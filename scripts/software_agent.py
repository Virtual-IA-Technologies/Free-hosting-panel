#!/usr/bin/env python3
"""Optional local package broker. No HTTP listener, arbitrary shell or repositories."""
import argparse
from datetime import datetime, timezone, date
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import socket
import socketserver
import struct
import subprocess
import tarfile
import threading
import time
import uuid
import signal

# Unit checks can run on Windows; service startup is strictly Linux-only.
if os.name == 'posix':
    import fcntl
    import grp
    import pwd

ROOT=Path('/usr/local/hestia')
STATE=Path('/var/lib/vip-software')
RUN=Path('/run/vip-software')
PHP_ETC=Path('/etc/php')
POLICY_PATH=Path(__file__).with_name('software-policy.json')
ACTOR=re.compile(r'^[a-zA-Z0-9][a-zA-Z0-9_-]{0,31}$')
EXTENSIONS={
 'bcmath':['bcmath'],'bz2':['bz2'],'curl':['curl'],'gd':['gd'],'gmp':['gmp'],
 'imap':['imap'],'intl':['intl'],'ldap':['ldap'],'mbstring':['mbstring'],
 'mysql':['mysqlnd','mysqli','pdo_mysql'],'pgsql':['pgsql','pdo_pgsql'],
 'redis':['redis'],'soap':['soap'],'sqlite3':['sqlite3','pdo_sqlite'],
 'tidy':['tidy'],'xml':['dom','simplexml','xml','xmlreader','xmlwriter'],
 'xsl':['xsl'],'zip':['zip'],'imagick':['imagick'],'apcu':['apcu'],
 'igbinary':['igbinary'],'msgpack':['msgpack'],'mongodb':['mongodb']}
NATIVE_PHP=['common','mbstring','bcmath','cli','curl','fpm','gd','intl','mysql','pgsql','soap','xml','zip','bz2','pspell','imagick','imap','ldap','apcu']
GROUPS={
 'php':(),
 'panel':('hestia','hestia-php','hestia-nginx'),
 'apache':('apache2','apache2-bin','apache2-data','apache2-utils'),
 'nginx':('nginx','nginx-common','nginx-core','nginx-full','nginx-light','nginx-extras'),
 'database':('mariadb-server','mariadb-server-core','mariadb-client','mariadb-client-core','mariadb-common','libmariadb3','galera-4','mysql-server','mysql-server-8.0','mysql-client','mysql-common'),
 'mail':('exim4','exim4-base','exim4-config','exim4-daemon-heavy','exim4-daemon-light','dovecot-core','dovecot-imapd','dovecot-pop3d','dovecot-lmtpd','roundcube','roundcube-core'),
 'dns':('bind9','bind9-utils','bind9-host'),
 'security':('fail2ban','clamav','clamav-daemon','spamassassin','iptables','openssl','openssh-server'),
 'tools':('phpmyadmin','certbot','python3','python3.12')}
LABELS={'php':'PHP del alojamiento','panel':'Hestia y componentes internos','apache':'Apache','nginx':'Nginx','database':'MySQL / MariaDB','mail':'Correo y webmail','dns':'DNS','security':'Seguridad y SSH','tools':'Herramientas del servidor'}
ENV={**os.environ,'DEBIAN_FRONTEND':'noninteractive','LC_ALL':'C','PATH':'/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'}

def now():return datetime.now(timezone.utc).isoformat()
def run(args,check=True):
    result=subprocess.run(list(map(str,args)),capture_output=True,text=True,env=ENV,timeout=90)
    if check and result.returncode:raise ValueError('Operacion del sistema fallida: '+str(args[0])+'; '+result.stderr[-1200:])
    return result
def atomic(path,data):
    path.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8');tmp.chmod(0o600);os.replace(tmp,path)
def policy():return json.loads(POLICY_PATH.read_text(encoding='utf-8'))
def branch(version):
    m=re.match(r'^(?:\d+:)?(\d+\.\d+)',version or '');return m.group(1) if m else None
def newer(a,b):return bool(a and b and run(['dpkg','--compare-versions',a,'lt',b],False).returncode==0)

def change_type(a,b):
    if not a or not b:return 'unknown'
    return 'maintenance' if branch(a)==branch(b) and branch(a) else 'branch'

