/* Native reads only. POST validation and successful responses are mocked explicitly. */
const {chromium}=require('playwright-core');
(async()=>{
 const base=process.env.VIP_BASE_URL,user=process.env.VIP_USERNAME,password=process.env.VIP_PASSWORD;
 if(!base||!user||!password)throw Error('Faltan credenciales de validación.');
 const browser=await chromium.launch({...(process.env.VIP_BROWSER_EXECUTABLE?{executablePath:process.env.VIP_BROWSER_EXECUTABLE}:{channel:'chrome'}),headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1440,height:1000}});await require('./preview.cjs')(ctx);
  const page=await ctx.newPage(),errors=[],confirms=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{confirms.push(d.type());await d.accept();});
  const assert=(value,message)=>{if(!value)throw Error(message);};
  await require('./login.cjs')(page,base,user,password);await page.waitForURL('**/list/user/**');
  await page.goto(base+'/list/user/#cuentas');
  const original=page.url(),create=page.locator('#via-sidebar').getByRole('link',{name:'Crear una nueva cuenta',exact:true});
  await create.click();const sheet=page.locator('#vip-record-sheet');
  const waitForm=async(label='crear')=>{try{await sheet.locator('form#main-form').waitFor({timeout:12000});}catch(e){throw Error('Formulario lateral '+label+': '+await sheet.locator('.vip-sheet-status').textContent()+'; errores: '+errors.join('; '));}};
  await waitForm();
  assert(page.url()===original,'Crear cambia la pantalla principal');assert(await sheet.locator('.vip-sheet-fallback').isHidden(),'Formulario cae en alternativa nativa');
  assert(await sheet.evaluate(e=>Math.abs(e.getBoundingClientRect().right-innerWidth)<2),'Lateral no alineado a la derecha');
  const generator=sheet.locator('.js-generate-password');if(await generator.count()){
   await generator.click();assert(await sheet.locator('.js-password-input').inputValue(),'Generador nativo no inicializado');
  }
  await sheet.getByRole('button',{name:'Cerrar formulario',exact:true}).click();await sheet.waitFor({state:'hidden'});
  assert(confirms.includes('confirm'),'Cambios sin guardar no piden confirmación');
  assert(await page.locator('#main-form').count()<=1,'Formulario principal duplicado tras cerrar');
  await page.locator('.js-unit').first().dispatchEvent('dblclick');await waitForm('editar o paquete');
  assert(await sheet.locator('.vip-sheet-fallback').isHidden(),'Doble clic no abre edición nativa');
  await page.keyboard.press('Escape');await sheet.waitFor({state:'hidden'});
  const row=page.locator('.js-unit').first();await row.click({button:'right',position:{x:(await row.boundingBox()).width-20,y:20}});
  const menu=page.locator('.vip-row-menu');await menu.waitFor();
  const bounds=await menu.evaluate(e=>{const r=e.getBoundingClientRect();return{right:r.right,bottom:r.bottom,width:r.width,height:r.height,viewport:[innerWidth,innerHeight],zoom:getComputedStyle(document.documentElement).zoom,style:e.getAttribute('style'),position:getComputedStyle(e).position};});
  assert(bounds.right<=1441&&bounds.bottom<=1001,'Menú contextual fuera de pantalla: '+JSON.stringify({bounds,errors}));
  await menu.getByLabel('Acción del doble clic').selectOption('disabled');await page.keyboard.press('Escape');
  await row.dispatchEvent('dblclick');assert(!await sheet.isVisible(),'Doble clic desactivado sigue actuando');
  await row.locator('.vip-row-trigger').click();await menu.getByLabel('Acción del doble clic').selectOption('detail');await page.keyboard.press('Escape');
  await row.dispatchEvent('dblclick');await sheet.locator('.vip-record-detail').waitFor();await page.keyboard.press('Escape');
  await row.locator('.vip-row-trigger').click();await menu.getByLabel('Acción del doble clic').selectOption('edit');await page.keyboard.press('Escape');
  await page.locator('#via-sidebar a[href="/list/package/"]').click();
  let mocked=0,mode='error';
  await ctx.route('**/edit/package/**',async route=>{
   if(route.request().method()!=='POST')return route.continue();
   mocked++;
   if(mode==='success')return route.fulfill({status:302,headers:{location:'/list/package/'},body:''});
   const response=await route.fetch({method:'GET',postData:undefined});let html=await response.text();
   html=html.replace('<div class="form-container">','<div class="form-container"><div class="alert alert-danger" role="alert">Validación simulada: revisa el campo.</div>');
   return route.fulfill({response,body:html});
  });
  await page.locator('.js-unit').first().dispatchEvent('dblclick');await waitForm('editar o paquete');
  await sheet.locator('button[type=submit]').click();await sheet.getByText('Validación simulada: revisa el campo.',{exact:true}).waitFor();
  assert(await sheet.isVisible()&&mocked===1,'Validación no conserva el lateral');
  mode='success';await sheet.locator('button[type=submit]').click();await sheet.waitFor({state:'hidden'});await page.waitForLoadState('networkidle');
  assert(mocked===2,'Se repitió una escritura simulada');
  await page.locator('a[href="/add/package/"]').first().click();await waitForm('editar o paquete');
  await page.setViewportSize({width:390,height:844});
  assert(await sheet.evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;}),'Lateral móvil desbordado');
  await page.keyboard.press('Escape');await sheet.waitFor({state:'hidden'});
  assert(!errors.length,errors.join('; '));
  console.log(JSON.stringify({result:'PASS',drawers:'native create/edit, cancel, focus and mobile',gestures:'double click, right click, more menu, per-list preference',submit:'validation and success mocked; zero real writes',javascriptErrors:errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exit(1);});
