/* Requires a disposable account supplied by a private runner. No external mail. */
const {chromium}=require('playwright-core');const assert=require('node:assert/strict');
(async()=>{
 const owner=process.env.VIP_FIXTURE_OWNER,domain=process.env.VIP_FIXTURE_DOMAIN,password=process.env.VIP_FIXTURE_PASSWORD,base=process.env.VIP_BASE_URL;
 if(!/^vipverify[a-f0-9]{6}$/.test(owner||'')||domain!==owner+'.invalid')throw Error('Disposable fixture required');
 const browser=await chromium.launch({executablePath:process.env.VIP_BROWSER_EXECUTABLE,headless:true});
 try{
  const context=await browser.newContext(),page=await context.newPage();
  const admin=async()=>{await context.clearCookies();await require('./login.cjs')(page,base,process.env.VIP_USERNAME,process.env.VIP_PASSWORD);await page.waitForURL('**/list/user/**');};
  const save=async()=>{const response=page.waitForResponse(r=>r.request().isNavigationRequest()&&r.request().method()==='POST');await page.locator('form#main-form').evaluate(form=>form.requestSubmit());await response;await page.waitForLoadState('networkidle');const alert=await page.locator('.inline-alert,[role=alert]').allTextContents();if(alert.some(value=>/error|failed|fall[oó]/i.test(value)))throw Error('Native form: '+alert.join(' ').slice(0,400));};
  await admin();await page.goto(base+'/list/db/');
  const sqlEvent=page.waitForEvent('popup');await page.getByRole('link',{name:'phpMyAdmin · todas las bases',exact:true}).click();const sql=await sqlEvent;await sql.locator('#pma_navigation').waitFor({timeout:20000});
  await sql.goto(new URL('/phpmyadmin/vip-admin-sso.php',sql.url()).href);await sql.locator('#pma_navigation').waitFor();await sql.close();
  const fresh=await browser.newContext();await fresh.addCookies((await context.cookies()).filter(cookie=>!cookie.name.startsWith('VipSql')&&!cookie.name.startsWith('pma')&&cookie.name!=='phpMyAdmin'));
  const reopened=await fresh.newPage();await reopened.goto(new URL('/phpmyadmin/vip-admin-sso.php','https://'+new URL(base).hostname+':2083').href);await reopened.locator('#pma_navigation').waitFor({timeout:20000});await fresh.close();
  await page.getByLabel('Cuenta para crear recursos').selectOption(owner);await page.getByRole('link',{name:'Crear nueva base de datos',exact:true}).click();await page.waitForURL('**/add/db/**');
  await page.locator('[name=v_database]').fill('fixture');await page.locator('[name=v_dbuser]').fill('fixture');await page.locator('[name=v_password]').fill(password);await save();
  await page.goto(base+'/list/db/');assert.ok((await page.locator('body').innerText()).includes(owner+'_fixture'),'Database creation failed');
  const ownerContext=await page.locator('#via-context').evaluate(e=>JSON.parse(e.textContent));assert.equal(ownerContext.user,owner);
  await page.goto(base+'/add/mail/?domain='+encodeURIComponent(domain)+'&token='+encodeURIComponent(ownerContext.csrfToken),{referer:page.url()});
  if(!await page.locator('[name=v_account]').count())throw Error('Native mailbox form unavailable: '+JSON.stringify(await page.evaluate(()=>({path:location.pathname,text:document.body.innerText.slice(0,300),title:document.querySelector('form h1')?.textContent,alerts:[...document.querySelectorAll('.inline-alert')].map(e=>e.textContent),fields:[...document.querySelectorAll('form input')].map(e=>e.name)}))));
  await page.locator('[name=v_account]').fill('panelcheck');await page.locator('[name=v_password]').fill(password);await save();
  const mailboxContext=await page.locator('#via-context').evaluate(e=>JSON.parse(e.textContent));await page.goto(base+'/edit/mail/?domain='+encodeURIComponent(domain)+'&account=panelcheck&token='+encodeURIComponent(mailboxContext.csrfToken),{referer:page.url()});await page.locator('[name=v_password]').fill(password+'X');await save();
  await admin();await page.goto(base+'/list/mail/');await page.getByLabel('Buscar recurso o cuenta').fill('panelcheck@'+domain);
  const event=page.waitForEvent('popup');await page.locator('#vip-service-inventory tbody tr:visible').getByRole('button',{name:'Acceder a bandeja'}).click();const inbox=await event;
  await inbox.waitForURL(url=>url.searchParams.get('_task')==='mail',{timeout:20000});await inbox.waitForLoadState('networkidle');
  if(!await inbox.locator('#rcmlogout,a[href*="_task=logout"]').count())throw Error('Roundcube state: '+JSON.stringify(await inbox.evaluate(()=>({task:window.rcmail?.env?.task,body:document.body.innerText.slice(0,350),login:!!document.querySelector('[name=_user]')}))));await inbox.close();
  for(const kind of ['cron','keys','bandwidth']){
   const path='/list/user/?vip_view='+kind+'#cuentas';await page.goto(base+path);await page.locator('#vip-operations').waitFor();const c=await page.locator('#via-context').evaluate(e=>JSON.parse(e.textContent));assert.ok(c.operationsInventory.available&&!c.operationsInventory.failedAccounts,'Incomplete administrative inventory '+path);assert.ok(c.operationsInventory.rows.some(item=>item.owner===owner),'Missing fixture in '+path);
  }
  await page.goto(base+'/list/web/?vip_view=ssl');await page.locator('#vip-domains-inventory').waitFor();assert.ok(await page.locator('#via-sidebar a[aria-current=page]').filter({hasText:'Certificados SSL'}).count());
  await page.locator('#via-sidebar a').filter({hasText:'Hora y zona horaria'}).click();try{await page.locator('#v_timezone').waitFor({state:'visible',timeout:10000});}catch(e){throw Error('Server time control: '+JSON.stringify(await page.evaluate(()=>({path:location.pathname,hash:location.hash,fields:document.querySelectorAll('#v_timezone').length,tabs:[...document.querySelectorAll('[role=tab]')].map(e=>[e.textContent,e.getAttribute('aria-selected')]),ancestors:[...(function*(e){while(e){yield [e.tagName,e.className,e.hidden,e.open,getComputedStyle(e).display];e=e.parentElement;}})(document.getElementById('v_timezone'))],alerts:[...document.querySelectorAll('[role=alert]')].map(e=>e.textContent)}))));}assert.ok(await page.locator('.vip-server-clock').count());
  await page.goto(base+'/list/db/');assert.equal(await page.locator('#vip-service-inventory > h2,#vip-service-inventory > p:not([role])').count(),0);await page.getByRole('button',{name:'Ayuda',exact:true}).click();await page.locator('#vip-help').waitFor();await page.locator('#vip-help').getByRole('button',{name:'Cerrar',exact:true}).click();
  await page.goto(base+'/list/backup/');await page.locator('#vip-backups [role=tablist]').waitFor();
  const backupContext=await page.locator('#via-context').evaluate(e=>JSON.parse(e.textContent));
  const request=async values=>{const r=await page.request.post(base+'/vip/backup-admin/',{form:{token:backupContext.csrfToken,...values}});return {status:r.status(),value:await r.json()};};
  assert.equal((await request({action:'save'})).status,400);
  const inventory=await request({action:'inventory'});assert.ok(inventory.value.ok);assert.ok(inventory.value.data.accounts.includes(owner));
  const destination=process.env.VIP_BACKUP_DESTINATION||'local';assert.ok(inventory.value.data.destinations.some(d=>d.id===destination));
  const policy={id:'',name:owner,accounts:[owner],kind:'databases',destination,folder:'integration-test',schedules:['0 2 * * *'],timezone:'America/Lima',enabled:false,retention:{local:1,daily:1,weekly:0,monthly:0,hours:0}};
  const saved=await request({action:'save',confirm:'true',policy:JSON.stringify(policy)});assert.ok(saved.value.ok);assert.match(saved.value.data.id,/^[a-f0-9]{32}$/);
  await page.reload();await page.getByRole('tab',{name:'Programación',exact:true}).click();assert.ok((await page.locator('#vip-backups').innerText()).includes(owner));
  await page.getByRole('tab',{name:'Programación',exact:true}).press('ArrowRight');assert.equal(await page.getByRole('tab',{name:'Destinos',exact:true}).getAttribute('aria-selected'),'true');
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile overflow');
  console.log('PASS 2087 SQL signon and reopening with/without SQL session, native database/mailbox creation and password change, Roundcube signon, global cron/SSH/bandwidth, SSL/time and compact help; no external mail or client changes');
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exit(1);});
