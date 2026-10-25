/* Global administrative lists; mutations use native owner sessions and tokens. */
(() => {
 'use strict';
 const context=JSON.parse(document.getElementById('via-context')?.textContent||'{}');
 const mail=/^\/list\/mail\/?$/.test(location.pathname),db=/^\/list\/db\/?$/.test(location.pathname);
 const inventory=mail?context.mailInventory:db?context.databasesInventory:null;
 if(!context.admin||!inventory)return;
 const content=document.querySelector('.app-content');if(!content)return;
 const node=(tag,text,cls)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(cls)element.className=cls;return element;};
 const title=mail?'Correo de todas las cuentas':'Bases de datos de todas las cuentas';
 const section=node('section',undefined,'vip-domains-inventory');section.id='vip-service-inventory';section.setAttribute('aria-label',title);
 section.append(node('span','Todas las cuentas','vip-scope-label'));
 const creation=node('div',undefined,'vip-domains-filters vip-service-toolbar'),accountSelect=node('select');accountSelect.setAttribute('aria-label','Cuenta para crear recursos');for(const account of context.fileAccounts||[]){const option=node('option',account.user);option.value=account.user;option.title=account.name;accountSelect.append(option);}const create=node('a',mail?'Crear dominio de correo':'Crear nueva base de datos','button');creation.append(accountSelect,create);section.append(creation);
 const setCreate=()=>{const path=mail?'/add/mail/':'/add/db/',url=new URL('/login/',location.origin);url.searchParams.set('loginas',accountSelect.value);url.searchParams.set('edit_link',path);url.searchParams.set('token',context.csrfToken||'');create.href=accountSelect.value===context.user?path:url.pathname+url.search;};accountSelect.onchange=setCreate;setCreate();const own=node('a','Mi cuenta');own.href=location.pathname+'?vip_scope=account';creation.append(own);
 if(!mail){const pma=node('a','phpMyAdmin · todas las bases','button button-secondary');const url=new URL('/'+(context.phpmyadminAlias||'phpmyadmin')+'/',location.origin);if(context.phpmyadminPort)url.port=String(context.phpmyadminPort);pma.href=url.href;pma.target='_blank';pma.rel='noopener';if(context.sqlAdmin)pma.dataset.vipSqlAdmin='true';creation.prepend(pma);if(context.sqlAdmin){const users=pma.cloneNode(true);users.textContent='Usuarios y permisos SQL';users.dataset.vipSqlRoute='/server/privileges';pma.after(users);}section.append(node('p',context.sqlAdmin?'Acceso administrativo a todas las bases y permisos. Crea las bases desde «Crear nueva base de datos» para registrarlas en la cuenta y en sus respaldos.':'El acceso directo requiere credenciales SQL. Cada base conserva el acceso único nativo de su propietario.'));}
 if(!inventory.available||inventory.failedAccounts){const warning=node('p','El inventario está incompleto. Recarga o entra desde Enumerar las cuentas.');warning.setAttribute('role','alert');section.append(warning);}
 const filters=node('div',undefined,'vip-domains-filters'),search=node('input'),select=node('select');search.type='search';search.placeholder='Buscar recurso o cuenta…';search.setAttribute('aria-label','Buscar recurso o cuenta');select.setAttribute('aria-label','Filtrar por propietario');
 const all=node('option','Todas las cuentas');all.value='';select.append(all);
 [...new Set(inventory.rows.map(item=>item.owner))].sort().forEach(owner=>{const option=node('option',owner);option.value=owner;select.append(option);});filters.append(search,select);section.append(filters);
 const wrapper=node('div',undefined,'vip-domains-table-wrap'),table=node('table',undefined,'vip-domains-table'),head=node('thead'),titles=node('tr');
 (mail?['Correo / dominio','Propietario / cuenta','Reenvío','Disco','Estado','Acciones']:['Base de datos','Propietario / cuenta','Usuario SQL','Disco','Estado','Acciones']).forEach(text=>{const cell=node('th',text);cell.scope='col';titles.append(cell);});head.append(titles);table.append(head);
 const body=node('tbody'),rows=[];
 const switchTo=(owner,path)=>{const target=new URL(path,location.origin);target.searchParams.set('token',context.csrfToken||'');if(owner===context.user){if(target.pathname==='/list/db/'&&!target.searchParams.has('database'))target.searchParams.set('vip_scope','account');return target.pathname+target.search;}const url=new URL('/login/',location.origin);url.searchParams.set('loginas',owner);url.searchParams.set('edit_link',target.pathname+target.search);url.searchParams.set('token',context.csrfToken||'');return url.pathname+url.search;};
 const action=(parent,label,owner,path)=>{const link=node('a',label);link.href=switchTo(owner,path);parent.append(link);return link;};
 inventory.rows.slice().sort((a,b)=>(a.domain||a.name).localeCompare(b.domain||b.name)||(a.account||'').localeCompare(b.account||'')).forEach(item=>{
  const name=mail?(item.account?item.account+'@'+item.domain:item.domain):item.name;
  const row=node('tr'),resource=node('td'),owner=node('td'),actions=node('td',undefined,'vip-domains-actions');resource.append(node('strong',name));if(mail&&!item.account)resource.append(node('small','Sin buzones'));
  owner.append(node('strong',item.owner),node('small',item.ownerName));
  if(mail){
   const query=new URLSearchParams({domain:item.domain});action(actions,'Buzones / suspender / eliminar',item.owner,'/list/mail/?'+query);
   action(actions,'Crear buzón',item.owner,'/add/mail/?'+query);
   action(actions,'Dominio y relay SMTP',item.owner,'/edit/mail/?'+query);
   if(item.account){query.set('account',item.account);const settings=action(actions,'Contraseña y ajustes',item.owner,'/edit/mail/?'+query);settings.title='Contraseña, cuota, alias, reenvíos, respuesta automática y límite de envío';}
   else action(actions,'Configurar dominio',item.owner,'/edit/mail/?'+query);
  }else{
   const query=new URLSearchParams({database:item.name});action(actions,'Administrar',item.owner,'/edit/db/?'+query);
   const link=action(actions,'phpMyAdmin',item.owner,'/list/db/');if(context.sqlAdmin)link.dataset.vipSqlAdmin='true';else link.dataset.vipPmaDatabase=item.name;
  }
  if(mail&&item.account&&context.mailAdmin){const inbox=node('button','Acceder a bandeja','button button-secondary');inbox.type='button';inbox.dataset.vipMailbox=JSON.stringify(item);actions.prepend(inbox);}
  row.append(resource,owner,node('td',mail?(item.forward||'—'):item.dbuser),node('td',(item.disk||'0')+' MB'),node('td',item.suspended||item.accountSuspended?'Suspendido':'Activo'),actions);body.append(row);
  rows.push({row,owner:item.owner,text:[name,item.owner,item.ownerName,item.forward,item.dbuser].join(' ').toLocaleLowerCase()});
 });
 table.append(body);wrapper.append(table);const count=node('p',undefined,'vip-domains-count');count.setAttribute('role','status');
 const filter=()=>{let total=0;const text=search.value.trim().toLocaleLowerCase();rows.forEach(item=>{item.row.hidden=!!(select.value&&item.owner!==select.value||text&&!item.text.includes(text));if(!item.row.hidden)total++;});count.textContent=total+(mail?' registros de correo':' bases de datos');};search.oninput=filter;select.onchange=filter;filter();section.append(wrapper,count);content.append(section);document.body.classList.add('vip-global-services');
})();
