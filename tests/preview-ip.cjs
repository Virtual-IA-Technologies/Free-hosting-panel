const {chromium}=require('playwright-core');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIP_BROWSER_EXECUTABLE,headless:true});
 try{
  const panel=await browser.newPage();await require('./login.cjs')(panel,process.env.VIP_BASE_URL,process.env.VIP_USERNAME,process.env.VIP_PASSWORD);await panel.waitForURL('**/list/user/**');
  await panel.goto(process.env.VIP_BASE_URL+'/list/web/');const context=await panel.locator('#via-context').evaluate(e=>JSON.parse(e.textContent));
  const routes=Object.entries(context.previewRoutes||{});if(!routes.length)throw Error('No direct preview routes configured');
  for(const [domain,url] of routes){
   const page=await browser.newPage(),failures=[];
   page.on('response',response=>{if(response.url().startsWith(new URL(url).origin)&&response.status()>=400)failures.push(new URL(response.url()).pathname+':'+response.status());});
   const response=await page.goto(url,{waitUntil:'networkidle',timeout:30000});if(response.status()!==200)throw Error(domain+' preview HTTP '+response.status());
   if(!page.url().startsWith(url))throw Error('Preview escaped its path');
   if(failures.length)throw Error(domain+' local resource errors: '+failures.slice(0,5).join(', '));
   console.log('PASS direct preview '+domain+' and local assets');await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exit(1);});
