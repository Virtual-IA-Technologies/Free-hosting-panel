/* Progressive record sheets and row gestures. Native routes retain authorization. */
(() => {
 'use strict';
 const contextNode=document.getElementById('via-context');
 if(!contextNode||window.vipInteractions||!document.body.classList.contains('via-shell'))return;
 const context=JSON.parse(contextNode.textContent),version=encodeURIComponent(context.assetVersion||'1.0.4');
 const modules='user|web|dns|dns-record|mail|mail-account|db|cron|package|ip|firewall|firewall-ipset|access-key';
 const recordPattern=new RegExp('^/(add|edit)/('+modules+')/?$');
 const recordURL=value=>{try{const u=new URL(value,location.href);return u.origin===location.origin&&recordPattern.test(u.pathname)?u:null;}catch{return null;}};
 const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 let sheet,root,body,footer,title,description,closeButton,status,fallback,trigger,baseForm,formURL,dirty=false,busy=false,teardown,request;
 let bridgePromise,menu,menuOwner,generation=0;
 const bridge=()=>bridgePromise||(bridgePromise=new Promise((resolve,reject)=>{
  const s=node('script');s.src='/js/virtualia/native-forms.js?v='+version;s.onload=()=>typeof window.vipInitNativeForm==='function'?resolve():reject(Error('No se pudo iniciar el formulario.'));s.onerror=()=>{bridgePromise=null;reject(Error('No se pudo cargar el formulario.'));};document.head.append(s);
 }));
 const resize=()=>{if(!sheet)return;const scale=Number.parseFloat(getComputedStyle(document.documentElement).zoom)||1;sheet.style.setProperty('--vip-sheet-vw',innerWidth/scale+'px');sheet.style.setProperty('--vip-sheet-vh',innerHeight/scale+'px');};
 function unlockBackground(){if(baseForm){baseForm.id='main-form';document.querySelectorAll('[form="vip-background-form"]').forEach(e=>e.setAttribute('form','main-form'));baseForm=null;}}
 function clearForm(){teardown?.();teardown=null;window.Alpine?.mutateDom(()=>{window.Alpine.destroyTree(root);root.replaceChildren();});if(!window.Alpine)root.replaceChildren();}
 function close(force=false){
  if(!sheet?.open||busy&&!force)return false;
  if(!force&&dirty&&!window.confirm('¿Descartar los cambios sin guardar?'))return false;
  generation++;request?.abort();clearForm();unlockBackground();dirty=false;sheet.close();document.body.classList.remove('vip-sheet-open');if(trigger?.isConnected)trigger.focus();return true;
 }
 function ensureSheet(){
  if(sheet)return;
  sheet=node('dialog','vip-sheet');sheet.id='vip-record-sheet';sheet.setAttribute('aria-labelledby','vip-sheet-title');sheet.setAttribute('aria-describedby','vip-sheet-description');
  const header=node('header','vip-sheet-header');title=node('h2','','Formulario');title.id='vip-sheet-title';description=node('p','','');description.id='vip-sheet-description';
  closeButton=node('button','vip-sheet-close','×');closeButton.type='button';closeButton.setAttribute('aria-label','Cerrar formulario');closeButton.onclick=()=>close();header.append(title,description,closeButton);
  status=node('p','vip-sheet-status');status.setAttribute('role','status');
  fallback=node('a','vip-sheet-fallback','Abrir formulario completo');fallback.hidden=true;
  root=node('div','vip-sheet-native');sheet.append(header,status,fallback,root);document.body.append(sheet);
  sheet.addEventListener('cancel',e=>{e.preventDefault();close();});sheet.addEventListener('click',e=>{if(e.target===sheet)close();});
  root.addEventListener('input',()=>{dirty=true;},true);root.addEventListener('change',()=>{dirty=true;},true);
  window.addEventListener('resize',resize);window.addEventListener('vip:appearance',resize);
 }
 function setBusy(value){busy=value;closeButton.disabled=value;root.setAttribute('aria-busy',String(value));}
 function showError(message){setBusy(false);status.textContent=message;status.setAttribute('role','alert');fallback.hidden=false;fallback.href=formURL.href;root.querySelector('.js-spinner')?.classList.remove('active');}
 async function render(response,posted=false,ticket=generation){
  if(new URL(response.url).origin!==location.origin)throw Error('No se pudo validar la respuesta del formulario.');
  const parsed=new DOMParser().parseFromString(await response.text(),'text/html');
  const content=parsed.querySelector('.app-content'),form=content?.querySelector('form#main-form');
  if(!form){
   if(posted&&new URL(response.url).pathname.startsWith('/list/')){dirty=false;close(true);location.reload();return;}
   throw Error(parsed.querySelector('#login-form')?'La sesión ha vencido. Abre el formulario completo para iniciar sesión.':'Esta opción requiere abrir el formulario completo.');
  }
  if(content.querySelector('script:not([type="application/json"])'))throw Error('Esta opción requiere abrir el formulario completo.');
  await bridge();if(ticket!==generation||!sheet.open)return;clearForm();formURL=new URL(response.url);status.textContent='';status.setAttribute('role','status');fallback.hidden=true;
  title.textContent=content.querySelector('h1')?.textContent.trim()||'Formulario';description.textContent=formURL.pathname.startsWith('/add/')?'Nuevo registro · completa los campos y guarda.':'Editar registro · revisa los cambios antes de guardar.';
  content.querySelector('h1')?.remove();
  body=node('div','vip-sheet-body');footer=node('footer','vip-sheet-footer');
  const toolbar=content.querySelector('.toolbar');toolbar?.querySelectorAll('.js-button-back').forEach(e=>e.remove());
  if(toolbar){toolbar.classList.add('vip-sheet-toolbar');footer.append(toolbar);}
  const cancel=node('button','button button-secondary','Cancelar');cancel.type='button';cancel.onclick=()=>close();footer.prepend(cancel);
  body.append(...content.childNodes);
  const spinner=parsed.querySelector('.js-spinner')||node('div','js-spinner');body.append(spinner);
  const absoluteAction=new URL(form.getAttribute('action')||formURL.href,formURL);if(absoluteAction.origin!==location.origin)throw Error('El formulario no pertenece a este servidor.');form.action=absoluteAction.href;
  Object.defineProperty(form,'submit',{configurable:true,value:()=>send(form)});
  const mount=()=>{root.append(body,footer);teardown=window.vipInitNativeForm(root,formURL.href);window.Alpine?.initTree(root);};
  if(window.Alpine)window.Alpine.mutateDom(mount);else mount();
  dirty=posted&&Boolean(body.querySelector('.alert-danger,.alert-error'));setBusy(false);
  const focus=body.querySelector('.alert-danger,.alert-error,input:not([type=hidden]):not([disabled]),select:not([disabled]),textarea:not([disabled])');
  if(focus){if(focus.matches('.alert-danger,.alert-error'))focus.tabIndex=-1;focus.focus({preventScroll:true});}
  body.scrollTop=0;
 }
 let posting=false;
 async function send(form){
  if(posting||!sheet.open)return;
  posting=true;setBusy(true);status.textContent='Guardando…';
  try{
   const response=await fetch(form.action,{method:form.method.toUpperCase(),body:new FormData(form),credentials:'same-origin'});
   if(!response.ok)throw Error('No se pudo guardar. Revisa el formulario completo antes de volver a intentarlo.');
   await render(response,true);
  }catch(error){showError(error.message);}finally{posting=false;}
 }
 async function open(url,source){
  if(sheet?.open&&!close())return;
  ensureSheet();const ticket=++generation;trigger=source||document.activeElement;closeMenu();
  baseForm=document.getElementById('main-form');if(baseForm){baseForm.id='vip-background-form';document.querySelectorAll('[form="main-form"]').forEach(e=>e.setAttribute('form','vip-background-form'));}
  formURL=url;dirty=false;title.textContent=url.pathname.startsWith('/add/')?'Nuevo registro':'Editar registro';description.textContent='';status.textContent='Cargando formulario…';status.setAttribute('role','status');fallback.hidden=true;resize();
  sheet.showModal();document.body.classList.add('vip-sheet-open');setBusy(false);request=new AbortController();
  try{const response=await fetch(url,{credentials:'same-origin',signal:request.signal});if(!response.ok)throw Error('No se pudo cargar el formulario.');await render(response,false,ticket);}
  catch(error){if(error.name!=='AbortError'&&ticket===generation&&sheet.open)showError(error.message);}
 }
 function details(row){
  if(sheet?.open&&!close())return;
  ensureSheet();trigger=row;closeMenu();title.textContent='Detalle del registro';description.textContent='Información visible en esta lista.';status.textContent='';fallback.hidden=true;dirty=false;resize();
  body=node('div','vip-sheet-body');const list=node('dl','vip-record-detail');
  const cells=[...row.querySelectorAll('.units-table-cell')].filter(e=>!e.querySelector('input,button')&&!e.classList.contains('units-table-row-actions'));
  (cells.length?cells:[row.querySelector('.units-table-heading-cell')||row]).forEach((cell,i)=>{const value=cell.textContent.trim();if(value){list.append(node('dt','',cell.dataset.label||cell.getAttribute('aria-label')||(i?'Dato '+(i+1):'Registro')),node('dd','',value));}});
  body.append(list);footer=node('footer','vip-sheet-footer');const button=node('button','button button-secondary','Cerrar');button.type='button';button.onclick=()=>close();footer.append(button);root.append(body,footer);sheet.showModal();document.body.classList.add('vip-sheet-open');setBusy(false);
 }
 document.addEventListener('click',e=>{
  if(e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
  const a=e.target.closest('a[href]');if(!a||a.closest('#vip-files')||a.classList.contains('vip-sheet-fallback')||a.target&&a.target!=='_self'||a.hasAttribute('download'))return;
  if(sheet?.open&&a.closest('#vip-record-sheet')&&a.classList.contains('js-button-back')){e.preventDefault();e.stopImmediatePropagation();close();return;}
  const url=recordURL(a.href);if(!url)return;e.preventDefault();e.stopPropagation();open(url,a);
 });
 window.addEventListener('beforeunload',e=>{if(sheet?.open&&dirty){e.preventDefault();e.returnValue='';}});
 const preferenceKey='vip-double-click:'+context.user+':'+location.pathname;
 let preference='edit';try{preference=localStorage.getItem(preferenceKey)||'edit';}catch{}
 const interactive='a,button,input,select,textarea,label,[contenteditable=true],[role=button]';
 const rows=()=>document.querySelectorAll('.js-unit:not(#vip-files .js-unit)');
 function actions(row){
  return [...row.querySelectorAll('.units-table-row-actions a[href],.vip-account-actions a[href]')].filter(a=>!a.hasAttribute('hidden')&&a.getAttribute('aria-disabled')!=='true'&&!a.closest('[hidden]')).map(a=>{
   let url;try{url=new URL(a.href,location.origin);}catch{return null;}if(url.origin!==location.origin||!/^https?:$/.test(url.protocol))return null;
   const path=url.pathname,destructive=/^\/(delete|suspend|restart|purge|rebuild)\//.test(path);
   const label=a.getAttribute('aria-label')||a.getAttribute('title')||a.textContent.trim()||({'edit':'Editar','delete':'Eliminar','suspend':'Suspender','unsuspend':'Activar','login':'Entrar en la cuenta'}[path.split('/')[1]])||'Abrir';
   return{a,label,destructive,edit:Boolean(recordURL(url)&&path.startsWith('/edit/'))};
  }).filter(Boolean);
 }
 function execute(row){if(preference==='disabled')return;const edit=actions(row).find(a=>a.edit);if(preference==='edit'&&edit)edit.a.click();else details(row);}
 function closeMenu(){if(menu){menu.remove();menu=null;}}
 function openMenu(row,x,y,source){
  const anchor=row.getBoundingClientRect();x=Number.isFinite(x)?x:anchor.left+20;y=Number.isFinite(y)?y:anchor.top+20;
  closeMenu();menuOwner=source||row;menu=node('div','vip-row-menu');menu.setAttribute('role','menu');menu.setAttribute('aria-label','Opciones del registro');
  const items=actions(row);const add=(label,callback,danger=false)=>{const b=node('button',danger?'vip-row-danger':'',label);b.type='button';b.setAttribute('role','menuitem');b.onclick=()=>{closeMenu();callback();};menu.append(b);};
  add('Ver detalle',()=>details(row));items.forEach(item=>add(item.label,()=>item.a.click(),item.destructive));
  const label=node('label','vip-double-click-label','Acción del doble clic');const select=node('select');select.setAttribute('aria-label','Acción del doble clic');
  for(const [value,text] of [['edit',items.some(a=>a.edit)?'Editar':'Ver detalle si no se puede editar'],['detail','Ver detalle'],['disabled','Desactivado']]){const option=node('option','',text);option.value=value;select.append(option);}select.value=preference;
  select.onchange=()=>{preference=select.value;try{localStorage.setItem(preferenceKey,preference);}catch{}updateRows();};label.append(select);menu.append(label);document.body.append(menu);
  const scale=Number.parseFloat(getComputedStyle(document.documentElement).zoom)||1,r=menu.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(x,innerWidth-r.width-8))/scale+'px';menu.style.top=Math.max(8,Math.min(y,innerHeight-r.height-8))/scale+'px';menu.querySelector('button')?.focus();
 }
 function updateRows(){rows().forEach(row=>{if(!row.querySelector('.units-table-heading-cell'))return;row.title=preference==='disabled'?'Clic derecho: opciones':preference==='edit'?'Doble clic: editar o ver detalle · Clic derecho: opciones':'Doble clic: ver detalle · Clic derecho: opciones';if(!row.hasAttribute('tabindex'))row.tabIndex=0;
  const target=row.querySelector('.units-table-row-actions');if(target&&!target.querySelector('.vip-row-trigger')){const b=node('button','vip-row-trigger','⋮');b.type='button';b.setAttribute('aria-label','Opciones de '+(row.dataset.sortName||'este registro'));b.title='Opciones';b.onclick=e=>{e.stopPropagation();const r=b.getBoundingClientRect();openMenu(row,r.right,r.bottom,b);};target.append(b);row.classList.add('vip-enhanced-row');}
 });}
 document.addEventListener('dblclick',e=>{if(e.target.closest(interactive+',#vip-files,#vip-record-sheet'))return;const row=e.target.closest('.js-unit');if(row){e.preventDefault();execute(row);}});
 document.addEventListener('contextmenu',e=>{if(e.target.closest('input,textarea,[contenteditable=true],#vip-files,#vip-record-sheet'))return;const row=e.target.closest('.js-unit');if(row){e.preventDefault();openMenu(row,e.clientX,e.clientY,row);}});
 document.addEventListener('keydown',e=>{
  if(menu){if(e.key==='Escape'){e.preventDefault();closeMenu();menuOwner?.focus();}else if(['ArrowDown','ArrowUp'].includes(e.key)&&!e.target.matches('select')){e.preventDefault();const items=[...menu.querySelectorAll('button,select')],index=items.indexOf(document.activeElement);items[(index+(e.key==='ArrowDown'?1:items.length-1))%items.length].focus();}return;}
  const row=e.target.closest('.js-unit');if(row&&e.target===row){if(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10'){e.preventDefault();const r=row.getBoundingClientRect();openMenu(row,r.left+20,r.top+20,row);}else if(e.key==='Enter'){e.preventDefault();execute(row);}}
 },true);
 document.addEventListener('pointerdown',e=>{if(menu&&!menu.contains(e.target))closeMenu();});window.addEventListener('resize',closeMenu);document.addEventListener('scroll',e=>{if(menu&&!menu.contains(e.target))closeMenu();},true);
 updateRows();window.vipInteractions={open:(href,source)=>{const url=recordURL(href);if(url)open(url,source);},close};
})();