def component_names(component,packages):
    if component=='php':
        suffixes=set(NATIVE_PHP)|set(EXTENSIONS)
        return sorted(n for n in packages if (m:=re.fullmatch(r'php\d+\.\d+-([a-z0-9]+)',n)) and m[1] in suffixes)
    return [n for n in GROUPS.get(component,()) if n in packages]

def php_alternative():
    text=run(['update-alternatives','--query','php']).stdout
    value=re.search(r'^Value: (/usr/bin/php\d+\.\d+)$',text,re.M)
    status=re.search(r'^Status: (auto|manual)$',text,re.M)
    if not value or not status:raise ValueError('Seleccion PHP CLI no reconocida; revisar antes de instalar otra rama.')
    return {'value':value[1],'status':status[1]}
def installed_packages():
    output=run(['dpkg-query','-W','-f=${binary:Package}\t${Version}\t${db:Status-Status}\n']).stdout
    return {fields[0].split(':')[0]:fields[1] for line in output.splitlines() if len(fields:=line.split('\t'))==3 and fields[2]=='installed'}
def candidates(names):
    result={};current=None
    if not names:return result
    for line in run(['apt-cache','policy',*sorted(set(names))],False).stdout.splitlines():
        if re.match(r'^[a-z0-9][a-z0-9+.-]*(?::[a-z0-9]+)?:$',line):current=line.split(':')[0]
        elif current and line.strip().startswith('Candidate:'):
            value=line.split(':',1)[1].strip();result[current]=None if value=='(none)' else value
    return result
def usage():
    counts={};shared=set()
    # Hestia's DEFAULT_PHP_VERSION is obtained from the system CLI, not hestia.conf.
    result=run(['/usr/bin/php','-r','echo PHP_MAJOR_VERSION,".",PHP_MINOR_VERSION;'],False)
    default=result.stdout.strip() if result.returncode==0 and re.fullmatch(r'\d+\.\d+',result.stdout.strip()) else None
    for path in (ROOT/'data/users').glob('*/web.conf'):
        for version in re.findall(r"BACKEND='PHP-([0-9]+_[0-9]+)'",path.read_text()):
            key=version.replace('_','.');counts[key]=counts.get(key,0)+1
        if default:counts[default]=counts.get(default,0)+len(re.findall(r"BACKEND='default'",path.read_text()))
    for path in PHP_ETC.glob('*/fpm/pool.d/*.conf'):
        if re.search(r'^\s*listen\s*=\s*/run/php/www.sock\s*$',path.read_text(),re.M):shared.add(path.parents[2].name)
    return counts,default,shared
def php_support(version,p):
    item=p['php'].get(version)
    if not item:return 'unreviewed'
    today=date.today().isoformat()
    return 'eol' if today>item['securityEnd'] else 'security' if today>item['activeEnd'] else 'active'
def module_enabled(version,modules,sapi):
    folder=PHP_ETC/version/sapi/'conf.d'
    return all(any(p.is_file() for p in folder.glob('*-'+module+'.ini')) for module in modules)

def native_php_script():
    text=(ROOT/'bin/v-add-web-php').read_text()
    update='apt-get -qq update'
    install='apt-get -y -qq -o Dpkg::Options::="--force-confold" install $mph > /dev/null 2>&1 &'
    if text.count(update)!=1 or text.count(install)!=1:raise ValueError('Instalador PHP nativo no compatible; requiere revision antes de usarlo.')
    text=text.replace(update,': # Indices conservados del plan confirmado').replace(install,'true & # Paquetes instalados por el broker con versiones fijadas')
    if re.search(r'\b(?:apt-get|apt|dpkg)\b', '\n'.join(line for line in text.splitlines() if not line.lstrip().startswith(('#','echo')))):
        raise ValueError('Instalador PHP contiene otra operacion de paquetes; requiere revision.')
    return text

def fingerprint():
    values={'packages':installed_packages(),'policy':policy(),'usage':usage()[:2],'modules':{}}
    for item in PHP_ETC.glob('*/?*/conf.d/*.ini'):
        values['modules'][str(item)]=str(item.resolve())+(':'+hashlib.sha256(item.read_bytes()).hexdigest() if item.is_file() else ':broken')
    for item in [ROOT/'bin/v-add-web-php',ROOT/'install/upgrade/upgrade.conf',ROOT/'conf/hestia.conf']:
        if item.is_file():values[str(item)]=hashlib.sha256(item.read_bytes()).hexdigest()
    if Path('/usr/bin/php').exists():values['phpAlternative']=php_alternative()
    return hashlib.sha256(json.dumps(values,sort_keys=True,default=str).encode()).hexdigest()
