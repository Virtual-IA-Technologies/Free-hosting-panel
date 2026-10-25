/* Account count, sorting and filtering against native-shaped rows; no server access. */
const {chromium}=require('playwright-core');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const accounts=[['one','9','20','100'],['two','100','3','unlimited'],['three','20','100','200']].map(([user,disk,traffic,quota])=>({user,disk,traffic,quota,domains:[user+'.example.test'],ips:['192.0.2.10'],contact:'support@example.test',created:'2026-10-24',plan:'default',suspended:false}));
(async()=>{
 const browser=await chromium.launch({...(process.env.VIP_BROWSER_EXECUTABLE?{executablePath:process.env.VIP_BROWSER_EXECUTABLE}:{channel:'chrome'}),headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const row=user=>'<div class="js-unit" data-sort-name="'+user+'">'+Array.from({length:7},(_,i)=>'<div class="units-table-cell">'+(i===1?user:i===0?'<input type="checkbox">':'')+'</div>').join('')+'</div>';
  await page.route('http://vip.test/**',route=>route.fulfill({contentType:'text/html',body:'<script id="via-context" type="application/json">'+JSON.stringify({admin:true,accountsInventory:accounts})+'</script><div class="units-table"><div class="units-table-header">'+Array.from({length:7},()=>'<div class="units-table-cell"></div>').join('')+'</div>'+['control',...accounts.map(a=>a.user)].map(row).join('')+'<div class="units-table-footer"><p>4 user accounts</p></div></div>'}));
  await page.goto('http://vip.test/list/user/');await page.evaluate(()=>{const footer=document.querySelector('.units-table-footer');document.querySelector('.units-table').after(footer);});await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../src/js/accounts.js'),'utf8')});
  assert.equal(await page.locator('.js-unit').count(),3);assert.equal(await page.locator('.units-table-footer p').innerText(),'3 cuentas de alojamiento');
  const order=()=>page.locator('.js-unit').evaluateAll(rows=>rows.map(row=>row.dataset.sortName));
  const header=column=>page.locator('.units-table-header [data-vip-col="'+column+'"] button');
  await page.locator('[data-sort-name=one] input').check();
  await header(5).click();assert.deepEqual(await order(),['one','three','two']);
  await header(5).click();assert.deepEqual(await order(),['two','three','one']);
  await header(11).click();assert.deepEqual(await order(),['one','three','two']);
  await header(11).click();assert.deepEqual(await order(),['two','three','one']);
  await header(6).focus();await page.keyboard.press('Enter');assert.deepEqual(await order(),['two','one','three']);
  assert.equal(await page.locator('[data-sort-name=one] input').isChecked(),true);
  await page.getByRole('searchbox').fill('two.example.test');assert.equal(await page.locator('.units-table-footer p').innerText(),'1 de 3 cuentas de alojamiento');
  await page.getByRole('searchbox').fill('missing');assert.equal(await page.locator('.units-table-footer p').innerText(),'0 de 3 cuentas de alojamiento');
  assert.deepEqual(errors,[]);console.log('PASS: administrators excluded, count and filters correct, numeric sorting both ways, keyboard and selections preserved.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
