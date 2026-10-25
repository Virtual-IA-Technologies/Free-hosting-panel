#!/usr/bin/python3
"""Optional, enumerated backup policies. Root CLI only; no shell or resident daemon."""
import configparser
from datetime import datetime,timezone
try:import fcntl
except ImportError:fcntl=None  # Pure validation tests also run on Windows.
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import sys
import time
import threading
from zoneinfo import ZoneInfo

STATE=Path('/var/lib/vip-backup-admin')
BIN=Path('/usr/local/hestia/bin')
RCLONE=Path('/root/.config/rclone/rclone.conf')
IDENT=re.compile(r'[a-f0-9]{32}')
USER=re.compile(r'[a-zA-Z0-9][a-zA-Z0-9_-]{0,31}')

def command(args,timeout=60):
    p=subprocess.run([str(x) for x in args],capture_output=True,text=True,timeout=timeout)
    if p.returncode:raise ValueError('Falló una operación de respaldo; revisa el servicio, espacio y permisos del destino.')
    return p.stdout

def native(name,*args):
    raw=command([BIN/name,*args,'json']);return json.loads(raw) if raw.strip() else {}

def load(path,default):
    return json.loads(path.read_text()) if path.exists() else default

def write(path,value):
    path.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    temp=path.with_name(path.name+'.'+secrets.token_hex(5));temp.write_text(json.dumps(value,ensure_ascii=True));temp.chmod(0o600);temp.replace(path)

def audit(actor,action,identifier):
    with (STATE/'audit.jsonl').open('a') as stream:stream.write(json.dumps({'time':int(time.time()),'actor':actor,'action':action,'id':identifier})+'\n')

def role(actor):
    if not isinstance(actor,str) or not USER.fullmatch(actor):raise ValueError('Administrador no válido')
    text=(Path('/usr/local/hestia/data/users')/actor/'user.conf').read_text()
    if not re.search(r"^ROLE=['\"]?admin['\"]?$",text,re.M) or re.search(r"^SUSPENDED=['\"]?yes['\"]?$",text,re.M):raise ValueError('Se requiere administrador activo sin suplantación')

def fields(expression):
    parts=expression.split()
    if len(parts)!=5 or len(expression)>120:raise ValueError('Cron debe tener cinco campos')
    result=[]
    for text,(low,high) in zip(parts,[(0,59),(0,23),(1,31),(1,12),(0,7)]):
        values=set()
        for part in text.split(','):
            match=re.fullmatch(r'(\*|\d+(?:-\d+)?)(?:/(\d+))?',part)
            if not match:raise ValueError('Campo cron no válido')
            start,end=(low,high) if match[1]=='*' else ([int(x) for x in match[1].split('-')] if '-' in match[1] else (int(match[1]),int(match[1])))
            if match[2] and match[1].isdigit():end=high
            step=int(match[2] or 1)
            if not low<=start<=end<=high or not 1<=step<=high-low+1:raise ValueError('Rango cron no válido')
            values.update(range(start,end+1,step))
        result.append(values)
    return result

def due(expression,now):
    values=fields(expression);weekday=(now.weekday()+1)%7
    if weekday==0:values[4]={0 if x==7 else x for x in values[4]}
    day=now.day in values[2];week=weekday in values[4];parts=expression.split()
    # Cron uses OR when both day-of-month and day-of-week are restricted.
    calendar=(day or week) if not parts[2].startswith('*') and not parts[4].startswith('*') else day and week
    return now.minute in values[0] and now.hour in values[1] and now.month in values[3] and calendar

def remotes():
    if not RCLONE.is_file():return []
    parser=configparser.ConfigParser(interpolation=None);parser.read(RCLONE)
    return [{'id':name,'type':parser.get(name,'type',fallback='unknown')} for name in parser.sections() if re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,63}',name)]