def inventory():
    packages=installed_packages();p=policy();counts,default,shared=usage()
    versions=sorted(set(p['php'])|{m.group(1) for name in packages if (m:=re.match(r'^php(\d+\.\d+)-fpm$',name))})
    names={name for component in GROUPS for name in component_names(component,packages)}
    for version in versions:
        names.update('php'+version+'-'+name for name in [*EXTENSIONS,'fpm'])
    available=candidates(names)
    components=[]
    for name,group in GROUPS.items():
        items=[{'name':n,'installed':packages[n],'candidate':available.get(n),'update':newer(packages[n],available.get(n)),'change':change_type(packages[n],available.get(n))} for n in component_names(name,packages)]
        components.append({'id':name,'label':LABELS[name],'packages':items,'status':'packaged' if items else 'unknown','upstream':p.get('upstream',{}).get(name)})
    php=[]
    for version in versions:
        base='php'+version+'-';info=[]
        for name,modules in EXTENSIONS.items():
            # Shared consumers cannot always be discovered from their sockets. Be conservative on every branch.
            package=base+name;protected=name in {'curl','intl','mbstring','mysql','xml','zip'}
            info.append({'name':name,'package':package,'installed':packages.get(package),'candidate':available.get(package),'enabledFpm':module_enabled(version,modules,'fpm'),'enabledCli':module_enabled(version,modules,'cli'),'protected':protected})
        php.append({'version':version,'installed':packages.get(base+'fpm'),'candidate':available.get(base+'fpm'),'support':php_support(version,p),'policy':p['php'].get(version),'usage':counts.get(version,0),'default':version==default,'shared':version in shared,'extensions':info})
    history=[]
    for file in sorted((STATE/'jobs').glob('*.json'),key=lambda p:p.stat().st_mtime,reverse=True)[:15]:
        item=json.loads(file.read_text());history.append({key:item.get(key) for key in ['id','actor','title','state','started','finished','error']})
    panel_php=run([ROOT/'php/bin/php','-r','echo PHP_VERSION;'],False).stdout.strip() if (ROOT/'php/bin/php').exists() else None
    return {'generated':now(),'policyReviewed':p['reviewed'],'policySource':p['phpSource'],'components':components,'php':php,'history':history,'panelPhp':panel_php,'defaultPhp':default,'rebootRequired':Path('/var/run/reboot-required').exists()}

def parse_simulation(text):
    if any(line.startswith(('Remv ','Purg ')) for line in text.splitlines()):raise ValueError('El plan retiraria paquetes; requiere revision manual.')
    result=[]
    for line in text.splitlines():
        m=re.match(r'^Inst ([a-zA-Z0-9.+:-]+)(?: \[([^]]+)\])? \(([^\s)]+)',line)
        if m:result.append({'package':m[1],'from':m[2] or None,'to':m[3]})
        elif line.startswith('Inst '):raise ValueError('Formato de simulacion no reconocido.')
    for item in result:
        if re.match(r'^(mariadb|mysql)-(server|client)',item['package']) and (not item['from'] or branch(item['from'])!=branch(item['to'])):
            raise ValueError('Cambio de rama de base de datos: requiere un plan de migracion y compatibilidad independiente.')
        if item['from'] and newer(item['to'],item['from']):raise ValueError('El plan degradaria paquetes; requiere revision manual.')
    return result
def simulate(arguments):return parse_simulation(run(['apt-get','-s','--no-remove',*arguments]).stdout)
def validate_operation(op):
    if not isinstance(op,dict):raise ValueError('Operacion no valida.')
    kind=op.get('kind')
    keys={'refresh':{'kind'},'upgrade':{'kind','component'},'php_install':{'kind','version'},'php_extensions':{'kind','version','enabled'}}
    if not isinstance(kind,str) or kind not in keys or set(op)!=keys[kind]:raise ValueError('Operacion o parametros no permitidos.')
    if kind=='upgrade' and (not isinstance(op.get('component'),str) or op.get('component') not in GROUPS):raise ValueError('Componente no permitido.')
    if kind in {'php_install','php_extensions'}:
        if not isinstance(op.get('version'),str) or op.get('version') not in policy()['php']:raise ValueError('Version PHP no permitida o pendiente de revision.')
        if php_support(op['version'],policy())=='eol':raise ValueError('No se instala una rama PHP sin soporte.')
    if kind=='php_extensions':
        enabled=op.get('enabled')
        if not isinstance(enabled,dict) or not enabled or len(enabled)>len(EXTENSIONS) or any(k not in EXTENSIONS or type(v) is not bool for k,v in enabled.items()):raise ValueError('Seleccion de extensiones no valida.')
    return op
