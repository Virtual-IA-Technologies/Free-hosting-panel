#!/usr/bin/env python3
"""Optional native-session mail/SQL signon module; no new resident services."""
import argparse
from pathlib import Path
import json,os,pwd,grp,re,shutil,subprocess,secrets,time

parser=argparse.ArgumentParser();parser.add_argument('--uninstall',action='store_true');parser.add_argument('--enable-sql-admin',action='store_true');parser.add_argument('--panel-port',type=int,default=8083);args=parser.parse_args()
if not 1<=args.panel_port<=65535:raise SystemExit('Invalid panel port')
if os.geteuid()!=0:raise SystemExit('Run as root')
source=Path(__file__).resolve().parents[1]/'modules/mail-admin'
state=Path('/var/lib/vip-mail-admin');app=Path('/usr/local/lib/virtualia-mail-admin')
manifest=state/'installer.json'
state.mkdir(mode=0o700,exist_ok=True);app.mkdir(mode=0o755,parents=True,exist_ok=True);app.chmod(0o755)
configuration=Path('/etc/roundcube/config.inc.php');pma=Path('/etc/phpmyadmin/config.inc.php')
endpoint=Path('/usr/local/hestia/web/vip/mail-admin/index.php');helper=Path('/usr/local/hestia/bin/v-vip-mail-admin')
plugin=Path('/var/lib/roundcube/plugins/vip_admin_login/vip_admin_login.php')
targets=[configuration,pma,endpoint,helper,plugin,Path('/etc/dovecot/conf.d/05-vip-master.conf'),Path('/etc/dovecot/vip-master-users'),Path('/etc/sudoers.d/vip-mail-sso'),Path('/usr/share/phpmyadmin/vip-admin-sso.php'),Path('/usr/share/phpmyadmin/vip-admin-logout.php'),Path('/usr/local/hestia/web/vip/mail-ticket/index.php')]
if args.uninstall:
    for target,backup in json.loads(manifest.read_text()).items():
        path=Path(target)
        if backup:shutil.copy2(backup,path)
        else:path.unlink(missing_ok=True)
    (app/'enabled').unlink(missing_ok=True)
    (app/'sql-enabled').unlink(missing_ok=True)
    subprocess.run(['doveconf','-n'],check=True,stdout=subprocess.DEVNULL);subprocess.run(['systemctl','reload','dovecot'],check=True)
    print('Native mail/SQL configuration restored; credentials and audit retained privately');raise SystemExit()
if manifest.exists():
    backups=json.loads(manifest.read_text())
    for target in targets:
        if str(target) not in backups:
            if target.exists():
                saved=state/('upgrade-backup-'+secrets.token_hex(8));shutil.copy2(target,saved);backups[str(target)]=str(saved)
            else:backups[str(target)]=None
    manifest.write_text(json.dumps(backups));manifest.chmod(0o600)
else:
    folder=state/'installer-backups'/str(time.time_ns());folder.mkdir(mode=0o700,parents=True)
    backups={}
    for index,target in enumerate(targets):
        if target.exists():saved=folder/str(index);shutil.copy2(target,saved);backups[str(target)]=str(saved)
        else:backups[str(target)]=None
    manifest.write_text(json.dumps(backups));manifest.chmod(0o600)
def write(target,value,mode=0o644):
    missing=[];parent=target.parent
    while not parent.exists():missing.append(parent);parent=parent.parent
    target.parent.mkdir(parents=True,exist_ok=True)
    for parent in missing:parent.chmod(0o755 if not parent.is_relative_to(state) else 0o700)
    target.write_bytes(value.encode() if isinstance(value,str) else value);target.chmod(mode)

sql_state=Path('/opt/virtual-ia-panel/phpmyadmin-admin-access.json')
if args.enable_sql_admin and not sql_state.exists():
    def sql(statement):
        result=subprocess.run(['mariadb','--batch','--skip-column-names'],input=statement,capture_output=True,text=True)
        if result.returncode:raise SystemExit('SQL administrative provisioning failed; credentials withheld')
        return result.stdout.strip()
    if sql("SELECT COUNT(*) FROM mysql.user WHERE User='vip_sql_admin';")!='0':raise SystemExit('Existing SQL user without private state; refusing to overwrite credentials')
    credentials={'username':'vip_sql_admin','password':secrets.token_urlsafe(48),'host':'localhost'}
    write(sql_state,json.dumps(credentials),0o600)
    sql("CREATE USER 'vip_sql_admin'@'localhost' IDENTIFIED BY '"+credentials['password']+"';")
    sql("GRANT ALL PRIVILEGES ON *.* TO 'vip_sql_admin'@'localhost' WITH GRANT OPTION;")
