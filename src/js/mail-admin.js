/* Optional on-demand mail tools and unified SQL signon. Native authentication only. */
(() => {
 'use strict';const context=JSON.parse(document.getElementById('via-context')?.textContent||'{}');if(!context.admin||!context.mailAdmin)return;
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 async function call(action,parameters={}){const response=await fetch('/vip/mail-admin/',{method:'POST',credentials:'same-origin',body:new URLSearchParams({token:context.csrfToken,action,...parameters})});const value=await response.json();if(!response.ok||!value.ok)throw Error(value.error||'No se pudo completar la operación');return value.data;}
 const button=(parent,label,action)=>{const b=node('button',label,'button button-secondary');b.type='button';b.onclick=action;parent.append(b);return b;};
 function status(parent,text){const p=node('p',text,'vip-mail-status');p.setAttribute('role','status');parent.replaceChildren(p);return p;}
 function view(){let dialog=document.getElementById('vip-mail-dialog');if(dialog)dialog.remove();dialog=node('dialog',undefined,'vip-mail-dialog');dialog.id='vip-mail-dialog';const heading=node('div',undefined,'vip-mail-dialog-heading');heading.append(node('h2','Administración del correo'));button(heading,'Cerrar',()=>dialog.close());const body=node('div',undefined,'vip-mail-dialog-body');dialog.append(heading,body);dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();return body;}
 async function openTicket(action,parameters={},route='',sameTab=false){
  const name='vip-admin-'+Date.now(),tab=sameTab?null:window.open('about:blank',name);if(tab){tab.opener=null;tab.document.body.textContent='Abriendo acceso administrativo…';}
  try{const data=await call(action,parameters),url=new URL(action==='sql_login'?'/'+(context.phpmyadminAlias||'phpmyadmin')+'/vip-admin-sso.php':'/',location.origin);url.protocol='https:';url.port=String(action==='sql_login'?context.phpmyadminPort:context.webmailPort);
   const form=node('form');form.method='POST';form.action=url.href;form.target=tab?name:'_self';const input=node('input');input.type='hidden';input.name=action==='sql_login'?'ticket':'vip_admin_ticket';input.value=data.ticket;form.append(input);if(action==='sql_login'&&route){const field=node('input');field.type='hidden';field.name='route';field.value=route;form.append(field);}document.body.append(form);form.submit();form.remove();
  }catch(error){if(tab)tab.close();const body=view();status(body,error.message);}
 }
 document.addEventListener('click',event=>{
  const sql=event.target.closest('[data-vip-sql-admin]');if(sql){event.preventDefault();event.stopImmediatePropagation();openTicket('sql_login',{},sql.dataset.vipSqlRoute||'');return;}
  const inbox=event.target.closest('[data-vip-mailbox]');if(inbox){event.preventDefault();const item=JSON.parse(inbox.dataset.vipMailbox);if(item.suspended||item.accountSuspended)openMailbox(item);else openTicket('webmail',{owner:item.owner,domain:item.domain,account:item.account});}
 },true);
 async function openMailbox(item){const body=view();status(body,'Cargando bandeja…');const parameters={owner:item.owner,domain:item.domain,account:item.account};
  try{const data=await call('mailbox_list',parameters);body.replaceChildren(node('h3',data.email),node('p','Vista de mensajes importados mientras el dominio está suspendido. Webmail completo y envío se habilitan al activar el correo en el corte.'));const list=node('div',undefined,'vip-mail-message-list');
   data.items.forEach(message=>button(list,message.folder+' · '+message.subject+' · '+message.from,async()=>{try{const value=await call('mailbox_read',{...parameters,id:message.id}),detail=node('section');detail.append(node('h3',value.subject),node('p',value.from+' → '+value.to),node('pre',value.body));list.replaceChildren(detail);}catch(error){status(list,error.message);}}));
   body.append(node('p',(data.truncated?'Al menos ':'')+data.total+' mensajes; hasta 100 recientes'+(data.truncated?' de una consulta limitada. Usa webmail para el buzón completo.':'')),list);
  }catch(error){status(body,error.message);}
 }
 async function tools(mode='queue'){
  const body=view(),nav=node('nav',undefined,'vip-mail-tool-tabs');nav.setAttribute('aria-label','Herramientas de correo');for(const [key,label] of [['queue','Cola de correos'],['trace','Seguimiento de entregas'],['relayers','Relayers']]){const tab=button(nav,label,()=>tools(key));if(key===mode)tab.setAttribute('aria-current','page');}
  const content=node('div');body.append(nav,content);status(content,'Consultando…');
  try{
   if(mode==='queue'){
    const data=await call('queue');content.replaceChildren(node('p',data.total+' mensajes en cola. Las acciones se ejecutan solo al confirmarlas.'));
    const table=node('table',undefined,'vip-domains-table'),head=node('thead'),tr=node('tr');['ID / antigüedad','Remitente','Destinatarios','Estado','Acciones'].forEach(text=>tr.append(node('th',text)));head.append(tr);table.append(head);const tbody=node('tbody');
    data.items.forEach(item=>{const row=node('tr'),actions=node('td');button(actions,'Ver mensaje',async()=>{try{const message=await call('message',{id:item.id});content.replaceChildren(node('h3',item.id),node('pre',message.headers+'\n\n'+message.body+'\n\nHISTORIAL\n'+message.history));}catch(error){status(content,error.message);}});
     for(const [action,label] of [['retry','Reintentar entrega'],[item.frozen?'thaw':'freeze',item.frozen?'Descongelar':'Congelar'],['remove','Eliminar de la cola']])button(actions,label,async()=>{if(!confirm(label+' el mensaje '+item.id+'?'+(action==='remove'?' Se guardará una copia privada antes de eliminarlo.':'')))return;try{await call(action,{id:item.id,confirm:'true'});tools('queue');}catch(error){status(content,error.message);}});
     row.append(node('td',item.id+' · '+item.age),node('td',item.sender),node('td',item.recipients.join(', ')),node('td',item.frozen?'Congelado':'Pendiente'),actions);tbody.append(row);
    });table.append(tbody);const wrap=node('div',undefined,'vip-domains-table-wrap');wrap.append(table);content.append(wrap);
   }else{
    content.replaceChildren();const form=node('form'),query=node('input');query.type='search';query.placeholder='Correo, dominio, ID o texto de respuesta SMTP';query.maxLength=150;query.setAttribute('aria-label','Buscar seguimiento de correo');const submit=node('button','Buscar','button button-secondary');submit.type='submit';form.append(query,submit);const result=node('div');content.append(form,node('p','Consulta bajo demanda de los registros recientes: hasta 2 MiB por archivo y 500 líneas. Incluye entregas, aplazamientos, rechazos y rebotes; no inventa eventos anteriores a la migración.'),result);
    const load=async()=>{status(result,'Consultando…');try{const data=await call(mode,{query:query.value});if(mode==='trace')result.replaceChildren(node('p',Object.entries(data.summary).map(([label,count])=>label+': '+count).join(' · ')),node('pre',data.lines.join('\n')||'Sin eventos coincidentes.'));else result.replaceChildren(node('pre',data.items.map(item=>item.account+' · '+item.messages+' mensajes autenticados').join('\n')||'Sin relayers autenticados en los registros consultados.'));}catch(error){status(result,error.message);}};form.onsubmit=event=>{event.preventDefault();load();};await load();
   }
  }catch(error){status(content,error.message);}
 }
 const inventory=document.getElementById('vip-service-inventory');if(context.mailInventory&&inventory){const bar=node('nav',undefined,'vip-mail-tool-tabs');for(const [mode,label] of [['queue','Cola de correos'],['trace','Seguimiento y rebotes'],['relayers','Relayers']])button(bar,label,()=>tools(mode));inventory.querySelector('.vip-service-toolbar')?.after(bar);}
 const accountTools=document.querySelector('.vip-account-filters');if(accountTools)button(accountTools,'Actualizar uso de disco y tráfico',async()=>{if(!confirm('Recalcular los contadores nativos una vez con prioridad baja?'))return;try{await call('refresh_metrics',{confirm:'true'});location.reload();}catch(error){const body=view();status(body,error.message);}});
 if(context.sqlAdmin&&new URLSearchParams(location.search).get('vip_sql_reopen')==='1'){history.replaceState(null,'',location.pathname);openTicket('sql_login',{},'',true);}
})();
