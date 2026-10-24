/* Read-only regression against account rows; no account changes or POST requests. */
const {chromium}=require('playwright-core');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIP_BROWSER_EXECUTABLE,headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1440,height:1000}});await require('./preview.cjs')(ctx);
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  await require('./login.cjs')(page,process.env.VIP_BASE_URL,process.env.VIP_USERNAME,process.env.VIP_PASSWORD);
  await page.waitForURL('**/list/user/**');
  const row=page.locator('.js-unit[data-sort-name]').first();
  const expectedName=(await row.locator('.units-table-heading-cell > a').first().textContent()).replace(/\s+/g,' ').trim();
  await row.dispatchEvent('contextmenu',{clientX:800,clientY:300});await page.getByRole('menuitem',{name:'Ver detalle',exact:true}).click();
  const sheet=page.locator('#vip-record-sheet');await sheet.locator('.vip-record-field').first().waitFor();
  const fields=await sheet.locator('.vip-record-field').evaluateAll(rows=>rows.map(e=>({label:e.querySelector('dt').textContent,value:e.querySelector('dd').textContent})));
  assert(fields.some(f=>/Nombre|Name/.test(f.label)&&f.value===expectedName),'Nombre separado y normalizado');
  assert(fields.some(f=>/Correo|Email/.test(f.label)&&/^[^\s@]+@[^\s@]+$/.test(f.value)),'Correo separado');
  assert(fields.some(f=>/Disco|Disk/.test(f.label)&&/\d.*\//.test(f.value)&&!f.value.includes('\n')),'Cuota compacta con unidad');
  assert(!fields.some(f=>/Dato \d|Registro/.test(f.label)||/WebDNS|\n| {2,}/.test(f.value)),'Sin etiquetas genéricas ni indentación o accesos');
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.waitForTimeout(250);
   const layout=await sheet.evaluate(e=>{const list=e.querySelector('.vip-record-detail'),r=e.getBoundingClientRect();return{overflow:e.scrollWidth>e.clientWidth,rowsOverflow:[...list.querySelectorAll('dd')].some(x=>x.scrollWidth>x.clientWidth+1),height:list.getBoundingClientRect().height,inside:r.left>=-1&&r.right<=innerWidth+1};});
   assert(!layout.overflow&&!layout.rowsOverflow&&layout.inside,'Sin desbordamiento a '+width+': '+JSON.stringify(layout));
   assert(layout.height<660,'Detalle compacto a '+width);
   if(process.env.VIP_DETAIL_SCREENSHOT&&width===390)await page.screenshot({path:process.env.VIP_DETAIL_SCREENSHOT});
  }
  await page.keyboard.press('Escape');assert(!await sheet.isVisible(),'Cerrar con Escape');
  assert(!errors.length,errors.join('; '));
  console.log('PASS account details: labels, separate email, compact quotas, desktop/mobile, Escape, no JavaScript errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exit(1);});
