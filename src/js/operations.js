/* Global summaries; every mutation stays in the native owner context. */
(() => {
 'use strict';const c=JSON.parse(document.getElementById('via-context')?.textContent||'{}'),inventory=c.operationsInventory;
 if(!c.admin||!inventory)return;
 const content=document.querySelector('.app-content'),node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 const route=(owner,path)=>{const target=new URL(path,location.origin);target.searchParams.set('token',c.csrfToken);if(owner===c.user)return target.pathname+target.search+target.hash;const url=new URL('/login/',location.origin);url.searchParams.set('loginas',owner);url.searchParams.set('edit_link',target.pathname+target.search+target.hash);url.searchParams.set('token',c.csrfToken);return url.pathname+url.search;};
 const section=node('section',undefined,'vip-domains-inventory');section.id='vip-operations';section.append(node('span','Todas las cuentas','vip-scope-label'));
 const toolbar=node('div',undefined,'vip-domains-filters vip-service-toolbar'),owners=node('select');owners.setAttribute('aria-label','Cuenta para crear recursos');
 for(const owner of c.fileAccounts||[]){const option=node('option',owner.user);option.value=owner.user;owners.append(option);}toolbar.append(owners);
 const create=node('a',inventory.kind==='cron'?'Crear tarea':inventory.kind==='keys'?'Añadir clave SSH':'Administrar cuenta','button');
 const createRoute=()=>create.href=route(owners.value,inventory.kind==='cron'?'/add/cron/':inventory.kind==='keys'?'/add/key/':'/edit/user/');owners.onchange=createRoute;createRoute();toolbar.append(create);section.append(toolbar);
 const filters=node('div',undefined,'vip-domains-filters'),search=node('input'),filter=node('select');search.type='search';search.placeholder='Buscar…';search.setAttribute('aria-label','Buscar recursos administrativos');filter.setAttribute('aria-label','Filtrar por propietario');
 for(const [value,label] of [['','Todas las cuentas'],...(c.fileAccounts||[]).map(o=>[o.user,o.user])]){const option=node('option',label);option.value=value;filter.append(option);}filters.append(search,filter);section.append(filters);
 const wrap=node('div',undefined,'vip-domains-table-wrap'),table=node('table',undefined,'vip-domains-table'),head=node('thead'),labels=node('tr');
 const headings=inventory.kind==='cron'?['Cuenta','Programación','Comando','Estado','Acciones']:inventory.kind==='keys'?['Cuenta','Nombre','Huella pública','Acciones']:['Cuenta','Consumido','Límite','Estado','Acciones'];headings.forEach(label=>labels.append(node('th',label)));head.append(labels);table.append(head);
 const body=node('tbody'),rows=[];const format=value=>value==='unlimited'?'Ilimitado':new Intl.NumberFormat('es',{maximumFractionDigits:1}).format(Number(value)||0)+' MB';
 const action=(cell,label,owner,path,confirmation)=>{const a=node('a',label);a.href=route(owner,path);if(confirmation)a.dataset.vipConfirm=confirmation;cell.append(a);};
 for(const item of inventory.rows){const row=node('tr'),actions=node('td',undefined,'vip-domains-actions');row.append(node('td',item.owner));
  if(inventory.kind==='cron'){
   row.append(node('td',item.schedule),node('td',item.command),node('td',item.suspended?'Suspendida':'Activa'));
   action(actions,'Editar',item.owner,'/edit/cron/?job='+encodeURIComponent(item.id));
   action(actions,item.suspended?'Activar':'Suspender',item.owner,'/'+(item.suspended?'unsuspend':'suspend')+'/cron/?job='+encodeURIComponent(item.id),'¿Cambiar el estado de esta tarea de '+item.owner+'?');
   action(actions,'Eliminar',item.owner,'/delete/cron/?job='+encodeURIComponent(item.id),'¿Eliminar esta tarea de '+item.owner+'?');
  }else if(inventory.kind==='keys'){
   row.append(node('td',item.name),node('td',item.fingerprint));
   action(actions,'Sustituir / eliminar',item.owner,'/list/key/');
   action(actions,'Añadir nueva',item.owner,'/add/key/');
  }else{
   row.append(node('td',format(item.used)),node('td',format(item.limit)),node('td',item.suspended?'Suspendida':'Activa'));
   action(actions,'Historial',item.owner,'/list/stats/?vip_scope=account');action(actions,'Límites y plan',item.owner,'/edit/user/');
  }
  row.append(actions);body.append(row);rows.push({row,owner:item.owner,text:row.textContent.toLocaleLowerCase()});
 }
 table.append(body);wrap.append(table);section.append(wrap);const count=node('p',undefined,'vip-domains-count');count.setAttribute('role','status');section.append(count);
 const apply=()=>{const query=search.value.trim().toLocaleLowerCase();let total=0;for(const item of rows){item.row.hidden=Boolean(filter.value&&filter.value!==item.owner||query&&!item.text.includes(query));if(!item.row.hidden)total++;}count.textContent=total+' registros';};search.oninput=apply;filter.onchange=apply;apply();
 if(!inventory.available||inventory.failedAccounts){const warning=node('p','Algunas cuentas no pudieron consultarse. Abre su lista nativa para revisar el estado.');warning.setAttribute('role','alert');section.append(warning);}
 document.addEventListener('click',event=>{const a=event.target.closest('[data-vip-confirm]');if(a&&!confirm(a.dataset.vipConfirm)){event.preventDefault();event.stopImmediatePropagation();}},true);
 content.append(section);document.body.classList.add('vip-global-operations');
})();
