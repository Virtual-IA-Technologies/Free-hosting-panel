#!/usr/bin/env python3
"""Reversible Roundcube presentation plugin; no authentication or mailbox changes."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess

SOURCE=Path(__file__).resolve().parents[1]
BACKUPS=Path('/opt/virtual-ia-panel/webmail-theme-backups')

def write(path,data,mode=0o644):
    path.parent.mkdir(parents=True,exist_ok=True,mode=0o755)
    tmp=path.with_name(path.name+'.vip-install');tmp.write_bytes(data);tmp.chmod(mode);os.replace(tmp,path)

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--roundcube-root',type=Path,default=Path('/var/lib/roundcube'))
    p.add_argument('--config',type=Path,default=Path('/etc/roundcube/config.inc.php'))
    p.add_argument('--php',default='/usr/local/hestia/php/bin/php')
    p.add_argument('--dry-run',action='store_true')
    p.add_argument('--restore',type=Path)
    args=p.parse_args()
    if os.name!='posix' or os.geteuid()!=0:p.error('Ejecutar como root en Linux.')
    os.umask(0o077)
    if args.restore:
        backup=args.restore.resolve()
        if not backup.is_relative_to(BACKUPS):p.error('Respaldo ajeno al instalador.')
        manifest=json.loads((backup/'manifest.json').read_text())
        for item in manifest['files']:
            target=Path(item['path'])
            if not target.is_file() or hashlib.sha256(target.read_bytes()).hexdigest()!=item['installed']:p.error('Un archivo cambio; revisar antes de restaurar.')
        for item in manifest['files']:
            target=Path(item['path'])
            if item['before'] is None:target.unlink()
            else:
                write(target,(backup/item['before']).read_bytes(),item['mode']);os.chown(target,item['uid'],item['gid'])
        print('Presentacion anterior restaurada; buzones intactos.');return
    root=args.roundcube_root.resolve();config=args.config.resolve()
    if not (root/'public_html/static.php').is_file() or not (root/'plugins').is_dir() or not config.is_file():p.error('Se requiere Roundcube con controlador static.php y configuracion nativa.')
    plugin=root/'plugins/vip_theme'
    text=config.read_text();marker='// VIP webmail presentation'
    if marker not in text:
        if text.rstrip().endswith('?>'):p.error('Revisar configuracion con cierre PHP antes de anadir plugin.')
        text+='\n'+marker+"\n$config['plugins'] = array_values(array_unique(array_merge((array) ($config['plugins'] ?? []), ['vip_theme'])));\n"
    assets={plugin/'vip_theme.php':(SOURCE/'src/webmail/vip_theme.php').read_bytes(),plugin/'vip.css':(SOURCE/'src/webmail/vip.css').read_bytes(),plugin/'logo.svg':(SOURCE/'src/images/logo-header.svg').read_bytes(),config:text.encode()}
    subprocess.run([args.php,'-l',str(SOURCE/'src/webmail/vip_theme.php')],check=True,capture_output=True)
    if args.dry_run:print('Compatible: plugin, estilos, logo y activacion nativa; sin cambios de buzones.');return
    backup=BACKUPS/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ');backup.mkdir(parents=True,mode=0o700)
    manifest={'files':[]}
    for index,(target,data) in enumerate(assets.items()):
        item={'path':str(target),'before':None,'installed':hashlib.sha256(data).hexdigest()}
        if target.exists():
            stat=target.stat();item.update({'before':str(index),'mode':stat.st_mode&0o777,'uid':stat.st_uid,'gid':stat.st_gid});shutil.copy2(target,backup/str(index))
        manifest['files'].append(item)
    (backup/'manifest.json').write_text(json.dumps(manifest,indent=2))
    print('Respaldo privado:',backup,flush=True)
    try:
        plugin.mkdir(mode=0o755,exist_ok=True);plugin.chmod(0o755)
        for target,data in assets.items():
            mode=next((item.get('mode',0o644) for item in manifest['files'] if item['path']==str(target)),0o644)
            write(target,data,mode)
            previous=next(item for item in manifest['files'] if item['path']==str(target))
            if previous['before'] is not None:os.chown(target,previous['uid'],previous['gid'])
        subprocess.run([args.php,'-l',str(config)],check=True,capture_output=True)
    except Exception:
        for item in manifest['files']:
            target=Path(item['path'])
            if item['before'] is None:target.unlink(missing_ok=True)
            else:write(target,(backup/item['before']).read_bytes(),item['mode']);os.chown(target,item['uid'],item['gid'])
        raise
    print('Estilo webmail instalado; sesion y autenticacion nativas. Reversion: --restore',backup)

if __name__=='__main__':main()