def make_plan(op):
    validate_operation(op);packages=installed_packages();arguments=[];changes=[];warnings=[];modules=[];alternative=None
    kind=op['kind'];title='Actualizar indices de repositorios'
    if kind=='upgrade':
        component=op['component'];title='Actualizar '+LABELS[component]
        names=component_names(component,packages)
        if not names:raise ValueError('No hay paquetes instalados para este componente.')
        arguments=['install','--only-upgrade',*names]
        changes=simulate(arguments)
        warnings.append('Se conservan configuraciones locales. Los servicios actualizados pueden reiniciarse. No se cambia de repositorio ni de motor SQL.')
    elif kind=='php_install':
        version=op['version'];title='Instalar PHP '+version+' en paralelo'
        if 'php'+version+'-fpm' in packages:raise ValueError('Esta version PHP ya esta instalada.')
        if (PHP_ETC/version/'fpm').exists():raise ValueError('Hay configuracion FPM previa; revisar manualmente antes de instalar.')
        native_php_script()
        alternative=php_alternative()
        upgrade=(ROOT/'install/upgrade/upgrade.conf').read_text()
        if not re.search(r'(?<![\d.])'+re.escape(version)+r'(?![\d.])',upgrade):raise ValueError('Esta rama no esta admitida por el instalador nativo.')
        names=['php'+version+'-'+name for name in NATIVE_PHP]
        config=(ROOT/'conf/hestia.conf').read_text()
        for driver in ['mysql','pgsql']:
            if not re.search(r"^DB_SYSTEM='[^']*\b"+driver+r"\b",config,re.M):names.remove('php'+version+'-'+driver)
        arguments=['install',*names];changes=simulate(arguments)
        warnings.append('Instalacion en paralelo con paquetes fijados al plan y configuracion del instalador nativo compatible. No cambia la version predeterminada ni los sitios.')
        if alternative['status']=='auto':warnings.append('Se fija la seleccion CLI existente en modo manual para evitar que APT cambie el PHP predeterminado al instalar una rama nueva.')
    elif kind=='php_extensions':
        version=op['version'];title='Extensiones compartidas de PHP '+version
        if 'php'+version+'-fpm' not in packages:raise ValueError('Instala primero esta version PHP.')
        counts,default,shared=usage();names=[]
        for name,enabled in op['enabled'].items():
            if not enabled and name in {'curl','intl','mbstring','mysql','xml','zip'}:raise ValueError('Extension protegida por servicios compartidos; revisar manualmente antes de desactivar.')
            package='php'+version+'-'+name
            if enabled and package not in packages:names.append(package)
            modules.append({'name':name,'enabled':enabled,'modules':EXTENSIONS[name]})
        arguments=['install',*names] if names else []
        if names:changes=simulate(arguments)
        warnings.append(f'Aplica a FPM y CLI de PHP {version}, compartidos por {counts.get(version,0)} dominios. No es una configuracion individual de cuenta. Desactivar no elimina paquetes ni archivos.')
    if len(changes)>500:raise ValueError('Plan demasiado amplio; dividir el mantenimiento.')
    for item in changes:
        if item['package'].split(':')[0]=='hestia' and item['from'] and re.sub(r'[-+~].*$','',item['from'])!=re.sub(r'[-+~].*$','',item['to']):
            raise ValueError('Otra version de Hestia requiere validar la compatibilidad de VIP y sus accesos antes de actualizar.')
        if item['from'] and re.match(r'^(hestia|apache2|nginx|exim4|dovecot|bind9)(?:-|$)',item['package']) and change_type(item['from'],item['to'])!='maintenance':
            raise ValueError('Cambio de rama de servicio: requiere revision de compatibilidad independiente.')
    database=any(re.match(r'^(mariadb|mysql)-(server|client)',x['package']) for x in changes)
    if changes:
        # Explicit versions for every simulated dependency; never upgrade an unplanned package.
        arguments=['install',*[x['package']+'='+x['to'] for x in changes]]
        if simulate(arguments)!=changes:raise ValueError('El plan fijado no coincide con la simulacion inicial.')
    elif kind=='upgrade':arguments=[]
    return {'operation':op,'title':title,'changes':changes,'modules':modules,'warnings':warnings,'databaseBackup':database,'arguments':arguments,'restartExpected':kind!='refresh','fingerprint':fingerprint(),'phpAlternative':alternative}

