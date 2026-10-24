/* Optional administration. Browser requests contain enumerated operations only. */
(() => {
 'use strict';
 const context=JSON.parse(document.getElementById('via-context')?.textContent||'{}'),content=document.querySelector('.app-content');
 if(!context.admin||!content||location.pathname!=='/list/server/'||document.getElementById('vip-software'))return;
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 const button=(label,action)=>{const b=node('button',label,'button button-secondary');b.type='button';b.onclick=action;return b;};
 const link=(label,url)=>{const a=node('a',label);a.href=url;return a;};
 const hub=node('section',undefined,'vip-software');hub.id='vip-software';hub.hidden=true;
 hub.append(node('h1','Versiones y actualizaciones'),node('p','El gestor usa los repositorios configurados. Una versión base antigua puede recibir correcciones del distribuidor; compararla con upstream no demuestra una vulnerabilidad.'));
 const status=node('p');status.setAttribute('role','status');const actions=node('div',undefined,'vip-software-actions');
 const reload=button('Consultar estado',()=>refresh()),indexes=button('Planificar actualización de índices',()=>preview({kind:'refresh'}));actions.append(reload,indexes);
 const native=node('p');native.append(link('Actualizaciones nativas','/list/updates/'),' · ',link('Configuración y PHP','/edit/server/#vip-php'));hub.append(actions,status,native);
 const nav=node('div',undefined,'vip-config-tabs');nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Gestor administrativo');
 const panels=[],tabs=[];let selected=0;
 ['Software','PHP y extensiones','Historial'].forEach((label,i)=>{
  const tab=button(label,()=>select(i));tab.id='vip-software-tab-'+i;tab.setAttribute('role','tab');
  const panel=node('div');panel.id='vip-software-panel-'+i;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);panel.tabIndex=0;tab.setAttribute('aria-controls',panel.id);
  tab.onkeydown=e=>{const target=e.key==='Home'?0:e.key==='End'?2:e.key==='ArrowRight'?(i+1)%3:e.key==='ArrowLeft'?(i+2)%3:null;if(target!==null){e.preventDefault();select(target);tabs[target].focus();}};
  nav.append(tab);tabs.push(tab);panels.push(panel);
 });
 function select(index){selected=index;panels.forEach((p,i)=>{p.hidden=i!==index;tabs[i].setAttribute('aria-selected',String(i===index));tabs[i].tabIndex=i===index?0:-1;});}
 select(0);hub.append(nav,...panels);
 const planBox=node('section',undefined,'vip-software-plan'),jobBox=node('section',undefined,'vip-software-job');planBox.hidden=true;jobBox.hidden=true;hub.append(planBox,jobBox);content.append(hub);
 let data,plan,timer,loading=false,pending=false,activeJob=null,disabledNative=[];
 const visible=()=>location.hash==='#vip-software'&&!hub.hidden&&document.visibilityState!=='hidden';
 const feedback=(message,error=false)=>{status.textContent=message;status.setAttribute('role',error?'alert':'status');};
 async function request(action,values={}){
  const body=new URLSearchParams({action,token:context.csrfToken||'',...values});
  const response=await fetch('/vip/software/',{method:'POST',credentials:'same-origin',body});
  if(response.status===404)throw Error('Gestor opcional no instalado. Usa los enlaces nativos; instalar el tema no instala este servicio.');
  if(response.redirected)throw Error('La sesión venció o ya no tiene permisos. Vuelve a iniciar sesión.');
  let result;try{result=await response.json();}catch{throw Error('Respuesta no válida. Revisa la sesión y el estado del servicio.');}
  if(!response.ok||!result.ok)throw Error(result.error||'No se pudo consultar el gestor.');return result.data;
 }
 const table=(head,rows)=>{const wrap=node('div',undefined,'vip-software-table'),t=node('table'),thead=node('thead'),tr=node('tr');head.forEach(h=>tr.append(node('th',h)));thead.append(tr);const body=node('tbody');rows.forEach(row=>{const tr=node('tr');row.forEach(value=>{const td=node('td');td.append(value instanceof Node?value:document.createTextNode(String(value??'Desconocido')));tr.append(td);});body.append(tr);});t.append(thead,body);wrap.append(t);return wrap;};
 const availability=()=>{indexes.disabled=pending||Boolean(activeJob)||!data||data.recoveryRequired;hub.querySelectorAll('[data-vip-operation]').forEach(b=>{b.disabled=pending||Boolean(activeJob)||!data||data.recoveryRequired;});};
 function operation(label,op){const b=button(label,()=>preview(op));b.dataset.vipOperation='true';return b;}
 function render(){
  panels.forEach(p=>p.replaceChildren());
  panels[0].append(node('p','Candidatas según la caché APT local. Planificar índices consulta los repositorios. Los cambios de rama de servicios requieren revisión independiente.'));
  for(const component of data.components){
   const card=node('section',undefined,'vip-software-card');card.append(node('h2',component.label));
   if(!component.packages.length)card.append(node('p','Estado desconocido: no se detectó un paquete permitido. Puede no estar instalado o gestionarse fuera de APT.'));
   else {
    card.append(table(['Paquete','Instalada','Candidata','Tipo'],component.packages.map(p=>[p.name,p.installed,p.candidate,p.update?(p.change==='maintenance'?'Mantenimiento':'Cambio de rama / revisión'):'Sin actualización detectada'])));
    if(component.packages.some(p=>p.update))card.append(operation('Preparar plan de '+component.label,{kind:'upgrade',component:component.id}));
   }
   panels[0].append(card);
  }
  panels[1].append(node('p','PHP interno del panel: '+(data.panelPhp||'Desconocido')+' · Predeterminado del sistema: '+(data.defaultPhp||'Desconocido')+'. La selección de cada dominio se cambia en su cuenta. Instalar otra rama conserva los proyectos actuales.'));
  const catalog=node('p','Catálogo de soporte revisado: '+data.policyReviewed+' · ');catalog.append(link('Fuente PHP','https://www.php.net/supported-versions.php'));panels[1].append(catalog);
  for(const php of data.php){
   const card=node('section',undefined,'vip-software-card');
   const labels={active:'soporte activo',security:'solo correcciones de seguridad',eol:'soporte upstream finalizado',unreviewed:'soporte desconocido'};
   card.append(node('h2','PHP '+php.version),node('p',(php.installed||'No instalado')+' · Candidata: '+(php.candidate||'Desconocida')+' · '+labels[php.support]+' · Dominios detectados: '+php.usage+(php.default?' · Predeterminado':'')+(php.shared?' · Pool compartido detectado':'')));
   if(php.policy)card.append(node('p','Soporte activo hasta '+php.policy.activeEnd+'; seguridad hasta '+php.policy.securityEnd+'.'));
   if(!php.installed){if(php.candidate&&['active','security'].includes(php.support))card.append(operation('Preparar instalación en paralelo',{kind:'php_install',version:php.version}));}
   else{
    card.append(node('p','Los cambios de módulos afectan a FPM y CLI de esta rama y a todas sus cuentas. Las extensiones esenciales de servicios compartidos están protegidas. Los ajustes de php.ini por cuenta requieren las capacidades nativas.'));
    const changes={};const rows=php.extensions.map(ext=>{
     const label=node('label'),input=node('input');input.type='checkbox';input.checked=ext.enabledFpm&&ext.enabledCli;input.indeterminate=ext.enabledFpm!==ext.enabledCli;
     input.disabled=(ext.protected&&ext.enabledFpm&&ext.enabledCli)||(!ext.installed&&!ext.candidate);input.setAttribute('aria-label',ext.name+' PHP '+php.version);input.onchange=()=>{changes[ext.name]=input.checked;if(ext.protected&&input.checked)input.disabled=true;};label.append(input,' '+(ext.protected?'Protegida':'Habilitar en FPM y CLI'));
     return [ext.name,ext.installed||'No instalada',ext.candidate,ext.enabledFpm?'Habilitada':'Deshabilitada',ext.enabledCli?'Habilitada':'Deshabilitada',label];
    });
    card.append(table(['Extensión','Paquete instalado','Candidata','FPM (configuración)','CLI (configuración)','Selección'],rows));
    const save=button('Preparar cambios de extensiones',()=>{if(!Object.keys(changes).length){feedback('Selecciona al menos un cambio de extensión.');return;}preview({kind:'php_extensions',version:php.version,enabled:changes});});save.dataset.vipOperation='true';card.append(save);
   }
   panels[1].append(card);
  }
  panels[2].append(node('p','Últimas 15 operaciones. Los registros y respaldos completos se conservan en el almacenamiento privado del servidor.'));
  for(const item of data.history){const row=node('p',item.started+' · '+item.title+' · '+item.state+' · '+item.actor+' ');row.append(button('Ver resultado',()=>showJob(item.id)));panels[2].append(row);}
  if(!data.history.length)panels[2].append(node('p','Sin operaciones registradas.'));
  availability();
 }
 async function refresh(){
  if(loading||!visible())return;loading=true;reload.disabled=true;feedback('Consultando paquetes y versiones…');
  try{data=await request('inventory');activeJob=data.activeJob;render();feedback(data.recoveryRequired?'Operación interrumpida: revisar dpkg y servicios y reconocer la interrupción por CLI antes de continuar.':data.rebootRequired?'El sistema indica que necesita reiniciarse. El gestor no reinicia el servidor automáticamente.':'Inventario consultado: '+data.generated);if(activeJob)await showJob(activeJob);}
  catch(error){data=null;feedback(error.message,true);availability();}
  finally{loading=false;reload.disabled=false;}
 }
 async function preview(op){
  if(pending||activeJob||!data)return;pending=true;availability();plan=null;planBox.replaceChildren();planBox.removeAttribute('role');planBox.hidden=false;planBox.append(node('p','Preparando plan…'));
  try{
   plan=await request('plan',{operation:JSON.stringify(op)});planBox.replaceChildren(node('h2',plan.title));
   planBox.append(node('p','Plan válido hasta '+new Date(plan.expires*1000).toLocaleString()+'. Puede reiniciar servicios; no cambia DNS ni migra proyectos.'));
   plan.warnings.forEach(w=>planBox.append(node('p',w)));
   if(plan.databaseBackup)planBox.append(node('p','Respaldo SQL completo con bloqueo de tablas antes de instalar. Reserva espacio y una ventana de mantenimiento.'));
   planBox.append(table(['Paquete','Actual','Propuesta'],plan.changes.map(p=>[p.package,p.from||'No instalado',p.to])));
   plan.modules.forEach(m=>planBox.append(node('p',m.name+': '+(m.enabled?'habilitar':'deshabilitar')+' en FPM y CLI')));
   planBox.append(node('p','Restaurar configuración no equivale a degradar paquetes o recuperar bases de datos.'));
   const label=node('label'),check=node('input');check.type='checkbox';label.append(check,' He revisado los cambios y los respaldos necesarios.');
   const apply=button('Confirmar y ejecutar',()=>execute());apply.disabled=true;check.onchange=()=>{apply.disabled=!check.checked||pending;};
   planBox.append(label,apply,button('Cancelar plan',()=>{plan=null;planBox.hidden=true;}));
   planBox.scrollIntoView({block:'nearest'});
  }catch(error){planBox.replaceChildren(node('p',error.message));planBox.setAttribute('role','alert');}
  finally{pending=false;availability();}
 }
 async function execute(){
  if(!plan||pending||activeJob)return;const id=plan.id;plan=null;pending=true;availability();planBox.replaceChildren(node('p','Enviando operación confirmada…'));
  try{const result=await request('apply',{plan:id,confirm:'true'});activeJob=result.job;planBox.hidden=true;await showJob(activeJob);}
  catch(error){feedback(error.message+' Consulta el historial antes de repetir la operación.',true);planBox.hidden=true;await refresh();}
  finally{pending=false;availability();}
 }
 async function showJob(id){
  clearTimeout(timer);
  try{
   const job=await request('job',{job:id});jobBox.hidden=false;jobBox.replaceChildren(node('h2',job.title),node('p','Estado: '+job.state));
   if(job.error)jobBox.append(node('p',job.error));if(job.backup)jobBox.append(node('p','Respaldo privado: '+job.backup));
   if(job.serviceChecks)for(const [name,ok] of Object.entries(job.serviceChecks))jobBox.append(node('p',name+': '+(ok?'activo':'requiere revisión')));
   if(job.configurationRestored!==undefined)jobBox.append(node('p',job.configurationRestored?'Configuración de módulos anterior restaurada.':'La configuración requiere recuperación manual.'));
   if(job.rebootRequired)jobBox.append(node('p','El sistema requiere reinicio; prográmalo por separado.'));
   jobBox.append(node('pre',(job.log||[]).join('\n')));
   if(['queued','running'].includes(job.state)){activeJob=id;if(visible())timer=setTimeout(()=>showJob(id),3000);}
   else if(activeJob===id){activeJob=null;data=null;if(visible())timer=setTimeout(()=>refresh(),0);}
   availability();
  }catch(error){feedback(error.message,true);}
 }
 function route(){
  clearTimeout(timer);const show=location.hash==='#vip-software';hub.hidden=!show;
  if(show){
   if(!disabledNative.length)[...content.children].filter(e=>e!==hub&&!e.matches('script,style')).forEach(e=>{disabledNative.push([e,e.hidden]);e.classList.add('vip-software-native-hidden');});
   refresh();
  }else{disabledNative.forEach(([e])=>e.classList.remove('vip-software-native-hidden'));disabledNative=[];}
 }
 window.addEventListener('hashchange',route);document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(visible())refresh();});route();
})();
