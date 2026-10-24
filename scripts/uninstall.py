#!/usr/bin/env python3
"""Revert only files and preferences recorded by one Virtual IA Panel installation."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('backup')
args=parser.parse_args()
backup=Path(args.backup).resolve()
if os.geteuid()!=0:
    parser.error('Ejecutar como root.')
if not backup.is_relative_to(Path('/opt/virtual-ia-panel/backups')):
    parser.error('Respaldo fuera del directorio esperado.')
manifest=json.loads((backup/'manifest.json').read_text())
root=Path(manifest['root']).resolve()
for record in manifest['files']:
    target=Path(record['path']).resolve()
    if not target.is_relative_to(root) and target not in [Path('/etc/hestiacp/hooks/post_install.sh'),Path('/opt/virtual-ia-panel/restore-assets.sh')]:
        parser.error('Ruta de reversión no válida.')
    if record['before']:
        source=(backup/record['before']).resolve()
        if source.parent!=backup:
            parser.error('Archivo de respaldo no válido.')
        shutil.copy2(source,target)
    elif target.is_file():
        target.unlink()
for key,value in manifest['previousConfig'].items():
    subprocess.run([str(root/'bin/v-change-sys-config-value'),key,value],check=True)
for user,theme in manifest['previousThemes'].items():
    subprocess.run([str(root/'bin/v-change-user-theme'),user,theme],check=True)
print('Instalación revertida; cuentas y datos conservados.')