for filename in ['endpoint.php','sql-sso.php','sql-logout.php','pma-server.php','vip_admin_login.php','ticket-client.php','ticket-endpoint.php']:
    subprocess.run(['/usr/local/hestia/php/bin/php','-l',str(source/filename)],check=True)
write(helper,(source/'mail-admin.py').read_bytes(),0o755)
write(endpoint,(source/'endpoint.php').read_bytes());write(plugin,(source/'vip_admin_login.php').read_bytes())
write(Path('/usr/local/hestia/web/vip/mail-ticket/index.php'),(source/'ticket-endpoint.php').read_bytes())
write(app/'ticket-client.php',(source/'ticket-client.php').read_bytes());write(app/'bridge.json',json.dumps({'port':args.panel_port}))
write(Path('/usr/share/phpmyadmin/vip-admin-sso.php'),(source/'sql-sso.php').read_bytes())
write(Path('/usr/share/phpmyadmin/vip-admin-logout.php'),(source/'sql-logout.php').read_bytes())
write(app/'pma-server.php',(source/'pma-server.php').read_bytes())
hook="require '/usr/local/lib/virtualia-mail-admin/pma-server.php';"
if hook not in pma.read_text():pma.write_text(pma.read_text()+'\n'+hook+'\n')
marker='// VIP optional administrative webmail signon'
if marker not in configuration.read_text():configuration.write_text(configuration.read_text()+"\n"+marker+"\n$config['plugins'] = array_values(array_unique(array_merge((array)($config['plugins']??[]), ['vip_admin_login'])));\n")
master=state/'master.json'
if master.exists():credentials=json.loads(master.read_text())
else:credentials={'user':'vip_mail_admin','password':secrets.token_urlsafe(48)};write(master,json.dumps(credentials),0o600)
hashed=subprocess.run(['openssl','passwd','-6','-stdin'],input=credentials['password']+'\n',capture_output=True,text=True,check=True).stdout.strip()
write(Path('/etc/dovecot/vip-master-users'),credentials['user']+':{SHA512-CRYPT}'+hashed+':::::::allow_nets=127.0.0.1/32,::1/128\n',0o600)
os.chown('/etc/dovecot/vip-master-users',0,grp.getgrnam('dovecot').gr_gid)
Path('/etc/dovecot/vip-master-users').chmod(0o640)
write(Path('/etc/dovecot/conf.d/05-vip-master.conf'),'''passdb {
  driver = passwd-file
  args = username_format=%u /etc/dovecot/vip-master-users
  master = yes
  result_success = continue
}
''')
webuser='hestiamail'
pwd.getpwnam(webuser)
write(Path('/etc/sudoers.d/vip-mail-sso'),'# Shared applications consume tickets through the loopback-only native panel bridge.\n',0o440)
subprocess.run(['visudo','-cf','/etc/sudoers.d/vip-mail-sso'],check=True)
for file in [configuration,pma]:subprocess.run(['/usr/local/hestia/php/bin/php','-l',str(file)],check=True)
result=subprocess.run(['doveconf','-n'],capture_output=True,text=True)
if result.returncode:
    for target in [Path('/etc/dovecot/conf.d/05-vip-master.conf'),Path('/etc/dovecot/vip-master-users')]:
        old=backups[str(target)]
        if old:shutil.copy2(old,target)
        else:target.unlink(missing_ok=True)
    raise SystemExit('Dovecot validation failed; master configuration restored')
subprocess.run(['systemctl','reload','dovecot'],check=True)
write(app/'enabled','1\n')
if sql_state.is_file():write(app/'sql-enabled','1\n')
else:(app/'sql-enabled').unlink(missing_ok=True)
print('Mail/SQL administrative tools enabled; existing Exim/Dovecot/Roundcube only; backup manifest private')
