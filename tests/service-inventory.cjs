const {chromium}=require('playwright-core');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIP_BROWSER_EXECUTABLE,headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await require('./login.cjs')(page,process.env.VIP_BASE_URL,process.env.VIP_USERNAME,process.env.VIP_PASSWORD);await page.waitForURL('**/list/user/**');
  await page.goto(process.env.VIP_BASE_URL+'/list/mail/');await page.locator('#vip-service-inventory tbody tr').first().waitFor();
  const mail=await page.locator('#via-context').evaluate(e=>JSON.parse(e.textContent));
  if(!mail.mailInventory.available||mail.mailInventory.failedAccounts)throw Error('Incomplete mail inventory');
  if(await page.locator('#vip-service-inventory tbody tr').count()!==mail.mailInventory.rows.length)throw Error('Missing mail records');
  const mailbox=mail.mailInventory.rows.find(item=>item.account);if(!mailbox)throw Error('Mailbox fixture required');
  await page.getByLabel('Buscar recurso o cuenta').fill(mailbox.account+'@'+mailbox.domain);
  const edit=page.locator('#vip-service-inventory tbody tr:visible').getByRole('link',{name:'Contraseña y ajustes',exact:true});
  await edit.click();await page.waitForURL(url=>url.pathname==='/edit/mail/');
  const account=await page.locator('#via-context').evaluate(e=>JSON.parse(e.textContent));if(account.user!==mailbox.owner||account.admin||account.mailInventory)throw Error('Invalid owner context');
  if(!await page.locator('input[name=v_password]').count())throw Error('Native password fields missing');
  await page.context().clearCookies();await require('./login.cjs')(page,process.env.VIP_BASE_URL,process.env.VIP_USERNAME,process.env.VIP_PASSWORD);await page.waitForURL('**/list/user/**');
  await page.goto(process.env.VIP_BASE_URL+'/list/db/');await page.locator('#vip-service-inventory tbody tr').first().waitFor();
  const db=await page.locator('#via-context').evaluate(e=>JSON.parse(e.textContent));if(!db.databasesInventory.available||db.databasesInventory.failedAccounts)throw Error('Incomplete database inventory');
  if(await page.locator('#vip-service-inventory tbody tr').count()!==db.databasesInventory.rows.length)throw Error('Missing databases');
  await page.setViewportSize({width:390,height:844});if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))throw Error('Mobile overflow');await page.setViewportSize({width:1440,height:1000});
  await page.locator('#vip-service-inventory').getByRole('link',{name:'phpMyAdmin',exact:true}).first().click();
  await page.waitForURL(url=>url.port===String(db.phpmyadminPort),{timeout:30000});await page.waitForLoadState('networkidle');
  const authenticated=await page.locator('#pma_navigation, #pma_navigation_tree').count();
  console.log('phpMyAdmin native SSO authenticated:',Boolean(authenticated));if(!authenticated)throw Error('Native SSO did not authenticate');
  if(errors.length)throw Error(errors.join('; '));console.log('PASS global mail/database inventory, native password form, account isolation, mobile and phpMyAdmin SSO');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exit(1);});
