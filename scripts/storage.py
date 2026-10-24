#!/usr/bin/env python3
"""Manage storage providers through Rclone's native interactive authorization."""
import argparse
import json
import os
import re
import shutil
import subprocess


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    commands.add_parser('providers', help='List all storage providers supported by the installed Rclone')
    commands.add_parser('connect', help='Open native Rclone configuration, including provider authorization')
    commands.add_parser('list', help='List configured remote names, without credentials')
    test = commands.add_parser('test', help='Test read access to a configured remote; does not upload or delete data')
    test.add_argument('remote')
    args = parser.parse_args()
    executable = shutil.which('rclone')
    if not executable:
        parser.error('Rclone no está instalado en este servidor.')
    if args.command == 'providers':
        result = subprocess.run([executable, 'config', 'providers'], check=True, capture_output=True, text=True)
        data = json.loads(result.stdout)
        providers = data if isinstance(data, list) else data.get('providers', [])
        for provider in providers:
            print(provider['Name'] + ' — ' + provider.get('Description', ''))
        return
    if os.geteuid() != 0:
        parser.error('Ejecutar como root para usar la misma configuración de respaldos que Hestia.')
    if args.command == 'connect':
        # Rclone handles OAuth/password prompts and stores credentials outside the project.
        raise SystemExit(subprocess.call([executable, 'config']))
    if args.command == 'list':
        raise SystemExit(subprocess.call([executable, 'listremotes']))
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,63}:?', args.remote):
        parser.error('Indicar solamente el nombre de un remoto existente.')
    remote = args.remote.rstrip(':') + ':'
    result = subprocess.run([executable, 'lsf', remote, '--max-depth', '1', '--dirs-only'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60)
    if result.returncode:
        parser.error('No se pudo leer el remoto. Revisa su autorización y permisos con Rclone.')
    print('Acceso de lectura correcto. Falta probar la escritura y restauración antes de activar respaldos.')


if __name__ == '__main__':
    main()
