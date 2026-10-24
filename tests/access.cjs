/* Read-only service checks; native panel login only. No mail/reset requests sent. */
const {chromium}=require('playwright-core');
(async()=>{
 const base=process.env.VIP_BASE_URL,user=process.env.VIP_USERNAME,password=process.env.VIP_PASSWORD;
 if(!base||!user||!password)throw Error('Missing validation credentials.');
 const browser=await chromium.launch({...(process.env.VIP_BROWSER_EXECUTABLE?{executablePath:process.env.VIP_BROWSER_EXECUTABLE}:{channel:'chrome'}),headless:true});
 const assert=(v,m)=>{if(!v)throw Error(m);};
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(()=>localStorage.setItem('virtual-ia-panel:appearance:login',JSON.stringify({theme:'light'})));
  await page.goto(base+'/login/',{waitUntil:'networkidle'});
  assert(await page.locator('#username').isVisible()&&await page.locator('#password').isVisible(),'Login still requires two steps');
  assert(await page.locator('html').getAttribute('data-via-theme')==='graphite','Legacy light preference overrides login');
  assert(await page.locator('#login-form a[href="/reset/"]').isVisible(),'Password recovery is absent');
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile login overflows');
  await page.locator('a[href="/reset/"]').click();await page.locator('input[name="email"]').waitFor();
  assert(await page.locator('html').getAttribute('data-via-theme')==='graphite','Reset uses another theme');
  await require('./login.cjs')(page,base,user,password);await page.waitForURL('**/list/user/**');
  await page.goto(base+'/list/db/',{waitUntil:'networkidle'});
  const config=await page.locator('#via-context').evaluate(e=>JSON.parse(e.textContent));
  const link=page.getByRole('link',{name:'phpMyAdmin',exact:true}).first();
  const target=new URL(await link.getAttribute('href'),base);
  assert(target.port===String(config.phpmyadminPort)&&target.protocol==='https:','Database link drops the service port');
  assert(!await link.evaluate(e=>e.classList.contains('button-suspended')),'Database entry disabled on IP');
  const service=await context.newPage();const response=await service.goto(target.href,{waitUntil:'networkidle'});
  assert(response.status()===200,'phpMyAdmin service unavailable');
  assert(await service.locator('input[name="pma_username"]').isVisible(),'SQL login form absent');
  assert(!/Access denied|controluser.*failed/i.test(await service.locator('body').innerText()),'SQL control connection error');
  for(const suffix of ['setup/','vendor/','sql/']){
   const blocked=await context.request.get(new URL(suffix,target).href);assert(blocked.status()===404,'Internal SQL path exposed: '+suffix);
  }
  if(config.accountPort){const url=new URL(base);url.port=String(config.accountPort);url.pathname='/login/';const isolated=await browser.newContext();const p=await isolated.newPage();await p.goto(url.href);await p.locator('#password').waitFor();await isolated.close();}
  if(config.webmailPort){const url=new URL(base);url.port=String(config.webmailPort);url.pathname='/';await service.goto(url.href);await service.locator('input[name="_user"]').waitFor();await service.locator('input[name="_pass"]').waitFor();const denied=await context.request.get(new URL('/config/config.inc.php',url).href);assert(denied.status()===404,'Webmail configuration exposed');}
  assert(!errors.length,errors.join('; '));
  console.log(JSON.stringify({result:'PASS',login:'one step, graphite, native recovery, mobile',database:'dedicated HTTPS port, SQL login, internal paths blocked',accountsPort:config.accountPort||null,webmailPort:config.webmailPort||null,javascriptErrors:errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exit(1);});
