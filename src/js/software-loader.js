/* The administrative interface is downloaded only when its view is opened. */
(() => {
 const raw=document.getElementById('via-context');if(!raw||location.pathname!=='/list/server/')return;
 const context=JSON.parse(raw.textContent);if(!context.admin)return;
 const load=()=>{
  if(location.hash!=='#vip-software'||document.getElementById('vip-software-script'))return;
  const script=document.createElement('script');script.id='vip-software-script';script.src='/js/virtualia/software.min.js?v='+encodeURIComponent(context.assetVersion||'1.2.2');
  script.onerror=()=>{script.remove();const message=document.createElement('p');message.setAttribute('role','alert');message.textContent='No se pudo cargar Versiones y actualizaciones. Recarga para reintentar o usa las opciones nativas.';document.querySelector('.app-content')?.prepend(message);};document.head.append(script);
 };
 window.addEventListener('hashchange',load);load();
})();
