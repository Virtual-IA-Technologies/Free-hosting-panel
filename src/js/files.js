/* Embedded FileGator presentation; native controls keep all file operations. */
(() => {
 'use strict';
 const context=JSON.parse(document.getElementById('via-context')?.textContent||'{}');
 const key='vip-files-view:'+context.user;
 const host=document.getElementById('vip-files');
 if(!host)return;
 function enhance(doc,c){
  const dropzone=host.querySelector('#dropzone'),browser=host.querySelector('#browser');
  if(!dropzone||!browser)return;
  let style=doc.getElementById('vip-files-integrated-style');
  if(!style){style=doc.createElement('style');style.id='vip-files-integrated-style';doc.head.append(style);}
  style.textContent=scopeStyle(`
   html,body,#wrapper,#inner{margin:0!important;min-height:100%;font-family:system-ui,-apple-system,sans-serif!important;background:${c.bg}!important;color:${c.text}!important}
   #dropzone{display:grid!important;grid-template-columns:190px minmax(0,1fr);gap:18px;width:100%!important;max-width:none!important;padding:18px!important;box-sizing:border-box}
   #dropzone>.container{grid-column:2;grid-row:2;width:100%!important;max-width:none!important;margin:0!important;padding:0!important;min-width:0}
   #dropzone nav.navbar{display:none!important}
   #browser{margin-top:0!important;padding:0!important}
   #browser>.is-flex:first-child{background:${c.surface};padding:13px 15px;border:1px solid ${c.border};border-radius:8px;margin-bottom:16px}
   #multi-actions{padding:8px 0 16px;gap:12px;flex-wrap:wrap}
   .table-wrapper{overflow:visible!important}.b-table .table{width:100%;border:1px solid ${c.border}!important;border-radius:8px;border-collapse:separate;border-spacing:0;background:${c.surface}!important}
   .table tr,.table td,.table th{background:transparent!important;color:${c.text}!important;border-color:${c.border}!important;text-shadow:none!important}
   body #browser table.table tbody tr.file-row,body #browser table.table tbody tr.file-row td{background:${c.surface}!important;color:${c.text}!important}
   body #browser table.table tbody tr.file-row:nth-child(even),body #browser table.table tbody tr.file-row:nth-child(even) td{background:${c['surface-alt']}!important}
   body #browser table.table tbody tr.file-row:hover td{background:${c.hover}!important}
   body #browser table.table tbody tr.file-row .name{color:${c.heading}!important}
   body #browser .breadcrumb a{background:transparent!important;color:${c.link}!important;border:0!important}
   body #multi-actions .upload a,body #multi-actions .add-new .dropdown-trigger{background:${c.input}!important;color:${c.heading}!important;border:1px solid ${c.border};padding:8px 12px;border-radius:6px}
   #multi-actions a.add-new{background:transparent!important;border:0!important;padding:0!important;box-shadow:none!important}
   .table thead th{background:${c['surface-alt']}!important;font-size:12px;font-weight:500;padding:13px 12px!important}
   .table td{padding:13px 12px!important;font-size:13px;vertical-align:middle!important}
   .table .name{color:${c.heading}!important;font-weight:400!important;text-shadow:none!important;overflow-wrap:anywhere}
   .table tr:hover td{background:${c.hover}!important}.table tr.is-selected td{background:${c.hover}!important;color:${c.heading}!important}
   .type-dir .name:before{content:'📁';display:inline-block;font-size:20px;margin-right:11px;vertical-align:middle}
   .type-file .name:before{content:'▤';display:inline-block;font-size:20px;margin-right:11px;vertical-align:middle;color:${c.link}}
   .dropdown-content,.modal-card-head,.modal-card-body,.modal-card-foot,.modal-content,.card,.box,.notification{background:${c.surface}!important;color:${c.text}!important;border-color:${c.border}!important}
   .modal{position:fixed!important;inset:0!important;width:auto!important;max-width:none!important;height:auto!important;max-height:none!important;margin:0!important;padding:20px!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;transform:none!important;z-index:1200!important;overflow-y:auto!important}
   .modal.is-active{display:flex!important;align-items:center!important;justify-content:center!important}
   .modal .modal-card,.modal .modal-content{width:640px!important;max-width:100%!important;max-height:calc(100dvh - 40px)!important;margin:0 auto!important}
   .dialog.modal .modal-card{width:460px!important}
   .modal:not(.dialog),.dialog.modal:has(input.input):not(:has(.button.is-danger)){padding:0!important;align-items:stretch!important;justify-content:flex-end!important}
   .modal:not(.dialog) .animation-content,.dialog.modal:has(input.input):not(:has(.button.is-danger)) .animation-content{transform:none!important;transition:none!important;animation:none!important}
   .modal:not(.dialog)>.modal-content,.modal:not(.dialog)>.modal-card,.dialog.modal:has(input.input):not(:has(.button.is-danger)) .modal-card{display:flex!important;flex-direction:column!important;width:min(672px,100vw)!important;max-width:100%!important;height:100dvh!important;max-height:100dvh!important;margin:0!important;border-radius:0!important;border-left:1px solid ${c.border}!important;box-shadow:-12px 0 48px #02081838!important}
   .modal:not(.dialog) .modal-card-head,.dialog.modal:has(input.input):not(:has(.button.is-danger)) .modal-card-head{flex-shrink:0;padding:26px 30px;border-bottom:1px solid ${c.border}}
   .modal:not(.dialog) .modal-card-body,.dialog.modal:has(input.input):not(:has(.button.is-danger)) .modal-card-body{flex:1;min-height:0;overflow-y:auto;padding:26px 30px;overscroll-behavior:contain}
   .modal:not(.dialog) .modal-card-foot,.dialog.modal:has(input.input):not(:has(.button.is-danger)) .modal-card-foot{flex-shrink:0;justify-content:flex-end;padding:18px 30px;border-top:1px solid ${c.border}}
   .modal-card-title{font-size:20px!important;font-weight:450!important}
   @media(max-width:768px){.dropdown.is-mobile-modal>.background{z-index:1200!important}.dropdown.is-mobile-modal>.dropdown-menu{z-index:1201!important}}
   .dropdown-item,.modal-card-title,.label{color:${c.heading}!important}.dropdown-item:hover,.dropdown-item:focus{background:${c.hover}!important;color:${c.heading}!important}
   .button,.select select,.input,.textarea{background:${c.input}!important;color:${c.text}!important;border-color:${c.border}!important;box-shadow:none!important;border-radius:6px}
   .button:hover{background:${c.hover}!important;color:${c.heading}!important}
   #single-actions .button{opacity:1!important;min-width:30px;min-height:30px}
   #vip-file-tools{grid-column:1/-1;grid-row:1;display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding-bottom:14px;border-bottom:1px solid ${c.border}}
   #vip-file-tools button,#vip-file-folders button{background:${c.surface};color:${c.text};border:1px solid ${c.border};border-radius:6px;padding:9px 12px;cursor:pointer;font:inherit;font-size:12px;line-height:1.4}
   #vip-file-tools button:hover,#vip-file-folders button:hover{background:${c.hover};color:${c.heading}}
   #vip-file-tools button[aria-pressed=true]{border-color:${c.link};color:${c.link};background:${c.hover}}
   #vip-file-tools button:focus-visible,#vip-file-folders button:focus-visible{outline:2px solid ${c.link};outline-offset:2px}
   #vip-file-folders{grid-column:1;grid-row:2;min-width:0;padding:12px 10px;background:${c.surface};border:1px solid ${c.border};border-radius:8px;align-self:start}
   #vip-file-folders h2{font-size:12px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;margin:5px 8px 15px;color:${c.heading}}
   #vip-file-folders button{width:100%;border:0;text-align:left;margin:2px 0;overflow-wrap:anywhere}
   #vip-file-folders small{display:block;margin:12px 8px;color:${c.text};font-size:11px;line-height:1.6}
   #vip-file-tools small{font-size:11px;color:${c.text};margin-left:auto}
   body.vip-files-grid .b-table table,body.vip-files-grid .b-table tbody{display:block}
   body.vip-files-grid .b-table thead{display:none}
   body.vip-files-grid .b-table tbody{display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:12px;padding:14px}
   body.vip-files-grid .b-table tr.file-row{display:grid;grid-template-columns:30px minmax(0,1fr) 64px;border:1px solid ${c.border};border-radius:8px;background:${c.surface}!important;min-width:0}
   body.vip-files-grid .b-table tr.file-row td{border:0!important;padding:10px!important;min-width:0;width:auto!important;overflow-wrap:anywhere}
   body.vip-files-grid .b-table tr.file-row td:nth-child(2){grid-column:1/-1;grid-row:1;padding-top:20px!important;text-align:center}
   body.vip-files-grid .b-table tr.file-row td:nth-child(2) .name:before{display:block;font-size:35px;margin:0 0 8px}
   body.vip-files-grid .b-table tr.file-row td:nth-child(3),body.vip-files-grid .b-table tr.file-row td:nth-child(5){display:none}
   body.vip-files-grid .b-table tr.file-row td:nth-child(4){grid-column:2;font-size:11px;align-self:center;text-align:left!important}
   body.vip-files-grid .b-table tr.file-row .checkbox-cell{grid-row:2;grid-column:1}
   body.vip-files-grid #single-actions{grid-row:2;grid-column:3;overflow:visible}
   @media(max-width:750px){#dropzone{grid-template-columns:minmax(0,1fr);padding:0!important;gap:14px}#dropzone>.container{grid-column:1}#vip-file-folders{display:none}#vip-file-tools small{display:none}#vip-file-tools button{min-height:44px;flex:1 1 auto}#vip-file-tools{gap:7px}.table td{padding:12px 7px!important}.table .checkbox-cell label{min-height:32px;min-width:24px}#browser table.table th:nth-child(3),#browser table.table th:nth-child(5),#browser table.table td:nth-child(3),#browser table.table td:nth-child(5){display:none}#browser .table .name{word-break:break-word}#single-actions .button{min-width:44px;min-height:44px}body.vip-files-grid .b-table tbody{grid-template-columns:repeat(auto-fill,minmax(130px,1fr))}#browser table.table{table-layout:fixed}#browser table.table th:first-child{width:34px}#browser table.table th:last-child{width:48px}#browser table.table th:nth-child(4){width:65px}}
  `);
  if(doc.getElementById('vip-file-tools'))return;
  const node=(tag,text)=>{const e=doc.createElement(tag);if(text)e.textContent=text;return e;};
  const tools=node('div');tools.id='vip-file-tools';tools.setAttribute('aria-label','Herramientas de archivos');
  const rail=node('aside');rail.id='vip-file-folders';rail.setAttribute('aria-label','Carpetas de la ubicación actual');
  const button=(parent,text,action)=>{const b=node('button',text);b.type='button';b.onclick=action;parent.append(b);return b;};
  const click=selector=>host.querySelector(selector)?.click();
  button(tools,'Inicio',()=>click('.breadcrumb li:first-child a'));
  button(tools,'Subir nivel',()=>{const items=host.querySelectorAll('.breadcrumb li a');if(items.length>1)items[items.length-2].click();});
  button(tools,'Buscar',()=>click('#search'));
  button(tools,'Árbol de carpetas',()=>click('#sitemap'));
  const list=button(tools,'Lista',()=>setView('list')),grid=button(tools,'Cuadrícula',()=>setView('grid'));
  button(tools,'Actualizar',()=>doc.defaultView.location.reload());
  tools.append(node('small','Selecciona archivos para copiar, mover o comprimir. Más opciones en ⋯'));
  function setView(view){host.classList.toggle('vip-files-grid',view==='grid');list.setAttribute('aria-pressed',String(view!=='grid'));grid.setAttribute('aria-pressed',String(view==='grid'));try{localStorage.setItem(key,view);}catch{}}
  let view='list';try{view=localStorage.getItem(key)||view;}catch{}setView(view);
  dropzone.prepend(tools,rail);
  const paint=()=>{
   rail.replaceChildren(node('h2','Carpetas'));
   button(rail,'⌂ Carpeta principal',()=>click('.breadcrumb li:first-child a'));
   const folders=[...browser.querySelectorAll('tr.type-dir a.name')];
   folders.forEach(a=>button(rail,'📁 '+a.textContent.trim(),()=>a.click()));
   rail.append(node('small',folders.length?'Carpetas de esta página. Usa el árbol para explorar otras ubicaciones.':'No hay carpetas en esta página.'));
   browser.querySelectorAll('#single-actions button').forEach(b=>{b.title='Acciones del archivo';b.setAttribute('aria-label','Acciones del archivo');});
  };
  let pending=false;
  const observer=new MutationObserver(()=>{if(!pending){pending=true;requestAnimationFrame(()=>{pending=false;paint();});}});
  observer.observe(browser,{childList:true,subtree:true});paint();
 }
 function scopeStyle(text){
  const sheet=new CSSStyleSheet();sheet.replaceSync(text);
  const split=selector=>{let depth=0,quote='',start=0,result=[];for(let i=0;i<selector.length;i++){const ch=selector[i];if(ch==='\\'){i++;continue;}if(quote){if(ch===quote)quote='';continue;}if(ch==='"'||ch==="'"){quote=ch;continue;}if(ch==='('||ch==='[')depth++;if(ch===')'||ch===']')depth--;if(ch===','&&!depth){result.push(selector.slice(start,i));start=i+1;}}result.push(selector.slice(start));return result;};
  const prefix=s=>{s=s.trim().replace(/(^|[\s>+~])(?:html|body|:root)(?=$|[\s.#:[>+~])/g,'$1#vip-files').replace(/#vip-files\s+#vip-files/g,'#vip-files');return s.startsWith('#vip-files')?s:'#vip-files '+s;};
  const visit=rules=>[...rules].map(rule=>{
   if(rule.type===CSSRule.STYLE_RULE)return split(rule.selectorText).map(prefix).join(',')+'{'+rule.style.cssText+'}';
   if(rule.type===CSSRule.KEYFRAMES_RULE||rule.type===CSSRule.FONT_FACE_RULE)return rule.cssText;
   if(rule.cssRules)return rule.cssText.slice(0,rule.cssText.indexOf('{')+1)+visit(rule.cssRules)+'}';
   return rule.type===CSSRule.IMPORT_RULE?'':rule.cssText;
  }).join('\n');
  return visit(sheet.cssRules);
 }
 const colors=()=>{const css=getComputedStyle(document.documentElement),result={};for(const name of ['bg','surface','surface-alt','text','heading','border','input','link','hover'])result[name]=css.getPropertyValue('--vip-'+name).trim();return result;};
 const loadScript=src=>new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>reject(Error('No se pudo cargar el gestor de archivos.'));document.head.append(script);});
 const mounted=()=>new Promise((resolve,reject)=>{
  if(host.querySelector('#browser'))return resolve();
  const observer=new MutationObserver(()=>{if(host.querySelector('#browser')){clearTimeout(timeout);observer.disconnect();resolve();}});
  const timeout=setTimeout(()=>{observer.disconnect();reject(Error('El gestor no terminó de iniciar.'));},20000);
  observer.observe(host,{childList:true,subtree:true});
 });
 async function boot(){
  host.setAttribute('aria-busy','true');
  const loading=document.createElement('p');loading.className='vip-files-status';loading.textContent='Cargando archivos…';host.append(loading);
  try{
   const response=await fetch('/fm/',{credentials:'same-origin'});if(!response.ok)throw Error('No se pudo iniciar la sesión de archivos.');
   const markup=new DOMParser().parseFromString(await response.text(),'text/html');
   const styles=[...markup.querySelectorAll('link[rel=stylesheet][href]')].map(link=>new URL(link.getAttribute('href'),location.origin+'/fm/')).filter(url=>url.origin===location.origin&&url.pathname.startsWith('/fm/css/'));
   if(!styles.length)throw Error('Versión del gestor no compatible.');
   const css=await Promise.all(styles.map(async url=>{
    const r=await fetch(url);if(!r.ok)throw Error('No se pudieron cargar los estilos de archivos.');
    return scopeStyle((await r.text()).replace(/url\((['"]?)([^)'"\s]+)\1\)/g,(all,quote,value)=>value.startsWith('data:')?all:'url("'+new URL(value,url).href+'")'));
   }));
   const style=document.createElement('style');style.id='vip-file-native-style';style.textContent=css.join('\n');document.head.append(style);
   const mount=document.createElement('div');mount.id='vip-file-mount';host.append(mount);
   const version=encodeURIComponent(context.assetVersion||'1.0.3');
   await loadScript('/js/virtualia/filegator-vendor.js?v='+version);
   await loadScript('/js/virtualia/filegator-app.js?v='+version);
   await mounted();
   enhance(document,colors());loading.remove();host.setAttribute('aria-busy','false');
   window.addEventListener('vip:appearance',()=>enhance(document,colors()));
  }catch(error){
   host.setAttribute('aria-busy','false');loading.textContent=error.message+' ';
   loading.setAttribute('role','alert');
   const fallback=document.createElement('a');fallback.href='/fm/';fallback.textContent='Abrir gestor nativo';loading.append(fallback);
  }
 }
 boot();
})();
