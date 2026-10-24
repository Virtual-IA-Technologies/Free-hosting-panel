/* Optional live integration checks. Supply credentials through the environment. */
const {chromium}=require('playwright-core');
(async()=>{
 const base=process.env.VIP_BASE_URL,user=process.env.VIP_USERNAME,password=process.env.VIP_PASSWORD;
 if(!base||!user||!password)throw Error('Faltan VIP_BASE_URL, VIP_USERNAME o VIP_PASSWORD.');
 const browser=await chromium.launch({...(process.env.VIP_BROWSER_EXECUTABLE?{executablePath:process.env.VIP_BROWSER_EXECUTABLE}:{channel:'chrome'}),headless:true});
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const assert=(v,s)=>{if(!v)throw Error(s);};
 const contrast=selector=>page.locator(selector).first().evaluate(e=>{
  const rgb=s=>(s.match(/[\d.]+/g)||[]).slice(0,3).map(Number),lum=a=>a.map(v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  let p=e,bg;do{bg=getComputedStyle(p).backgroundColor;p=p.parentElement;}while(bg==='rgba(0, 0, 0, 0)'&&p);
  const a=lum(rgb(getComputedStyle(e).color)),b=lum(rgb(bg));return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
 });
 try{
  await page.goto(base+'/login/',{waitUntil:'networkidle'});await page.locator('#username').fill(user);await page.locator('#login-form button[type=submit]').click();
  await page.locator('input[type=password]').fill(password);await page.locator('#login-form button[type=submit]').click();await page.waitForURL('**/list/user/**');await page.waitForLoadState('networkidle');
  assert(await page.locator('#via-home').isVisible(),'Inicio no visible');
  const categories=await page.locator('.via-group summary').allTextContents();assert(categories.indexOf('Alojamiento')<categories.indexOf('Configuración del servidor'),'Orden del menú incorrecto');
  await page.locator('.vip-appearance select').selectOption('light');await page.locator('.via-tool-card').first().hover();
  assert(await contrast('.via-tool-card strong')>=4.5,'Hover claro sin contraste');
  assert(await page.locator('.via-brand img').evaluate(e=>getComputedStyle(e).backgroundColor)==='rgba(0, 0, 0, 0)','Logo con recuadro');
  assert(await page.locator('.via-brand img').evaluate(e=>getComputedStyle(e).content.includes('logo-header-light.svg')),'Logo claro ausente');
  const resources={};
  for(const name of ['disk','mem','cpu','net']){
    const href=await page.locator(`#via-sidebar a[href^="/list/server/?${name}"]`).getAttribute('href');assert(href.includes('token='),'Falta token en recurso');
    await page.locator(`#via-sidebar a[href^="/list/server/?${name}"]`).click();await page.waitForLoadState('networkidle');
    assert(await page.locator('#via-context').count()===1,'Rechazo de sesión en '+name);
    assert(await page.locator(`.vip-resource-panel[data-resource-view="${name}"]`).count()===1,'Gráficos no específicos: '+name);
    resources[name]=await page.locator('.vip-resource-meter,.vip-resource-bars').count();assert(resources[name]>0,'No hay gráficos de '+name);
    assert(await page.locator('.console-output').first().isVisible(),'Detalle oculto en '+name);
    assert(await contrast('.console-output')>=4.5,'Detalle ilegible en '+name);
  }
  await page.locator('.vip-appearance-button').click();await page.locator('#vip-scale').fill('110');await page.locator('#vip-scale').dispatchEvent('input');
  assert(await page.evaluate(()=>document.documentElement.style.zoom)==='1.1','Escala sin efecto');
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=4;const x=c.getContext('2d');x.fillStyle='#ff0000';x.fillRect(0,0,4,4);return c.toDataURL('image/png').split(',')[1];});
  for(const area of ['menu','content']){
    await page.locator('#vip-background-'+area).setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
    await page.waitForFunction(a=>document.documentElement.style.getPropertyValue('--vip-'+a+'-image').includes('data:image/webp'),area);
  }
  await page.locator('.vip-close').click();
  assert(await page.locator('.via-sidebar').evaluate(e=>getComputedStyle(e).backgroundImage.includes('data:image/webp')),'El menú no pinta el fondo');
  assert(await page.locator('.app-content').evaluate(e=>getComputedStyle(e).backgroundImage.includes('data:image/webp')),'El contenido no pinta el fondo');
  await page.reload({waitUntil:'networkidle'});assert(await page.evaluate(()=>document.documentElement.style.zoom)==='1.1','No persiste escala');
  assert(await page.evaluate(()=>document.documentElement.hasAttribute('data-vip-menu-background')),'No persiste fondo');
  await page.locator('.vip-appearance-button').click();await page.getByRole('button',{name:'Restablecer apariencia'}).click();await page.locator('.vip-close').click();
  assert(await page.evaluate(()=>document.documentElement.style.zoom)==='1','Restablecer no funciona');
  await page.goto(base+'/list/user/#cuentas',{waitUntil:'networkidle'});
  assert(await page.locator('.vip-account-actions').count()>0,'Faltan accesos de cuentas');assert(await page.locator('.vip-quota-meter').count()>0,'Faltan barras de cuota');
  const gap=await page.evaluate(()=>document.querySelector('.units-table').getBoundingClientRect().top-document.querySelector('.toolbar').getBoundingClientRect().bottom);assert(gap>=20,'Tablas sin separación');
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.querySelector('.top-bar-right').getBoundingClientRect().right<=innerWidth+1),'Barra móvil fuera de pantalla');await page.setViewportSize({width:1440,height:1000});
  const fileLink=page.locator('#via-sidebar a[href$="#archivos"]');if(await fileLink.count()){
    await fileLink.click();const frame=page.frameLocator('.vip-file-frame');await frame.locator('table').first().waitFor({timeout:20000});
    assert(new URL(page.url()).hash==='#archivos','El gestor sale del panel');assert(await page.locator('#via-sidebar').isVisible(),'Sin menú en archivos');
  }
  assert(errors.length===0,errors.join('; '));console.log(JSON.stringify({result:'PASS',contrast:'>=4.5',resources,appearance:'scale/backgrounds/persistence/reset OK',tables:'24px',files:'inside panel',javascriptErrors:errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exit(1);});
