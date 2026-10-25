/* Optional dedicated phpMyAdmin service. Keep native SQL authentication and SSO. */
(() => {
  const contextNode=document.getElementById('via-context');
  if(!contextNode)return;
  const context=JSON.parse(contextNode.textContent),port=Number(context.phpmyadminPort);
  if(!context.user)return;
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[data-vip-pma-database]');if(!link)return;
    const row=context.databasesInventory?.rows.find(item=>item.name===link.dataset.vipPmaDatabase);if(!row)return;
    try{sessionStorage.setItem('vip-pma-intent',JSON.stringify({database:row.name,owner:row.owner,time:Date.now()}));}catch{}
  });
  const valid=value=>Number.isInteger(Number(value))&&Number(value)>0&&Number(value)<=65535;
  const path='/'+(context.phpmyadminAlias||'phpmyadmin')+'/';
  for(const anchor of document.querySelectorAll('a[href]')){
    let url;try{url=new URL(anchor.href,location.href);}catch{continue;}
    if(!valid(port)||url.hostname!==location.hostname||!url.pathname.startsWith(path))continue;
    url.protocol='https:';url.port=String(port);anchor.href=url.href;
    anchor.classList.remove('button-suspended');
  }
  if(/^\/list\/db\/?$/.test(location.pathname)&&!context.databasesInventory){
    let intent;try{intent=JSON.parse(sessionStorage.getItem('vip-pma-intent')||'null');}catch{}
    if(intent&&intent.owner===context.user){
      try{sessionStorage.removeItem('vip-pma-intent');}catch{}
      if(Date.now()-intent.time<60000){
        const target=[...document.querySelectorAll('a[href]')].find(anchor=>{const url=new URL(anchor.href,location.href);return url.hostname===location.hostname&&url.pathname===path+'hestia-sso.php'&&url.searchParams.get('database')===intent.database;});
        if(target){location.assign(target.href);return;}
      }
    }
  }
  const nav=document.querySelector('#via-sidebar .via-nav');
  if(nav){
    const group=document.createElement('details');group.className='via-group';group.open=true;
    const summary=document.createElement('summary');summary.textContent='Accesos por puerto';group.append(summary);
    for(const [name,value,pathname] of [['Acceso de cuentas',context.accountPort,'/login/'],['phpMyAdmin',port,path],['Webmail',context.webmailPort,'/']]){
      if(!valid(value))continue;
      const url=new URL(location.origin);url.protocol='https:';url.port=String(value);url.pathname=pathname;
      const anchor=document.createElement('a');anchor.className='via-link';anchor.href=url.href;anchor.target='_blank';anchor.rel='noopener';anchor.textContent=name+' · '+value;if(name==='phpMyAdmin'&&context.admin&&context.sqlAdmin)anchor.dataset.vipSqlAdmin='true';group.append(anchor);
    }
    if(group.children.length>1)nav.append(group);
  }
})();
