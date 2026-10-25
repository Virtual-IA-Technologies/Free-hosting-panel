#!/usr/bin/python3
"""On-demand server activity. Only signed, current hosting PHP workers can be terminated."""
import base64
from collections import Counter
import hashlib
import hmac
import ipaddress
import importlib.util
import json
import os
from pathlib import Path
import pwd
import re
import secrets
import signal
import stat
import subprocess
import sys
import time
from urllib.parse import urlsplit

STATE = Path('/var/lib/vip-activity-admin')
USERS = Path('/usr/local/hestia/data/users')
PROC = Path('/proc')
USER = re.compile(r'[A-Za-z0-9][A-Za-z0-9_-]{0,31}')


def role(actor):
    if not isinstance(actor, str) or not USER.fullmatch(actor):
        raise ValueError('Administrador no válido')
    text = (USERS / actor / 'user.conf').read_text()
    if not re.search(r"^ROLE=['\"]?admin['\"]?$", text, re.M) or re.search(r"^SUSPENDED=['\"]?yes['\"]?$", text, re.M):
        raise ValueError('Se requiere administrador activo')


def command(args, timeout=3):
    result = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if result.returncode:
        raise ValueError('No se pudo consultar este recurso')
    return result.stdout


def accounts():
    result = {}
    for path in sorted(USERS.glob('*/user.conf'))[:256]:
        name = path.parent.name
        if not USER.fullmatch(name):
            continue
        text = path.read_text()
        if re.search(r"^ROLE=['\"]?admin['\"]?$", text, re.M):
            continue
        try:
            result[pwd.getpwnam(name).pw_uid] = name
        except KeyError:
            pass
    return result


def connections():
    peers = Counter()
    raw = command(['/usr/bin/ss', '-Hnt', 'state', 'established'])
    for line in raw.splitlines()[:20000]:
        parts = line.split()
        if len(parts) < 4:
            continue
        local, peer = parts[-2:]
        if local.rpartition(':')[2] not in {'80', '443'}:
            continue
        address = peer.rpartition(':')[0].strip('[]')
        try:
            address = str(ipaddress.ip_address(address))
        except ValueError:
            continue
        peers[address] += 1
    return {'webConnections': sum(peers.values()), 'uniqueIPs': len(peers),
            'peers': [{'ip': ip, 'connections': n} for ip, n in peers.most_common(100)],
            'truncated': len(peers) > 100}


def read_process(pid, owners):
    path = PROC / str(pid)
    try:
        raw = (path / 'stat').read_text()
        tail = raw.rsplit(')', 1)[1].split()
        uid = path.stat().st_uid
        comm = (path / 'comm').read_text().strip()[:60]
        cmd = (path / 'cmdline').read_bytes()[:1024].replace(b'\0', b' ').decode(errors='replace').strip()
        pool = re.fullmatch(r'php-fpm: pool ([A-Za-z0-9_.-]{1,253})', cmd)
        executable = os.readlink(path / 'exe')
        eligible = uid in owners and bool(pool) and bool(re.fullmatch(r'/usr/sbin/php-fpm[0-9.]+', executable))
        try:
            user = owners.get(uid) or pwd.getpwuid(uid).pw_name
        except KeyError:
            user = str(uid)
        return {'pid': int(pid), 'uid': uid, 'owner': user, 'name': comm,
                'pool': pool[1] if pool else '', 'state': tail[0], 'parent': int(tail[1]),
                'ticks': int(tail[11]) + int(tail[12]), 'start': int(tail[19]),
                'rssBytes': int(tail[21]) * os.sysconf('SC_PAGE_SIZE'),
                'eligible': eligible, 'executable': executable}
    except (OSError, ValueError, IndexError):
        return None


def secret():
    return (STATE / 'signing.key').read_bytes()


def sign(payload):
    raw = json.dumps(payload, separators=(',', ':'), sort_keys=True).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip('=') + '.' + hmac.new(secret(), raw, hashlib.sha256).hexdigest()


def verify(ticket, actor):
    if not isinstance(ticket, str) or len(ticket) > 2048:
        raise ValueError('Acción no válida')
    try:
        encoded, mac = ticket.split('.')
        raw = base64.b64decode(encoded + '=' * (-len(encoded) % 4), altchars=b'-_', validate=True)
        if not hmac.compare_digest(hmac.new(secret(), raw, hashlib.sha256).hexdigest(), mac):
            raise ValueError()
        value = json.loads(raw)
        if value['actor'] != actor or value['expires'] < time.time() or value['expires'] > time.time() + 91:
            raise ValueError()
        if value['boot'] != (PROC / 'sys/kernel/random/boot_id').read_text().strip():
            raise ValueError()
        return value
    except (ValueError, KeyError, TypeError):
        raise ValueError('La selección venció o cambió. Actualiza la actividad.') from None


