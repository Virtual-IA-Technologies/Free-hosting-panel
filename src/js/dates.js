/* Display dates consistently; never rewrite stored values, forms, logs or timestamps. */
(() => {
 'use strict';const c=JSON.parse(document.getElementById('via-context')?.textContent||'{}');
 const zone=c.serverTime?.timezone||'UTC';let formatter;
 try{formatter=new Intl.DateTimeFormat('en-GB',{timeZone:zone,day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});}catch{formatter=new Intl.DateTimeFormat('en-GB');}
 window.vipDate=value=>{
  if(typeof value==='number')return formatter.format(new Date(value*1000));
  const raw=String(value??'');return raw.replace(/^(\d{4})-(\d{2})-(\d{2})(?=$|[ T])/,(_,y,m,d)=>d+'/'+m+'/'+y);
 };
 window.vipFormatDates=(root=document)=>root.querySelectorAll('td,time').forEach(cell=>{
  if(cell.children.length||cell.closest('pre,code,[contenteditable]'))return;
  const raw=cell.textContent.trim();if(/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(raw))cell.textContent=window.vipDate(raw);
 });
})();
