/* Live read-only checks for the embedded file manager. */
const {chromium}=require('playwright-core');
(async()=>{
 const base=process.env.VIP_BASE_URL,user=process.env.VIP_USERNAME,password=process.env.VIP_PASSWORD;
 if(!base||!user||!password)throw Error('Faltan credenciales de validación en el entorno.');
 const browser=await chromium.launch({...(process.env.VIP_BROWSER_EXECUTABLE?{executablePath:process.env.VIP_BROWSER_EXECUTABLE}:{channel:'chrome'}),headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const assert=(v,message)=>{if(!v)throw Error(message);};
  await page.goto(base+'/login/');await page.locator('#username').fill(user);await page.locator('#login-form button[type=submit]').click();
  await page.locator('input[type=password]').fill(password);await page.locator('#login-form button[type=submit]').click();await page.waitForURL('**/list/user/**');
  const panel=page.locator('#via-sidebar .via-group').first();
  assert(await panel.getByRole('link',{name:'Dominios',exact:true}).count()===1,'Dominios fuera del grupo Panel');
  assert(await panel.getByRole('link',{name:'Bases de datos',exact:true}).count()===1,'Bases de datos fuera del grupo Panel');
  await page.locator('#via-sidebar a[href$="#archivos"]').click();
  const frame=page.locator('#vip-files');await frame.locator('#vip-file-tools').waitFor({timeout:20000});
  assert(await page.locator('iframe').count()===0,'El gestor todavía usa iframe');
  assert(!await frame.locator('nav.navbar').isVisible(),'Cabecera duplicada');
  assert(await frame.locator('#vip-file-folders').isVisible(),'Carpetas no visibles');
  assert(await frame.locator('#multi-actions .add-new').evaluate(e=>getComputedStyle(e).backgroundColor==='rgba(0, 0, 0, 0)'),'Nuevo tiene marco de fondo');
  const checkDialog=async label=>{
   await frame.locator('#multi-actions .add-new .dropdown-trigger').click();
   await frame.locator('#multi-actions .dropdown-content').getByRole('listitem').filter({hasText:label}).click();
   const modal=frame.locator('.dialog.modal.is-active');await modal.waitFor();
   assert(await modal.evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=-1&&r.top>=-1&&Math.abs(r.width-innerWidth)<=1&&Math.abs(r.height-innerHeight)<=1;}),'Diálogo fuera de pantalla: '+label);
   assert(await page.evaluate(()=>Boolean(document.elementFromPoint(10,innerHeight/2)?.closest('#vip-files .modal'))),'Diálogo detrás del menú: '+label);
   assert(await modal.locator('.modal-card').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;}),'Formulario fuera de pantalla: '+label);
   await page.keyboard.press('Escape');await modal.waitFor({state:'hidden'});
  };
  await checkDialog('Carpeta');await checkDialog('Archivo');
  assert(await frame.locator('#dropzone').evaluate(e=>e.getBoundingClientRect().width/document.getElementById('vip-files').clientWidth)>.95,'Ancho limitado');
  await frame.getByRole('button',{name:'Cuadrícula',exact:true}).click();
  assert(await frame.evaluate(e=>e.classList.contains('vip-files-grid')),'Cuadrícula sin efecto');
  await frame.getByRole('button',{name:'Lista',exact:true}).click();
  await frame.locator('tr.type-dir a.name').first().waitFor();
  const contrast=()=>frame.locator('tr.type-dir a.name').first().evaluate(e=>{
   const values=s=>(s.match(/[\d.]+/g)||[]).slice(0,3).map(Number),lum=a=>a.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
   let p=e,bg;do{bg=getComputedStyle(p).backgroundColor;p=p.parentElement;}while(bg==='rgba(0, 0, 0, 0)'&&p);
   const a=lum(values(getComputedStyle(e).color)),b=lum(values(bg));return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  });
  assert(await contrast()>=4.5,'Filas de archivos sin contraste oscuro');
  await page.locator('.vip-appearance select').selectOption('light');assert(await contrast()>=4.5,'Filas de archivos sin contraste claro');
  await page.locator('.vip-appearance select').selectOption('night');
  const folder=frame.locator('#vip-file-folders button').filter({hasText:'📁'}).first();
  await folder.click();await frame.locator('.breadcrumb li').nth(1).waitFor();
  await frame.getByRole('button',{name:'Subir nivel',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('#vip-files .breadcrumb li').length===1);
  assert(new URL(page.url()).hash==='#archivos','El gestor salió del panel');
  await page.setViewportSize({width:390,height:844});
  await checkDialog('Carpeta');await checkDialog('Archivo');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Archivos desborda en celular');
  assert(await frame.getByRole('button',{name:'Lista',exact:true}).evaluate(e=>e.getBoundingClientRect().height)>=44,'Control táctil pequeño');
  await frame.getByRole('button',{name:'Cuadrícula',exact:true}).click();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Cuadrícula desborda en celular');
  await frame.getByRole('button',{name:'Lista',exact:true}).click();
  if(process.env.VIP_SCREENSHOT)await page.screenshot({path:process.env.VIP_SCREENSHOT.replace('.png','-mobile.png')});
  await page.setViewportSize({width:1440,height:1000});
  if(process.env.VIP_SCREENSHOT)await page.screenshot({path:process.env.VIP_SCREENSHOT});
  const fallback=await page.context().newPage();
  try{
   await fallback.route('**/js/virtualia/files.min.js*',route=>route.abort());
   await fallback.goto(base+'/list/user/#archivos');
   await fallback.getByRole('link',{name:'Abrir gestor nativo',exact:true}).waitFor();
   assert(await fallback.getByRole('link',{name:'Abrir gestor nativo',exact:true}).getAttribute('href')==='/fm/','Recuperación sin ruta nativa');
  }finally{await fallback.close();}
  assert(errors.length===0,errors.join('; '));
  console.log(JSON.stringify({result:'PASS',files:'full width, single header, folders, grid/list, native navigation',menu:'Domains and databases in Panel',javascriptErrors:errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exit(1);});
