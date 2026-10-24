#!/usr/bin/env python3
"""Explicitly serve the installed native phpMyAdmin on a dedicated HTTPS port."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import subprocess

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--port', type=int, default=2083)
p.add_argument('--hestia-root', default='/usr/local/hestia')
p.add_argument('--open-firewall', action='store_true', help='Add one native TCP allow rule')
p.add_argument('--ipv6', action='store_true', help='Also listen on IPv6; manage its firewall separately')
p.add_argument('--dry-run', action='store_true')
args = p.parse_args()
if not 1024 <= args.port <= 65535 or args.port in (8080, 8083, 8443):
    p.error('Choose an unused service port, distinct from Hestia and its backend.')
root = Path(args.hestia_root).resolve()
include = Path('/etc/nginx/conf.d/phpmyadmin.inc')
target = include.with_name('vip-phpmyadmin.conf')
for required in [include, root/'ssl/certificate.crt', root/'ssl/certificate.key', Path('/run/php/www.sock'), Path('/usr/share/phpmyadmin/index.php')]:
    if not required.exists():
        p.error('Missing native prerequisite: '+str(required))
if not str(root).replace('/', '').replace('-', '').replace('_', '').replace('.', '').isalnum():
    p.error('Unsupported Hestia path.')
ipv6=f'    listen [::]:{args.port} ssl;\n' if args.ipv6 else ''
config = f'''# VIP dedicated phpMyAdmin service; no hosting accounts or domains.
server {{
    listen {args.port} ssl;
{ipv6}    server_name _;
    ssl_certificate {root}/ssl/certificate.crt;
    ssl_certificate_key {root}/ssl/certificate.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    index index.php;
    client_max_body_size 128m;
    error_page 497 https://$host:$server_port$request_uri;
    location = / {{ return 302 /phpmyadmin/; }}
    location ^~ /phpmyadmin/vendor/ {{ return 404; }}
    location ^~ /phpmyadmin/sql/ {{ return 404; }}
    include {include};
    location / {{ return 404; }}
}}
'''
if args.dry_run:
    print(f'Compatible native phpMyAdmin; service plan: HTTPS :{args.port}, no hosting domains created.')
    raise SystemExit(0)
if os.geteuid() != 0:
    p.error('Run as root.')
if not target.exists():
    sock = __import__('socket').socket()
    try:
        sock.bind(('0.0.0.0', args.port))
    except OSError:
        p.error('Port is already in use.')
    finally:
        sock.close()
elif not target.read_text().startswith('# VIP dedicated phpMyAdmin service;'):
    p.error('Refusing to replace an unrelated configuration.')
def cli(command, *values):
    result = subprocess.run([str(root/'bin'/command), *map(str, values)], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(command+' failed')
    return result.stdout
backup = Path('/opt/virtual-ia-panel/service-backups')/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
backup.mkdir(parents=True, mode=0o700)
before = target.read_bytes() if target.exists() else None
if before is not None:
    (backup/'vip-phpmyadmin.conf.before').write_bytes(before)
rules_before = json.loads(cli('v-list-firewall', 'json'))
added = []
try:
    target.write_text(config);target.chmod(0o644)
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    if args.open_firewall and not any(r['ACTION']=='ACCEPT' and r['PROTOCOL']=='TCP' and str(args.port) in r['PORT'].split(',') and r['IP']=='0.0.0.0/0' and r.get('SUSPENDED')=='no' for r in rules_before.values()):
        cli('v-add-firewall-rule', 'ACCEPT', '0.0.0.0/0', args.port, 'TCP', 'VIP phpMyAdmin')
        added = sorted(set(json.loads(cli('v-list-firewall', 'json')))-set(rules_before))
except Exception:
    if before is None:
        target.unlink(missing_ok=True)
    else:
        target.write_bytes(before)
    for rule in added:
        cli('v-delete-firewall-rule', rule)
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    raise
(backup/'manifest.json').write_text(json.dumps({'target':str(target),'hadConfig':before is not None,'addedFirewallRules':added,'port':args.port},indent=2))
print(f'Native phpMyAdmin HTTPS service enabled on :{args.port}; backup: {backup}')
print('SQL credentials or native per-database SSO are still required. No accounts/domains created.')
