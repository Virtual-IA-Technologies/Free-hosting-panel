#!/usr/bin/python3
"""On-demand Exim control and one-use administrative webmail tickets. No daemon."""
import base64
from collections import Counter
from email.parser import BytesParser
from email import policy
import hashlib
import heapq
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import sys
import time

STATE=Path('/var/lib/vip-mail-admin')
EXIM='/usr/sbin/exim4'
ID=re.compile(r'[A-Za-z0-9]{6}-[A-Za-z0-9]{6,16}-[A-Za-z0-9]{2,8}')
USER=re.compile(r'[a-zA-Z0-9][a-zA-Z0-9_-]{0,31}')
OPERATIONS={'queue','message','trace','relayers','retry','freeze','thaw','remove','webmail','sql_login','mailbox_list','mailbox_read','refresh_metrics','ssh_keys'}

def command(args,timeout=20):
    result=subprocess.run(args,capture_output=True,text=True,timeout=timeout)
    if result.returncode:raise ValueError('La operación no pudo completarse. Revisa el seguimiento y los servicios.')
    return result.stdout

def role(actor):
    if not isinstance(actor,str) or not USER.fullmatch(actor):raise ValueError('Administrador no válido')
    text=(Path('/usr/local/hestia/data/users')/actor/'user.conf').read_text()
    if not re.search(r"^ROLE=['\"]?admin['\"]?$",text,re.M) or re.search(r"^SUSPENDED=['\"]?yes['\"]?$",text,re.M):raise ValueError('Se requiere administrador activo')

def native(name,*args):
    return json.loads(command(['/usr/local/hestia/bin/'+name,*args,'json']))

def audit(actor,action,identifier='',backup=''):
    STATE.mkdir(mode=0o700,parents=True,exist_ok=True)
    with open(STATE/'audit.jsonl','a') as stream:stream.write(json.dumps({'time':int(time.time()),'actor':actor,'action':action,'id':identifier,'backup':backup})+'\n')

def recent_logs():
    lines=[]
    for name in ['mainlog.1','mainlog','rejectlog']:
        path=Path('/var/log/exim4')/name
        if not path.is_file():continue
        with path.open('rb') as stream:
            offset=max(0,path.stat().st_size-2*1024*1024);stream.seek(offset)
            if offset:stream.readline()
            lines.extend(stream.read(2*1024*1024).decode(errors='replace').splitlines())
    return lines

def mailbox(request,active=True):
    owner=request.get('owner','');domain=request.get('domain','');account=request.get('account','')
    if not USER.fullmatch(owner) or not re.fullmatch(r'[a-zA-Z0-9.-]{1,253}',domain):raise ValueError('Cuenta o dominio no válido')
    domains=native('v-list-mail-domains',owner)
    if domain not in domains:raise ValueError('El dominio no pertenece a la cuenta')
    boxes=native('v-list-mail-accounts',owner,domain)
    if account not in boxes:raise ValueError('Buzón no encontrado')
    if active and (domains[domain].get('SUSPENDED')=='yes' or boxes[account].get('SUSPENDED')=='yes'):raise ValueError('Correo en preparación o suspendido. La bandeja web estará disponible al activarlo; sus archivos permanecen en /home/'+owner+'/mail/.')
    return account+'@'+domain


def mailbox_root(request):
    root=Path('/home')/request['owner']/'mail'/request['domain']/request['account']
    # Account owners can write their homes: never follow their symlinks as root.
    if root.resolve()!=root or not root.is_dir():raise ValueError('Directorio de buzón no válido')
    return root


def mailbox_path(root,relative):
    value=Path(relative)
    if value.is_absolute() or '..' in value.parts:raise ValueError('Ruta no válida')
    path=root/value
    if path.resolve()!=path or not path.is_file():raise ValueError('Mensaje no disponible')
    if path.parent.name not in {'cur','new'} or path.parent.parent!=root and (path.parent.parent.parent!=root or not path.parent.parent.name.startswith('.')):raise ValueError('Ruta de mensaje no válida')
    return path


