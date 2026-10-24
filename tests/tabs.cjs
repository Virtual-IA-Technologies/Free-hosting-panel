/* Offline form tests. Optional official Hestia templates are read without executing PHP. */
const {chromium}=require('playwright-core');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const script=fs.readFileSync(path.join(root,'src/js/tabs.js'),'utf8');
const css=fs.readFileSync(path.join(root,'src/css/tabs.css'),'utf8');
const fixture=`<form id="main-form"><input name="token" value="fixture-token" type="hidden"><div class="form-container">
<input name="outside" value="kept"><details class="box-collapse"><summary>Básicas</summary><div><input name="hostname" value="example.test"></div></details>
<details class="box-collapse"><summary>PHP</summary><input id="v_php_default_version" name="php" value="8.4"></details>
<details class="box-collapse"><summary>Seguridad</summary><details class="collapse"><summary>API</summary><input id="v_api_system" name="api" value="restricted"><input id="invalid-first" name="required" required></details></details>
<details class="box-collapse"><summary>Correo</summary><input id="v_webmail_alias" name="mail" value="webmail"><input name="second-required" required></details>
<details class="box-collapse"><summary>Respaldos</summary><select id="v_backup" name="backup"><option value="yes">Sí</option></select></details>
<details class="box-collapse"><summary>Incrementales</summary><input id="v_backup_incremental" name="incremental" value="yes"></details>
</div><button>Guardar</button></form><details id="guide"><summary>Ayuda</summary>Guía</details>`;
const stripPHP=html=>html.replace(/<\?(?:php|=)[\s\S]*?\?>/g,block=>{const m=block.match(/_\("([^"]+)"\)/);return m?m[1]:'';});
(async()=>{
 const browser=await chromium.launch({...(process.env.VIP_BROWSER_EXECUTABLE?{executablePath:process.env.VIP_BROWSER_EXECUTABLE}:{channel:'chrome'}),headless:true});
 try{
  const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let html=fixture;
  await ctx.route('http://vip.test/**',r=>r.fulfill({contentType:'text/html',body:'<style>body{margin:10px}.form-container{max-width:900px}'+css+'</style>'+html}));
  await page.goto('http://vip.test/edit/server/#vip-php');await page.addScriptTag({content:script});
  const values=()=>page.locator('form').evaluate(f=>[...new FormData(f)]);
  const before=await values();assert.equal(await page.locator('[role=tab][aria-selected=true]').innerText(),'PHP');
  await page.locator('[role=tab]').first().click();await page.locator('[name=hostname]').fill('changed.example');
  for(const hash of ['php','mail','backups','retention','security']){
   await page.evaluate(hash=>{location.hash='vip-'+hash;},hash);await page.waitForTimeout(30);
   const id={php:'v_php_default_version',mail:'v_webmail_alias',backups:'v_backup',retention:'v_backup_incremental',security:'v_api_system'}[hash];
   assert.equal(await page.locator('#'+id).isVisible(),true,hash);
  }
  const after=await values();assert.deepEqual(after,before.map(([k,v])=>[k,k==='hostname'?'changed.example':v]));
  await page.locator('[role=tab]').first().focus();await page.keyboard.press('End');assert.equal(await page.locator('[role=tab]').last().getAttribute('aria-selected'),'true');
  await page.keyboard.press('ArrowRight');assert.equal(await page.locator('[role=tab]').first().getAttribute('aria-selected'),'true');
  await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('[role=tab]').last().getAttribute('aria-selected'),'true');
  await page.keyboard.press('Home');assert.equal(await page.locator('[role=tab]').first().getAttribute('aria-selected'),'true');
  await page.locator('button').filter({hasText:'Guardar'}).click();await page.waitForTimeout(60);
  assert.equal(await page.locator('#invalid-first').isVisible(),true);assert.equal(await page.evaluate(()=>document.activeElement.id),'invalid-first');
  assert.equal(await page.locator('#guide').getAttribute('role'),null);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'mobile overflow');
  assert.equal(await page.locator('[role=tablist]').evaluate(e=>e.scrollWidth>e.clientWidth),true,'mobile tabs do not scroll');
  // The same initializer is used after a sheet mounts its native form.
  await page.evaluate(html=>{const sheet=document.createElement('div');sheet.id='sheet';sheet.innerHTML=html;document.body.append(sheet);window.vipInitTabs(sheet,'/edit/package/');window.vipInitTabs(sheet,'/edit/package/');},fixture);
  assert.equal(await page.locator('#sheet [role=tablist]').count(),1);assert.equal(await page.locator('#sheet form [name=token]').inputValue(),'fixture-token');
  const native=await browser.newContext({javaScriptEnabled:false}),np=await native.newPage();await np.setContent('<style>'+css+'</style>'+fixture);
  await np.locator('summary').filter({hasText:'PHP',exact:true}).click();assert.equal(await np.locator('#v_php_default_version').isVisible(),true);await native.close();
  const reviewed=[];
  if(process.env.VIP_NATIVE_TEMPLATES){
   for(const file of fs.readdirSync(process.env.VIP_NATIVE_TEMPLATES).filter(f=>f.endsWith('.php'))){
    const content=fs.readFileSync(path.join(process.env.VIP_NATIVE_TEMPLATES,file),'utf8');
    if(!/<details\b|x-show="showAdvanced"/.test(content))continue;
    html=stripPHP(content);const route={edit_server:'/edit/server/',add_package:'/add/package/',edit_package:'/edit/package/',edit_whitelabel:'/edit/server/whitelabel/',edit_web:'/edit/web/',edit_user:'/edit/user/',add_db:'/add/db/',add_dns:'/add/dns/',add_mail_acc:'/add/mail-account/'}[file.slice(0,-4)];
    assert.ok(route,'Unreviewed native configuration groups: '+file);
    await page.goto('http://vip.test'+route);const fields=await values();await page.addScriptTag({content:script});
    const tabs=page.locator('[role=tab]'),count=await tabs.count();assert.ok(count>0,file);
    for(let i=0;i<count;i++){await tabs.nth(i).click();assert.equal(await page.locator('details.vip-config-panel:visible').count(),1,file);assert.deepEqual(await values(),fields,file+' fields changed');}
    reviewed.push({template:file,sections:count});
   }
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS',checks:'fields, tokens, links, first invalid field, keyboard, mobile, sheets, no JS',reviewed},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
