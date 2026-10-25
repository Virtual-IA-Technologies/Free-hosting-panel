/* Backup UI is downloaded only when an administrator opens Backups. */
(() => {
 if(location.pathname!=='/list/backup/'||new URLSearchParams(location.search).get('vip_scope')==='account')return;const c=JSON.parse(document.getElementById('via-context')?.textContent||'{}');if(!c.admin)return;
 const script=document.createElement('script');script.src='/js/virtualia/backups.min.js?v='+encodeURIComponent(c.assetVersion);document.head.append(script);
})();
