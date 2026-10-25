/* Optional admin-only, on-demand activity. All untrusted fields use textContent. */
(() => {
 'use strict';
 const c=JSON.parse(document.getElementById('via-context')?.textContent||'{}');if(!c.admin||!c.activityAdmin)return;
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 const button=(text,fn)=>{const e=node('button',text,'button button-secondary');e.type='button';e.onclick=fn;return e;};
 const nativeHref=path=>{const u=new URL(path,location.origin);u.searchParams.set('token',c.csrfToken);return u.pathname+u.search+u.hash;};
 const mib=bytes=>(bytes/1048576).toFixed(1)+' MiB';
 async function post(action,extra={}){const r=await fetch('/vip/activity-admin/',{method:'POST',credentials:'same-origin',body:new URLSearchParams({token:c.csrfToken,action,...extra})});const v=await r.json();if(!r.ok||!v.ok)throw Error(v.error||'No se pudo consultar la actividad.');return v.data;}
 function table(headers,rows){const wrap=node('div',undefined,'vip-activity-table'),t=node('table',undefined,'vip-domains-table'),head=node('thead'),hr=node('tr'),body=node('tbody');for(const h of headers)hr.append(node('th',h));head.append(hr);
  for(const row of rows){const tr=node('tr');for(const value of row){const cell=node('td');if(value instanceof Node)cell.append(value);else cell.textContent=String(value??'—');tr.append(cell);}body.append(tr);}if(!rows.length){const tr=node('tr'),td=node('td','Sin actividad en esta muestra.');td.colSpan=headers.length;tr.append(td);body.append(tr);}t.append(head,body);wrap.append(t);return wrap;}
 window.vipOpenActivity=()=>{
  const previous=document.getElementById('vip-activity-dialog');if(previous){previous.showModal();return;}
  const dialog=node('dialog',undefined,'vip-mail-dialog vip-activity-dialog');dialog.id='vip-activity-dialog';dialog.setAttribute('aria-labelledby','vip-activity-title');
  const title=node('h2','Actividad del servidor');title.id='vip-activity-title';const heading=node('div',undefined,'vip-mail-dialog-heading');heading.append(title,button('Cerrar',()=>dialog.close()));
  const body=node('div',undefined,'vip-mail-dialog-body'),toolbar=node('div',undefined,'vip-activity-toolbar'),status=node('p','Consultando…');status.setAttribute('role','status');
  const search=node('input');search.type='search';search.placeholder='Filtrar por cuenta, dominio, IP o proceso';search.setAttribute('aria-label',search.placeholder);
  const live=node('input');live.type='checkbox';const liveLabel=node('label','Actualizar cada 5 s ');liveLabel.append(live);
  const content=node('div');let timer,loading=false,data,selectedPID=null,selectedIP=null;
  const refreshButton=button('Actualizar',refresh),firewall=node('a','Firewall e IP bloqueadas');firewall.href=nativeHref('/list/firewall/');toolbar.append(refreshButton,search,liveLabel,firewall);
  body.append(toolbar,status,node('p','Conexiones TCP web establecidas en 80/443, no usuarios conectados. Una persona puede abrir varias conexiones; bots y proxies también cuentan.','via-muted'),content);dialog.append(heading,body);document.body.append(dialog);
  function schedule(){clearTimeout(timer);if(dialog.open&&live.checked&&document.visibilityState==='visible')timer=setTimeout(refresh,5000);}
  function matches(values){const q=search.value.toLocaleLowerCase();return !q||values.join(' ').toLocaleLowerCase().includes(q);}
  function firewallLink(ip){if(ip===data?.viewerIP)return node('strong','Tu IP · protegida','vip-own-ip');const a=node('a',ip.includes(':')?'Ver firewall':'Bloquear IP');a.href=nativeHref(ip.includes(':')?'/list/firewall/':'/list/firewall/?vip_ip='+encodeURIComponent(ip));return a;}
  function ipLink(ip){const a=node('a',ip+(ip===data?.viewerIP?' · Tu IP':''),'vip-activity-link');a.href='#ip';a.onclick=e=>{e.preventDefault();selectedIP=ip;selectedPID=null;render();};return a;}
  function processLink(p){const a=node('a',p.pool||p.name,'vip-activity-link');a.href='#proceso-'+p.pid;a.onclick=e=>{e.preventDefault();selectedPID=p.pid;render();};return a;}
  async function endProcess(process){
   if(!confirm('¿Finalizar el trabajador PHP '+process.pid+' de '+process.owner+' ('+process.pool+')? Puede interrumpir una operación en curso. No se enviará SIGKILL.'))return;
   refreshButton.disabled=true;
   try{const result=await post('terminate',{ticket:process.ticket,confirm:'FINALIZAR'});await refresh();status.textContent=result.message;}
   catch(error){status.textContent=error.message;}
   finally{refreshButton.disabled=false;}
  }
  function render(){
   if(!data)return;content.replaceChildren();
   if(data.viewerIP){const own=node('p','Tu IP pública de esta conexión: '+data.viewerIP+' · protegida contra bloqueo desde esta sección.','vip-own-ip-notice');own.setAttribute('role','note');content.append(own);}
   const s=data.connections;content.append(node('p',s.webConnections+' conexiones web · '+s.uniqueIPs+' IP distintas · '+data.processes.hostingPHP+' trabajadores PHP de alojamiento · RAM '+mib(data.memoryUsedBytes)+' / '+mib(data.memoryTotalBytes)));
   if(selectedPID!==null){
    content.append(button('Volver a procesos',()=>{selectedPID=null;render();}));const p=data.processes.items.find(p=>p.pid===selectedPID);
    if(!p){content.append(node('p','Este proceso ya terminó o salió de la muestra. Actualiza o vuelve a la lista.'));return;}
    content.append(node('h3',p.owner+' · '+(p.pool||p.name)+' · PID '+p.pid),node('p','CPU '+p.cpuPercent+' % · RAM '+mib(p.rssBytes)+' · Edad del trabajador '+p.ageSeconds+' s'));
    const r=p.request;
    if(r){
     const same=r.ip===data.viewerIP?' · Misma IP que tu sesión':'';
     content.append(node('h3','Solicitud en curso'),table(['Dato','Valor'],[['IP de origen',r.ip+same],['Método y ruta',r.method+' '+r.path],['Tiempo transcurrido',r.seconds+' s'],['Archivo PHP',r.script]]),firewallLink(r.ip),node('p','La misma IP puede ser compartida por varios clientes. No identifica por sí sola a una persona. Se omiten parámetros, cookies y formularios.','via-muted'));
    }else content.append(node('p','Sin solicitud activa observada en esta muestra. El trabajador puede estar esperando trabajo.'));
    if(p.ticket)content.append(button('Finalizar este trabajador PHP',()=>endProcess(p)));
    content.append(node('h3','Solicitudes recientes de este sitio'),table(['Hora','IP','Método','Ruta','HTTP'],data.requests.filter(r=>p.pool?r.domain===p.pool:r.owner===p.owner).map(r=>[r.time,ipLink(r.ip),r.method,r.path,r.status])));return;
   }
   if(selectedIP!==null){
    content.append(button('Volver a la actividad',()=>{selectedIP=null;render();}),node('h3','Detalle de IP · '+selectedIP),firewallLink(selectedIP));
    const peer=s.peers.find(p=>p.ip===selectedIP),workers=data.processes.items.filter(p=>p.request?.ip===selectedIP);
    content.append(node('p',(peer?.connections||0)+' conexiones web establecidas · '+workers.length+' trabajadores PHP activos observados en esta muestra.'));
    content.append(node('h3','Procesos de solicitudes activas'),table(['PID','Cuenta / sitio','Método y ruta','Tiempo de solicitud','CPU','RAM RSS','Acción'],workers.map(p=>[p.pid,processLink(p),p.request.method+' '+p.request.path,p.request.seconds+' s',p.cpuPercent+' %',mib(p.rssBytes),p.ticket?button('Finalizar',()=>endProcess(p)):'Protegido'])));
    if(!workers.length)content.append(node('p','No se observa una solicitud PHP activa de esta IP. Puede estar cargando archivos estáticos, esperando o haber terminado.','via-muted'));
    content.append(node('p','Solo se asocian procesos con metadatos actuales de la solicitud. La muestra se limita a los 100 procesos de mayor consumo; no atribuye trabajadores inactivos ni consultas SQL a una IP.','via-muted'));
    content.append(node('h3','Solicitudes recientes de esta IP'),table(['Hora','Cuenta','Sitio','Método','Ruta','HTTP'],data.requests.filter(r=>r.ip===selectedIP).map(r=>[r.time,r.owner,r.domain,r.method,r.path,r.status])));return;
   }
   const note=node('p','CPU por proceso: 100 % equivale a un núcleo. La edad corresponde al trabajador. Pulsa un pool PHP para ver su solicitud activa observada y la IP de origen.','via-muted');content.append(note,node('h3','Procesos y consumo'));
   const rows=data.processes.items.filter(p=>matches([p.owner,p.pool,p.name,p.pid])).map(p=>[p.pid,p.owner,p.pool?processLink(p):p.name,p.state,p.cpuPercent+' %',mib(p.rssBytes),p.ageSeconds+' s',p.ticket?button('Finalizar',()=>endProcess(p)):'Protegido']);
   content.append(table(['PID','Cuenta','Proceso / pool','Estado','CPU','RAM RSS','Edad','Acción'],rows));
   if(data.processes.truncated)content.append(node('p','Se muestran los 100 procesos con mayor CPU / RAM.'));
   content.append(node('h3','Conexiones web por IP'),table(['IP remota','Conexiones','Firewall'],s.peers.filter(p=>matches([p.ip])).map(p=>[ipLink(p.ip),p.connections,firewallLink(p.ip)])));
   content.append(node('h3','Consultas SQL en curso'),node('p','Vista de estado y duración; no muestra el texto SQL ni permite finalizar MySQL.','via-muted'));
   if(data.sql.available)content.append(table(['ID','Base','Usuario SQL','Tiempo','Operación','Estado'],data.sql.items.filter(p=>matches([p.database,p.user,p.state])).map(p=>[p.id,p.database,p.user,p.seconds+' s',p.command,p.state])));else content.append(node('p','No se pudo consultar SQL en esta muestra.'));
   content.append(node('h3','Solicitudes web recientes'),node('p','Solicitudes ya registradas al terminar. Se omiten parámetros de URL. No es un listado de usuarios ni de solicitudes activas.','via-muted'));
   content.append(table(['Hora','Cuenta','Dominio','IP','Método','Ruta','HTTP'],data.requests.filter(p=>matches([p.owner,p.domain,p.ip,p.path])).map(p=>[p.time,p.owner,p.domain,ipLink(p.ip),p.method,p.path,p.status])));
  }
  async function refresh(){if(loading||!dialog.open||document.visibilityState!=='visible')return;loading=true;refreshButton.disabled=true;clearTimeout(timer);status.textContent='Consultando…';try{data=await post('snapshot');render();status.textContent='Muestra: '+new Date(data.generated*1000).toLocaleTimeString();}catch(error){status.textContent=error.message;}finally{loading=false;refreshButton.disabled=false;schedule();}}
  function visibility(){clearTimeout(timer);if(document.visibilityState==='visible'&&live.checked)refresh();}
  live.onchange=schedule;search.oninput=render;document.addEventListener('visibilitychange',visibility);
  dialog.addEventListener('close',()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',visibility);dialog.remove();});dialog.showModal();refresh();
 };
})();
