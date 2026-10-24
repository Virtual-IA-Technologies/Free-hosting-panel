(() => {
  'use strict';
  let user='login',defaultTheme='graphite';try{const context=JSON.parse(document.getElementById('via-context')?.textContent || '{}');user=context.user||user;defaultTheme=user==='login'?(context.loginTheme||'graphite'):(context.defaultTheme||'night');}catch{}
  const key=`virtual-ia-panel:appearance:${user}`,themes={night:'Azul noche',graphite:'Grafito',medium:'Medium',light:'Claro'};
  if(!Object.hasOwn(themes,defaultTheme))defaultTheme='night';
  const defaults={theme:defaultTheme,scale:100,opacity:12,menu:'',content:''};let settings={...defaults};
  if(user!=='login')try{const saved=JSON.parse(localStorage.getItem(key));if(saved && typeof saved==='object')settings={...defaults,...saved};else settings.theme=localStorage.getItem(`virtual-ia-panel:theme:${user}`)||defaultTheme;}catch{}
  if(!Object.hasOwn(themes,settings.theme))settings.theme='night';
  settings.scale=Math.min(125,Math.max(80,Number(settings.scale)||100));settings.opacity=Math.min(40,Math.max(0,Number.isFinite(Number(settings.opacity))?Number(settings.opacity):12));
  const image=s=>typeof s==='string' && /^data:image\/(webp|png|jpeg);base64,[a-zA-Z0-9+/=]+$/.test(s) && s.length<1100000?s:'';
  settings.menu=image(settings.menu);settings.content=image(settings.content);
  const root=document.documentElement,apply=()=>{root.dataset.viaTheme=settings.theme;root.style.zoom=String(settings.scale/100);root.style.setProperty('--vip-image-opacity',String(settings.opacity/100));root.style.setProperty('--vip-background-mask',(100-settings.opacity)+'%');for(const area of ['menu','content']){root.style.setProperty(`--vip-${area}-image`,settings[area]?`url("${settings[area]}")`:'none');root.toggleAttribute('data-vip-'+area+'-background',Boolean(settings[area]));}window.dispatchEvent(new CustomEvent('vip:appearance'));};apply();
  if(user==='login')return;
  const mount=document.querySelector('.top-bar-right');if(!mount)return;
  const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const createSelect=()=>{const s=node('select');s.setAttribute('aria-label','Tema del panel');for(const[id,label]of Object.entries(themes)){const o=node('option','',label);o.value=id;s.append(o);}s.value=settings.theme;return s;};
  const wrapper=node('div','vip-appearance'),quick=createSelect(),button=node('button','vip-appearance-button','⚙');button.type='button';button.title='Personalizar apariencia';button.setAttribute('aria-label',button.title);wrapper.append(quick,button);mount.append(wrapper);
  const dialog=node('dialog','vip-personalize');dialog.setAttribute('aria-labelledby','vip-appearance-title');
  const close=node('button','vip-close','Cerrar');close.type='button';close.addEventListener('click',()=>dialog.close());dialog.append(close);
  const title=node('h2','','Personalizar apariencia');title.id='vip-appearance-title';dialog.append(title,node('p','','Elige tu estilo y ajusta tu espacio. Se guarda en este navegador para tu usuario.'));
  const status=node('p','vip-status');status.setAttribute('role','status');
  const save=()=>{apply();try{localStorage.setItem(key,JSON.stringify(settings));status.textContent='Preferencias guardadas.';}catch{status.textContent='No se pudo guardar. Elimina una imagen o utiliza una más pequeña.';}};
  const label=(text,id)=>{const l=node('label','',text);l.htmlFor=id;dialog.append(l);};
  label('Estilo del panel','vip-theme');const theme=createSelect();theme.id='vip-theme';dialog.append(theme);
  const setTheme=v=>{settings.theme=v;quick.value=theme.value=v;save();};quick.addEventListener('change',()=>setTheme(quick.value));theme.addEventListener('change',()=>setTheme(theme.value));
  const range=(text,id,min,max,value,update)=>{label(text,id);const input=node('input');Object.assign(input,{type:'range',id,min,max,step:5,value});const output=node('output','',value+' %');output.htmlFor=id;input.addEventListener('input',()=>{output.textContent=input.value+' %';update(Number(input.value));save();});dialog.append(input,output);return{input,output};};
  const scale=range('Escala de la interfaz','vip-scale',80,125,settings.scale,v=>{settings.scale=v;}),opacity=range('Intensidad de las imágenes','vip-opacity',0,40,settings.opacity,v=>{settings.opacity=v;});
  const files=[];
  for(const[area,text]of [['menu','Fondo del menú'],['content','Fondo del contenido']]){
    const id='vip-background-'+area;label(text,id);const file=node('input');Object.assign(file,{type:'file',id,accept:'image/png,image/jpeg,image/webp'});files.push(file);
    const preview=node('img','vip-background-preview');preview.alt='Vista previa: '+text;preview.hidden=!settings[area];if(settings[area])preview.src=settings[area];
    file.addEventListener('change',async()=>{const selected=file.files?.[0];if(!selected)return;try{
      if(!['image/png','image/jpeg','image/webp'].includes(selected.type)||selected.size>10485760)throw Error('Usa PNG, JPG o WebP de hasta 10 MB.');
      const bitmap=await createImageBitmap(selected);if(bitmap.width*bitmap.height>32000000){bitmap.close();throw Error('La imagen es demasiado grande.');}
      const ratio=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
      const result=canvas.toDataURL('image/webp',.78);if(!image(result))throw Error('Elige una imagen más pequeña.');settings[area]=result;preview.src=result;preview.hidden=false;if(settings.opacity<25){settings.opacity=25;opacity.input.value=25;opacity.output.textContent='25 %';}save();status.textContent='Imagen aplicada. Cierra este panel para ver el fondo sin atenuación.';
    }catch(error){status.textContent=error.message;file.value='';}});
    const remove=node('button','vip-remove-image','Quitar imagen');remove.type='button';remove.addEventListener('click',()=>{settings[area]='';file.value='';preview.hidden=true;preview.removeAttribute('src');save();});dialog.append(file,preview,remove);
  }
  dialog.append(node('p','','Las imágenes se optimizan y se muestran con baja intensidad para mantener legible el contenido.'));
  const reset=node('button','','Restablecer apariencia');reset.type='button';reset.addEventListener('click',()=>{settings={...defaults};quick.value=theme.value=settings.theme;scale.input.value=100;scale.output.textContent='100 %';opacity.input.value=12;opacity.output.textContent='12 %';files.forEach(f=>{f.value='';});dialog.querySelectorAll('.vip-background-preview').forEach(p=>{p.hidden=true;p.removeAttribute('src');});save();});dialog.append(reset,status);document.body.append(dialog);button.addEventListener('click',()=>dialog.showModal());
})();
