#!/usr/bin/env python3
"""Install the optional policy UI/worker, preserving native backups and schedules."""
import argparse,json,os,secrets,shutil,subprocess,time
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--uninstall',action='store_true');parser.add_argument('--native-backup-dir',default='/backup');args=parser.parse_args()
if os.geteuid()!=0:raise SystemExit('Run as root')
state=Path('/var/lib/vip-backup-admin');state.mkdir(mode=0o700,parents=True,exist_ok=True);state.chmod(0o700)
source=Path(__file__).resolve().parents[1]/'modules/backup-admin';manifest=state/'installer.json'
targets=[Path('/usr/local/hestia/bin/v-vip-backup-admin'),Path('/usr/local/hestia/web/vip/backup-admin/index.php'),Path('/etc/cron.d/vip-backup-admin')]
if args.uninstall:
    if json.loads((state/'job.json').read_text() if (state/'job.json').exists() else '{}').get('state') in {'queued','running'}:raise SystemExit('Wait for the active backup before uninstalling')
    for name,backup in json.loads(manifest.read_text()).items():
        if backup:shutil.copy2(backup,name)
        else:Path(name).unlink(missing_ok=True)
    Path('/usr/local/lib/virtualia-backup-admin/enabled').unlink(missing_ok=True)
    print('Module removed; archives, credentials and audit preserved privately');raise SystemExit()
if not manifest.exists():
    folder=state/'installer-backups'/str(time.time_ns());folder.mkdir(mode=0o700,parents=True);saved={}
    for i,path in enumerate(targets):
        if path.exists():backup=folder/str(i);shutil.copy2(path,backup);saved[str(path)]=str(backup)
        else:saved[str(path)]=None
    manifest.write_text(json.dumps(saved));manifest.chmod(0o600)
subprocess.run(['/usr/local/hestia/php/bin/php','-l',str(source/'endpoint.php')],check=True)
for sourcefile,target,mode in [(source/'backup-admin.py',targets[0],0o755),(source/'endpoint.php',targets[1],0o644)]:
    target.parent.mkdir(parents=True,exist_ok=True);target.parent.chmod(0o755);shutil.copy2(sourcefile,target);target.chmod(mode)
backup_dir=Path(args.native_backup_dir)
if not backup_dir.is_absolute() or backup_dir==Path('/'):raise SystemExit('Invalid native backup directory')
settings=state/'settings.json'
value=json.loads(settings.read_text()) if settings.exists() else {'instance':secrets.token_hex(12)}
value['nativeBackupDir']=str(backup_dir);settings.write_text(json.dumps(value));settings.chmod(0o600)
targets[2].write_text('# VIP backup policies only; existing native/source schedules are preserved.\n* * * * * root /usr/local/hestia/bin/v-vip-backup-admin tick >/dev/null 2>&1\n');targets[2].chmod(0o644)
marker=Path('/usr/local/lib/virtualia-backup-admin/enabled');marker.parent.mkdir(parents=True,exist_ok=True);marker.parent.chmod(0o755);marker.write_text('1\n');marker.chmod(0o644)
print('Optional backup policies enabled; no policies, destinations or client backups created automatically')
