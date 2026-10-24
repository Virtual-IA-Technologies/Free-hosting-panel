/* Shortcuts select native configuration sections; no privileged endpoints. */
(() => {
 'use strict';
 const raw=document.getElementById('via-context');
 if(!raw)return;
 const context=JSON.parse(raw.textContent);
 if(!context.admin)return;
 const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
 const link=(label,href)=>{const a=make('a',label,'via-link');a.href=href;return a;};
 const sections={
  '#vip-php':['#v_php_default_version','PHP del servidor: instala o retira versiones y elige la predeterminada. Para cambiar un sitio, entra en su cuenta → Dominios web → Editar → Opciones avanzadas → PHP / Backend. Cada dominio conserva su selección.'],
  '#vip-backups':['#v_backup','Respaldos completos: destino, compresión y ruta. La cantidad local se modifica en el plan de cada cuenta. Google Drive y OneDrive requieren primero autorizar un remoto de Rclone en el servidor.'],
  '#vip-retention':['#v_backup_incremental','Respaldos incrementales: repositorio y retención editables. La propuesta es 7 diarias, 4 semanales y 3 mensuales; aplícala después de conectar y probar el destino. La retención no programa horarios.'],
  '#vip-mail':['#v_webmail_alias','Correo del servidor: servicios y protección global. Los dominios, buzones, cuotas y contraseñas se administran dentro de cada cuenta → Correo. El antivirus necesita su servicio instalado.'],
  '#vip-security':['#v_api_system','API del servidor: conserva el acceso restringido a las direcciones IP necesarias. Usa claves individuales con permisos limitados para cada integración.']
 };
 let hint;
 const focusSection=()=>{
  if(location.pathname!=='/edit/server/')return;
  if(hint)hint.remove();
  const spec=sections[location.hash];if(!spec)return;
  const input=document.querySelector(spec[0]) || (location.hash==='#vip-mail'?document.querySelector('[name="v_mail"]'):null);
  if(!input)return;
  const details=input.closest('details');if(!details)return;
  details.open=true;
  hint=make('aside',spec[1],'vip-account-hint');details.before(hint);
  requestAnimationFrame(()=>hint.scrollIntoView({block:'center',behavior:'instant'}));
 };
 if(location.pathname==='/edit/server/php/'){
  const warning=make('aside','Editor PHP global compartido: Hestia aplica este archivo a las versiones de PHP del servidor. Para una configuración independiente usa el php.ini de la versión o el pool del dominio mediante administración SSH. Este editor no es específico de una cuenta.','vip-account-hint');
  document.querySelector('.via-page-heading')?.after(warning);
 }
 if(location.pathname==='/edit/web/'){
  if(location.hash==='#vip-ssl')document.querySelector('#v_ssl')?.closest('.form-check')?.scrollIntoView({block:'center'});
  const selector=document.querySelector('#v_backend_template');
  if(selector){const note=make('aside','PHP de este dominio: esta selección es independiente de la versión predeterminada del servidor. Los límites personalizados requieren un pool o plantilla propios.','vip-account-hint');selector.closest('details')?.before(note);}
 }
 if(location.pathname==='/list/web/'){
  const hint=make('aside','Cada dominio tiene su propio certificado SSL. Abre SSL / HTTPS para habilitar Let’s Encrypt, instalar un certificado propio o forzar HTTPS. El DNS del dominio debe apuntar a este servidor para validar Let’s Encrypt.','vip-account-hint');
  document.querySelector('.via-page-heading')?.after(hint);
  document.querySelectorAll('.js-unit').forEach(row=>{
   const edit=[...row.querySelectorAll('a[href]')].find(a=>new URL(a.href,location.origin).pathname==='/edit/web/');
   const cell=row.querySelector('.units-table-heading-cell');
   if(edit&&cell){const shortcuts=make('div',null,'vip-account-actions');const a=link('SSL / HTTPS',edit.getAttribute('href').split('#')[0]+'#vip-ssl');shortcuts.append(a);cell.append(shortcuts);}
  });
 }
 const content=document.querySelector('.app-content');
 if(location.pathname==='/list/user/' && content){
  const hub=make('section',null,'vip-developers');hub.id='vip-developers';
  const card=(title,text,links=[])=>{const box=make('section',null,'vip-integration-card');box.append(make('h2',title),make('p',text));links.forEach(([label,url])=>box.append(link(label,url)));hub.append(box);return box;};
  card('API y claves de acceso','Conecta aplicaciones mediante la API nativa. Crea una clave por herramienta, limita sus permisos y autoriza la IP de conexión. Las claves pertenecen al usuario que las crea.',[['Administrar claves','/list/access-key/'],['Crear clave','/add/access-key/'],['Configuración de seguridad','/edit/server/#vip-security'],['Documentación de la API','https://hestiacp.com/docs/server-administration/rest-api']]);
  const api=card('Perfil de conexión','Exporta la dirección y el usuario para preparar un cliente. El perfil no contiene claves ni contraseñas.');
  const endpoint=make('code',location.origin+'/api/');api.append(endpoint);
  const download=make('button','Descargar perfil','button');download.type='button';
  download.onclick=()=>{const data={name:'Virtual IA Panel',endpoint:location.origin+'/api/',user:context.user,authentication:'access-key',connected:false};const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=make('a');a.href=u;a.download='virtual-ia-connection.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};api.append(download);
  card('Asistentes de IA','ChatGPT, Claude y otros asistentes necesitan un conector o adaptador autenticado. Esta instalación todavía no los conecta. Empieza con consultas de lectura; las modificaciones deben conservar permisos, registro y confirmación.',[['Claves por integración','/list/access-key/']]);
  card('PHP y extensiones','La versión global se administra en Servidor. La versión de cada sitio se cambia en Dominios web de su cuenta. Las extensiones se instalan por versión de PHP mediante paquetes del sistema; no hay un instalador visual de extensiones en esta edición.',[['Versiones del servidor','/edit/server/#vip-php'],['Editor PHP global compartido','/edit/server/php/'],['Cuentas y dominios','/list/user/#cuentas']]);
  card('Almacenamiento y respaldos','Elige destino y retención en los formularios nativos. La autorización inicial de Drive/OneDrive se realiza con Rclone. Comprueba una restauración antes de confiar datos reales. La programación global se administra por SSH; los trabajos de cada cuenta siguen disponibles en Trabajos programados.',[['Destino y compresión','/edit/server/#vip-backups'],['Retención incremental','/edit/server/#vip-retention'],['Copias locales por plan','/list/package/']]);
  const custom=card('Mis herramientas externas','Guarda accesos HTTPS a tus herramientas. Se conservan solo en este navegador y usuario; añadir un enlace no conecta su API.');
  const key='vip-tools:'+context.user;let saved=[];try{const v=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(v))saved=v.filter(x=>typeof x?.label==='string'&&typeof x?.url==='string').slice(0,20);}catch{}
  const valid=value=>{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('Usa una URL HTTPS sin credenciales, parámetros ni fragmentos.');return u.href;};
  const listing=make('div');const form=make('form',null,'vip-tools-form');
  const label=make('input');label.placeholder='Nombre de la herramienta';label.setAttribute('aria-label',label.placeholder);label.maxLength=60;label.required=true;
  const url=make('input');url.type='url';url.placeholder='https://herramienta.ejemplo';url.setAttribute('aria-label',url.placeholder);url.required=true;
  const add=make('button','Añadir acceso','button');add.type='submit';
  const status=make('p');status.setAttribute('role','status');
  const persist=()=>{try{localStorage.setItem(key,JSON.stringify(saved));return true;}catch{status.textContent='No se pudo guardar: revisa el almacenamiento del navegador.';return false;}};
  const paint=()=>{listing.replaceChildren();saved.forEach((item,index)=>{try{valid(item.url);}catch{return;}const row=make('div',null,'vip-external-tool');const a=link(item.label,item.url);a.target='_blank';a.rel='noopener noreferrer';const remove=make('button','Quitar','button');remove.type='button';remove.onclick=()=>{saved.splice(index,1);persist();paint();};row.append(a,remove);listing.append(row);});};
  form.append(label,url,add);form.onsubmit=e=>{e.preventDefault();try{if(saved.length>=20)throw Error('Máximo 20 accesos.');saved.push({label:label.value.trim()||'Herramienta',url:valid(url.value)});if(persist()){form.reset();status.textContent='Acceso guardado.';}paint();}catch(err){status.textContent=err.message;}};
  custom.append(listing,form,status);paint();content.append(hub);
 }
 window.addEventListener('hashchange',focusSection);focusSection();
})();
