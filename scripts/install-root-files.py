#!/usr/bin/env python3
"""Install/uninstall optional native FileGator root adapter, with exact-file backups."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import time

parser=argparse.ArgumentParser()
parser.add_argument('--uninstall',action='store_true')
args=parser.parse_args()
if os.geteuid()!=0: raise SystemExit('Run as root')
root=Path('/usr/local/hestia')
module=Path('/usr/local/lib/virtualia-root-files')
source=Path(__file__).resolve().parents[1]/'modules/root-files'
configuration=root/'web/fm/configuration.php'
storage=root/'web/fm/backend/Services/Storage/Filesystem.php'
manifest=Path('/opt/virtual-ia-panel/root-files/manifest.json')
targets=[configuration,storage,root/'bin/v-vip-root-files']
hook="require '/usr/local/lib/virtualia-root-files/configuration.php';\n"
if args.uninstall:
    data=json.loads(manifest.read_text())
    for target,backup in data.items():
        path=Path(target)
        if backup: shutil.copy2(backup,path)
        else: path.unlink(missing_ok=True)
    (module/'enabled').unlink(missing_ok=True)
    print('Root file adapter removed; native files restored')
    raise SystemExit()
if manifest.exists():
    data=json.loads(manifest.read_text())
else:
    backup=Path('/opt/virtual-ia-panel/backups')/('root-files-'+str(time.time_ns()))
    backup.mkdir(parents=True,mode=0o700)
    data={}
    for index,target in enumerate(targets):
        saved=backup/str(index)
        if target.exists(): shutil.copy2(target,saved); data[str(target)]=str(saved)
        else: data[str(target)]=None
module.mkdir(parents=True,exist_ok=True,mode=0o755)
module.chmod(0o755)
for name in ['RootAdapter.php','configuration.php']:
    subprocess.run(['/usr/local/hestia/php/bin/php','-l',str(source/name)],check=True)
    shutil.copy2(source/name,module/name); (module/name).chmod(0o644)
shutil.copy2(source/'v-vip-root-files',targets[2]); targets[2].chmod(0o755)
text=configuration.read_text()
text=text.replace("require '/opt/virtual-ia-panel/root-files/configuration.php';\n",'')
if hook not in text:
    if text.count('return $dist_config;')!=1: raise SystemExit('Unsupported FileGator configuration')
    configuration.write_text(text.replace('return $dist_config;',hook+'return $dist_config;'))
text=storage.read_text()
if "case 'Virtualia\\RootAdapter':" not in text:
    chmod="        switch (get_class($adapter)) {"
    if text.count(chmod)!=2: raise SystemExit('Unsupported FileGator storage')
    text=text.replace(chmod,chmod+"\n            case 'Virtualia\\RootAdapter':\n                return $adapter->chmod($path, $permissions);",1)
    position=text.index('protected function getPermissions')
    text=text[:position]+text[position:].replace(chmod,chmod+"\n            case 'Virtualia\\RootAdapter':\n                return $entry['permissions'] ?? -1;",1)
    storage.write_text(text)
manifest.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
manifest.write_text(json.dumps(data)); manifest.chmod(0o600)
for path in [configuration,storage]: subprocess.run(['/usr/local/hestia/php/bin/php','-l',str(path)],check=True)
(module/'enabled').write_text('1\n'); (module/'enabled').chmod(0o644)
print('Optional root adapter enabled; native account adapter retained')
