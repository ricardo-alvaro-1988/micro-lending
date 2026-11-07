#!/usr/bin/python3
"""Installed by an administrator, root-owned; Jenkins may invoke without arguments."""
import fcntl
import grp
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request

assert os.geteuid() == 0 and len(sys.argv) == 1
lock = open('/run/lock/microlending-staging.lock', 'w')
fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
source = Path('/var/lib/jenkins/workspace/MicroLending-Staging/.pipeline-artifacts')
base = Path('/var/www/lending')
assert source.is_dir() and not source.is_symlink()
for item in source.rglob('*'):
    if item.is_symlink() or not (item.is_file() or item.is_dir()):
        raise RuntimeError('Unexpected artifact type: ' + str(item))
commit = (source / 'commit.txt').read_text().strip()
assert re.fullmatch(r'[0-9a-f]{40}', commit)
assert (source / 'api/MicroLending.Api.dll').is_file()
assert (source / 'web/index.html').is_file()
for forbidden in ['Uploads', 'database', 'appsettings.Production.json']:
    assert not (source / 'api' / forbidden).exists(), forbidden

def run(args):
    subprocess.run(args, check=True)

stamp = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())
release = base / 'releases' / (stamp + '-' + commit[:12])
release.mkdir(parents=True)
for name in ['api', 'web']:
    shutil.copytree(source / name, release / name)
for item in release.rglob('*'):
    item.chmod(0o755 if item.is_dir() else 0o644)
release.chmod(0o755)
config = Path('/etc/microlending/appsettings.Production.json')
assert config.is_file()
(release / 'api/appsettings.Production.json').symlink_to(config)
(release / 'api/Uploads').symlink_to(base / 'Uploads', target_is_directory=True)
(release / 'commit.txt').write_text(commit + '\n')

# Back up the live database before startup applies any pending EF migrations.
connection = json.loads(config.read_text())['ConnectionStrings']['DefaultConnection']
parts = dict(part.split('=', 1) for part in connection.split(';') if '=' in part)
parts = {key.strip().lower(): value for key, value in parts.items()}
backup = '/var/opt/mssql/backups/MicroLending-before-' + stamp + '.bak'
env = os.environ.copy()
env['SQLCMDPASSWORD'] = parts.get('password', parts.get('pwd'))
result = subprocess.run([
    'docker', 'exec', '-e', 'SQLCMDPASSWORD', 'sqlserver',
    '/opt/mssql-tools18/bin/sqlcmd', '-S', 'localhost', '-U',
    parts.get('user id', parts.get('uid')), '-C', '-b', '-Q',
    "BACKUP DATABASE [MicroLending] TO DISK=N'" + backup + "' WITH COPY_ONLY, CHECKSUM;"
], env=env, capture_output=True, text=True)
if result.returncode:
    raise RuntimeError('Database backup failed: ' + result.stdout + result.stderr)
print('Database backup completed.', flush=True)

previous = (base / 'current').resolve(strict=True)
assert previous.parent == base / 'releases'

def activate(target):
    temp = base / 'current.next'
    temp.symlink_to(target, target_is_directory=True)
    temp.replace(base / 'current')

run(['systemctl', 'stop', 'microlending'])
try:
    activate(release)
    run(['systemctl', 'start', 'microlending'])
    healthy = False
    for attempt in range(30):
        try:
            urllib.request.urlopen('http://127.0.0.1:5267/api/auth/me', timeout=3)
        except urllib.error.HTTPError as error:
            if error.code == 401:
                healthy = True
                break
        except (OSError, TimeoutError):
            pass
        time.sleep(2)
    if not healthy:
        raise RuntimeError('API did not become healthy')
except Exception:
    run(['systemctl', 'stop', 'microlending'])
    activate(previous)
    run(['systemctl', 'start', 'microlending'])
    print('Previous application release restored. Database backup retained; migrations are not automatically reversed.', flush=True)
    raise
print('Deployed staging commit ' + commit, flush=True)
