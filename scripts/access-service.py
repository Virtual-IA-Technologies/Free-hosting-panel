#!/usr/bin/env python3
"""Explicit native account listener or Roundcube HTTPS service; no hosting domains."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import subprocess

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('service',choices=['accounts','webmail'])
p.add_argument('--port',type=int,required=True)
p.add_argument('--hestia-root',default='/usr/local/hestia')
p.add_argument('--open-firewall',action='store_true')
p.add_argument('--ipv6',action='store_true',help='Also listen on IPv6; manage its firewall separately')
p.add_argument('--dry-run',action='store_true')
args=p.parse_args();root=Path(args.hestia_root).resolve()
if not 1024<=args.port<=65535:
    p.error('Choose an unused service port, distinct from the panel, database and web backends.')
if not str(root).replace('/','').replace('-','').replace('_','').replace('.','').isalnum():
    p.error('Unsupported Hestia path.')
if args.service=='accounts':
    target=root/'nginx/conf/nginx.conf'
    text=target.read_text()
    text=re.sub(r'(?m)^\s*# VIP accounts listener\n(?:[^\n]*\n)*?\s*# End VIP accounts listener\n','',text)
    listen=re.search(r'(?m)^([ \t]*)listen[ \t]+\d+[ \t]+ssl;',text)
    if not listen or str(args.port) in re.findall(r'(?m)^\s*listen\s+(\d+)\s+ssl;',text):
        p.error('Cannot identify a safe native listener location.')
    at=listen.end();indent=listen.group(1)
    ipv6=f'{indent}listen [::]:{args.port} ssl;\n' if args.ipv6 else ''
    extra=f'\n{indent}# VIP accounts listener\n{indent}listen {args.port} ssl;\n{ipv6}{indent}# End VIP accounts listener\n'
    config=text[:at]+extra+text[at:]
    executable=root/'nginx/sbin/hestia-nginx'
    if not executable.is_file():
        p.error('Native Hestia nginx executable not found.')
    check=[str(executable),'-t','-c',str(target)]
    def reload_service():
        os.kill(int(Path('/run/hestia-nginx.pid').read_text().strip()),signal.SIGHUP)
else:
    for required in [Path('/var/lib/roundcube/index.php'),Path('/run/php/www.sock'),root/'ssl/certificate.crt',root/'ssl/certificate.key']:
        if not required.exists():p.error('Missing native webmail prerequisite: '+str(required))
    target=Path('/etc/nginx/conf.d/vip-webmail.conf')
    if target.exists() and not target.read_text().startswith('# VIP native webmail service'):
        p.error('Refusing to replace unrelated configuration.')
    ipv6=f'    listen [::]:{args.port} ssl;\n' if args.ipv6 else ''
    config=fr'''# VIP native webmail service; no hosting domains.
server {{
    listen {args.port} ssl;
{ipv6}    server_name _;
    ssl_certificate {root}/ssl/certificate.crt;
    ssl_certificate_key {root}/ssl/certificate.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    root /var/lib/roundcube;
    index index.php;
    client_max_body_size 50m;
    error_page 497 https://$host:$server_port$request_uri;
    location = /index.php {{
        include /etc/nginx/fastcgi_params;
        fastcgi_param SCRIPT_FILENAME /var/lib/roundcube/index.php;
        fastcgi_pass unix:/run/php/www.sock;
    }}
    location ~ ^/(config|temp|logs|bin|SQL|installer|vendor|tests)(/|$) {{ return 404; }}
    location ~ /\. {{ return 404; }}
    location ~ \.php(/|$) {{ return 404; }}
    location ~* \.(css|js|png|gif|ico|jpe?g|svg|woff2?|ttf)$ {{ try_files $uri =404; }}
    location / {{ try_files $uri /index.php?$query_string; }}
}}
'''
    check=['nginx','-t']
    def reload_service():
        subprocess.run(['systemctl','reload','nginx'],check=True)
if args.dry_run:
    print(f'Compatible {args.service}; HTTPS :{args.port}; no accounts or domains created.');raise SystemExit(0)
if os.geteuid()!=0:p.error('Run as root.')
before=target.read_bytes() if target.exists() else None
if not before or f'listen {args.port} ssl;'.encode() not in before:
    sock=socket.socket()
    try:sock.bind(('0.0.0.0',args.port))
    except OSError:p.error('Port is already in use.')
    finally:sock.close()
def cli(command,*values):
    result=subprocess.run([str(root/'bin'/command),*map(str,values)],capture_output=True,text=True)
    if result.returncode:raise RuntimeError(command+' failed')
    return result.stdout
backup=Path('/opt/virtual-ia-panel/service-backups')/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
backup.mkdir(parents=True,mode=0o700)
if before is not None:(backup/'config.before').write_bytes(before)
rules=json.loads(cli('v-list-firewall','json'));added=[]
try:
    target.write_text(config);target.chmod(0o644)
    subprocess.run(check,check=True);reload_service()
    allowed=any(r['ACTION']=='ACCEPT' and r['PROTOCOL']=='TCP' and str(args.port) in r['PORT'].split(',') and r['IP']=='0.0.0.0/0' and r.get('SUSPENDED')=='no' for r in rules.values())
    if args.open_firewall and not allowed:
        cli('v-add-firewall-rule','ACCEPT','0.0.0.0/0',args.port,'TCP','VIP '+args.service)
        added=sorted(set(json.loads(cli('v-list-firewall','json')))-set(rules))
except Exception:
    if before is None:target.unlink(missing_ok=True)
    else:target.write_bytes(before)
    for rule in added:cli('v-delete-firewall-rule',rule)
    subprocess.run(check,check=True);reload_service();raise
(backup/'manifest.json').write_text(json.dumps({'target':str(target),'hadConfig':before is not None,'beforeFile':'config.before','addedFirewallRules':added,'port':args.port,'service':args.service},indent=2))
print(f'{args.service} service enabled on :{args.port}; native authentication unchanged; backup: {backup}')