class Broker:
    def __init__(self):
        self.lock=threading.Lock();self.query_lock=threading.Lock();self.active=None;self.cache=None;self.cache_time=0;self.stopping=False
        self.recovery_required=any(json.loads(p.read_text()).get('state')=='interrupted' for p in (STATE/'jobs').glob('*.json'))
    def get_inventory(self):
        if self.cache is None or time.monotonic()-self.cache_time>600:
            if not self.query_lock.acquire(blocking=False):raise ValueError('Consulta de inventario en curso; reintenta en unos segundos.')
            try:self.cache=inventory();self.cache_time=time.monotonic()
            finally:self.query_lock.release()
        return {**self.cache,'activeJob':self.active,'recoveryRequired':self.recovery_required}
    def request(self,data):
        if not isinstance(data,dict) or set(data)-{'action','actor','operation','plan','job','confirm'}:raise ValueError('Solicitud no permitida.')
        actor=data.get('actor','')
        if not isinstance(actor,str) or not ACTOR.fullmatch(actor):raise ValueError('Identidad no valida.')
        action=data.get('action')
        keys={'status':{'action','actor'},'inventory':{'action','actor'},'plan':{'action','actor','operation'},'apply':{'action','actor','plan','confirm'},'job':{'action','actor','job'}}
        if not isinstance(action,str) or action not in keys or set(data)!=keys[action]:raise ValueError('Parametros de solicitud no permitidos.')
        if self.stopping and action in {'plan','apply'}:raise ValueError('El servicio se esta deteniendo; espera antes de planificar.')
        if self.recovery_required and action in {'plan','apply'}:raise ValueError('Hay una tarea interrumpida. El administrador debe revisar dpkg y los servicios antes de reconocerla por CLI.')
        if action=='status':return {'activeJob':self.active,'stopping':self.stopping,'recoveryRequired':self.recovery_required}
        if action=='inventory':return self.get_inventory()
        if action=='plan':
            if not self.lock.acquire(blocking=False):raise ValueError('Ya hay una tarea en ejecucion.')
            try:
                plan=make_plan(data.get('operation'));plan.update({'id':uuid.uuid4().hex,'actor':actor,'created':now(),'expires':time.time()+600})
                atomic(STATE/'plans'/(plan['id']+'.json'),plan);return plan
            finally:self.lock.release()
        if action=='apply':
            if data.get('confirm') is not True:raise ValueError('Confirma expresamente el plan.')
            key=data.get('plan','')
            if not isinstance(key,str) or not re.fullmatch('[a-f0-9]{32}',key):raise ValueError('Plan no valido.')
            if not self.lock.acquire(blocking=False):raise ValueError('Ya hay una tarea en ejecucion.')
            try:
                path=STATE/'plans'/(key+'.json');plan=json.loads(path.read_text())
                if plan['actor']!=actor or plan['expires']<time.time():raise ValueError('Plan vencido o de otro administrador.')
                fresh=make_plan(plan['operation'])
                if any(fresh[key]!=plan[key] for key in ['changes','modules','fingerprint','arguments','databaseBackup']):raise ValueError('El inventario o los paquetes cambiaron. Genera un plan nuevo.')
                job={'id':uuid.uuid4().hex,'actor':actor,'title':plan['title'],'state':'queued','started':now(),'plan':plan,'log':[]}
                atomic(STATE/'jobs'/(job['id']+'.json'),job);path.unlink();self.active=job['id']
                threading.Thread(target=self.execute,args=(job,),daemon=False).start();return {'job':job['id']}
            except Exception:self.active=None;self.lock.release();raise
        if action=='job':
            key=data.get('job','')
            if not isinstance(key,str) or not re.fullmatch('[a-f0-9]{32}',key):raise ValueError('Tarea no valida.')
            job=json.loads((STATE/'jobs'/(key+'.json')).read_text())
            if job['actor']!=actor:raise ValueError('La tarea pertenece a otro administrador.')
            return {k:v for k,v in job.items() if k!='plan'}
        raise ValueError('Accion no permitida.')
    def execute(self,job):
        target=STATE/'jobs'/(job['id']+'.json');plan=job['plan'];op=plan['operation']
        snapshot=None;services=[]
        def log(message):
            job['log']=(job['log']+[re.sub(r'\x1b\[[0-9;]*[a-zA-Z]','',message)[:1500]])[-160:];atomic(target,job)
        def command(args):
            log('Ejecutando '+str(args[0])+' '+(' '.join(map(str,args[1:]))))
            process=subprocess.Popen(list(map(str,args)),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,env=ENV)
            for line in iter(lambda:process.stdout.readline(4096),''):
                if line.strip():log(line.rstrip())
            if process.wait():raise ValueError('El comando fallo; consulta el registro y el respaldo antes de reintentar.')
        try:
            job['state']='running';atomic(target,job)
            if fingerprint()!=plan['fingerprint']:raise ValueError('El inventario cambio antes de ejecutar; genera un plan nuevo.')
            if plan['arguments'] and simulate(plan['arguments'])!=plan['changes']:raise ValueError('La simulacion cambio antes de ejecutar; no se aplicaron paquetes.')
            if op['kind']!='refresh':
                services=active_services();job['servicesBefore']=services
                backup=STATE/'backups'/job['id'];backup.mkdir(parents=True,mode=0o700)
                atomic(backup/'packages.json',installed_packages())
                with tarfile.open(backup/'configuration.tar.gz','w:gz') as tar:
                    for path in backup_paths(op):
                        if path.exists():tar.add(path,arcname=str(path).lstrip('/'))
                (backup/'configuration.tar.gz').chmod(0o600)
                if plan['databaseBackup']:
                    log('Creando respaldo SQL privado antes de actualizar el motor.')
                    dump=shutil.which('mariadb-dump') or shutil.which('mysqldump')
                    if not dump:raise ValueError('No se encontro una herramienta nativa de respaldo SQL; no se instalaron paquetes.')
                    credentials=next((p for host in ['localhost','127.0.0.1'] if (p:=ROOT/'conf'/('.mysql.'+host)).is_file()),None)
                    if not credentials:raise ValueError('No se encontro el archivo nativo de acceso SQL local. Revisar el respaldo antes de actualizar.')
                    # Lock all tables also covers nontransactional engines. Error output stays private.
                    with gzip.open(backup/'databases.sql.gz','wb') as output,(backup/'dump-error.log').open('wb') as error:
                        proc=subprocess.Popen([dump,'--defaults-extra-file='+str(credentials),'--all-databases','--lock-all-tables','--routines','--events','--triggers','--hex-blob'],stdout=subprocess.PIPE,stderr=error,env=ENV)
                        shutil.copyfileobj(proc.stdout,output)
                        if proc.wait():raise ValueError('No se pudo respaldar SQL. No se instalaron cambios.')
                    (backup/'databases.sql.gz').chmod(0o600)
                job['backup']=str(backup);atomic(target,job)
                if op['kind']=='php_extensions':
                    snapshot=backup/'module-links';snapshot.mkdir(mode=0o700)
                    for sapi in ['fpm','cli']:
                        source=PHP_ETC/op['version']/sapi/'conf.d'
                        if not source.is_dir():raise ValueError('No se encontro configuracion '+sapi+'; no se modificaron modulos.')
                        shutil.copytree(source,snapshot/sapi,symlinks=True)
            apt=['apt-get','-y','--no-remove','-o','Dpkg::Options::=--force-confold']
            if op['kind']=='refresh':command(['apt-get','update'])
            else:
                if op['kind']=='php_install':
                    atomic(backup/'php-alternative.json',plan['phpAlternative'])
                    command(['update-alternatives','--set','php',plan['phpAlternative']['value']])
                if plan['arguments']:command([*apt,*plan['arguments']])
                actual=installed_packages()
                if any(actual.get(x['package'].split(':')[0])!=x['to'] for x in plan['changes']):raise ValueError('Los paquetes instalados no coinciden con el plan.')
                if op['kind']=='php_install':
                    native=backup/'configure-php.sh';native.write_text(native_php_script());native.chmod(0o700)
                    command(['/bin/bash',native,op['version']]);command(['php-fpm'+op['version'],'-t'])
                    command(['systemctl','restart','php'+op['version']+'-fpm'])
                    if php_alternative()['value']!=plan['phpAlternative']['value']:raise ValueError('La seleccion PHP predeterminada cambio; revisar y restaurar la alternativa respaldada.')
                if op['kind']=='php_extensions':
                    for item in plan['modules']:
                        for sapi in ['fpm','cli']:command(['phpenmod' if item['enabled'] else 'phpdismod','-v',op['version'],'-s',sapi,*item['modules']])
                    command(['php-fpm'+op['version'],'-t'])
                    command(['systemctl','reload','php'+op['version']+'-fpm'])
                    verify_modules(op['version'],plan['modules'])
                if op['kind'] in {'php_install','php_extensions'}:command(['systemctl','is-active','php'+op['version']+'-fpm'])
            job['serviceChecks']={name:run(['systemctl','is-active','--quiet',name],False).returncode==0 for name in services}
            if not all(job['serviceChecks'].values()):raise ValueError('Un servicio antes activo no esta activo tras la operacion; revisar el historial y configuracion respaldada.')
            job['rebootRequired']=Path('/var/run/reboot-required').exists()
            job['state']='succeeded';log('Operacion completada. Se conserva un respaldo de configuracion; no se promete downgrade automatico.')
        except Exception as error:
            job['state']='failed';job['error']=str(error);log(str(error))
            if snapshot:
                try:
                    restore_modules(snapshot,op['version']);command(['php-fpm'+op['version'],'-t']);command(['systemctl','reload','php'+op['version']+'-fpm'])
                    job['configurationRestored']=True;log('Enlaces de modulos anteriores restaurados; los paquetes instalados se conservan.')
                except Exception as recovery:job['configurationRestored']=False;log('Restauracion requiere revision manual: '+str(recovery))
        finally:
            try:
                job['finished']=now();atomic(target,job)
                with (STATE/'audit.jsonl').open('a') as audit:audit.write(json.dumps({k:job.get(k) for k in ['id','actor','title','state','started','finished','error']})+'\n')
            finally:self.cache=None;self.active=None;self.lock.release()

