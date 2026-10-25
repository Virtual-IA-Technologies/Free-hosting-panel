/* Live, read-only administrative coverage. Never retries/deletes mail or saves client forms. */
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
(async()=>{
 const base=process.env.VIP_BASE_URL,browser=await chromium.launch({executablePath:process.env.VIP_BROWSER_EXECUTABLE,headless:true});
 try{
  const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await require('./login.cjs')(page,base,process.env.VIP_USERNAME,process.env.VIP_PASSWORD);await page.waitForURL('**/list/user/**');
  await page.locator('.vip-server-usage').first().waitFor();assert.equal(await page.locator('.vip-server-usage').count(),3);
  await page.goto(base+'/list/user/#cuentas');await page.locator('.vip-accounts-table').waitFor();
  const accounts=await page.locator('#via-context').evaluate(e=>JSON.parse(e.textContent));
  assert.ok(accounts.accountsInventory.length);assert.ok(await page.getByRole('button',{name:'Actualizar uso de disco y tráfico'}).count());
  assert.ok((await page.locator('.vip-accounts-table .units-table-header').innerText()).includes('Transferencia'));
  await page.goto(base+'/list/db/');await page.locator('#vip-service-inventory').waitFor();
  const db=await page.locator('#via-context').evaluate(e=>JSON.parse(e.textContent));assert.ok(db.mailAdmin&&db.sqlAdmin);
  const popupEvent=page.waitForEvent('popup');await page.getByRole('link',{name:'phpMyAdmin · todas las bases',exact:true}).click();const sql=await popupEvent;
  await sql.waitForURL(url=>url.pathname.endsWith('/index.php'));await sql.locator('#pma_navigation').waitFor({timeout:20000});
  const sqlText=await sql.locator('body').innerText();for(const item of db.databasesInventory.rows)assert.ok(sqlText.includes(item.name),'Global SQL database not visible');await sql.close();
  const usersPopup=page.waitForEvent('popup');await page.getByRole('link',{name:'Usuarios y permisos SQL',exact:true}).click();const users=await usersPopup;
  await users.waitForURL(url=>url.searchParams.get('route')==='/server/privileges');await users.waitForLoadState('networkidle');
  assert.ok(await users.locator('a[href*="/server/privileges&adduser=1"],a[href*="adduser=1"]').count(),'SQL user creation unavailable');await users.close();
  await page.goto(base+'/list/mail/');await page.locator('#vip-service-inventory').waitFor();
  const mail=await page.locator('#via-context').evaluate(e=>JSON.parse(e.textContent));assert.ok(mail.mailInventory.available&&!mail.mailInventory.failedAccounts);
  const post=async data=>ctx.request.post(base+'/vip/mail-admin/',{form:data});
  assert.equal((await post({action:'queue'})).status(),403);
  assert.equal((await post({action:'queue',token:mail.csrfToken,actor:'root'})).status(),400);
  for(const action of ['queue','trace','relayers']){const r=await post({action,token:mail.csrfToken});assert.equal(r.status(),200,action);assert.ok((await r.json()).ok);}
  await page.getByRole('button',{name:'Cola de correos',exact:true}).click();await page.locator('#vip-mail-dialog').getByText(/mensajes en cola/).waitFor();
  await page.locator('#vip-mail-dialog').getByRole('button',{name:'Cerrar',exact:true}).click();
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile overflow');
  const box=mail.mailInventory.rows.find(item=>item.account);assert.ok(box,'Mailbox fixture required');
  await page.getByLabel('Buscar recurso o cuenta').fill(box.account+'@'+box.domain);
  if(box.suspended||box.accountSuspended){await page.locator('#vip-service-inventory tbody tr:visible').first().getByRole('button',{name:'Acceder a bandeja'}).click();await page.locator('#vip-mail-dialog').getByText(/mensajes; hasta 100 recientes/).waitFor();await page.locator('#vip-mail-dialog').getByRole('button',{name:'Cerrar',exact:true}).click();}
  await page.locator('#vip-service-inventory tbody tr:visible').first().getByRole('link',{name:'Contraseña y ajustes',exact:true}).click();await page.waitForURL(url=>url.pathname==='/edit/mail/');
  const account=await page.locator('#via-context').evaluate(e=>JSON.parse(e.textContent));assert.ok(!account.admin&&!account.mailInventory&&!account.sqlAdmin);
  for(const field of ['v_password','v_quota','v_fwd','v_autoreply'])assert.ok(await page.locator('[name="'+field+'"]').count(),'Missing native mailbox field: '+field);
  assert.equal((await post({action:'queue',token:account.csrfToken})).status(),403,'Impersonation must not access global tools');
  assert.deepEqual(errors,[]);console.log('PASS accounts/server metrics, global SQL SSO and user privileges, mail tools, native settings, mobile, CSRF and impersonation isolation; no mail sent or client forms saved');
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exit(1);});