def read_mail(root,relative,limit):
    path=mailbox_path(root,relative)
    descriptor=os.open('/',os.O_RDONLY|os.O_DIRECTORY)
    try:
        for name in path.parts[1:-1]:
            child=os.open(name,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=descriptor)
            os.close(descriptor);descriptor=child
        leaf=os.open(path.name,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=descriptor)
        with os.fdopen(leaf,'rb') as stream:
            import stat
            if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):raise ValueError('Mensaje no válido')
            return stream.read(limit)
    finally:os.close(descriptor)

def consume(token,remote_ip):
    if not re.fullmatch(r'[a-f0-9]{64}',token):raise ValueError('Acceso no válido')
    path=STATE/'tickets'/(hashlib.sha256(token.encode()).hexdigest()+'.json')
    value=json.loads(path.read_text())
    if value['expires']<time.time() or value['ip']!=remote_ip:raise ValueError('Acceso vencido o de otro origen')
    role(value['actor'])
    if value.get('kind')!='sql':mailbox(value)
    used=path.with_suffix('.used')
    try:path.rename(used)
    except FileNotFoundError:raise ValueError('Acceso ya utilizado')
    try:
        if value.get('kind')=='sql':
            credentials=json.loads(Path('/opt/virtual-ia-panel/phpmyadmin-admin-access.json').read_text())
            return {'kind':'sql','actor':value['actor'],'username':credentials['username'],'password':credentials['password'],'host':'localhost'}
        credentials=json.loads((STATE/'master.json').read_text())
        return {'email':value['account']+'@'+value['domain'],'actor':value['actor'],
                'masterUser':credentials['user'],'masterPassword':credentials['password'],'expires':int(time.time())+1800}
    finally:used.unlink(missing_ok=True)

