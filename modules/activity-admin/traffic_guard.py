"""Optional web firewall manager; native Hestia commands and existing Fail2Ban."""
from collections import Counter
from contextlib import contextmanager
import fcntl
import ipaddress
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

STATE=Path('/var/lib/vip-activity-admin')
JAIL=Path('/etc/fail2ban/jail.d/vip-web-rate.local')
FILTER=Path('/etc/fail2ban/filter.d/vip-web-rate.conf')
ACTION=Path('/etc/fail2ban/action.d/vip-web-rate.conf')
CRON=Path('/etc/cron.d/vip-web-connections')
NATIVE=Path('/usr/local/hestia/data/firewall')
DEFAULT={'enabled':False,'count':500,'window':60,'ban':600,'exclude':[], 'connectionsEnabled':False,'connections':100}
CHAINS={'VIPWEB':'Exceso de solicitudes web','VIPCON':'Exceso de conexiones web','WEB':'Bloqueo web manual o regla web','SSH':'Protección de acceso SSH','MAIL':'Protección de correo','HESTIA':'Protección de acceso al panel','RECIDIVE':'Reincidencia detectada por Fail2Ban','DB':'Protección de base de datos','FTP':'Protección FTP'}
JAILS={'VIPWEB':['vip-web-rate'],'VIPCON':['vip-web-connections'],'SSH':['ssh-iptables'],'MAIL':['dovecot-iptables','exim-iptables'],'HESTIA':['hestia-iptables'],'RECIDIVE':['recidive'],'WEB':['phpmyadmin-auth']}

def command(args,timeout=20):
    result=subprocess.run(args,capture_output=True,text=True,timeout=timeout)
    if result.returncode:raise ValueError('No se pudo aplicar el cambio de firewall. Se conservó o recuperó la configuración anterior.')
    return result.stdout

@contextmanager
def locked():
    with (STATE/'guard.lock').open('a') as stream:
        fcntl.flock(stream,fcntl.LOCK_EX)
        yield

def settings():
    path=STATE/'traffic-guard.json'
    config={**DEFAULT,**(json.loads(path.read_text()) if path.exists() else {})}
    config['exclude']=sorted({canonical(value) for value in config['exclude']})
    return config

def canonical(value):
    net=ipaddress.ip_network(value,strict=False)
    return str(net.network_address) if net.prefixlen==net.max_prefixlen else str(net)

def validate(raw,viewer):
    if not isinstance(raw,dict) or set(raw)!=set(DEFAULT):raise ValueError('Configuración no válida')
    if any(type(raw[k]) is not bool for k in ['enabled','connectionsEnabled']):raise ValueError('Estado no válido')
    for name,low,high in [('count',100,100000),('window',10,3600),('ban',60,86400),('connections',20,10000)]:
        if type(raw[name]) is not int or not low<=raw[name]<=high:raise ValueError('Umbral o duración fuera de rango')
    if not isinstance(raw['exclude'],list) or len(raw['exclude'])>64:raise ValueError('Máximo 64 exclusiones')
    exclude=[]
    for value in raw['exclude']:
        if not isinstance(value,str):raise ValueError('Exclusión no válida')
        net=ipaddress.ip_network(value,strict=False)
        if net.prefixlen==0:raise ValueError('No se permite excluir toda Internet')
        exclude.append(canonical(value))
    try:exclude.append(str(ipaddress.ip_address(viewer)))
    except ValueError:pass
    return {**raw,'exclude':sorted(set(exclude))}

def protected(viewer,config=None):
    values=['127.0.0.0/8','::1']+(config or settings())['exclude']
    if viewer:values.append(viewer)
    for p in Path('/usr/local/hestia/data/ips').glob('*'):
        try:values.append(str(ipaddress.ip_address(p.name)))
        except ValueError:pass
    # Preserve native exclusions, without treating them as editable module settings.
    p=NATIVE/'excludes.conf'
    if p.exists():
        for line in p.read_text().splitlines():
            try:values.append(str(ipaddress.ip_network(line.strip(),strict=False)))
            except ValueError:pass
    return list(set(values))

