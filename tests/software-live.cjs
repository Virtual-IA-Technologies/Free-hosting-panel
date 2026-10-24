/* Authorized Linux integration. Refreshes APT indices only when explicitly enabled. */
const {chromium}=require('playwright-core'),assert=require('node:assert/strict');
(async()=>{
 const base=process.env.VIP_BASE_URL,user=process.env.VIP_USERNAME,password=process.env.VIP_PASSWORD;
 if(!base||!user||!password)throw Error('Falta el acceso de prueba.');
 const browser=await chromium.launch({...(process.env.VIP_BROWSER_EXECUTABLE?{executablePath:process.env.VIP_BROWSER_EXECUTABLE}:{channel:'chrome'}),headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});await require('./preview.cjs')(context);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const post=(action,values={},target=page)=>target.evaluate(async({action,values})=>{
   const token=JSON.parse(document.getElementById('via-context').textContent).csrfToken;
   const r=await fetch('/vip/software/',{method:'POST',body:new URLSearchParams({action,token,...values})});
   return {status:r.status,redirected:r.redirected,body:r.headers.get('content-type')?.includes('application/json')?await r.json():{ok:false,nativeHtml:true}};
  },{action,values});
  const anonymous=await context.request.post(base+'/vip/software/',{form:{action:'inventory'},headers:{Origin:base},maxRedirects:0});assert.ok([302,303,400,401,403].includes(anonymous.status()),'Anonymous request accepted');
  await require('./login.cjs')(page,base,user,password);await page.waitForURL('**/list/user/**');
  const goto=route=>page.goto(new URL(route,base).href,{referer:base+'/list/user/'});
  await goto('/edit/server/#vip-php');
  try{await page.locator('.vip-config-tabs').waitFor({timeout:7000});}catch{
   const diagnostic=await page.evaluate(()=>({path:location.pathname,forms:document.querySelectorAll('form').length,containers:document.querySelectorAll('form .form-container').length,details:document.querySelectorAll('details').length,shell:document.body.classList.contains('via-shell'),initializer:typeof window.vipInitTabs,context:document.getElementById('via-context')?JSON.parse(document.getElementById('via-context').textContent).admin:null}));
   throw Error('Tabs initialization: '+JSON.stringify({diagnostic,errors}));
  }
  const serialize=()=>page.locator('form#main-form').evaluate(f=>[...new FormData(f)]);const original=await serialize();
  const tabs=page.locator('.vip-config-tabs [role=tab]');const count=await tabs.count();assert.ok(count>=8);
  for(let i=0;i<count;i++){await tabs.nth(i).click();assert.equal(await page.locator('.vip-config-panel:visible').count(),1);assert.deepEqual(await serialize(),original);}
  await tabs.first().click();
  const field=await page.locator('details.vip-config-panel[hidden] input:not([type=hidden]):not([disabled])').first().getAttribute('id');
  await page.evaluate(id=>{const f=document.getElementById(id);f.setCustomValidity('Validación local de prueba');f.form.reportValidity();},field);
  await page.waitForTimeout(100);assert.equal(await page.locator('#'+field).isVisible(),true);await page.evaluate(id=>document.getElementById(id).setCustomValidity(''),field);
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Native mobile overflow');await page.setViewportSize({width:1440,height:1000});
  console.log('PASS native server tabs, preserved values, validation and mobile');
  // Actual Alpine-controlled advanced groups must remain visible when their tab is selected.
  for(const route of ['/add/db/','/add/dns/']){
   await goto(route);
   // Hestia warns before hosting resources in an administrator account. Follow
   // its own Continue URL to inspect the form, without submitting any resource.
   const proceed=page.locator('a[href*="accept=true"]');
   if(await proceed.count())await goto(await proceed.first().getAttribute('href'));
   try{await page.locator('.vip-config-tabs [role=tab]').last().waitFor({timeout:5000});}catch{
    const diagnostic=await page.evaluate(()=>({path:location.pathname,title:document.querySelector('.app-content h1')?.textContent.trim(),forms:[...document.querySelectorAll('form')].map(e=>({id:e.id,name:e.name,fields:[...e.elements].map(f=>f.name).filter(n=>n!=='token')})),containers:document.querySelectorAll('form .form-container').length,advanced:document.querySelectorAll('[x-show="showAdvanced"]').length,clicks:[...document.querySelectorAll('button')].map(e=>e.getAttribute('x-on:click')).filter(Boolean),initializer:typeof window.vipInitTabs}));
    throw Error('Advanced tabs '+route+': '+JSON.stringify({diagnostic,errors}));
   }
   await page.locator('.vip-config-tabs [role=tab]').last().click();
   assert.equal(await page.locator('[x-show="showAdvanced"]').isVisible(),true,'Native Alpine advanced group hidden');
   assert.equal(await page.locator('[x-show="showAdvanced"]').evaluate(e=>window.Alpine.$data(e).showAdvanced),true);
  }
  await goto('/list/server/#vip-software');await page.getByRole('tab',{name:'Software',exact:true}).waitFor();
  await page.locator('.vip-software-card').first().waitFor();
  const inventory=await post('inventory');assert.equal(inventory.status,200,JSON.stringify(inventory.body));assert.ok(inventory.body.data.components.length>=8);
  console.log('PASS authenticated inventory');
  for(const values of [{token:''},{actor:'forged'}]){const response=await post('inventory',values);assert.ok([400,403].includes(response.status)||response.redirected,JSON.stringify(response));assert.equal(response.body.ok,false);}
  const plan=await post('plan',{operation:JSON.stringify({kind:'refresh'})});assert.equal(plan.status,200,JSON.stringify(plan.body));
  const noConfirm=await post('apply',{plan:plan.body.data.id,confirm:'false'});assert.equal(noConfirm.status,400);
  if(process.env.VIP_ALLOW_INDEX_REFRESH==='1'){
   const applied=await post('apply',{plan:plan.body.data.id,confirm:'true'});assert.equal(applied.status,200,JSON.stringify(applied.body));const id=applied.body.data.job;
   const replay=await post('apply',{plan:plan.body.data.id,confirm:'true'});assert.equal(replay.body.ok,false);
   let job;
   for(let i=0;i<90;i++){job=await post('job',{job:id});if(!['running','queued'].includes(job.body.data.state))break;await page.waitForTimeout(1000);}
   assert.equal(job.body.data.state,'succeeded',job.body.data.error||'Index refresh did not finish');
   console.log('PASS confirmed index-only job and replay rejection');
  }
  if(process.env.VIP_TEST_USER&&process.env.VIP_TEST_PASSWORD){
   const normal=await browser.newContext();await require('./preview.cjs')(normal);const np=await normal.newPage();
   await require('./login.cjs')(np,base,process.env.VIP_TEST_USER,process.env.VIP_TEST_PASSWORD);await np.waitForURL(url=>url.pathname.startsWith('/list/'));
   const denied=await post('inventory',{},np);assert.ok(denied.status===403||denied.redirected,JSON.stringify(denied));assert.equal(denied.body.ok,false);await normal.close();
   await goto('/list/user/#cuentas');
   const href=await page.locator('a[href*="loginas='+process.env.VIP_TEST_USER+'"]').first().getAttribute('href');
   await goto(href);await page.waitForURL(url=>url.pathname.startsWith('/list/'));
   const looked=await post('inventory');assert.ok(looked.status===403||looked.redirected,JSON.stringify(looked));assert.equal(looked.body.ok,false,'Impersonation accepted');
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS',tabs:count,checks:'native session, anonymous rejection, CSRF, actor spoof, native Alpine, preserved form values and mobile',normalRoleAndImpersonation:Boolean(process.env.VIP_TEST_USER&&process.env.VIP_TEST_PASSWORD),indexOnlyJob:process.env.VIP_ALLOW_INDEX_REFRESH==='1',packagesInstalled:false},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exit(1);});
