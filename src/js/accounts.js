/* cPanel-like account columns; native rows, bulk controls and actions are retained. */
(() => {
 'use strict';const context=JSON.parse(document.getElementById('via-context')?.textContent||'{}');
 if(!context.admin||!context.accountsInventory||!/^\/list\/user\/?$/.test(location.pathname))return;
 const nativeRows=[...document.querySelectorAll('.js-unit[data-sort-name]')];if(!nativeRows.length)return;
 const byUser=new Map(context.accountsInventory.map(item=>[item.user.toLowerCase(),item]));
 const table=nativeRows[0].closest('.units-table');if(!table)return;table.classList.add('vip-accounts-table');
 const rows=nativeRows.filter(row=>byUser.has(row.dataset.sortName.toLowerCase()));
 nativeRows.filter(row=>!rows.includes(row)).forEach(row=>row.remove());
 const header=table.querySelector('.units-table-header'),names=['','Cuenta','Opciones','Plan','IPs asignadas','Uso del disco','Transferencia'];
 [...header.children].slice(0,7).forEach((cell,index)=>{cell.dataset.vipCol=String(index);if(index)cell.textContent=names[index];});
 const node=(tag,text)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element;};
 const add=(parent,label,column)=>{const cell=node('div',label);cell.className='units-table-cell';cell.dataset.vipCol=String(column);parent.append(cell);return cell;};
 [['Dominio',7],['Dirección IP',8],['Correo de contacto',9],['Fecha de alta',10],['Cuota',11],['Enlaces rápidos',12],['Estado',13]].forEach(([name,column])=>add(header,name,column));
 const format=value=>{let number=Number(value)||0,unit='MB';if(number>=1024){number/=1024;unit='GB';}return new Intl.NumberFormat('es',{maximumFractionDigits:1}).format(number)+' '+unit;};
 for(const row of rows){
  const account=byUser.get(row.dataset.sortName);if(!account)continue;
  const cells=[...row.children];cells.slice(0,7).forEach((cell,index)=>cell.dataset.vipCol=String(index));
  cells[5].textContent=format(account.disk);cells[6].textContent=format(account.traffic);
  const domain=add(row,'',7);domain.append(node('strong',account.domains[0]||'Sin dominio web'));if(account.domains.length>1)domain.append(node('small',account.domains.slice(1).join(', ')));
  add(row,account.ips.join(', ')||'—',8);add(row,account.contact||'—',9);add(row,window.vipDate?.(account.created)||account.created||'—',10);add(row,account.quota==='unlimited'?'Ilimitada':format(account.quota),11);
  const quick=add(row,'',12),links=row.querySelector('.vip-account-actions');if(links)quick.append(links);
  add(row,account.suspended?'Suspendida':'Activa',13);
  for(const span of cells[1].querySelectorAll('span[title]'))if(span.title===account.contact)span.remove();
 }
 const note=node('p','Disco y transferencia del servidor actual, calculados por Hestia. La actualización programada es diaria; el tráfico histórico del servidor anterior no se suma.');note.className='vip-account-hint';table.after(note);
 const tools=node('div');tools.className='vip-domains-filters vip-account-filters';const search=node('input');search.type='search';search.placeholder='Buscar por dominio, cuenta, IP, contacto o plan…';search.setAttribute('aria-label','Buscar cuentas');
 const state=node('select');state.setAttribute('aria-label','Estado de las cuentas');for(const [value,label] of [['','Todas'],['active','Activas'],['suspended','Suspendidas']]){const option=node('option',label);option.value=value;state.append(option);}
 const footer=document.querySelector('.units-table-footer p');
 const filter=()=>{const query=search.value.trim().toLocaleLowerCase();for(const row of rows){const account=byUser.get(row.dataset.sortName);if(account)row.hidden=!!(query&&!row.textContent.toLocaleLowerCase().includes(query)||state.value==='active'&&account.suspended||state.value==='suspended'&&!account.suspended);}const visible=rows.filter(row=>!row.hidden).length;if(footer)footer.textContent=(visible===rows.length?rows.length:visible+' de '+rows.length)+' cuentas de alojamiento';};search.oninput=filter;state.onchange=filter;tools.append(search,state);filter();
 const collator=new Intl.Collator('es',{numeric:true,sensitivity:'base'});
 const fields={1:a=>a.user,3:a=>a.plan,5:a=>Number(a.disk)||0,6:a=>Number(a.traffic)||0,7:a=>a.domains[0]||'',8:a=>a.ips.join(', '),9:a=>a.contact||'',10:a=>a.created||'',11:a=>a.quota==='unlimited'?Infinity:Number(a.quota)||0,13:a=>a.suspended?'Suspendida':'Activa'};
 let sortedColumn=null,descending=false;
 for(const cell of header.children){const column=Number(cell.dataset.vipCol),value=fields[column];if(!value)continue;
  const label=cell.textContent,button=node('button',label+' ↕');button.type='button';button.className='vip-account-sort';cell.replaceChildren(button);cell.setAttribute('aria-sort','none');
  button.onclick=()=>{descending=sortedColumn===column?!descending:false;sortedColumn=column;
   const ordered=[...rows].sort((a,b)=>{const av=value(byUser.get(a.dataset.sortName)),bv=value(byUser.get(b.dataset.sortName));const result=typeof av==='number'?(av===bv?0:av<bv?-1:1):collator.compare(av,bv);return (descending?-result:result)||collator.compare(a.dataset.sortName,b.dataset.sortName);});
   // Move the existing rows inside their native container, retaining controls and listeners.
   const parent=rows[0]?.parentNode,anchor=rows[rows.length-1]?.nextSibling;if(parent){const marker=document.createComment('account order');parent.insertBefore(marker,anchor);for(const row of ordered)parent.insertBefore(row,marker);marker.remove();}
   for(const other of header.children){const active=other===cell;if(other.hasAttribute('aria-sort')){other.setAttribute('aria-sort',active?(descending?'descending':'ascending'):'none');const control=other.querySelector('.vip-account-sort');if(control)control.textContent=control.textContent.replace(/ [↕↑↓]$/,'')+' '+(active?(descending?'↓':'↑'):'↕');}}
  };
 }
 const csv=node('button','Exportar CSV');csv.type='button';csv.onclick=()=>{const quote=value=>'"'+String(value??'').replaceAll('"','""')+'"';const data=[['Dominio','IP','Cuenta','Contacto','Alta','Cuota MB','Disco MB','Transferencia MB','Plan','Estado'],...context.accountsInventory.filter(account=>rows.some(row=>row.dataset.sortName===account.user.toLowerCase()&&!row.hidden)).map(account=>[account.domains.join(', '),account.ips.join(', '),account.user,account.contact,account.created,account.quota,account.disk,account.traffic,account.plan,account.suspended?'Suspendida':'Activa'])];const url=URL.createObjectURL(new Blob(['\uFEFF'+data.map(row=>row.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=node('a');a.href=url;a.download='cuentas.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};tools.append(csv);table.before(tools);
})();
