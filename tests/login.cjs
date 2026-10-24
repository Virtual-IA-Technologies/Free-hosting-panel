/* Native login compatibility: one step or username/password steps; no 2FA bypass. */
module.exports=async(page,base,user,password)=>{
 await page.goto(base+'/login/',{waitUntil:'networkidle'});
 await page.locator('#username').fill(user);
 if(!await page.locator('input[type=password]').count())await page.locator('#login-form button[type=submit]').click();
 await page.locator('input[type=password]').fill(password);
 await page.locator('#login-form button[type=submit]').click();
};
