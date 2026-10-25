#!/usr/bin/env python3
"""Install only panel assets. Never provision accounts or migrate customer data."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
from filemanager import build_assets
from nativeforms import build_assets as native_form_assets
from datetime import datetime, timezone

SOURCE = Path(__file__).resolve().parents[1]
MAPPING = {
    'src/images/logo.svg': 'web/images/custom/logo.svg',
    'src/images/logo-header.svg': 'web/images/custom/logo-header.svg',
    'src/images/logo-header-light.svg': 'web/images/custom/logo-header-light.svg',
    'dist/virtualia.min.css': 'web/css/themes/custom/virtualia.css',
    'dist/panel.min.css': 'web/css/virtualia/panel.min.css',
    'dist/login.min.css': 'web/css/virtualia/login.min.css',
    'dist/panel.min.js': 'web/js/virtualia/panel.min.js',
    'dist/backups.min.js': 'web/js/virtualia/backups.min.js',
    'dist/activity.min.js': 'web/js/virtualia/activity.min.js',
    'dist/software.min.js': 'web/js/virtualia/software.min.js',
    'dist/files.min.js': 'web/js/virtualia/files.min.js',
    'dist/login.min.js': 'web/js/virtualia/login.min.js',
    'src/php/virtualia-navigation.php': 'web/js/custom_scripts/virtualia-navigation.php',
}


def atomic_copy(data, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.parent.chmod(0o755)
    temporary = destination.with_name(destination.name + '.vip-install')
    temporary.write_bytes(data)
    temporary.chmod(0o644)
    os.replace(temporary, destination)


def prepare_assets(root, app_name, default_theme, integrated_files, login_theme='graphite', phpmyadmin_port=0, account_port=0, webmail_port=0):
    assets={target:(SOURCE/relative).read_bytes() for relative,target in MAPPING.items()}
    assets.update(native_form_assets(root))
    if integrated_files:
        assets.update(build_assets(root))
    settings={'appName':app_name,'defaultTheme':default_theme,'integratedFiles':integrated_files,'loginTheme':login_theme,'phpmyadminPort':phpmyadmin_port,'accountPort':account_port,'webmailPort':webmail_port}
    fingerprint=hashlib.sha256(json.dumps(settings,sort_keys=True).encode())
    for target,data in sorted(assets.items()):
        fingerprint.update(target.encode()+b'\0'+hashlib.sha256(data).digest())
    settings['assetVersion']=fingerprint.hexdigest()[:16]
    assets['web/js/virtualia/config.json']=json.dumps(settings,ensure_ascii=False).encode()
    return assets,settings


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--hestia-root', default='/usr/local/hestia')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--apply-to-existing-users', action='store_true')
    parser.add_argument('--app-name', default='VIP - Virtual IA Panel', help='Nombre mostrado en el título del panel')
    parser.add_argument('--default-theme', choices=['night','graphite','medium','light'], default='night')
    parser.add_argument('--without-file-manager', action='store_true', help='Conservar el acceso al gestor nativo sin integración')
    parser.add_argument('--login-theme', choices=['night','graphite','medium','light'], default='graphite')
    parser.add_argument('--login-style', choices=['single','steps','preserve'], default='single')
    parser.add_argument('--phpmyadmin-port', type=int, default=0, help='Enlazar un servicio existente por puerto; 0 conserva el enlace nativo')
    parser.add_argument('--account-port', type=int, default=0, help='Enlazar un puerto nativo adicional de cuentas; no lo abre')
    parser.add_argument('--webmail-port', type=int, default=0, help='Enlazar un servicio webmail existente; no lo abre')
    args = parser.parse_args()
    ports=[args.phpmyadmin_port,args.account_port,args.webmail_port]
    if any(not 0 <= port <= 65535 for port in ports) or len([p for p in ports if p])!=len(set(p for p in ports if p)):
        parser.error('Puertos no válidos o duplicados.')
    if not re.fullmatch(r'[\w .()&+\-]{1,80}',args.app_name) or not args.app_name.strip():
        parser.error('El nombre admite letras, números, espacios y . () & + -, hasta 80 caracteres.')
    root = Path(args.hestia_root).resolve()
    if not root.is_dir() or not (root/'web/templates/includes/js.php').is_file():
        parser.error('No se encontró HestiaCP.')
    if 'custom_scripts' not in (root/'web/templates/includes/js.php').read_text():
        parser.error('La versión de Hestia no dispone del cargador requerido.')
    for relative in MAPPING:
        if not (SOURCE/relative).is_file():
            parser.error('Falta recurso: '+relative)
    try:
        assets,settings=prepare_assets(root,args.app_name.strip(),args.default_theme,not args.without_file_manager,args.login_theme,args.phpmyadmin_port,args.account_port,args.webmail_port)
    except (OSError,ValueError) as error:
        parser.error(str(error))
    if args.dry_run:
        print('Compatible. Se instalarán', len(assets), 'recursos; sin cambios de cuentas, DNS o bases de datos.')
        return
    if os.geteuid() != 0:
        parser.error('Ejecutar como root.')
    state = Path('/opt/virtual-ia-panel')
    state.mkdir(mode=0o700, exist_ok=True)
    backup = state/'backups'/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    backup.mkdir(parents=True, mode=0o700)
    hook = Path('/etc/hestiacp/hooks/post_install.sh')
    restore=state/'restore-assets.sh'
    paths = [root/value for value in assets] + [root/'web/images/logo.svg',root/'web/images/logo-header.svg',hook,restore]
    config = (root/'conf/hestia.conf').read_text()
    previous = {key: match.group(1) for key in ['APP_NAME','TITLE','THEME','LOGIN_STYLE'] if (match:=re.search(r"^"+key+r"='(.*)'$",config,re.M))}
    manifest = {'root':str(root),'files':[],'previousConfig':previous,'previousThemes':{}}
    if args.apply_to_existing_users:
        for user in (root/'data/users').iterdir():
            conf = user/'user.conf'
            if conf.is_file() and (match:=re.search(r"^THEME='(.*)'$",conf.read_text(),re.M)):
                manifest['previousThemes'][user.name] = match.group(1)
    for i, destination in enumerate(paths):
        record={'path':str(destination),'before':None}
        if destination.is_file():
            name=f'file-{i}'
            shutil.copy2(destination,backup/name)
            record['before']=name
        manifest['files'].append(record)
    (backup/'manifest.json').write_text(json.dumps(manifest,indent=2))
    print('Respaldo:',backup,flush=True)
    for target,data in assets.items():
        atomic_copy(data,root/target)
    def cli(*values):
        subprocess.run([str(root/'bin'/values[0]),*values[1:]],check=True)
    cli('v-update-white-label-logo','no')
    for key,value in [('APP_NAME',settings['appName']),('TITLE','{{page}} - '+settings['appName']),('THEME','virtualia')]:
        cli('v-change-sys-config-value',key,value)
    if args.login_style != 'preserve':
        cli('v-change-sys-config-value','LOGIN_STYLE','old' if args.login_style=='single' else 'default')
    for user in manifest['previousThemes']:
        cli('v-change-user-theme',user,'virtualia')
    # A private asset snapshot permits restoring after an upstream package update.
    installed = backup/'installed'
    for destination in paths:
        if not destination.is_relative_to(root):
            continue
        target=installed/destination.relative_to(root)
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(destination,target)
    import shlex
    restore.write_text('#!/bin/sh\nset -eu\ncp -a '+shlex.quote(str(installed))+'/. '+shlex.quote(str(root))+'/\n')
    restore.chmod(0o700)
    text=hook.read_text() if hook.exists() else '#!/bin/bash\n'
    if '# Virtual IA Panel assets' not in text:
        text+='\n# Virtual IA Panel assets\n/opt/virtual-ia-panel/restore-assets.sh\n'
    hook.parent.mkdir(parents=True,exist_ok=True)
    hook.write_text(text);hook.chmod(0o750)
    digests={key:hashlib.sha256(data).hexdigest() for key,data in assets.items()}
    (backup/'installed-sha256.json').write_text(json.dumps(digests,indent=2))
    print('Virtual IA Panel instalado. Reversión: python3 scripts/uninstall.py',backup)


if __name__ == '__main__':
    main()