def excluded(ip,values):
    addr=ipaddress.ip_address(ip)
    return any(addr in ipaddress.ip_network(net,strict=False) for net in values)

def bans():
    p=NATIVE/'banlist.conf';rows=[]
    if not p.exists():return rows
    for line in p.read_text().splitlines()[:5000]:
        row=dict(re.findall(r"([A-Z]+)='([^']*)'",line))
        if not {'IP','CHAIN','DATE','TIME'}<=set(row):continue
        rows.append({'ip':row['IP'],'chain':row['CHAIN'],'date':row['DATE']+' '+row['TIME'],'reason':CHAINS.get(row['CHAIN'],'Regla del firewall: '+row['CHAIN'])})
    return rows

def records():
    p=STATE/'firewall-events.jsonl'
    if not p.exists():return []
    with p.open('rb') as f:
        f.seek(max(0,p.stat().st_size-262144));raw=f.read().decode(errors='replace')
    rows=[]
    for line in raw.splitlines()[-300:]:
        try:rows.append(json.loads(line))
        except ValueError:pass
    return rows

def event(actor,operation,ip,reason='',chain='WEB'):
    p=STATE/'firewall-events.jsonl'
    with p.open('a') as stream:stream.write(json.dumps({'time':int(time.time()),'actor':actor,'operation':operation,'ip':ip,'reason':reason,'chain':chain},ensure_ascii=False)+'\n')
    p.chmod(0o600)

def status(viewer):
    config=settings();rows=bans();history=records();manual={}
    for e in history:
        key=(e['ip'],e['chain'])
        if e['operation']=='black_add':manual[key]=e
        elif e['operation']=='unban':manual.pop(key,None)
    for row in rows:
        own=manual.get((row['ip'],row['chain']))
        if own:row.update(reason=own['reason'],actor=own['actor'])
        row['automatic']=row['chain'] in {'VIPWEB','VIPCON'}
    running={}
    for name in ['vip-web-rate','vip-web-connections']:
        p=subprocess.run(['fail2ban-client','status',name],capture_output=True,text=True,timeout=4)
        running[name]=p.returncode==0
    return {'settings':config,'running':running['vip-web-rate'],'connectionsRunning':running['vip-web-connections'],'viewerIP':viewer,'bans':rows,'history':history[-100:][::-1],'protected':protected(viewer,config)}

def save(raw,viewer):
    config=validate(json.loads(raw),viewer)
    with locked():return apply(config,viewer)

