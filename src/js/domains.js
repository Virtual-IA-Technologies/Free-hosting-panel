/* Read-only server inventory. Edits and files use Hestia's native account switch. */
(() => {
 'use strict';
 const contextNode=document.getElementById('via-context');if(!contextNode)return;
 const context=JSON.parse(contextNode.textContent),inventory=context.domainsInventory;
 if(!context.admin||!inventory||!/^\/list\/web\/?$/.test(location.pathname))return;
 const content=document.querySelector('.app-content');if(!content)return;
 const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 const section=node('section','vip-domains-inventory');section.id='vip-domains-inventory';section.setAttribute('aria-label','Dominios de todas las cuentas');
 if(!inventory.available||inventory.failedAccounts){const warning=node('p','vip-account-hint','No se pudo completar el inventario de todas las cuentas. Recarga la página o entra en cada cuenta desde Enumerar las cuentas.');warning.setAttribute('role','alert');content.prepend(warning);return;}
 const switchTo=(owner,path)=>{if(owner===context.user)return path==='/list/web/'?'/list/web/?vip_scope=account':path;const url=new URL('/login/',location.origin);url.searchParams.set('loginas',owner);url.searchParams.set('edit_link',path);url.searchParams.set('token',context.csrfToken||'');return url.pathname+url.search;};
 const header=node('div','vip-domains-header');header.append(node('h2','','Dominios de todas las cuentas'),node('p','','Cada sitio muestra su propietario. Administrar y Archivos abren la cuenta correspondiente.'));
 const toolbar=node('div','vip-domains-filters'),search=node('input'),owners=node('select');search.type='search';search.placeholder='Buscar dominio o cuenta…';search.setAttribute('aria-label','Buscar dominio o cuenta');owners.setAttribute('aria-label','Filtrar por propietario');
 const option=node('option','','Todas las cuentas');option.value='';owners.append(option);
 [...new Set(inventory.rows.map(row=>row.owner))].sort().forEach(owner=>{const option=node('option','',owner);option.value=owner;owners.append(option);});toolbar.append(search,owners);
 const wrapper=node('div','vip-domains-table-wrap'),table=node('table','vip-domains-table'),thead=node('thead'),tr=node('tr');
 ['Dominio','Propietario / cuenta','Dirección IP','Disco','SSL','Acciones'].forEach(label=>{const th=node('th','',label);th.scope='col';tr.append(th);});thead.append(tr);table.append(thead);
 const tbody=node('tbody'),rows=[];
 inventory.rows.slice().sort((a,b)=>a.domain.localeCompare(b.domain)).forEach(item=>{
  const row=node('tr'),domain=node('td'),name=node('strong','',item.domain);domain.append(name);
  if(item.aliases)domain.append(node('small','','Alias: '+item.aliases.split(',').join(', ')));
  if(item.suspended)domain.append(node('small','','Suspendido'));
  const owner=node('td');owner.append(node('strong','',item.owner));if(item.ownerName!==item.owner)owner.append(node('small','',item.ownerName));
  const actions=node('td','vip-domains-actions');
  for(const [label,path] of [['Administrar','/list/web/'],['Archivos','/fm/']]){const link=node('a','',label);link.href=switchTo(item.owner,path==='/fm/'?'/list/web/':path);if(path==='/fm/')link.dataset.vipFilesOwner=item.owner;link.setAttribute('aria-label',label+' · '+item.domain+' · '+item.owner);actions.append(link);}
  const preview=context.previewRoutes?.[item.domain];if(preview&&/^https?:\/\//.test(preview)){const link=node('a','','Probar por IP');link.href=preview;link.target='_blank';link.rel='noopener';link.setAttribute('aria-label','Probar por IP '+item.domain);actions.prepend(link);}
  row.append(domain,owner,node('td','',item.ip),node('td','',(item.disk||'0')+' MB'),node('td','',item.ssl?'Activo':'Pendiente'),actions);tbody.append(row);
  rows.push({row,owner:item.owner,search:(item.domain+' '+item.aliases+' '+item.owner+' '+item.ownerName).toLocaleLowerCase()});
 });
 table.append(tbody);wrapper.append(table);const count=node('p','vip-domains-count');count.setAttribute('role','status');
 const filter=()=>{const q=search.value.trim().toLocaleLowerCase();let visible=0;rows.forEach(item=>{item.row.hidden=Boolean(owners.value&&owners.value!==item.owner||q&&!item.search.includes(q));if(!item.row.hidden)visible++;});count.textContent=visible+' '+(visible===1?'dominio':'dominios')+' · '+new Set(rows.filter(item=>!item.row.hidden).map(item=>item.owner)).size+' cuentas';};
 search.addEventListener('input',filter);owners.addEventListener('change',filter);filter();
 section.append(header,toolbar,wrapper,count);content.append(section);document.body.classList.add('vip-global-domains');
})();
