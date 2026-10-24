#!/usr/bin/env python3
"""Install or restore the optional VIP broker; never install application packages."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess

SOURCE=Path(__file__).resolve().parents[1]
STATE=Path('/var/lib/vip-software')
APP=Path('/opt/vip-software')
UNIT=Path('/etc/systemd/system/vip-software.service')
HOOK=Path('/etc/hestiacp/hooks/post_install.sh')
SOCKET=Path('/run/vip-software/control.sock')

def command(*args,check=True):
    return subprocess.run(list(map(str,args)),check=check,capture_output=True,text=True)

def active():
    if not SOCKET.exists():
        if command('systemctl','is-active','vip-software',check=False).returncode==0:
            raise ValueError('El servicio esta activo pero su socket no responde; revisar antes de instalar.')
        return
    with socket.socket(socket.AF_UNIX,socket.SOCK_STREAM) as client:
        client.settimeout(3);client.connect(str(SOCKET));client.sendall(b'{"action":"status","actor":"installer"}\n')
        data=json.loads(client.makefile('rb').readline(65537))
    if not data.get('ok') or data['data'].get('activeJob') or data['data'].get('stopping'):
        raise ValueError('Hay una operacion activa o el servicio se esta deteniendo; espera a que termine.')

def assets(root,web_user):
    endpoint=root/'web/vip/software/index.php'
    unit=f'''[Unit]
Description=VIP optional software manager (local Unix socket)
After=network.target

[Service]
Type=simple
User=root
UMask=0077
ExecStart=/usr/bin/python3 /opt/vip-software/software_agent.py --web-user {web_user} --hestia-root {root} --policy /opt/vip-software/software-policy.json
Restart=on-failure
RestartSec=5
TimeoutStopSec=infinity
KillMode=process

[Install]
WantedBy=multi-user.target
'''
    restore=f'''#!/bin/sh
set -eu
install -d -m 755 {endpoint.parent}
install -m 644 /opt/vip-software/software-endpoint.php {endpoint}
'''
    hook=HOOK.read_text() if HOOK.exists() else '#!/bin/bash\n'
    marker='# VIP optional software endpoint'
    if marker not in hook:hook+='\n'+marker+'\n/opt/vip-software/restore-endpoint.sh\n'
    return {
        APP/'software_agent.py':((SOURCE/'scripts/software_agent.py').read_bytes(),0o700),
        APP/'software-policy.json':((SOURCE/'src/admin/software-policy.json').read_bytes(),0o600),
        APP/'software-endpoint.php':((SOURCE/'src/admin/software-endpoint.php').read_bytes(),0o600),
        APP/'restore-endpoint.sh':(restore.encode(),0o700),
        endpoint:((SOURCE/'src/admin/software-endpoint.php').read_bytes(),0o644),
        UNIT:(unit.encode(),0o644),HOOK:(hook.encode(),0o750)}

def write(target,data,mode):
    target.parent.mkdir(parents=True,exist_ok=True)
    tmp=target.with_name(target.name+'.vip-install');tmp.write_bytes(data);tmp.chmod(mode);os.replace(tmp,target)

def restore(backup):
    backup=backup.resolve()
    if not backup.is_relative_to(STATE/'installer-backups'):raise ValueError('El respaldo debe pertenecer al instalador administrativo.')
    manifest=json.loads((backup/'manifest.json').read_text())
    root=Path(manifest['root'])
    allowed=set(assets(root,manifest['webUser']))
    if set(Path(x['path']) for x in manifest['files'])!=allowed:raise ValueError('Manifiesto de respaldo no valido.')
    for item in manifest['files']:
        target=Path(item['path'])
        if not target.is_file() or hashlib.sha256(target.read_bytes()).hexdigest()!=item['installed']:
            raise ValueError('Un archivo instalado cambio; revisar manualmente antes de revertir: '+str(target))
    active();command('systemctl','stop','vip-software',check=False)
    command('systemctl','disable','vip-software',check=False)
    for item in manifest['files']:
        target=Path(item['path'])
        if item['before'] is None:target.unlink(missing_ok=True)
        else:
            write(target,(backup/item['before']).read_bytes(),item['mode']);os.chown(target,item['uid'],item['gid'])
    command('systemctl','daemon-reload')
    if manifest['enabled']:command('systemctl','enable','vip-software')
    if manifest['active']:command('systemctl','start','vip-software')
    print('Archivos anteriores restaurados; historial y respaldos privados conservados.')

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--hestia-root',default='/usr/local/hestia')
    parser.add_argument('--web-user',default='hestiaweb')
    parser.add_argument('--dry-run',action='store_true')
    parser.add_argument('--restore',type=Path)
    args=parser.parse_args()
    root=Path(args.hestia_root).resolve()
    if not re.fullmatch(r'/[A-Za-z0-9_./-]+',str(root)) or not re.fullmatch(r'[a-z_][a-z0-9_-]{0,31}',args.web_user):parser.error('Ruta o usuario no compatible.')
    if os.name!='posix':parser.error('Este instalador requiere Linux; las pruebas unitarias del broker son portables.')
    if os.geteuid()!=0:parser.error('Ejecutar como root.')
    import pwd
    pwd.getpwnam(args.web_user)
    os.umask(0o077)
    if args.restore:
        if args.dry_run:parser.error('No combinar --restore con --dry-run.')
        restore(args.restore);return
    if not (root/'web/inc/main.php').is_file() or not (root/'bin/v-add-web-php').is_file():parser.error('No se encontro Hestia compatible.')
    version=(root/'conf/hestia.conf').read_text()
    if not re.search(r"^VERSION='1\.10\.5'",version,re.M):parser.error('Solo se ha revisado Hestia 1.10.5; comprobar compatibilidad antes de instalar en otra version.')
    source=assets(root,args.web_user)
    command(root/'php/bin/php','-l',SOURCE/'src/admin/software-endpoint.php')
    if args.dry_run:
        print('Compatible:',len(source),'archivos. Servicio y endpoint opcionales; sin instalar paquetes ni cambiar puertos.');return
    active()
    backup=STATE/'installer-backups'/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    backup.mkdir(parents=True,mode=0o700)
    STATE.chmod(0o700);APP.mkdir(mode=0o700,exist_ok=True);APP.chmod(0o700)
    manifest={'root':str(root),'webUser':args.web_user,'files':[],
              'enabled':command('systemctl','is-enabled','vip-software',check=False).returncode==0,
              'active':command('systemctl','is-active','vip-software',check=False).returncode==0}
    for index,(target,(data,mode)) in enumerate(source.items()):
        record={'path':str(target),'before':None,'installed':hashlib.sha256(data).hexdigest()}
        if target.exists():
            if target.is_symlink() or not target.is_file():raise ValueError('Destino no regular: '+str(target))
            stat=target.stat();record.update({'before':str(index),'mode':stat.st_mode&0o777,'uid':stat.st_uid,'gid':stat.st_gid});shutil.copy2(target,backup/str(index))
        manifest['files'].append(record)
    (backup/'manifest.json').write_text(json.dumps(manifest,indent=2))
    print('Respaldo del instalador:',backup,flush=True)
    command('systemctl','stop','vip-software',check=False)
    for directory in [root/'web/vip',root/'web/vip/software']:
        directory.mkdir(mode=0o755,exist_ok=True);directory.chmod(0o755)
    for target,(data,mode) in source.items():write(target,data,mode)
    command('systemctl','daemon-reload');command('systemctl','enable','--now','vip-software')
    command('systemctl','is-active','vip-software')
    print('Gestor instalado. Reversion: python3 scripts/install-software.py --restore',backup)

if __name__=='__main__':
    try:main()
    except (ValueError,OSError,subprocess.CalledProcessError) as error:raise SystemExit(str(error))
