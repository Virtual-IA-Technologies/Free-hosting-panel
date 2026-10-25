/* Read-only inventory and native account switch; no domain/file writes. */
const {chromium}=require('playwright-core');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIP_BROWSER_EXECUTABLE,headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  await require('./login.cjs')(page,process.env.VIP_BASE_URL,process.env.VIP_USERNAME,process.env.VIP_PASSWORD);await page.waitForURL('**/list/user/**');
  const panel=page.locator('#via-sidebar .via-group').first();assert(await panel.getByRole('link',{name:'Enumerar las cuentas',exact:true}).count()===1,'Cuentas en Panel');
  await panel.getByRole('link',{name:'Enumerar las cuentas',exact:true}).click();
  await page.waitForFunction(()=>!document.body.classList.contains('via-is-home'));
  const account=page.locator('.js-unit[data-sort-name] .vip-account-actions').first();assert(await account.getByRole('link',{name:'Archivos',exact:true}).count()===1,'Archivos por cuenta');
  await panel.getByRole('link',{name:'Dominios',exact:true}).click();await page.locator('#vip-domains-inventory tbody tr').first().waitFor();
  const context=await page.locator('#via-context').evaluate(e=>JSON.parse(e.textContent)),data=context.domainsInventory;
  assert(context.admin&&data.available&&!data.failedAccounts&&data.rows.length>0,'Inventario administrativo completo');
  assert(await page.locator('#vip-domains-inventory tbody tr').count()===data.rows.length,'Todas las filas nativas visibles');
  assert(await page.getByRole('columnheader',{name:'Propietario / cuenta',exact:true}).count()===1,'Columna de propietario');
  const owner=data.rows[0].owner;await page.getByLabel('Filtrar por propietario').selectOption(owner);
  assert(await page.locator('#vip-domains-inventory tbody tr:visible').count()===data.rows.filter(r=>r.owner===owner).length,'Filtro de propietario');
  await page.getByLabel('Filtrar por propietario').selectOption('');await page.getByLabel('Buscar dominio o cuenta').fill('__no_such_domain__');assert(await page.locator('#vip-domains-inventory tbody tr:visible').count()===0,'Búsqueda sin resultados');await page.getByLabel('Buscar dominio o cuenta').fill('');
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Página móvil sin desbordamiento');await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('link',{name:'Dominios de esta cuenta',exact:true}).click();await page.waitForLoadState('networkidle');
  assert(!await page.locator('#vip-domains-inventory').count(),'Vista de cuenta conserva lista nativa');
  await page.locator('#via-sidebar .via-group').first().getByRole('link',{name:'Dominios',exact:true}).click();await page.locator('#vip-domains-inventory tbody tr').first().waitFor();
  const target=data.rows.find(r=>r.owner!==context.user);assert(target,'Se requiere una cuenta real distinta para validar aislamiento');
  await page.getByRole('link',{name:'Administrar · '+target.domain+' · '+target.owner,exact:true}).click();await page.waitForURL('**/list/web/**');
  const normal=await page.locator('#via-context').evaluate(e=>JSON.parse(e.textContent));assert(normal.user===target.owner&&!normal.admin&&!normal.domainsInventory,'Cuenta suplantada no recibe datos globales: '+JSON.stringify({effectiveUser:normal.user,expected:target.owner,admin:normal.admin,hasInventory:Boolean(normal.domainsInventory)}));
  assert(!await page.locator('#vip-domains-inventory').count(),'Sin tabla global en cuenta normal');
  await page.locator('#via-sidebar a[href$="#archivos"]').click();await page.locator('#vip-file-tools').waitFor({timeout:25000});
  assert(await page.locator('#vip-files #browser').isVisible(),'Archivos de la cuenta accesibles con autenticación nativa');
  assert(!errors.length,errors.join('; '));
  console.log('PASS global domains: native rows, owners, filters, mobile; accounts in Panel; native account switch and own file manager; no JavaScript errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exit(1);});