def validate(value,users):
    allowed={'id','name','accounts','kind','destination','folder','schedules','timezone','enabled','retention'}
    if not isinstance(value,dict) or set(value)!=allowed:raise ValueError('Configuración no válida')
    identifier=value['id']
    if identifier and (not isinstance(identifier,str) or not IDENT.fullmatch(identifier)):raise ValueError('ID no válido')
    if not isinstance(value['name'],str) or not 1<=len(value['name'].strip())<=80 or any(ord(c)<32 for c in value['name']):raise ValueError('Nombre no válido')
    if not isinstance(value['accounts'],list) or not value['accounts'] or len(value['accounts'])>1000 or any(not isinstance(u,str) or u not in users for u in value['accounts']):raise ValueError('Selecciona cuentas existentes')
    if value['kind'] not in {'full','databases','web','mail'}:raise ValueError('Tipo no permitido')
    if value['destination'] not in ['local']+[r['id'] for r in remotes()]:raise ValueError('Conecta primero un destino válido')
    folder=value['folder']
    if not isinstance(folder,str) or len(folder)>180 or not re.fullmatch(r'[A-Za-z0-9 _./-]*',folder) or folder.startswith('/') or any(v in {'.','..'} for v in folder.split('/')):raise ValueError('Ruta de destino relativa no válida')
    if not isinstance(value['schedules'],list) or not 1<=len(value['schedules'])<=12:raise ValueError('Indica una o más frecuencias')
    for expression in value['schedules']:
        if not isinstance(expression,str):raise ValueError('Frecuencia no válida')
        fields(expression)
    if not isinstance(value['timezone'],str) or len(value['timezone'])>80:raise ValueError('Zona no válida')
    if value['timezone']!='UTC':ZoneInfo(value['timezone'])
    if type(value['enabled']) is not bool:raise ValueError('Estado no válido')
    retention=value['retention']
    if not isinstance(retention,dict) or set(retention)!={'local','daily','weekly','monthly','hours'} or any(type(v)is not int or not 0<=v<=8760 for v in retention.values()):raise ValueError('Retención no válida')
    if not any(retention.values()) or value['destination']=='local' and retention['local']<1:raise ValueError('Conserva al menos una copia')
    if value['destination']!='local' and not any(retention[k] for k in ['daily','weekly','monthly','hours']):raise ValueError('Configura retención remota')
    return {**value,'id':identifier or secrets.token_hex(16),'accounts':sorted(set(value['accounts'])),'name':value['name'].strip()}

def policies():return load(STATE/'policies.json',{})
def records():return load(STATE/'records.json',[])

def job_state():
    job=load(STATE/'job.json',None)
    if job and job.get('state') in {'queued','running'}:
        pid=job.get('pid');path=Path('/proc')/str(pid)/'cmdline'
        if not pid or not path.is_file() or b'v-vip-backup-admin' not in path.read_bytes():
            job['state']='interrupted';job['error']='La tarea anterior se interrumpió; revisa su resultado antes de repetirla.';write(STATE/'job.json',job)
    return job

def file_record(identifier):
    if not isinstance(identifier,str) or not IDENT.fullmatch(identifier):raise ValueError('ID no válido')
    record=next((r for r in records() if r['id']==identifier),None)
    if not record or not record.get('local'):raise ValueError('Copia local no disponible')
    path=Path(record['path'])
    if path.resolve()!=path or path.parent!=STATE/'artifacts'/identifier or not path.is_file():raise ValueError('Ruta de copia no válida')
    return record

def hosting_users():
    return {owner:info for owner,info in native('v-list-users').items() if info.get('ROLE')!='admin'}

def inventory():
    users=hosting_users();copies=[];failures=0
    for owner in users:
        try:
            for name,info in native('v-list-user-backups',owner).items():copies.append({'native':True,'owner':owner,'name':name,'sizeMb':info.get('SIZE'),'date':info.get('DATE'),'time':info.get('TIME'),'type':info.get('TYPE')})
        except (ValueError,json.JSONDecodeError):failures+=1
    custom=[{k:v for k,v in r.items() if k not in {'path','remotePath'}} for r in records()]
    config=load(STATE/'settings.json',{})
    job=job_state()
    return {'accounts':list(users),'policies':list(policies().values()),'copies':copies+custom,'failedAccounts':failures,'destinations':[{'id':'local','type':'local'},*remotes()],
            'namespace':'VIP/'+config.get('instance','unconfigured'),'job':job,'schedulerInstalled':Path('/etc/cron.d/vip-backup-admin').is_file(),
            'nativeSettings':'/edit/server/#vip-backups','nativeRetention':'/edit/server/#vip-retention'}

