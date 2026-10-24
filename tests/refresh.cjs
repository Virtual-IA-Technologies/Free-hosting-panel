/* Refresh and network checks in an isolated authenticated browser context. */
const {chromium}=require('playwright-core');
(async()=>{
 const base=process.env.VIP_BASE_URL,user=process.env.VIP_USERNAME,password=process.env.VIP_PASSWORD;
 if(!base||!user||!password)throw Error('Faltan credenciales de validación.');
 const browser=await chromium.launch({...(process.env.VIP_BROWSER_EXECUTABLE?{executablePath:process.env.VIP_BROWSER_EXECUTABLE}:{channel:'chrome'}),headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage(),errors=[],failures=[];
  await require('./preview.cjs')(ctx);
  const assert=(value,message)=>{if(!value)throw Error(message);};
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',r=>{if(r.status()>=400&&new URL(r.url()).origin===new URL(base).origin)failures.push({path:new URL(r.url()).pathname,status:r.status()});});
  await require('./login.cjs')(page,base,user,password);await page.waitForURL('**/list/user/**');await page.waitForLoadState('networkidle');
  await page.locator('.vip-appearance select').selectOption('medium');
  let releaseBoot,bootRequested;
  const bootHold=new Promise(resolve=>{releaseBoot=resolve;}),bootSeen=new Promise(resolve=>{bootRequested=resolve;});
  const bootRoute=async route=>{bootRequested();await bootHold;await route.fallback();};
  await page.route('**/virtualia/panel.min.js*',bootRoute);
  await page.reload({waitUntil:'commit'});await bootSeen;
  const boot=await page.evaluate(()=>({message:getComputedStyle(document.body,'::before').content,native:getComputedStyle(document.querySelector('.app')).visibility,ring:getComputedStyle(document.body,'::after').borderTopColor}));
  assert(boot.message.includes('Cargando')&&boot.native==='hidden','La recarga muestra la interfaz nativa: '+JSON.stringify(boot));
  releaseBoot();await page.waitForLoadState('networkidle');await page.unroute('**/virtualia/panel.min.js*',bootRoute);
  assert(await page.locator('#via-home').isVisible(),'El indicador no deja paso al panel');
  const samples=[];
  for(let i=0;i<3;i++){
   await page.reload({waitUntil:'networkidle'});
   assert(await page.locator('#via-home').isVisible(),'Inicio no visible tras recargar');
   assert(await page.locator('#via-sidebar').count()===1,'Menú duplicado');
   assert(await page.locator('.vip-appearance select').inputValue()==='medium','Tema no persiste');
   assert(await page.locator('script[src*="filegator"],script[src*="files.min.js"]').count()===0,'Archivos se descarga sin solicitarlo');
   samples.push(await page.evaluate(()=>({navigationMs:Math.round(performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd),assets:performance.getEntriesByType('resource').filter(r=>new URL(r.name).pathname.includes('/virtualia/')).map(r=>({path:new URL(r.name).pathname,transfer:r.transferSize,bytes:r.decodedBodySize}))})));
  }
  await page.locator('#via-sidebar a[href$="#archivos"]').click();await page.locator('#vip-file-tools').waitFor({timeout:20000});
  await page.reload({waitUntil:'networkidle'});await page.locator('#vip-file-tools').waitFor({timeout:20000});
  assert(new URL(page.url()).hash==='#archivos','Recarga pierde la vista de archivos');
  assert(await page.locator('#vip-file-tools').count()===1,'Controles de archivos duplicados');
  const native=await ctx.newPage();
  try{
   await native.route('**/list/user/**',async route=>{
    const response=await route.fetch();let body=await response.text();
    body=body.replace(/(<script[^>]+id="via-context"[^>]*>)([\s\S]*?)(<\/script>)/,(all,start,json,end)=>{const config=JSON.parse(json);config.integratedFiles=false;return start+JSON.stringify(config).replace(/</g,'\\u003c')+end;});
    await route.fulfill({response,body});
   });
   await native.goto(base+'/list/user/',{waitUntil:'networkidle'});
   const href=await native.getByRole('link',{name:'Archivos y documentos',exact:true}).getAttribute('href');
   assert(new URL(href,base).pathname==='/fm/','Modo nativo conserva una ruta integrada');
   assert(await native.locator('script[src*="files.min.js"]').count()===0,'Modo nativo carga integración');
  }finally{await native.close();}
  if(!process.env.VIP_PREVIEW_ASSET_ROOT){
   const recovery=await ctx.newPage();
   try{
    await recovery.route('**/virtualia/panel.min.js*',route=>route.abort());
    await recovery.goto(base+'/list/user/',{waitUntil:'domcontentloaded'});
    await recovery.waitForFunction(()=>document.body.classList.contains('vip-native-fallback'),{},{timeout:11000});
    assert(await recovery.locator('.app').isVisible(),'El fallo del recurso bloquea el acceso nativo');
   }finally{await recovery.close();}
  }
  assert(!errors.length,errors.join('; '));assert(!failures.length,JSON.stringify(failures));
  console.log(JSON.stringify({result:'PASS',bootGuard:true,refreshes:3,filesRefresh:true,nativeManagerOption:true,javascriptErrors:errors,httpErrors:failures,samples},null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error.message);process.exit(1);});