def apply(config,viewer):
    ignore=' '.join(sorted(protected(viewer,config)))
    contents={}
    for name,chain,enabled,filtertext,logpath,retry,window in [
        ('vip-web-rate','VIPWEB',config['enabled'],r'^<IP4> \S+ \S+ \[[^]]*\] "(?:GET|POST|HEAD|PUT|PATCH|DELETE|OPTIONS) [^"]+" \d{3} ','/var/log/apache2/domains/*.log',config['count'],config['window']),
        ('vip-web-connections','VIPCON',config['connectionsEnabled'],r'^\s*Connection limit <IP4> connections=\d+ limit=\d+$',str(STATE/'connection-events.log'),1,120)]:
        contents[Path('/etc/fail2ban/filter.d')/(name+'.conf')]='[Definition]\nfailregex = '+filtertext+'\nignoreregex =\n'
        contents[Path('/etc/fail2ban/action.d')/(name+'.conf')]=f'''[Definition]
actionstart = /usr/bin/flock -w 30 /run/hestia-firewall.lock /usr/local/hestia/bin/v-add-firewall-chain {chain} 80,443 TCP
actionstop = /usr/bin/flock -w 30 /run/hestia-firewall.lock /usr/local/hestia/bin/v-delete-firewall-chain {chain}
actioncheck = /usr/sbin/iptables -n -L INPUT | grep -q 'fail2ban-{chain}[ \\t]'
actionban = /usr/bin/flock -w 30 /run/hestia-firewall.lock /usr/local/hestia/bin/v-add-firewall-ban <ip> {chain}
actionunban = /usr/bin/flock -w 30 /run/hestia-firewall.lock /usr/bin/env HESTIA_F2B_CALLER=1 /usr/local/hestia/bin/v-delete-firewall-ban <ip> {chain}
'''
        contents[Path('/etc/fail2ban/jail.d')/(name+'.local')]=f'''[{name}]
enabled = {'true' if enabled else 'false'}
filter = {name}
backend = polling
logpath = {logpath}
findtime = {window}
maxretry = {retry}
bantime = {config['ban']}
ignoreip = {ignore}
action = {name}
'''
    contents[CRON]='* * * * * root /usr/bin/flock -n /run/vip-web-connections.lock /usr/bin/python3 /usr/local/lib/virtualia-activity-admin/traffic_guard.py --scan\n' if config['connectionsEnabled'] else None
    previous={p:p.read_bytes() if p.exists() else None for p in contents}
    backup=STATE/'guard-backups'/str(time.time_ns());backup.mkdir(parents=True,mode=0o700)
    for n,(p,value) in enumerate(previous.items()):
        if value is not None:(backup/str(n)).write_bytes(value)
    log=STATE/'connection-events.log';log.touch(mode=0o600,exist_ok=True)
    try:
        for p,value in contents.items():
            if value is None:p.unlink(missing_ok=True)
            else:p.write_text(value);p.chmod(0o644)
        command(['fail2ban-client','-t']);command(['fail2ban-client','reload'])
    except Exception:
        for p,value in previous.items():
            if value is None:p.unlink(missing_ok=True)
            else:p.write_bytes(value)
        subprocess.run(['fail2ban-client','reload'],capture_output=True,timeout=20)
        raise
    p=STATE/'traffic-guard.json';p.write_text(json.dumps(config));p.chmod(0o600)
    # Reloading ignoreip does not remove old bans: explicitly clear only our automatic chains.
    for row in bans():
        if row['chain'] in {'VIPWEB','VIPCON'} and excluded(row['ip'],ignore.split()):
            for jail in JAILS[row['chain']]:command(['fail2ban-client','set',jail,'unbanip',row['ip']])
    return status(viewer)

def native(name,*args):
    return command(['/usr/bin/flock','-w','15','/run/hestia-firewall.lock','/usr/local/hestia/bin/'+name,*args])

