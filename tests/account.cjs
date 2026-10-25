/* Read-only checks with a normal hosting account; no resource creation. */
const {chromium}=require('playwright-core');
(async()=>{
 const base=process.env.VIP_BASE_URL,user=process.env.VIP_USERNAME,password=process.env.VIP_PASSWORD;
 if(!base||!user||!password)throw Error('Faltan credenciales de prueba de una cuenta normal.');
 const browser=await chromium.launch({...(process.env.VIP_BROWSER_EXECUTABLE?{executablePath:process.env.VIP_BROWSER_EXECUTABLE}:{channel:'chrome'}),headless:true});
 try{
  const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const assert=(condition,message)=>{if(!condition)throw Error(message);};
  await require('./login.cjs')(page,base,user,password);
  await page.waitForURL(url=>url.pathname.startsWith('/list/'));
  await page.locator('#via-sidebar .via-link').first().waitFor();
  const context=await page.locator('#via-context').evaluate(e=>JSON.parse(e.textContent));
  assert(context.user===user&&!context.admin&&!context.server,'Contexto de cuenta o métricas incorrecto');
  assert(!context.fileAccounts&&!context.fileAdminUser&&!context.domainsInventory&&!context.mailInventory&&!context.databasesInventory,'Datos globales visibles en cuenta normal');
  assert(await page.locator('#via-sidebar a[href="/add/user/"],#via-sidebar a[href="/list/ip/"],#via-home').count()===0,'Herramientas globales visibles en cuenta normal');
  assert(await page.locator('#via-sidebar .via-link[href="/list/web/"]').count()===1,'Dominios duplicados en el menú de la cuenta');
  await page.locator('#via-sidebar a[href="/list/web/"]').first().click();await page.waitForLoadState('networkidle');
  await page.getByText('Probar antes del DNS',{exact:true}).click();assert(await page.locator('.vip-preview-guide code').isVisible(),'Falta ayuda web en cuenta normal');
  await page.locator('#via-sidebar a[href="/list/db/"]').first().click();await page.waitForLoadState('networkidle');
  assert(await page.locator('.vip-account-hint').filter({hasText:'phpMyAdmin:'}).isVisible(),'Falta orientación SQL en cuenta normal');
  await page.locator('#via-sidebar a[href$="#archivos"]').click();await page.locator('#vip-file-tools').waitFor({timeout:20000});
  assert(await page.locator('#vip-files #browser').isVisible(),'Gestor de archivos de cuenta no disponible');
  assert(errors.length===0,errors.join('; '));
  console.log(JSON.stringify({result:'PASS',role:'normal hosting account',navigation:'web/database guidance and own file manager',globalTools:false,javascriptErrors:errors},null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error.message);process.exit(1);});