def handle(request):
    actor=request.get('actor');role(actor);action=request.get('action')
    if action not in OPERATIONS:raise ValueError('Acción no permitida')
    if action=='ssh_keys':
        owner=request.get('owner','')
        if not USER.fullmatch(owner) or not (Path('/usr/local/hestia/data/users')/owner/'user.conf').is_file():raise ValueError('Cuenta no válida')
        path=Path('/home')/owner/'.ssh/authorized_keys'
        if not path.exists() or path.stat().st_size==0:return {}
        if path.stat().st_size>2097152:raise ValueError('El archivo de claves es demasiado grande para esta vista')
        if path.resolve()!=path:raise ValueError('Ruta SSH no válida')
        output=command(['/usr/bin/ssh-keygen','-l','-f',str(path)])
        result={}
        for index,line in enumerate(output.splitlines()):
            parts=line.split(' ',2)
            if len(parts)>=2:
                label=re.sub(r'\s+\([^()]+\)$','',parts[2] if len(parts)>2 else '')
                if label!='filemanager.ssh.key':result[str(index)]={'ID':label or parts[1],'KEY':parts[1]}
        return result
    if action=='queue':
        raw=command([EXIM,'-bp']);items=[];current=None
        for line in raw.splitlines():
            match=re.search(r'\b('+ID.pattern+r')\b',line)
            if match:
                before=line[:match.start()].split();after=line[match.end():].strip()
                current={'id':match.group(1),'age':before[0] if before else '', 'size':before[1] if len(before)>1 else '',
                         'sender':after.split(' ***')[0], 'frozen':'frozen' in after.lower(),'recipients':[]};items.append(current)
            elif current and line.startswith(' ') and line.strip():current['recipients'].append(line.strip())
        return {'items':items[:1000],'truncated':len(items)>1000,'total':len(items)}
    if action in {'message','retry','freeze','thaw','remove'}:
        identifier=request.get('id','')
        if not isinstance(identifier,str) or not ID.fullmatch(identifier):raise ValueError('ID de cola no válido')
        if action=='message':
            audit(actor,'read_queue',identifier)
            try:history=command([EXIM,'-Mvl',identifier])[:262144]
            except ValueError:history='Sin historial de intentos disponible para este mensaje.'
            return {'id':identifier,'headers':command([EXIM,'-Mvh',identifier])[:262144],
                    'body':command([EXIM,'-Mvb',identifier])[:524288],'history':history}
        if request.get('confirm')!='true':raise ValueError('Confirma la operación sobre '+identifier)
        backup=''
        if action=='remove':
            folder=STATE/'backups'/(str(time.time_ns())+'-'+identifier);folder.mkdir(mode=0o700,parents=True)
            spool=Path(command([EXIM,'-bP','spool_directory']).strip().split('=',1)[1].strip())
            for parent in ['input','msglog']:
                for name in [identifier,identifier+'-H',identifier+'-D',identifier+'-J']:
                    for path in [spool/parent/name,*list((spool/parent).glob('*/'+name))]:
                        if path.is_file() and not path.is_symlink():shutil.copy2(path,folder/(parent+'-'+path.name))
            backup=str(folder)
            if not any(folder.glob('input-*')):raise ValueError('No se encontró el mensaje para respaldarlo; no se elimina')
        flag={'retry':'-M','freeze':'-Mf','thaw':'-Mt','remove':'-Mrm'}[action]
        audit(actor,action+'_requested',identifier,backup)
        output=command([EXIM,flag,identifier],timeout=45)
        audit(actor,action+'_completed',identifier,backup)
        return {'id':identifier,'result':output.strip() or 'Operación completada','backup':backup}
    if action in {'trace','relayers'}:
        lines=recent_logs();query=request.get('query','').strip()
        if len(query)>150 or any(ord(ch)<32 for ch in query):raise ValueError('Filtro no válido')
        if query:lines=[line for line in lines if query.lower() in line.lower()]
        if action=='relayers':
            counts=Counter()
            for line in lines:
                match=re.search(r'\bA=\S+?:(\S+)',line)
                if match:counts[match.group(1)]+=1
            return {'items':[{'account':name,'messages':count} for name,count in counts.most_common(100)],'limited':True}
        summary=Counter('Rebotado' if ' ** ' in line else 'Aplazado' if ' == ' in line else 'Entregado' if ' => ' in line else 'Recibido' if ' <= ' in line else 'Rechazado' if 'reject' in line.lower() else 'Evento' for line in lines)
        return {'lines':lines[-500:],'summary':dict(summary),'limited':True,'matches':len(lines)}
    if action in {'mailbox_list','mailbox_read'}:
        email=mailbox(request,active=False)
        root=mailbox_root(request)
        if action=='mailbox_list':
            files=[];seen=0;truncated=False;deadline=time.monotonic()+5
            folders=[root]
            with os.scandir(root) as entries:
                for entry in entries:
                    if entry.name.startswith('.') and entry.is_dir(follow_symlinks=False):folders.append(Path(entry.path))
                    if len(folders)>=256:truncated=True;break
            for folder in folders:
                for section in ['cur','new']:
                    directory=folder/section
                    if directory.is_symlink() or not directory.is_dir():continue
                    with os.scandir(directory) as entries:
                        for entry in entries:
                            if not entry.is_file(follow_symlinks=False):continue
                            seen+=1;item=(entry.stat(follow_symlinks=False).st_mtime,entry.path)
                            if len(files)<100:heapq.heappush(files,item)
                            elif item>files[0]:heapq.heapreplace(files,item)
                            if seen>=20000 or time.monotonic()>deadline:truncated=True;break
                    if truncated and (seen>=20000 or time.monotonic()>deadline):break
                if seen>=20000 or time.monotonic()>deadline:break
            items=[]
            for _,filename in sorted(files,reverse=True):
                path=mailbox_path(root,str(Path(filename).relative_to(root)))
                message=BytesParser(policy=policy.default).parsebytes(read_mail(root,str(path.relative_to(root)),65536),headersonly=True)
                identifier=base64.urlsafe_b64encode(str(path.relative_to(root)).encode()).decode()
                items.append({'id':identifier,'folder':path.parent.parent.name if path.parent.parent!=root else 'INBOX','subject':str(message.get('Subject','Sin asunto')),'from':str(message.get('From','')),'date':str(message.get('Date','')),'bytes':path.stat().st_size})
            audit(actor,'mailbox_list',email)
            return {'items':items,'total':seen,'truncated':truncated,'email':email,'readOnly':True}
        identifier=request.get('id','')
        if len(identifier)>1500:raise ValueError('Mensaje no válido')
        relative=base64.urlsafe_b64decode(identifier).decode()
        path=mailbox_path(root,relative)
        if path.stat().st_size>4*1024*1024:raise ValueError('Mensaje no disponible para vista rápida; usa webmail')
        message=BytesParser(policy=policy.default).parsebytes(read_mail(root,relative,4*1024*1024));part=message.get_body(preferencelist=('plain','html')) if message.is_multipart() else message
        body=part.get_content() if part else ''
        if not isinstance(body,str):body='Contenido binario; abre el mensaje en webmail.'
        audit(actor,'mailbox_read',email)
        return {'subject':str(message.get('Subject','')),'from':str(message.get('From','')),'to':str(message.get('To','')),'body':body[:524288],'readOnly':True}
    if action in {'webmail','sql_login'}:
        email=mailbox(request) if action=='webmail' else 'administrador SQL';ipaddress.ip_address(request['ip'])
        token=secrets.token_hex(32);folder=STATE/'tickets';folder.mkdir(mode=0o700,parents=True,exist_ok=True)
        for old in folder.glob('*.json'):
            if old.stat().st_mtime<time.time()-120:old.unlink(missing_ok=True)
        ticket={key:request[key] for key in ['actor','ip']};ticket['expires']=int(time.time())+60
        if action=='webmail':ticket.update({key:request[key] for key in ['owner','domain','account']})
        else:ticket['kind']='sql'
        path=folder/(hashlib.sha256(token.encode()).hexdigest()+'.json');path.write_text(json.dumps(ticket));path.chmod(0o600)
        audit(actor,'sql_login' if action=='sql_login' else 'webmail_login',email)
        return {'ticket':token,'email':email}
    if action=='refresh_metrics':
        if request.get('confirm')!='true':raise ValueError('Confirma el recálculo de métricas')
        audit(actor,action)
        for queue in ['disk','traffic']:command(['/usr/bin/ionice','-c','3','/usr/bin/nice','-n','19','/usr/local/hestia/bin/v-update-sys-queue',queue],timeout=100)
        return {'result':'Contadores nativos actualizados; recarga el listado.'}

def main():
    if os.geteuid()!=0:raise ValueError('Local root helper required')
    if len(sys.argv)>1:
        if len(sys.argv)==4 and sys.argv[1]=='list-keys':return handle({'actor':sys.argv[2],'owner':sys.argv[3],'action':'ssh_keys'})
        if len(sys.argv)!=4 or sys.argv[1]!='consume':raise ValueError('Invalid invocation')
        return consume(sys.argv[2],sys.argv[3])
    if os.environ.get('SUDO_USER') not in {None,'root','hestiaweb','admin'}:raise ValueError('Only native panel can request operations')
    raw=sys.stdin.buffer.read(8193)
    if len(raw)>8192:raise ValueError('Request too large')
    request=json.loads(raw)
    if not isinstance(request,dict):raise ValueError('Invalid request')
    return handle(request)

if __name__=='__main__':
    try:print(json.dumps({'ok':True,'data':main()},ensure_ascii=True))
    except Exception as error:print(json.dumps({'ok':False,'error':str(error)},ensure_ascii=True));sys.exit(1)