def backup_paths(op):
    groups={'php':[PHP_ETC,ROOT/'data/templates/web/php-fpm'],
            'apache':[Path('/etc/apache2')],'nginx':[Path('/etc/nginx')],
            'database':[Path('/etc/mysql')],
            'mail':[Path('/etc/exim4'),Path('/etc/dovecot'),Path('/etc/roundcube')],
            'dns':[Path('/etc/bind')],
            'security':[Path('/etc/fail2ban'),Path('/etc/clamav'),Path('/etc/spamassassin'),Path('/etc/ssh'),Path('/etc/iptables')],
            'tools':[Path('/etc/phpmyadmin'),Path('/etc/letsencrypt')],
            'panel':[ROOT/'conf',ROOT/'nginx/conf']}
    # Dependencies may update another service, so configuration backups cover all managed services.
    selected=list(groups) if op['kind']=='upgrade' else ['php','apache']
    return [p for key in selected for p in groups[key]]

def active_services():
    names=['hestia','nginx','apache2','mariadb','mysql','exim4','dovecot','bind9','named','fail2ban','clamav-daemon','spamassassin','vip-certificate-renew.timer']
    names.extend('php'+m[1]+'-fpm' for package in installed_packages() if (m:=re.fullmatch(r'php(\d+\.\d+)-fpm',package)))
    return [name for name in names if run(['systemctl','is-active','--quiet',name],False).returncode==0]

