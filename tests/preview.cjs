/* Optional browser-only preview of working assets; never changes the server. */
const fs=require('node:fs/promises');
const path=require('node:path');
module.exports=async context=>{
 const root=process.env.VIP_PREVIEW_ASSET_ROOT;
 if(!root)return;
 await context.route('**/css/themes/custom/virtualia.css*',async route=>route.fulfill({status:200,contentType:'text/css',body:await fs.readFile(path.join(root,'dist','virtualia.min.css'))}));
 await context.route('**/virtualia/*',async route=>{
  const filename=new URL(route.request().url()).pathname.split('/').pop();
  if(['panel.min.js','panel.min.css','files.min.js','login.min.js','login.min.css','software.min.js'].includes(filename)){
   const body=await fs.readFile(path.join(root,'dist',filename));return route.fulfill({status:200,contentType:filename.endsWith('.js')?'application/javascript':'text/css',body});
  }
  if(filename==='native-forms.js'&&process.env.VIP_PREVIEW_NATIVE_FORMS){return route.fulfill({status:200,contentType:'application/javascript',body:await fs.readFile(process.env.VIP_PREVIEW_NATIVE_FORMS)});}
  return route.continue();
 });
};
