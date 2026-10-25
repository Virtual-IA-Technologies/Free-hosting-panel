/* Read-only regression for shared paths and hash-specific menu entries. */
const {chromium}=require('playwright-core');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIP_BROWSER_EXECUTABLE,headless:true});
 try{
  const page=await browser.newPage();await require('./login.cjs')(page,process.env.VIP_BASE_URL,process.env.VIP_USERNAME,process.env.VIP_PASSWORD);await page.waitForURL('**/list/user/**');
  for(const name of ['Estado del servidor','Versiones y actualizaciones','Estado del servidor','Enumerar las cuentas','Inicio del servidor']){
   await page.locator('#via-sidebar').getByRole('link',{name,exact:true}).click();
   await page.waitForFunction(label=>{const active=document.querySelectorAll('#via-sidebar .via-active');return active.length===1&&active[0].textContent.trim()===label;},name);
  }
  console.log('PASS exactly one active menu item through server status, software updates, accounts and home');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exit(1);});