def fingerprint(process):
    return {k: process[k] for k in ['pid', 'uid', 'start', 'pool', 'executable']}


def active_request(process):
    if not process['eligible']:
        return None
    owner = process['owner']
    descriptor = os.open('/', os.O_RDONLY | os.O_DIRECTORY)
    try:
        for component in ['home', owner, 'tmp', 'vip-activity-live']:
            child = os.open(component, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=descriptor)
            os.close(descriptor)
            descriptor = child
        leaf = os.open(str(process['pid']) + '.json', os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=descriptor)
        with os.fdopen(leaf, 'rb') as stream:
            info = os.fstat(stream.fileno())
            if not stat.S_ISREG(info.st_mode) or info.st_uid != process['uid'] or info.st_size > 4096:
                return None
            value = json.loads(stream.read(4096))
        boot = next(int(l.split()[1]) for l in (PROC / 'stat').read_text().splitlines() if l.startswith('btime '))
        born = boot + process['start'] / os.sysconf('SC_CLK_TCK')
        started = float(value['started'])
        if value['pid'] != process['pid'] or started < born - 1 or started > time.time() + 1:
            return None
        ip = str(ipaddress.ip_address(value['ip']))
        path = urlsplit(str(value.get('path', '/'))).path[:220]
        path = re.sub(r'(?<=/)[A-Za-z0-9_-]{20,}(?=/|$)', '…', path)
        return {'ip': ip, 'path': path, 'method': str(value.get('method', ''))[:12],
                'seconds': round(max(0, time.time() - started), 1),
                'script': str(value.get('script', ''))[:300]}
    except (OSError, ValueError, TypeError, KeyError, StopIteration):
        return None
    finally:
        os.close(descriptor)


def audit(actor, action, data):
    with (STATE / 'audit.jsonl').open('a') as stream:
        stream.write(json.dumps({'time': int(time.time()), 'actor': actor, 'action': action, **data}) + '\n')


def terminate(actor, ticket, confirm):
    if confirm != 'FINALIZAR':
        raise ValueError('Confirma la finalización del proceso')
    selection = verify(ticket, actor)
    if not hasattr(os, 'pidfd_open') or not hasattr(signal, 'pidfd_send_signal'):
        raise ValueError('El sistema no admite finalización segura por identidad de proceso')
    descriptor = os.pidfd_open(int(selection['pid']))
    try:
        process = read_process(selection['pid'], accounts())
        if not process or not process['eligible'] or fingerprint(process) != selection['process']:
            raise ValueError('El proceso terminó o cambió. Actualiza la actividad.')
        audit(actor, 'terminate_intent', {'pid': process['pid'], 'owner': process['owner'], 'pool': process['pool']})
        signal.pidfd_send_signal(descriptor, signal.SIGTERM)
        audit(actor, 'terminate_sent', {'pid': process['pid'], 'signal': 'SIGTERM'})
        return {'message': 'Se solicitó finalizar el trabajador PHP. Actualiza para comprobar su estado.'}
    finally:
        os.close(descriptor)


def processes(actor):
    owners = accounts()
    pids = [p.name for p in PROC.iterdir() if p.name.isdigit()][:4096]
    first = {p: read_process(p, owners) for p in pids}
    start = time.monotonic()
    time.sleep(0.25)
    elapsed = time.monotonic() - start
    hz = os.sysconf('SC_CLK_TCK')
    uptime = float((PROC / 'uptime').read_text().split()[0])
    boot = (PROC / 'sys/kernel/random/boot_id').read_text().strip()
    rows = []
    for pid, previous in first.items():
        current = read_process(pid, owners)
        if not previous or not current or previous['start'] != current['start']:
            continue
        cpu = max(0, (current['ticks'] - previous['ticks']) / hz / elapsed * 100)
        row = {k: current[k] for k in ['pid', 'owner', 'name', 'pool', 'state', 'rssBytes']}
        row.update(cpuPercent=round(cpu, 1), ageSeconds=max(0, int(uptime - current['start'] / hz)), protected=not current['eligible'])
        if current['eligible']:
            row['request'] = active_request(current)
            row['ticket'] = sign({'actor': actor, 'expires': int(time.time()) + 90, 'boot': boot,
                                  'pid': current['pid'], 'process': fingerprint(current)})
        rows.append(row)
    rows.sort(key=lambda r: (r['cpuPercent'], r['rssBytes']), reverse=True)
    return {'items': rows[:100], 'total': len(rows), 'hostingPHP': sum(not r['protected'] for r in rows),
            'cpuScale': '100 % equivale a un núcleo; la suma puede superar 100 %', 'truncated': len(rows) > 100}


