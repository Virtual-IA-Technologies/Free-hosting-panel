/* Offline view/plan/confirmation tests. All broker responses are mocked. */
const {chromium}=require('playwright-core'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
(async()=>{
 const browser=await chromium.launch({...(process.env.VIP_BROWSER_EXECUTABLE?{executablePath:process.env.VIP_BROWSER_EXECUTABLE}:{channel:'chrome'}),headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage(),calls=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
  let mode='normal',state='running',done=false;
  const inventory={generated:'fixture',policyReviewed:'2026-10-24',panelPhp:'8.3.1',defaultPhp:'8.4',rebootRequired:false,activeJob:null,
   components:[{id:'nginx',label:'Nginx',packages:[{name:'nginx',installed:'1.26.0',candidate:'1.26.1',update:true,change:'maintenance'}]},{id:'apache',label:'Apache',packages:[]}],
   php:[{version:'8.4',installed:'8.4.26',candidate:'8.4.27',support:'active',usage:2,shared:false,default:true,extensions:[{name:'gd',installed:'8.4.26',candidate:'8.4.27',enabledFpm:true,enabledCli:false,protected:false},{name:'curl',installed:'8.4.26',candidate:'8.4.27',enabledFpm:true,enabledCli:true,protected:true}]},
        {version:'8.5',installed:null,candidate:'8.5.12',support:'active',usage:0,extensions:[]}],history:[]};
  const html='<meta charset="UTF-8"><style>'+read('src/css/appearance.css')+read('src/css/tabs.css')+read('src/css/software.css')+'</style><script type="application/json" id="via-context">'+JSON.stringify({admin:true,user:'admin',csrfToken:'fixture'})+'</script><main class="app-content"><p id="native">Native services</p></main>';
  await ctx.route('http://vip.test/**',async r=>{
   const url=new URL(r.request().url());
   if(url.pathname==='/js/virtualia/software.min.js')return r.fulfill({contentType:'text/javascript',body:read('src/js/software.js')});
   if(url.pathname!=='/vip/software/')return r.fulfill({contentType:'text/html',body:html});
   const args=Object.fromEntries(new URLSearchParams(r.request().postData()));calls.push(args);
   assert.equal(args.token,'fixture');assert.equal(args.actor,undefined);
   if(mode==='missing')return r.fulfill({status:404,body:''});
   let data;
   if(args.action==='inventory')data={...inventory,activeJob:done?null:inventory.activeJob};
   else if(args.action==='plan')data={id:'p',title:'Plan de prueba',expires:Date.now()/1000+600,changes:[{package:'nginx',from:'1.26.0',to:'1.26.1'}],modules:[],warnings:['Se reiniciará el servicio.'],databaseBackup:false};
   else if(args.action==='apply'){assert.equal(args.confirm,'true');inventory.activeJob='j';data={job:'j'};}
   else if(args.action==='job'){if(state==='succeeded'){done=true;inventory.activeJob=null;}data={id:'j',title:'Operación de prueba',state,log:['Salida segura <script>malicious</script>'],configurationRestored:state==='failed'};}
   else throw Error('unexpected request');
   return r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data})});
  });
  await page.goto('http://vip.test/list/server/');await page.addScriptTag({content:read('src/js/software-loader.js')});assert.equal(calls.length,0);
  await page.evaluate(()=>{location.hash='vip-software';});await page.getByRole('tab',{name:'Software',exact:true}).waitFor();await page.getByText('Estado desconocido:',{exact:false}).waitFor();
  assert.equal(await page.locator('#native').isVisible(),false);
  await page.getByRole('tab',{name:'PHP y extensiones',exact:true}).click();assert.equal(await page.getByLabel('curl PHP 8.4').isDisabled(),true);assert.equal(await page.getByLabel('gd PHP 8.4').evaluate(e=>e.indeterminate),true);
  await page.getByRole('button',{name:'Preparar instalación en paralelo'}).click();await page.getByText('Plan de prueba',{exact:true}).waitFor();assert.deepEqual(JSON.parse(calls.findLast(c=>c.action==='plan').operation),{kind:'php_install',version:'8.5'});
  const apply=page.getByRole('button',{name:'Confirmar y ejecutar'});assert.equal(await apply.isDisabled(),true);
  await page.getByLabel('He revisado los cambios y los respaldos necesarios.').check();await apply.click();await page.getByText('Estado: running',{exact:true}).waitFor();
  assert.equal(calls.filter(c=>c.action==='apply').length,1);assert.equal(await page.getByRole('button',{name:'Preparar instalación en paralelo'}).isDisabled(),true);
  // No job polling after leaving the view.
  await page.evaluate(()=>{location.hash='native';});await page.waitForTimeout(50);const count=calls.length;await page.waitForTimeout(3200);assert.equal(calls.length,count);assert.equal(await page.locator('#native').isVisible(),true);
  state='succeeded';await page.evaluate(()=>{location.hash='vip-software';});await page.getByText('Estado: succeeded',{exact:true}).waitFor();await page.waitForTimeout(50);
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'mobile overflow');
  await page.getByRole('tab',{name:'Software',exact:true}).focus();await page.keyboard.press('End');assert.equal(await page.getByRole('tab',{name:'Historial',exact:true}).getAttribute('aria-selected'),'true');
  mode='missing';await page.getByRole('button',{name:'Consultar estado',exact:true}).click();await page.getByRole('alert').filter({hasText:'Gestor opcional no instalado'}).waitFor();
  assert.equal(await page.getByRole('link',{name:'Actualizaciones nativas'}).isVisible(),true);assert.deepEqual(errors,[]);
  console.log('PASS: lazy load, real unavailable state, preview, confirmation, single apply, PHP scopes, protected modules, progress, no background polling, keyboard and mobile.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
