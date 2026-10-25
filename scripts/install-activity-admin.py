#!/usr/bin/env python3
"""Optional activity module. Native administrator session; no daemon or public status endpoints."""
import argparse
import json
import os
from pathlib import Path
import pwd
import re
import secrets
import shutil
import subprocess
import time

parser=argparse.ArgumentParser()
parser.add_argument('--uninstall',action='store_true')
parser.add_argument('--observe-requests',action='store_true')
args=parser.parse_args()
if os.geteuid()!=0:raise SystemExit('Run as root')
source=Path(__file__).resolve().parents[1]/'modules/activity-admin'
state=Path('/var/lib/vip-activity-admin');state.mkdir(mode=0o700,parents=True,exist_ok=True);state.chmod(0o700)
manifest=state/'installer.json'
targets=[Path('/usr/local/hestia/bin/v-vip-activity-admin'),Path('/usr/local/hestia/web/vip/activity-admin/index.php'),Path('/usr/local/lib/virtualia-activity-admin/enabled')]
library=Path('/usr/share/virtualia-activity-observer')
guard=Path('/usr/local/lib/virtualia-activity-admin/traffic_guard.py')
targets.append(guard)
for name in ['vip-web-rate','vip-web-connections']:
    for directory,suffix in [('filter.d','.conf'),('action.d','.conf'),('jail.d','.local')]:
        targets.append(Path('/etc/fail2ban')/directory/(name+suffix))
targets.append(Path('/etc/cron.d/vip-web-connections'))
prepared={};wrappers={};services=set()
if args.observe_requests and not args.uninstall:
    for pool in Path('/etc/php').glob('*/fpm/pool.d/*.conf'):
        text=pool.read_text();match=re.search(r'^user\s*=\s*([A-Za-z0-9_-]+)\s*$',text,re.M)
        if not match:continue
        owner=match[1];profile=Path('/usr/local/hestia/data/users')/owner/'user.conf'
        if not profile.is_file() or re.search(r"^ROLE=['\"]?admin['\"]?$",profile.read_text(),re.M):continue
        current=re.search(r'^php_admin_value\[auto_prepend_file\]\s*=\s*(.+)$',text,re.M)
        if current and not current[1].strip().startswith(str(library)+'/'):continue
        basedir=re.search(r'^php_admin_value\[open_basedir\]\s*=\s*(.+)$',text,re.M)
        if basedir and not any(str(library).startswith(p.rstrip('/')+'/') for p in basedir[1].strip().split(':') if p.startswith('/')):
            print('Request observation skipped: library outside existing open_basedir');continue
        account=pwd.getpwnam(owner);runtime=Path('/home')/owner/'tmp'/'vip-activity-live'
        if runtime.parent.resolve()!=runtime.parent or runtime.is_symlink():raise SystemExit('Unsafe runtime directory')
        if not runtime.parent.exists():
            runtime.parent.mkdir(mode=0o700);os.chown(runtime.parent,account.pw_uid,account.pw_gid)
        runtime.mkdir(mode=0o700,parents=False,exist_ok=True);os.chown(runtime,account.pw_uid,account.pw_gid);runtime.chmod(0o700)
        wrapper=library/(owner+'.php')
        wrappers[wrapper]="<?php (static function(){ $activityDirectory="+repr(str(runtime))+"; require "+repr(str(library/'observer.php'))+"; })();\n"
        clean=re.sub(r'\n; VIP request observation\nphp_admin_value\[auto_prepend_file\][^\n]*\n?','\n',text)
        prepared[pool]=clean.rstrip()+"\n; VIP request observation\nphp_admin_value[auto_prepend_file] = "+str(wrapper)+"\n"
        services.add('php'+pool.parts[3]+'-fpm')
    targets.extend([library/'observer.php',*wrappers,*prepared])
if args.uninstall:
    for name in ['vip-web-rate','vip-web-connections']:
        jail=Path('/etc/fail2ban/jail.d')/(name+'.local')
        if jail.exists():
            subprocess.run(['fail2ban-client','stop',name],capture_output=True)
            jail.unlink()
    for name,backup in json.loads(manifest.read_text()).items():
        if backup:shutil.copy2(backup,name)
        else:Path(name).unlink(missing_ok=True)
    for service in json.loads((state/'observer-services.json').read_text()) if (state/'observer-services.json').exists() else []:
        subprocess.run(['systemctl','reload',service],check=True)
    subprocess.run(['fail2ban-client','reload'],check=True)
    print('Activity module removed; private audit retained');raise SystemExit()
subprocess.run(['/usr/local/hestia/php/bin/php','-l',str(source/'endpoint.php')],check=True)
subprocess.run(['/usr/local/hestia/php/bin/php','-l',str(source/'observer.php')],check=True)
saved=json.loads(manifest.read_text()) if manifest.exists() else {}
folder=state/'installer-backups'/str(time.time_ns());folder.mkdir(parents=True,mode=0o700)
for i,path in enumerate(targets):
    if str(path) not in saved:
        if path.exists():backup=folder/str(i);shutil.copy2(path,backup);saved[str(path)]=str(backup)
        else:saved[str(path)]=None
manifest.write_text(json.dumps(saved));manifest.chmod(0o600)
for original,target,mode in [(source/'activity-admin.py',targets[0],0o755),(source/'endpoint.php',targets[1],0o644),(source/'traffic_guard.py',guard,0o644)]:
    target.parent.mkdir(parents=True,exist_ok=True);target.parent.chmod(0o755)
    temp=target.with_name(target.name+'.vip-new');shutil.copyfile(original,temp);temp.chmod(mode);temp.replace(target)
key=state/'signing.key'
if not key.exists():key.write_bytes(secrets.token_bytes(32));key.chmod(0o600)
if prepared:
    library.mkdir(mode=0o755,parents=True,exist_ok=True);library.chmod(0o755)
    shutil.copyfile(source/'observer.php',library/'observer.php');(library/'observer.php').chmod(0o644)
    for path,text in wrappers.items():path.write_text(text);path.chmod(0o644)
    previous={p:p.read_text() for p in prepared}
    try:
        for p,text in prepared.items():p.write_text(text)
        for service in services:subprocess.run(['/usr/sbin/php-fpm'+service.removeprefix('php').removesuffix('-fpm'),'-t'],check=True,capture_output=True)
        for service in services:subprocess.run(['systemctl','reload',service],check=True)
    except Exception:
        for p,text in previous.items():p.write_text(text)
        for service in services:subprocess.run(['systemctl','reload',service],capture_output=True)
        raise
    (state/'observer-services.json').write_text(json.dumps(sorted(services)))
targets[2].parent.mkdir(parents=True,exist_ok=True);targets[2].parent.chmod(0o755);targets[2].write_text('1\n');targets[2].chmod(0o644)
print('Activity module enabled; observed pools:',len(prepared),'; no new resident service; automatic protection remains opt-in')