def verify_modules(version,modules):
    for sapi,executable in [('cli','php'+version),('fpm','php-fpm'+version)]:
        loaded={line.strip().lower() for line in run([executable,'-m']).stdout.splitlines()}
        for item in modules:
            for module in item['modules']:
                if (module.lower() in loaded)!=item['enabled']:raise ValueError('Estado efectivo inesperado de '+item['name']+' en '+sapi)
            if module_enabled(version,item['modules'],sapi)!=item['enabled']:raise ValueError('Enlaces de modulos inesperados en '+sapi)

def restore_modules(snapshot,version):
    for sapi in ['fpm','cli']:
        saved=snapshot/sapi
        if not saved.is_dir():continue
        destination=PHP_ETC/version/sapi/'conf.d'
        # Both paths are fixed internal directories, never supplied by a request.
        shutil.rmtree(destination);shutil.copytree(saved,destination,symlinks=True)

def serve(web_user):
    if os.name!='posix' or not hasattr(socket,'SO_PEERCRED'):raise SystemExit('El servicio requiere Linux con SO_PEERCRED.')
    if os.geteuid()!=0:raise SystemExit('Run the broker as root.')
    os.umask(0o077)
    STATE.mkdir(mode=0o700,parents=True,exist_ok=True);STATE.chmod(0o700)
    for folder in ['plans','jobs','backups']:(STATE/folder).mkdir(mode=0o700,exist_ok=True)
    lock=(STATE/'broker.lock').open('w');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    for path in (STATE/'jobs').glob('*.json'):
        job=json.loads(path.read_text())
        if job['state'] in {'queued','running'}:job.update({'state':'interrupted','finished':now(),'error':'El broker se reinicio. Revisar dpkg y registros antes de continuar.'});atomic(path,job)
    RUN.mkdir(mode=0o750,exist_ok=True);RUN.chmod(0o750);os.chown(RUN,0,grp.getgrnam(web_user).gr_gid)
    uid=pwd.getpwnam(web_user).pw_uid;broker=Broker();socket_path=RUN/'control.sock';socket_path.unlink(missing_ok=True)
    class Handler(socketserver.StreamRequestHandler):
        def handle(self):
            peer=struct.unpack('3i',self.request.getsockopt(socket.SOL_SOCKET,socket.SO_PEERCRED,12))[1]
            try:
                if peer not in (0,uid):raise ValueError('Cliente local no autorizado.')
                self.request.settimeout(10);line=self.rfile.readline(65537)
                if len(line)>65536 or not line.endswith(b'\n'):raise ValueError('Solicitud demasiado grande o incompleta.')
                data=json.loads(line);response={'ok':True,'data':broker.request(data)}
            except Exception as error:response={'ok':False,'error':str(error)[:1500]}
            payload=json.dumps(response,ensure_ascii=False).encode()+b'\n'
            if len(payload)>1048576:payload=b'{"ok":false,"error":"Respuesta demasiado grande."}\n'
            self.wfile.write(payload)
    class Server(socketserver.ThreadingMixIn,socketserver.UnixStreamServer):
        daemon_threads=True
        request_queue_size=8
        slots=threading.BoundedSemaphore(8)
        def process_request(self,request,client_address):
            if not self.slots.acquire(blocking=False):self.shutdown_request(request);return
            try:super().process_request(request,client_address)
            except Exception:self.slots.release();raise
        def process_request_thread(self,request,client_address):
            try:super().process_request_thread(request,client_address)
            finally:self.slots.release()
    with Server(str(socket_path),Handler) as server:
        def stop(signum,frame):
            broker.stopping=True;threading.Thread(target=server.shutdown,daemon=True).start()
        signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
        os.chown(socket_path,0,grp.getgrnam(web_user).gr_gid);socket_path.chmod(0o660);server.serve_forever()
        with broker.lock:pass # Never interrupt a package transaction when systemd stops the service.
    socket_path.unlink(missing_ok=True)

