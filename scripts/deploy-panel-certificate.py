#!/usr/bin/env python3
"""Certbot deploy hook: import a validated lineage using Hestia's native CLI."""
import argparse
from datetime import datetime, timezone
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--lineage',default=os.environ.get('RENEWED_LINEAGE'))
p.add_argument('--hestia-root',default='/usr/local/hestia')
args=p.parse_args()
if not args.lineage or os.geteuid()!=0:
    p.error('A certificate lineage and root access are required.')
lineage=Path(args.lineage).resolve();root=Path(args.hestia_root).resolve()
cert=lineage/'fullchain.pem';key=lineage/'privkey.pem'
subprocess.run(['openssl','x509','-in',str(cert),'-noout','-checkend','86400'],check=True)
cert_pub=subprocess.check_output(['openssl','x509','-in',str(cert),'-pubkey','-noout'])
key_pub=subprocess.check_output(['openssl','pkey','-in',str(key),'-pubout'],stderr=subprocess.DEVNULL)
if cert_pub!=key_pub:
    p.error('Certificate and private key do not match.')
backup=Path('/opt/virtual-ia-panel/certificate-backups')/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
backup.mkdir(parents=True,mode=0o700)
for name in ['certificate.crt','certificate.key']:
    shutil.copy2(root/'ssl'/name,backup/name);(backup/name).chmod(0o600)
try:
    with tempfile.TemporaryDirectory(prefix='vip-cert-',dir=backup.parent) as temporary:
        stage=Path(temporary)
        shutil.copyfile(cert,stage/'certificate.crt');shutil.copyfile(key,stage/'certificate.key')
        (stage/'certificate.key').chmod(0o600)
        subprocess.run([str(root/'bin/v-change-sys-hestia-ssl'),str(stage),'yes'],check=True)
    subprocess.run(['nginx','-t'],check=True)
    subprocess.run(['systemctl','reload','nginx'],check=True)
except Exception:
    for name in ['certificate.crt','certificate.key']:
        shutil.copyfile(backup/name,root/'ssl'/name)
    subprocess.run([str(root/'bin/v-restart-service'),'hestia'],check=False)
    subprocess.run(['systemctl','reload','nginx'],check=False)
    raise
print('Panel certificate deployed through native Hestia; nginx reloaded. Private backup:',backup)