def start(actor,identifier):
    if not isinstance(identifier,str) or not IDENT.fullmatch(identifier) or identifier not in policies():raise ValueError('Política no encontrada')
    job=job_state() or {}
    if job.get('state') in {'queued','running'}:
        pid=job.get('pid')
        try:
            if pid:os.kill(pid,0);raise ValueError('Ya hay una copia en curso')
        except ProcessLookupError:pass
    with (STATE/'worker.lock').open('a') as lock:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:raise ValueError('Ya hay una copia en curso')
        with (STATE/'worker.log').open('ab') as log:
            process=subprocess.Popen([sys.executable,str(Path(__file__).resolve()),'run',identifier,actor],stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True,close_fds=True)
        write(STATE/'job.json',{'policy':identifier,'actor':actor,'state':'queued','pid':process.pid,'started':int(time.time())})
    audit(actor,'run_requested',identifier)
    return {'state':'queued'}

def retention_ids(items,policy,now):
    keep=set();ordered=sorted(items,key=lambda r:r['created'],reverse=True);rule=policy['retention']
    if policy['destination']=='local':keep.update(r['id'] for r in ordered[:rule['local']])
    for key,formatter in [('daily',lambda d:d.strftime('%Y-%m-%d')),('weekly',lambda d:d.strftime('%G-%V')),('monthly',lambda d:d.strftime('%Y-%m'))]:
        groups=set()
        for record in ordered:
            group=formatter(datetime.fromtimestamp(record['created'],timezone.utc if policy['timezone']=='UTC' else ZoneInfo(policy['timezone'])))
            if group not in groups and len(groups)<rule[key]:groups.add(group);keep.add(record['id'])
    if rule['hours']:keep.update(r['id'] for r in ordered if r['created']>=now-rule['hours']*3600)
    return keep

def cloud(args,timeout=3600):return command(['/usr/bin/rclone','--config',RCLONE,*args,'--transfers','1','--checkers','2'],timeout)

def make_copy(policy,owner):
    before={p.name for p in (STATE/'artifacts').iterdir()} if (STATE/'artifacts').exists() else set()
    try:return make_copy_inner(policy,owner)
    except Exception:
        # A failed transfer is never a valid copy. Only remove this worker's new local files.
        for folder in (STATE/'artifacts').iterdir():
            if folder.name not in before and IDENT.fullmatch(folder.name) and folder.is_dir() and not folder.is_symlink():shutil.rmtree(folder)
        raise

