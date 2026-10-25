/* One lightweight count on server home; details load only when requested. */
(() => {
 'use strict';
 const c=JSON.parse(document.getElementById('via-context')?.textContent||'{}');
 const home=document.getElementById('via-home');if(!c.admin||!c.activityAdmin||!home)return;
 const note=home.querySelector('.via-metric small');if(!note)return;
 const link=document.createElement('a');link.href='#actividad';link.className='vip-activity-link';link.id='vip-activity-open';link.textContent='… conexiones';link.setAttribute('aria-label','Ver actividad y conexiones web');
 note.append(document.createTextNode(' · '),link);
 let loading,busy=false;
 link.onclick=async event=>{event.preventDefault();if(busy)return;busy=true;link.setAttribute('aria-disabled','true');try{
  if(!window.vipOpenActivity){if(!loading)loading=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/js/virtualia/activity.min.js?v='+encodeURIComponent(c.assetVersion);s.onload=resolve;s.onerror=()=>{loading=null;s.remove();reject(Error('No se pudo cargar la actividad.'));};document.head.append(s);});await loading;}
  window.vipOpenActivity();
 }catch(error){link.textContent='Reintentar actividad';link.title=error.message;}finally{busy=false;link.removeAttribute('aria-disabled');}};
 fetch('/vip/activity-admin/',{method:'POST',credentials:'same-origin',body:new URLSearchParams({token:c.csrfToken,action:'summary'})}).then(r=>r.json()).then(v=>{if(v.ok){link.textContent=v.data.webConnections+' conexiones';link.setAttribute('aria-label','Ver actividad: '+v.data.webConnections+' conexiones web');}else link.textContent='Ver conexiones';}).catch(()=>{link.textContent='Ver conexiones';});
})();
