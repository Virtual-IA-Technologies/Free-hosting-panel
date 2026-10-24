#!/usr/bin/env python3
"""Check publishable Git files without printing secret values. Not a full secret audit."""
from pathlib import Path
import re
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
patterns = {
    'private key': re.compile(rb'-----BEGIN (?:OPENSSH |RSA |EC |DSA |ENCRYPTED )?PRIVATE KEY-----'),
    'GitHub token': re.compile(rb'\b(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,})\b'),
    'provider token': re.compile(rb'\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{30,}\b'),
    'AWS access key': re.compile(rb'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b'),
}
forbidden = {'.ssh', '.secrets', 'secrets', 'backups', 'deployments', 'test-results', 'node_modules'}
suffixes = {'.dpapi', '.pem', '.key', '.p12', '.pfx', '.kdbx', '.zip', '.tar', '.gz'}
result = subprocess.run(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'],
                        cwd=root, capture_output=True, check=True)
issues = []
files = set(result.stdout.decode('utf-8').split('\0')) - {''}
for name in sorted(files):
    path = root / name
    if not path.is_file():
        continue
    if forbidden.intersection(Path(name).parts) or path.suffix in suffixes or path.name.startswith('.env'):
        issues.append((name, 'private/deployment file'))
        continue
    content = path.read_bytes()
    for kind, pattern in patterns.items():
        if pattern.search(content):
            issues.append((name, kind))
for name, kind in issues:
    print(f'{name}: {kind}')
if issues:
    sys.exit(1)
print(f'Public-source checks passed: {len(files)} files; no recognized secret patterns.')