def make_copy_inner(policy,owner):
    identifier=secrets.token_hex(16);folder=STATE/'artifacts'/identifier;folder.mkdir(parents=True,mode=0o700)
    now=int(time.time());name=owner+'-'+policy['kind']+'-'+datetime.fromtimestamp(now,timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    result={'id':identifier,'owner':owner,'policy':policy['id'],'name':name,'kind':policy['kind'],'created':now,'native':False,'local':True,'remote':False}
    if policy['kind']=='full':
        # Preserve native backup format, account metadata and exclusion handling.
        command(['/usr/bin/ionice','-c','3','/usr/bin/nice','-n','19',BIN/'v-backup-user',owner,'no'],7200)
        copies=native('v-list-user-backups',owner)
        if not copies:raise ValueError('Hestia no registró una copia local')
        name=max(copies,key=lambda n:copies[n].get('DATE','')+' '+copies[n].get('TIME',''))
        if Path(name).name!=name:raise ValueError('Nombre de copia nativa no válido')
        source=Path(load(STATE/'settings.json',{}).get('nativeBackupDir','/backup'))/name
        if not source.is_file() or source.is_symlink():raise ValueError('No se encontró la copia en el directorio nativo configurado')
        path=folder/name
        try:os.link(source,path)
        except OSError:shutil.copy2(source,path)
        result['name']=name;result['nativeName']=name
    elif policy['kind']=='databases':
        databases=list(native('v-list-databases',owner))
        if not databases:raise ValueError('La cuenta no tiene bases de datos')
        if any(not re.fullmatch(r'[a-zA-Z0-9_$][a-zA-Z0-9_$-]{0,63}',v) for v in databases):raise ValueError('Nombre SQL no válido')
        path=folder/(name+'.sql.gz');result['name']=path.name
        with gzip.open(path,'wb',compresslevel=4) as output,temp_error(folder) as error:
            process=subprocess.Popen(['/usr/bin/ionice','-c','3','/usr/bin/nice','-n','19','/usr/bin/mariadb-dump','--single-transaction','--routines','--events','--triggers','--hex-blob','--databases',*databases],stdout=subprocess.PIPE,stderr=error)
            watchdog=threading.Timer(7200,process.kill);watchdog.daemon=True;watchdog.start()
            try:
                shutil.copyfileobj(process.stdout,output,1024*1024)
                if process.wait(timeout=7200):raise ValueError('Falló el volcado SQL; no se publicó como copia válida')
            finally:
                watchdog.cancel()
                if process.poll() is None:process.kill();process.wait()
        result['databases']=databases
    else:
        source=Path('/home')/owner/('web' if policy['kind']=='web' else 'mail')
        if not source.is_dir() or source.is_symlink():raise ValueError('No hay contenido de ese tipo')
        path=folder/(name+'.tar.gz');result['name']=path.name
        command(['/usr/bin/ionice','-c','3','/usr/bin/nice','-n','19','/usr/bin/tar','--one-file-system','-czf',path,'-C',source.parent,source.name],7200)
    result['path']=str(path);result['bytes']=path.stat().st_size;result['sizeMb']=round(result['bytes']/1048576,2)
    if policy['destination']!='local':
        settings=load(STATE/'settings.json',{});prefix='VIP/'+settings['instance']+'/'+policy['id']+'/'+owner
        if policy['folder']:prefix+='/'+policy['folder'].strip('/')
        remote=policy['destination']+':'+prefix+'/'+identifier+'-'+result['name']
        cloud(['copyto',str(path),remote]);details=json.loads(cloud(['lsjson',remote,'--stat'],120))
        if details.get('Size')!=result['bytes']:raise ValueError('No se pudo verificar el tamaño de la copia remota')
        result['remote']=True;result['remotePath']=remote
    return result

class temp_error:
    def __init__(self,folder):self.path=folder/'error.private'
    def __enter__(self):self.file=self.path.open('wb');return self.file
    def __exit__(self,*args):self.file.close();self.path.unlink(missing_ok=True)

def prune(policy,owner,all_records):
    items=[r for r in all_records if r['policy']==policy['id'] and r['owner']==owner]
    keep=retention_ids(items,policy,time.time());local_keep={r['id'] for r in sorted(items,key=lambda r:r['created'],reverse=True)[:policy['retention']['local']]}
    for record in items:
        # Never delete source-server archives or objects not created by this module.
        if record.get('remote') and record['id'] not in keep:
            prefix=policy['destination']+':VIP/'+load(STATE/'settings.json',{})['instance']+'/'+policy['id']+'/'
            if not record.get('remotePath','').startswith(prefix):continue
            cloud(['deletefile',record['remotePath']]);record['remote']=False
        preserve_local=record['id'] in (keep if policy['destination']=='local' else local_keep)
        if not preserve_local and (record.get('remote') or record['id'] not in keep):
            path=Path(record['path'])
            if path.is_relative_to(STATE/'artifacts') and path.parent.name==record['id']:path.unlink(missing_ok=True);record['local']=False
    return [r for r in all_records if r.get('local') or r.get('remote')]

def work(identifier,actor):
    with (STATE/'worker.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        job={'policy':identifier,'actor':actor,'state':'running','pid':os.getpid(),'started':int(time.time())};write(STATE/'job.json',job)
        try:
            policy=policies()[identifier]
            for owner in policy['accounts']:
                job['account']=owner;write(STATE/'job.json',job)
                result=make_copy(policy,owner);rows=records()+[result];write(STATE/'records.json',rows);write(STATE/'records.json',prune(policy,owner,rows))
            job['state']='succeeded';audit(actor,'run_succeeded',identifier)
        except Exception as error:job['state']='failed';job['error']=str(error);audit(actor,'run_failed',identifier)
        job['finished']=int(time.time());write(STATE/'job.json',job)

def tick():
    with (STATE/'scheduler.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        state=load(STATE/'scheduler.json',{});all_policies=policies()
        # Coalesce missed runs per policy while preserving every due policy when a worker is busy.
        pending=[key for key in state.pop('_pending',[]) if key in all_policies and all_policies[key]['enabled']]
        for identifier,policy in all_policies.items():
            if not policy['enabled']:continue
            now=datetime.now(timezone.utc if policy['timezone']=='UTC' else ZoneInfo(policy['timezone']));minute=now.strftime('%Y-%m-%dT%H:%M%z')
            if state.get(identifier)==minute or not any(due(expression,now) for expression in policy['schedules']):continue
            if identifier not in pending:pending.append(identifier)
            state[identifier]=minute
        if pending:
            try:start('scheduler',pending[0])
            except ValueError:pass
            else:pending.pop(0)
        state['_pending']=pending;write(STATE/'scheduler.json',state)

def handle(request):
    role(request.get('actor'));action=request.get('action');actor=request['actor']
    if action=='inventory':return inventory()
    if action=='status':return job_state()
    if action=='file':
        record=file_record(request.get('id'));return {'name':record['name'],'bytes':record['bytes']}
    if action in {'save','delete','run'} and request.get('confirm')!='true':raise ValueError('Confirma esta operación')
    if action=='save':
        value=validate(json.loads(request.get('policy','{}')),hosting_users());all_policies=policies()
        if value['id'] in all_policies and (all_policies[value['id']]['destination']!=value['destination'] or all_policies[value['id']]['folder']!=value['folder']):
            # Separate namespace prevents new retention settings from touching an old destination.
            old=value['id'];value['id']=secrets.token_hex(16);all_policies.pop(old)
        write(STATE/'config-backups'/(str(time.time_ns())+'.json'),all_policies)
        all_policies[value['id']]=value;write(STATE/'policies.json',all_policies);audit(actor,'policy_saved',value['id']);return value
    if action in {'delete','run'}:
        identifier=request.get('id','')
        if not isinstance(identifier,str) or not IDENT.fullmatch(identifier):raise ValueError('ID no válido')
        if action=='run':return start(actor,identifier)
        all_policies=policies();all_policies.pop(identifier,None);write(STATE/'policies.json',all_policies);audit(actor,'policy_deleted',identifier);return {'deleted':True,'copiesPreserved':True}
    if action=='test':
        name=request.get('destination')
        if name not in [v['id'] for v in remotes()]:raise ValueError('Destino no válido')
        cloud(['lsf',name+':','--max-depth','1','--dirs-only'],45);return {'readable':True}
    raise ValueError('Acción no permitida')

def main():
    if os.geteuid()!=0:raise ValueError('Root helper required')
    os.umask(0o077);STATE.mkdir(parents=True,exist_ok=True,mode=0o700)
    if len(sys.argv)>1:
        if sys.argv[1:] == ['tick']:return tick()
        if len(sys.argv)==4 and sys.argv[1]=='run' and IDENT.fullmatch(sys.argv[2]):return work(sys.argv[2],sys.argv[3])
        raise ValueError('Invalid invocation')
    if os.environ.get('SUDO_USER') not in {None,'root','hestiaweb','admin'}:raise ValueError('Only native panel may request operations')
    raw=sys.stdin.buffer.read(32769)
    if len(raw)>32768:raise ValueError('Solicitud demasiado grande')
    request=json.loads(raw)
    if not isinstance(request,dict) or set(request)-{'actor','action','policy','id','confirm','destination'}:raise ValueError('Solicitud no válida')
    with (STATE/'config.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX);return handle(request)

if __name__=='__main__':
    if len(sys.argv)==4 and sys.argv[1]=='stream':
        try:
            if os.geteuid()!=0:raise ValueError('Root required')
            role(sys.argv[2]);record=file_record(sys.argv[3]);audit(sys.argv[2],'download',record['id'])
            with open(record['path'],'rb') as stream:shutil.copyfileobj(stream,sys.stdout.buffer,1024*1024)
        except Exception:sys.exit(1)
        sys.exit(0)
    try:print(json.dumps({'ok':True,'data':main()}))
    except Exception as error:print(json.dumps({'ok':False,'error':str(error)}));sys.exit(1)
