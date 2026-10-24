/* Optional dedicated phpMyAdmin service. Keep native SQL authentication and SSO. */
(() => {
  const contextNode=document.getElementById('via-context');
  if(!contextNode)return;
  const context=JSON.parse(contextNode.textContent),port=Number(context.phpmyadminPort);
  if(!context.user)return;
  const valid=value=>Number.isInteger(Number(value))&&Number(value)>0&&Number(value)<=65535;
  const path='/'+(context.phpmyadminAlias||'phpmyadmin')+'/';
  for(const anchor of document.querySelectorAll('a[href]')){
    let url;try{url=new URL(anchor.href,location.href);}catch{continue;}
    if(!valid(port)||url.hostname!==location.hostname||!url.pathname.startsWith(path))continue;
    url.protocol='https:';url.port=String(port);anchor.href=url.href;
    anchor.classList.remove('button-suspended');
  }
  const nav=document.querySelector('#via-sidebar .via-nav');
  if(nav){
    const group=document.createElement('details');group.className='via-group';group.open=true;
    const summary=document.createElement('summary');summary.textContent='Accesos por puerto';group.append(summary);
    for(const [name,value,pathname] of [['Acceso de cuentas',context.accountPort,'/login/'],['phpMyAdmin',port,path],['Webmail',context.webmailPort,'/']]){
      if(!valid(value))continue;
      const url=new URL(location.origin);url.protocol='https:';url.port=String(value);url.pathname=pathname;
      const anchor=document.createElement('a');anchor.className='via-link';anchor.href=url.href;anchor.target='_blank';anchor.rel='noopener';anchor.textContent=name+' · '+value;group.append(anchor);
    }
    if(group.children.length>1)nav.append(group);
  }
})();
