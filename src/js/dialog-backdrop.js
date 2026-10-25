/* Close native dialogs from the backdrop, preserving sheet unsaved-change handlers. */
(() => {
 'use strict';let pressed;
 const outside=(d,e)=>{const r=d.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
 document.addEventListener('pointerdown',e=>{pressed=e.target instanceof HTMLDialogElement&&e.target.open&&outside(e.target,e)?e.target:null;},true);
 document.addEventListener('click',e=>{const d=pressed;pressed=null;if(!d||!d.open||e.target!==d||!outside(d,e)||d.id==='vip-record-sheet')return;
  const cancel=new Event('cancel',{cancelable:true});if(d.dispatchEvent(cancel))d.close();
 },true);
})();