def mutate(raw,viewer,actor):
    data=json.loads(raw)
    if not isinstance(data,dict) or set(data)-{'operation','target','reason','chain'}:raise ValueError('Operación no válida')
    op=data.get('operation');target=data.get('target');reason=data.get('reason','');chain=data.get('chain','WEB')
    if op not in {'black_add','unban','white_add','white_remove'}:raise ValueError('Operación no permitida')
    if not isinstance(target,str) or not isinstance(reason,str) or len(reason)>200 or any(ord(c)<32 for c in reason):raise ValueError('IP o motivo no válido')
    reason=reason.strip()
    net=ipaddress.ip_network(target,strict=False)
    if net.version!=4 or net.prefixlen==0:raise ValueError('Esta gestión de firewall admite IPv4; no se admite toda Internet')
    target=str(net.network_address) if net.prefixlen==32 else str(net)
    if op in {'black_add','unban'} and net.prefixlen!=32:raise ValueError('Indica una sola IPv4')
    with locked():
        config=settings()
        if op=='black_add':
            if not reason:raise ValueError('Escribe el motivo del bloqueo')
            if excluded(target,protected(viewer,config)):raise ValueError('IP protegida o en lista blanca. No se bloqueará tu acceso.')
            if any(r['ip']==target and r['chain']=='WEB' for r in bans()):raise ValueError('La IP ya tiene un bloqueo WEB')
            native('v-add-firewall-ban',target,'WEB')
            if not any(r['ip']==target and r['chain']=='WEB' for r in bans()):raise ValueError('El firewall no aplicó el bloqueo')
            chain='WEB'
        elif op=='unban':
            if not any(r['ip']==target and r['chain']==chain for r in bans()):raise ValueError('El bloqueo ya no existe')
            if chain not in JAILS:raise ValueError('Usa la gestión nativa para esta cadena')
            live=command(['fail2ban-client','status'])
            for jail in JAILS[chain]:
                if re.search(r'(?<![\w-])'+re.escape(jail)+r'(?![\w-])',live):command(['fail2ban-client','set',jail,'unbanip',target])
            if any(r['ip']==target and r['chain']==chain for r in bans()):native('v-delete-firewall-ban',target,chain)
        else:
            if op=='white_add':
                if not reason:raise ValueError('Escribe el motivo de la exclusión')
                # Refuse an ambiguous promise when another security service is blocking this address.
                if any(ipaddress.ip_network(r['ip'],strict=False).overlaps(net) and r['chain'] not in {'WEB','VIPWEB','VIPCON'} for r in bans()):raise ValueError('Hay un bloqueo de otro servicio en esta red. Revísalo y desbloquéalo antes de añadir la exclusión web.')
                if any(r['chain']=='WEB' and ipaddress.ip_network(r['ip'],strict=False).overlaps(net) and not ipaddress.ip_network(r['ip'],strict=False).subnet_of(net) for r in bans()):raise ValueError('Una red WEB bloqueada más amplia cubre esta excepción. Revisa ese bloqueo antes de continuar.')
                config['exclude']=sorted(set(config['exclude']+[target]))
            else:
                config['exclude']=[v for v in config['exclude'] if ipaddress.ip_network(v,strict=False)!=net]
                if viewer and excluded(viewer,[target]):raise ValueError('Tu IP actual permanece protegida durante esta sesión')
            config=validate(config,viewer);apply(config,viewer)
            if op=='white_add':
                for row in bans():
                    if row['chain']=='WEB' and ipaddress.ip_network(row['ip'],strict=False).subnet_of(net):native('v-delete-firewall-ban',row['ip'],'WEB')
        event(actor,op,target,reason,chain)
    return status(viewer)

def scan():
    config=settings()
    if not config['connectionsEnabled']:return
    with locked():
        config=settings()
        if not config['connectionsEnabled']:return
        counts=Counter()
        for line in command(['/usr/bin/ss','-Hnt','state','established']).splitlines():
            parts=line.split()
            if len(parts)<4:continue
            local,remote=parts[-2:]
            if local.rsplit(':',1)[-1] not in {'80','443'}:continue
            ip=remote.rsplit(':',1)[0].strip('[]')
            try:
                addr=ipaddress.ip_address(ip)
                if addr.version==4:counts[str(addr)]+=1
            except ValueError:continue
        values=protected('',config);path=STATE/'connection-events.log'
        if path.exists() and path.stat().st_size>2_000_000:path.replace(path.with_suffix('.previous'))
        with path.open('a') as stream:
            for ip,count in counts.items():
                if count>config['connections'] and not excluded(ip,values):
                    stream.write(time.strftime('%Y-%m-%d %H:%M:%S')+f' Connection limit {ip} connections={count} limit={config["connections"]}\n')
                    event('automatic','connection_limit',ip,f'{count} conexiones establecidas; límite {config["connections"]}','VIPCON')
        path.chmod(0o600)

if __name__=='__main__':
    if os.geteuid()!=0 or sys.argv[1:]!=['--scan']:raise SystemExit('Root --scan required')
    scan()