def acknowledge_interrupted():
    if os.name!='posix' or os.geteuid()!=0:raise SystemExit('Se requiere root en Linux.')
    with (STATE/'broker.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        for name in ['/var/lib/dpkg/lock-frontend','/var/lib/dpkg/lock','/var/lib/apt/lists/lock','/var/cache/apt/archives/lock']:
            with open(name,'r+') as package_lock:fcntl.lockf(package_lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        if run(['dpkg','--audit']).stdout.strip():raise ValueError('dpkg informa problemas; resolverlos antes de reconocer la interrupcion.')
        for path in (STATE/'jobs').glob('*.json'):
            job=json.loads(path.read_text())
            if job.get('state')=='interrupted':
                job.update({'state':'interrupted-reviewed','reviewed':now(),'reviewedBy':'root'});atomic(path,job)
                with (STATE/'audit.jsonl').open('a') as audit:audit.write(json.dumps({'id':job['id'],'actor':'root','state':'interrupted-reviewed','reviewed':job['reviewed']})+'\n')
    print('Interrupciones reconocidas. No se reinstalaron paquetes ni restauraron bases de datos.')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--web-user',default='hestiaweb');parser.add_argument('--hestia-root',default=str(ROOT));parser.add_argument('--state',default=str(STATE));parser.add_argument('--policy',default=str(POLICY_PATH));parser.add_argument('--acknowledge-interrupted',action='store_true');args=parser.parse_args()
    ROOT=Path(args.hestia_root).resolve();STATE=Path(args.state).resolve();POLICY_PATH=Path(args.policy).resolve()
    if args.acknowledge_interrupted:acknowledge_interrupted()
    else:serve(args.web_user)
