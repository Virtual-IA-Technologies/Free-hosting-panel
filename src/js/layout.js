/* Contextual help stays available without competing with the working area. */
(() => {
 'use strict';const heading=document.querySelector('.via-page-heading');if(!heading)return;
 const entries=[],node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};let trigger;
 function open(){let dialog=document.getElementById('vip-help');if(dialog)dialog.remove();dialog=node('dialog',undefined,'vip-mail-dialog vip-help');dialog.id='vip-help';const header=node('div',undefined,'vip-mail-dialog-heading'),close=node('button','Cerrar','button button-secondary');close.type='button';close.onclick=()=>dialog.close();header.append(node('h2','Ayuda de esta sección'),close);const body=node('div',undefined,'vip-mail-dialog-body');entries.forEach(item=>{const section=node('section');section.append(node('h3',item.title),item.content.cloneNode(true));section.querySelectorAll('details').forEach(d=>d.open=true);body.append(section);});dialog.append(header,body);dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();}
 window.vipHelp={add(title,content){if(entries.some(item=>item.title===title&&item.content.textContent===content.textContent))return;entries.push({title,content});if(!trigger){trigger=node('button','Ayuda','vip-help-trigger');trigger.type='button';trigger.onclick=open;heading.append(trigger);}}};
 document.querySelectorAll('.vip-account-hint:not([role=alert]),.vip-hosting-guide').forEach(item=>{const title=item.querySelector('summary')?.textContent||'Información';window.vipHelp.add(title,item);item.remove();});
 for(const item of document.querySelectorAll('#vip-service-inventory > p:not([role]),#vip-service-inventory > h2')){if(item.matches('p'))window.vipHelp.add('Administración',item);item.remove();}
 for(const hint of document.querySelectorAll('#vip-domains-inventory .vip-domains-header p')){window.vipHelp.add('Dominios',hint);hint.remove();}
 const c=JSON.parse(document.getElementById('via-context')?.textContent||'{}');
 if(c.serverTime&&location.pathname==='/edit/server/'){
  const label=node('small',undefined,'vip-server-clock');label.textContent=window.vipDate(c.serverTime.epoch)+' · '+c.serverTime.timezone;heading.append(label);
 }
})();
