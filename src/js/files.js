/* Embedded FileGator presentation; native controls keep all file operations. */
(() => {
 'use strict';
 const context=JSON.parse(document.getElementById('via-context')?.textContent||'{}');
 const key='vip-files-view:'+context.user;
 const waiting=new WeakSet();
 window.addEventListener('vip:files-ready',({detail:{doc,colors:c}})=>{
  const dropzone=doc.querySelector('#dropzone'),browser=doc.querySelector('#browser');
  if(!dropzone||!browser){
   if(doc.documentElement&&!waiting.has(doc)){
    waiting.add(doc);
    const ready=new MutationObserver(()=>{
     if(doc.querySelector('#dropzone')&&doc.querySelector('#browser')){
      ready.disconnect();waiting.delete(doc);
      window.dispatchEvent(new CustomEvent('vip:files-ready',{detail:{doc,colors:c}}));
     }
    });
    ready.observe(doc.documentElement,{childList:true,subtree:true});
   }
   return;
  }
  let style=doc.getElementById('vip-files-integrated-style');
  if(!style){style=doc.createElement('style');style.id='vip-files-integrated-style';doc.head.append(style);}
  style.textContent=`
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
   .table thead th{background:${c['surface-alt']}!important;font-size:12px;font-weight:500;padding:13px 12px!important}
   .table td{padding:13px 12px!important;font-size:13px;vertical-align:middle!important}
   .table .name{color:${c.heading}!important;font-weight:400!important;text-shadow:none!important;overflow-wrap:anywhere}
   .table tr:hover td{background:${c.hover}!important}.table tr.is-selected td{background:${c.hover}!important;color:${c.heading}!important}
   .type-dir .name:before{content:'📁';display:inline-block;font-size:20px;margin-right:11px;vertical-align:middle}
   .type-file .name:before{content:'▤';display:inline-block;font-size:20px;margin-right:11px;vertical-align:middle;color:${c.link}}
   .dropdown-content,.modal-card-head,.modal-card-body,.modal-card-foot,.modal-content,.card,.box,.notification{background:${c.surface}!important;color:${c.text}!important;border-color:${c.border}!important}
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
   body.vip-files-grid .b-table tr.file-row{display:grid;grid-template-columns:30px minmax(0,1fr) 32px;border:1px solid ${c.border};border-radius:8px;background:${c.surface}!important;min-width:0}
   body.vip-files-grid .b-table tr.file-row td{border:0!important;padding:10px!important;min-width:0}
   body.vip-files-grid .b-table tr.file-row td:nth-child(2){grid-column:1/-1;grid-row:1;padding-top:20px!important;text-align:center}
   body.vip-files-grid .b-table tr.file-row td:nth-child(2) .name:before{display:block;font-size:35px;margin:0 0 8px}
   body.vip-files-grid .b-table tr.file-row td:nth-child(3),body.vip-files-grid .b-table tr.file-row td:nth-child(5){display:none}
   body.vip-files-grid .b-table tr.file-row td:nth-child(4){grid-column:2;font-size:11px;align-self:center;text-align:left!important}
   body.vip-files-grid .b-table tr.file-row .checkbox-cell{grid-row:2;grid-column:1}
   body.vip-files-grid #single-actions{grid-row:2;grid-column:3;overflow:visible}
   @media(max-width:750px){#dropzone{grid-template-columns:minmax(0,1fr);padding:12px!important}#dropzone>.container{grid-column:1}#vip-file-folders{display:none}#vip-file-tools small{display:none}.table td{padding:10px 8px!important}body.vip-files-grid .b-table tbody{grid-template-columns:repeat(auto-fill,minmax(135px,1fr))}}
  `;
  if(doc.getElementById('vip-file-tools'))return;
  const node=(tag,text)=>{const e=doc.createElement(tag);if(text)e.textContent=text;return e;};
  const tools=node('div');tools.id='vip-file-tools';tools.setAttribute('aria-label','Herramientas de archivos');
  const rail=node('aside');rail.id='vip-file-folders';rail.setAttribute('aria-label','Carpetas de la ubicación actual');
  const button=(parent,text,action)=>{const b=node('button',text);b.type='button';b.onclick=action;parent.append(b);return b;};
  const click=selector=>doc.querySelector(selector)?.click();
  button(tools,'Inicio',()=>click('.breadcrumb li:first-child a'));
  button(tools,'Subir nivel',()=>{const items=doc.querySelectorAll('.breadcrumb li a');if(items.length>1)items[items.length-2].click();});
  button(tools,'Buscar',()=>click('#search'));
  button(tools,'Árbol de carpetas',()=>click('#sitemap'));
  const list=button(tools,'Lista',()=>setView('list')),grid=button(tools,'Cuadrícula',()=>setView('grid'));
  button(tools,'Actualizar',()=>doc.defaultView.location.reload());
  tools.append(node('small','Selecciona archivos para copiar, mover o comprimir. Más opciones en ⋯'));
  function setView(view){doc.body.classList.toggle('vip-files-grid',view==='grid');list.setAttribute('aria-pressed',String(view!=='grid'));grid.setAttribute('aria-pressed',String(view==='grid'));try{localStorage.setItem(key,view);}catch{}}
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
 });
})();
