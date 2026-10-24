/* Live read-only checks for the embedded file manager. */
const {chromium}=require('playwright-core');
(async()=>{
 const base=process.env.VIP_BASE_URL,user=process.env.VIP_USERNAME,password=process.env.VIP_PASSWORD;
 if(!base||!user||!password)throw Error('Faltan credenciales de validación en el entorno.');
 const browser=await chromium.launch({...(process.env.VIP_BROWSER_EXECUTABLE?{executablePath:process.env.VIP_BROWSER_EXECUTABLE}:{channel:'chrome'}),headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const assert=(v,message)=>{if(!v)throw Error(message);};
  await page.goto(base+'/login/');await page.locator('#username').fill(user);await page.locator('#login-form button[type=submit]').click();
  await page.locator('input[type=password]').fill(password);await page.locator('#login-form button[type=submit]').click();await page.waitForURL('**/list/user/**');
  const panel=page.locator('#via-sidebar .via-group').first();
  assert(await panel.getByRole('link',{name:'Dominios',exact:true}).count()===1,'Dominios fuera del grupo Panel');
  assert(await panel.getByRole('link',{name:'Bases de datos',exact:true}).count()===1,'Bases de datos fuera del grupo Panel');
  await page.locator('#via-sidebar a[href$="#archivos"]').click();
  const frame=page.frameLocator('.vip-file-frame');await frame.locator('#vip-file-tools').waitFor({timeout:20000});
  assert(!await frame.locator('nav.navbar').isVisible(),'Cabecera duplicada');
  assert(await frame.locator('#vip-file-folders').isVisible(),'Carpetas no visibles');
  assert(await frame.locator('#dropzone').evaluate(e=>e.getBoundingClientRect().width/innerWidth)>.95,'Ancho limitado');
  await frame.getByRole('button',{name:'Cuadrícula',exact:true}).click();
  assert(await frame.locator('body').evaluate(e=>e.classList.contains('vip-files-grid')),'Cuadrícula sin efecto');
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
  await page.waitForFunction(()=>document.querySelector('.vip-file-frame').contentDocument.querySelectorAll('.breadcrumb li').length===1);
  assert(new URL(page.url()).hash==='#archivos','El gestor salió del panel');
  if(process.env.VIP_SCREENSHOT)await page.screenshot({path:process.env.VIP_SCREENSHOT});
  assert(errors.length===0,errors.join('; '));
  console.log(JSON.stringify({result:'PASS',files:'full width, single header, folders, grid/list, native navigation',menu:'Domains and databases in Panel',javascriptErrors:errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exit(1);});
