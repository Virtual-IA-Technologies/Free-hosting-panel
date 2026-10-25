#!/usr/bin/env python3
"""Optional PHP panel timezone alignment; does not change system/site/SQL timezone."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
from zoneinfo import ZoneInfo


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--hestia-root',type=Path,default=Path('/usr/local/hestia'))
    parser.add_argument('--timezone',help='IANA zone; defaults to the system zone')
    parser.add_argument('--dry-run',action='store_true')
    parser.add_argument('--restore',type=Path)
    args=parser.parse_args()
    if os.name!='posix' or os.geteuid()!=0:parser.error('Run as root on Linux.')
    root=args.hestia_root.resolve();ini=root/'php/lib/php.ini'
    backups=Path('/opt/virtual-ia-panel/timezone-backups')
    zone=args.timezone or Path('/etc/timezone').read_text().strip()
    ZoneInfo(zone)
    before=ini.read_bytes();stat=ini.stat()
    if args.restore:
        folder=args.restore.resolve()
        if not folder.is_relative_to(backups):parser.error('Unknown backup directory')
        meta=json.loads((folder/'manifest.json').read_text())
        if meta['path']!=str(ini) or hashlib.sha256(before).hexdigest()!=meta['installed']:parser.error('Configuration changed; review before restoring')
        data=(folder/'php.ini').read_bytes()
    else:
        text=before.decode()
        text=re.sub(r'(?m)^\s*date\.timezone\s*=.*$', '',text)
        data=(text.rstrip()+'\n\n; VIP: panel timezone aligned with administrator choice\ndate.timezone = '+zone+'\n').encode()
        if re.search(r'(?m)^\s*date\.timezone\s*=\s*[\"\x27]?'+re.escape(zone)+r'[\"\x27]?\s*$',before.decode()):
            print('Panel PHP already uses',zone);return
    # Reload only the matching panel FPM master; leave SQL and site FPM untouched.
    masters=[]
    for proc in Path('/proc').iterdir():
        if not proc.name.isdigit():continue
        try:cmd=(proc/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace')
        except (FileNotFoundError,PermissionError):continue
        if cmd.strip()=='php-fpm: master process ('+str(root/'php/etc/php-fpm.conf')+')':masters.append(int(proc.name))
    if len(masters)!=1:parser.error('Expected one native panel FPM master')
    if args.dry_run:print('Compatible: panel PHP timezone',zone,'with graceful FPM reload; no other services changed.');return
    os.umask(0o077)
    if not args.restore:
        folder=backups/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ');folder.mkdir(parents=True,mode=0o700)
        shutil.copy2(ini,folder/'php.ini');(folder/'php.ini').chmod(0o600)
        (folder/'manifest.json').write_text(json.dumps({'path':str(ini),'installed':hashlib.sha256(data).hexdigest()}))
        print('Private backup:',folder)
    temporary=ini.with_name('php.ini.vip-timezone');temporary.write_bytes(data);temporary.chmod(stat.st_mode&0o777);os.chown(temporary,stat.st_uid,stat.st_gid)
    try:
        check=subprocess.run([str(root/'php/sbin/php-fpm'),'-t','-c',str(temporary),'-y',str(root/'php/etc/php-fpm.conf')],capture_output=True)
        if check.returncode:raise RuntimeError('Panel PHP configuration test failed; original preserved')
        os.replace(temporary,ini)
        os.kill(masters[0],signal.SIGUSR2)
    finally:temporary.unlink(missing_ok=True)
    print('Panel PHP configuration applied with graceful reload. No database/site service restarted.')

if __name__=='__main__':main()
