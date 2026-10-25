const {chromium}=require('playwright-core');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIP_BROWSER_EXECUTABLE,headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await require('./login.cjs')(page,process.env.VIP_BASE_URL,process.env.VIP_USERNAME,process.env.VIP_PASSWORD);await page.waitForURL('**/list/user/**');
  const context=await page.locator('#via-context').evaluate(e=>JSON.parse(e.textContent));if(!context.rootFiles)throw Error('Root adapter unavailable');
  const account=context.fileAccounts.find(item=>item.user!==context.user)?.user;if(!account)throw Error('An existing hosting account is required');
  await page.locator('#via-sidebar a[href$="#archivos"]').click();await page.locator('#vip-files #browser').waitFor({timeout:30000});
  const folder=name=>page.locator('#vip-files #browser tr.type-dir a.name').filter({hasText:new RegExp('^\\s*'+name+'\\s*$')}).first();
  await folder('home').click();await folder(account).waitFor();await folder(account).click();await folder('web').waitFor();await folder('web').click();
  await page.waitForFunction(owner=>document.querySelector('.vip-file-path strong')?.textContent==='/home/'+owner+'/web',account);
  const measure=page.getByRole('button',{name:/Calcular tamaño de/}).first();await measure.click();await page.waitForFunction(()=>[...document.querySelectorAll('[data-vip-size]')].some(e=>/\d.*(?:B|KB|MB|GB)/.test(e.textContent)),null,{timeout:35000});
  const result=await page.evaluate(async token=>{
   const response=await fetch('/fm/?vip_folder_size=1',{method:'POST',body:new URLSearchParams({token:'invalid',path:'home'})});return response.status;
  },context.csrfToken);if(result!==403)throw Error('Missing CSRF rejection');
  if(await page.locator('#vip-home-directory').count())throw Error('Duplicate virtual directory remains');
  if(errors.length)throw Error(errors.join('; '));console.log('PASS real root and account paths, one explorer, folder content size, CSRF rejection');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exit(1);});
