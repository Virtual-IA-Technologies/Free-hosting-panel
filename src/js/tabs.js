/* Enhance only audited native configuration groups. Fields never leave their form. */
(() => {
 'use strict';
 const advancedRoutes=new Set(['/edit/web/','/edit/user/','/add/db/','/add/dns/','/add/mail-account/']);
 const routes=new Set(['/edit/server/','/edit/server/whitelabel/','/add/package/','/edit/package/',...advancedRoutes]);
 const aliases={'#vip-time':'#v_timezone','#vip-php':'#v_php_default_version,#v_backend_template,#v_phpcli','#vip-backups':'#v_backup','#vip-retention':'#v_backup_incremental','#vip-mail':'#v_webmail_alias,[name="v_mail"]','#vip-security':'#v_api_system'};
 let sequence=0;
 const reveal=field=>{
  const panels=[];
  for(let parent=field;parent;parent=parent.parentElement)if(parent.matches('details'))panels.unshift(parent);
  panels.forEach(panel=>{panel.vipSelect?.();panel.open=true;});
 };
 window.vipRevealField=reveal;
 window.vipInitTabs=(root=document,path=location.pathname)=>{
  if(!routes.has(path))return;
  root.querySelectorAll('form .form-container').forEach(container=>{
   if(container.dataset.vipTabsReady||container.querySelector('.vip-config-tabs'))return;
   if(advancedRoutes.has(path)){
    const advanced=container.querySelector('[x-show="showAdvanced"]');
    const toggle=[...container.querySelectorAll('button')].find(e=>e.getAttribute('x-on:click')==='showAdvanced = !showAdvanced');
    // These five native forms have one explicit Basic/Advanced configuration group.
    if(!advanced||!toggle||!advanced.parentElement.contains(toggle))return;
    container=advanced.parentElement;
    const transform=()=>{
     const basic=document.createElement('details'),extra=document.createElement('details');
     for(const [panel,label] of [[basic,'Opciones básicas'],[extra,toggle.textContent.trim()]]){panel.className='box-collapse';const summary=document.createElement('summary');summary.textContent=label;panel.append(summary);}
     const children=[...container.childNodes];let holder=toggle;
     while(holder.parentElement!==container)holder=holder.parentElement;
     container.insertBefore(basic,holder);container.insertBefore(extra,advanced);
     for(const child of children){
      if(child===advanced){extra.append(child);break;}
      if(child.nodeType===1&&(child.matches('h1,.inline-alert,[role=alert]')||child.contains(toggle)))continue;
      basic.append(child);
     }
     holder.classList.add('vip-config-native-toggle');
     advanced.removeAttribute('x-cloak');advanced.style.removeProperty('display');
     const enable=()=>{const scope=advanced.closest('[x-data]');if(window.Alpine&&scope?._x_dataStack)window.Alpine.$data(advanced).showAdvanced=true;};
     enable();document.addEventListener('alpine:initialized',enable,{once:true});
    };
    if(window.Alpine)window.Alpine.mutateDom(transform);else transform();
   }
   const panels=[...container.children].filter(e=>e.matches('details.box-collapse,details.collapse'));
   if(!panels.length||container.querySelector(':scope > .vip-config-tabs'))return;
   const summaries=panels.map(e=>e.querySelector(':scope > summary'));
   if(summaries.some(e=>!e))return;
   if(root===document)container.closest('.app-content')?.classList.add('vip-config-page');
   const list=document.createElement('div');list.className='vip-config-tabs';list.setAttribute('role','tablist');list.setAttribute('aria-label','Secciones de configuración');
   const tabs=panels.map((panel,i)=>{
    const tab=document.createElement('button'),key='vip-config-'+(++sequence);
    tab.type='button';tab.className='button button-secondary';tab.id=key+'-tab';tab.textContent=summaries[i].textContent.trim();tab.setAttribute('role','tab');
    const icon=summaries[i].querySelector('i')?.cloneNode(true);if(icon){icon.setAttribute('aria-hidden','true');tab.prepend(icon,document.createTextNode(' '));}
    if(!panel.id)panel.id=key+'-panel';
    tab.setAttribute('aria-controls',panel.id);panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);panel.tabIndex=0;
    panel.classList.add('vip-config-panel');panel.open=true;list.append(tab);return tab;
   });
   function select(index,focus=false){
    panels.forEach((panel,i)=>{panel.hidden=i!==index;panel.open=true;tabs[i].setAttribute('aria-selected',String(i===index));tabs[i].tabIndex=i===index?0:-1;});
    if(focus){tabs[index].focus();tabs[index].scrollIntoView({block:'nearest',inline:'nearest'});}
   }
   panels.forEach((panel,i)=>{
    panel.vipSelect=()=>select(i);
    tabs[i].onclick=()=>{select(i);if(root===document){const alias=Object.keys(aliases).find(hash=>panel.querySelector(aliases[hash]));history.replaceState(null,'',alias||'#'+panel.id);}};
    tabs[i].onkeydown=e=>{
     let target=i;
     if(e.key==='ArrowRight')target=(i+1)%tabs.length;
     else if(e.key==='ArrowLeft')target=(i+tabs.length-1)%tabs.length;
     else if(e.key==='Home')target=0;
     else if(e.key==='End')target=tabs.length-1;
     else return;
     e.preventDefault();tabs[target].click();select(target,true);
    };
    // Security subsections remain readable in full inside the selected section.
    panel.querySelectorAll('details.collapse').forEach(nested=>{nested.open=true;nested.classList.add('vip-config-expanded');nested.querySelector(':scope > summary')?.addEventListener('click',e=>e.preventDefault());});
   });
   const toolbar=root===document?container.closest('.app-content')?.querySelector(':scope > .toolbar'):null;
   if(toolbar){list.classList.add('vip-config-toolbar-tabs');toolbar.append(list);}
   else container.insertBefore(list,panels[0]);
   container.dataset.vipTabsReady='true';select(0);
   let invalid=false;
   container.closest('form').addEventListener('invalid',e=>{
    if(invalid)return;invalid=true;reveal(e.target);
    requestAnimationFrame(()=>{e.target.focus();invalid=false;});
   },true);
   const serverError=container.querySelector('[aria-invalid="true"],.is-invalid');if(serverError)reveal(serverError);
  });
 };
 const hash=()=>{
  let target;
  if(aliases[location.hash])target=document.querySelector(aliases[location.hash]);
  else {try{target=document.getElementById(decodeURIComponent(location.hash.slice(1)));}catch{}}
  if(target&&target.closest('form'))reveal(target);
 };
 window.vipInitTabs();window.addEventListener('hashchange',hash);hash();
})();
