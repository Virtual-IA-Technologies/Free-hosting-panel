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
    'dist/files.min.js': 'web/js/virtualia/files.min.js',
    'dist/login.min.js': 'web/js/virtualia/login.min.js',
    'src/php/virtualia-navigation.php': 'web/js/custom_scripts/virtualia-navigation.php',
}


def atomic_copy(source, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.parent.chmod(0o755)
    temporary = destination.with_name(destination.name + '.vip-install')
    shutil.copyfile(source, temporary)
    temporary.chmod(0o644)
    os.replace(temporary, destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--hestia-root', default='/usr/local/hestia')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--apply-to-existing-users', action='store_true')
    args = parser.parse_args()
    root = Path(args.hestia_root).resolve()
    if not root.is_dir() or not (root/'web/templates/includes/js.php').is_file():
        parser.error('No se encontró HestiaCP.')
    if 'custom_scripts' not in (root/'web/templates/includes/js.php').read_text():
        parser.error('La versión de Hestia no dispone del cargador requerido.')
    for relative in MAPPING:
        if not (SOURCE/relative).is_file():
            parser.error('Falta recurso: '+relative)
    if args.dry_run:
        print('Compatible. Se instalarán', len(MAPPING), 'recursos; sin cambios de cuentas, DNS o bases de datos.')
        return
    if os.geteuid() != 0:
        parser.error('Ejecutar como root.')
    state = Path('/opt/virtual-ia-panel')
    state.mkdir(mode=0o700, exist_ok=True)
    backup = state/'backups'/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    backup.mkdir(parents=True, mode=0o700)
    hook = Path('/etc/hestiacp/hooks/post_install.sh')
    restore=state/'restore-assets.sh'
    paths = [root/value for value in MAPPING.values()] + [root/'web/images/logo.svg',root/'web/images/logo-header.svg',hook,restore]
    config = (root/'conf/hestia.conf').read_text()
    previous = {key: match.group(1) for key in ['APP_NAME','TITLE','THEME'] if (match:=re.search(r"^"+key+r"='(.*)'$",config,re.M))}
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
    for relative,target in MAPPING.items():
        atomic_copy(SOURCE/relative,root/target)
    def cli(*values):
        subprocess.run([str(root/'bin'/values[0]),*values[1:]],check=True)
    cli('v-update-white-label-logo','no')
    for key,value in [('APP_NAME','Virtual IA Panel'),('TITLE','{{page}} - Virtual IA Panel'),('THEME','virtualia')]:
        cli('v-change-sys-config-value',key,value)
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
    digests={key:hashlib.sha256((SOURCE/key).read_bytes()).hexdigest() for key in MAPPING}
    (backup/'installed-sha256.json').write_text(json.dumps(digests,indent=2))
    print('Virtual IA Panel instalado. Reversión: python3 scripts/uninstall.py',backup)


if __name__ == '__main__':
    main()