def sql_activity():
    # Never return SQL text, credentials or query literals. No SQL kill operation.
    query = "SELECT JSON_OBJECT('id',ID,'database',DB,'user',USER,'seconds',TIME,'command',COMMAND,'state',STATE) FROM information_schema.PROCESSLIST WHERE ID<>CONNECTION_ID() AND COMMAND<>'Sleep' ORDER BY TIME DESC LIMIT 50"
    try:
        raw = command(['/usr/bin/mariadb', '--raw', '-N', '-B', '-e', query], timeout=2)
        return {'available': True, 'items': [json.loads(line) for line in raw.splitlines()]}
    except (ValueError, OSError, subprocess.TimeoutExpired):
        return {'available': False, 'items': []}


def recent_requests():
    rows = []
    for owner in list(accounts().values())[:64]:
        config = USERS / owner / 'web.conf'
        if not config.exists():
            continue
        domains = re.findall(r"^DOMAIN='([A-Za-z0-9.-]+)'", config.read_text(), re.M)[:32]
        for domain in domains:
            path = Path('/var/log/nginx/domains') / (domain + '.log')
            apache = Path('/var/log/apache2/domains') / (domain + '.log')
            if apache.is_file():
                path = apache
            if not path.is_file():
                continue
            with path.open('rb') as stream:
                offset = max(0, path.stat().st_size - 32768)
                stream.seek(offset)
                if offset:
                    stream.readline()
                lines = stream.read(32768).decode(errors='replace').splitlines()[-8:]
            for line in reversed(lines):
                match = re.match(r'^(\S+) .*?\[([^]]+)\] "([A-Z]+) ([^ ]+) HTTP/[0-9.]+" (\d{3}) ', line)
                if not match:
                    continue
                try:
                    route = urlsplit(match[4]).path[:220]
                except ValueError:
                    continue
                route = re.sub(r'(?<=/)[A-Za-z0-9_-]{20,}(?=/|$)', '…', route)
                rows.append({'owner': owner, 'domain': domain, 'ip': match[1][:64], 'time': match[2],
                             'method': match[3], 'path': route, 'status': int(match[5])})
    return rows[:100]


def handle(request):
    if not isinstance(request, dict) or set(request) - {'actor', 'action', 'ticket', 'confirm', 'ip', 'policy'}:
        raise ValueError('Parámetros no permitidos')
    actor = request.get('actor')
    role(actor)
    action = request.get('action')
    if action in {'guard_status', 'guard_save', 'guard_mutate'}:
        spec = importlib.util.spec_from_file_location('traffic_guard', '/usr/local/lib/virtualia-activity-admin/traffic_guard.py')
        guard = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(guard)
        if action == 'guard_status':
            return guard.status(request.get('ip', ''))
        if action == 'guard_mutate':
            if request.get('confirm') != 'CAMBIAR':
                raise ValueError('Confirma el cambio de firewall')
            data = guard.mutate(request.get('policy', ''), request.get('ip', ''), actor)
            audit(actor, 'guard_mutate', {'policy': request.get('policy', '')})
            return data
        if request.get('confirm') != 'GUARDAR':
            raise ValueError('Confirma el cambio de protección web')
        data = guard.save(request.get('policy', ''), request.get('ip', ''))
        audit(actor, 'guard_save', {'enabled': data['settings']['enabled'], 'count': data['settings']['count']})
        return data
    if action == 'summary':
        data = connections()
        return {k: data[k] for k in ['webConnections', 'uniqueIPs']}
    if action == 'snapshot':
        network = connections()
        memory = {line.split(':')[0]: int(line.split(':')[1].split()[0]) for line in (PROC / 'meminfo').read_text().splitlines()}
        return {'generated': int(time.time()), 'connections': network, 'processes': processes(actor),
                'sql': sql_activity(), 'requests': recent_requests(), 'load': os.getloadavg(),
                'memoryUsedBytes': (memory['MemTotal'] - memory['MemAvailable']) * 1024,
                'memoryTotalBytes': memory['MemTotal'] * 1024, 'viewerIP': request.get('ip', '')}
    if action == 'terminate':
        return terminate(actor, request.get('ticket'), request.get('confirm'))
    raise ValueError('Acción no permitida')


if __name__ == '__main__':
    try:
        if os.geteuid() != 0:
            raise ValueError('Se requiere el helper nativo privilegiado')
        raw = sys.stdin.buffer.read(8193)
        if len(raw) > 8192:
            raise ValueError('Solicitud demasiado grande')
        result = handle(json.loads(raw))
        print(json.dumps({'ok': True, 'data': result}, ensure_ascii=False))
    except Exception as error:
        message = str(error) if isinstance(error, ValueError) else 'La actividad cambió o no está disponible. Actualiza e inténtalo otra vez.'
        print(json.dumps({'ok': False, 'error': message}, ensure_ascii=False))
        sys.exit(1)
