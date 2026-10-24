/* Virtual IA: navigation enhancement. All actions remain on native Hestia pages. */
(() => {
  'use strict';
  const contextNode = document.getElementById('via-context');
  const content = document.querySelector('.app-content');
  if (!contextNode || !content || document.getElementById('via-sidebar')) return;
  const context = JSON.parse(contextNode.textContent);
  const token=context.csrfToken || document.getElementById('token')?.getAttribute('token');
  const secureHref=href=>{const u=new URL(href,location.origin);if(u.origin===location.origin && u.search && token && !u.searchParams.has('token'))u.searchParams.set('token',token);return u.pathname+u.search+u.hash;};
  const comparableSearch=value=>{const p=new URLSearchParams(value);p.delete('token');return p.toString();};
  const nativeFileLink=[...document.querySelectorAll('.top-bar-menu a[href]')].find(a=>new URL(a.href).pathname==='/fm/');
  const nativeLinks = [...document.querySelectorAll('.main-menu-item-link')];
  const node = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const icon = name => { const e = node('i', `fas fa-${name}`); e.setAttribute('aria-hidden', 'true'); return e; };
  const groups = context.admin ? [
    ['Panel', [['Inicio del servidor', '/list/user/#inicio', 'th-large', 'Resumen y herramientas del servidor']]],
    ['Cuentas y planes', [
      ['Enumerar las cuentas', '/list/user/#cuentas', 'users', 'Usuarios, cuotas y accesos de hosting'],
      ['Crear una nueva cuenta', '/add/user/', 'user-plus', 'Alta de una cuenta de alojamiento'],
      ['Administrar planes', '/list/package/', 'box', 'Límites y recursos de los planes']]],
    ['Configuración del servidor', [
      ['Opciones del servidor', '/edit/server/', 'cog', 'Hostname, PHP, correo, seguridad y respaldos'],
      ['Estado de los servicios', '/list/server/', 'server', 'Servicios instalados y sus controles'],
      ['Direcciones IP', '/list/ip/', 'network-wired', 'Direcciones disponibles y asignaciones'],
      ['Actualizaciones', '/list/updates/', 'sync', 'Paquetes y actualizaciones del sistema']]],
    ['Salud del sistema', [
      ['CPU y carga del servidor', '/list/server/?cpu', 'microchip', 'Información del procesador y carga'],
      ['Uso de memoria', '/list/server/?mem', 'memory', 'Memoria física y swap'],
      ['Uso de disco', '/list/server/?disk', 'hdd', 'Espacio y particiones del servidor'],
      ['Red del servidor', '/list/server/?net', 'exchange-alt', 'Información de las interfaces de red'],
      ['Estadísticas de cuentas', '/list/stats/', 'chart-line', 'Consumo registrado por usuario']]],
    ['Alojamiento', []],
    ['Herramientas y Developers', [
      ['PHP del servidor', '/edit/server/#vip-php', 'code', 'Versiones instaladas y versión predeterminada global'],
      ['Respaldos y destinos', '/edit/server/#vip-backups', 'archive', 'Compresión, almacenamiento local y externo'],
      ['Retención de respaldos', '/edit/server/#vip-retention', 'calendar-alt', 'Copias incrementales: diarias, semanales, mensuales y anuales'],
      ['Correo y protección', '/edit/server/#vip-mail', 'envelope', 'Servicios de correo, antispam y antivirus disponible'],
      ['Developers e integraciones', '/list/user/#developers', 'plug', 'API, claves de acceso y herramientas externas']]],
    ['Seguridad y registros', [
      ['Cortafuegos', '/list/firewall/', 'shield-alt', 'Reglas de acceso y protección de red'],
      ['Registro de actividad', '/list/log/', 'history', 'Historial de acciones del panel']]]
  ] : [['Mi alojamiento', []]];
  const hostingGroup = groups.find(g => ['Alojamiento', 'Mi alojamiento'].includes(g[0]));
  const labels = {WEB:['Dominios web','globe'], DNS:['Zonas DNS','globe-americas'], MAIL:['Correo electrónico','envelope'], DB:['Bases de datos','database'], CRON:['Trabajos programados','clock'], BACKUP:['Copias de seguridad','archive']};
  nativeLinks.forEach(a => {
    const u = new URL(a.href, location.origin);
    const part = u.pathname.split('/').filter(Boolean)[1]?.toUpperCase();
    if (labels[part]) hostingGroup[1].push([labels[part][0], u.pathname + u.search, labels[part][1], a.querySelector('.main-menu-stats')?.textContent.replace(/\s+/g, ' ').trim() || 'Administrar este servicio']);
  });
  const shellPath=context.admin?'/list/user/':new URL(hostingGroup[1][0]?.[1]||'/list/web/',location.origin).pathname;
  if(nativeFileLink){groups[0][1].push(['Archivos y documentos',shellPath+'#archivos','folder-open','Explorar y gestionar los archivos de esta cuenta']);nativeFileLink.href=shellPath+'#archivos';}
  if(context.admin){const index=groups.findIndex(g=>g[0]==='Alojamiento');if(index>2)groups.splice(2,0,groups.splice(index,1)[0]);}
  if (!hostingGroup[1].length && !context.admin) return;
  document.body.classList.add('via-shell');
  const sidebar = node('aside', 'via-sidebar'); sidebar.id = 'via-sidebar'; sidebar.setAttribute('aria-label', 'Administración Virtual IA');
  const brand = node('a', 'via-brand'); brand.href = context.admin ? '/list/user/#inicio' : hostingGroup[1][0][1];
  const logo = node('img'); logo.src = '/images/logo-header.svg?v=20261024-3'; logo.alt = 'Virtual IA Technologies'; brand.append(logo);
  sidebar.append(brand, node('div', 'via-caption', context.admin ? 'VIRTUAL IA PANEL / ACCESO VIP' : 'VIRTUAL IA PANEL / ALOJAMIENTO'));
  const search = node('input', 'via-search'); search.type = 'search'; search.placeholder = 'Buscar herramientas…'; search.setAttribute('aria-label', 'Buscar herramientas');
  sidebar.append(search);
  const nav = node('nav', 'via-nav'); const searchable = [];
  const linkFor = item => {
    const a = node('a', 'via-link'); a.href = secureHref(item[1]); a.append(icon(item[2]), node('span', '', item[0])); return a;
  };
  groups.filter(g => g[1].length).forEach(([title, items]) => {
    const details = node('details', 'via-group'); details.open = true;
    details.append(node('summary', '', title));
    items.forEach(item => { const a = linkFor(item); details.append(a); searchable.push({item,a,details}); });
    nav.append(details);
  });
  sidebar.append(nav, node('div', 'via-sidebar-footer', `Sesión: ${context.user} · HestiaCP`));
  const toggle = node('button', 'via-toggle', '☰'); toggle.type = 'button'; toggle.setAttribute('aria-label','Abrir menú de administración'); toggle.setAttribute('aria-controls','via-sidebar'); toggle.setAttribute('aria-expanded','false');
  const backdrop = node('button', 'via-backdrop'); backdrop.type = 'button'; backdrop.setAttribute('aria-label', 'Cerrar menú');
  document.body.append(sidebar, backdrop, toggle);
  const setMenu = open => { document.body.classList.toggle('via-menu-open',open); toggle.setAttribute('aria-expanded', String(open)); };
  toggle.addEventListener('click', () => setMenu(!document.body.classList.contains('via-menu-open')));
  backdrop.addEventListener('click', () => setMenu(false));
  nav.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  const heading = node('div','via-page-heading');
  const eyebrow = node('div','via-eyebrow', context.admin ? 'VIRTUAL IA / ADMINISTRACIÓN' : 'VIRTUAL IA / ALOJAMIENTO');
  const title = node('h1'); const sub = node('p'); heading.append(eyebrow,title,sub); content.prepend(heading);
  let dashboard;
  const files=node('section','vip-files');files.id='vip-files';content.append(files);
  let fileFrame;
  const styleFrame=()=>{
    if(!fileFrame?.contentDocument)return;
    const doc=fileFrame.contentDocument;if(!doc.head)return;
    let style=doc.getElementById('vip-file-theme');if(!style){style=doc.createElement('style');style.id='vip-file-theme';doc.head.append(style);}
    const computed=getComputedStyle(document.documentElement),colors={};
    for(const key of ['bg','surface','surface-alt','text','heading','border','input','link','hover'])colors[key]=computed.getPropertyValue('--vip-'+key).trim();
    style.textContent=`body{background:${colors.bg}!important;color:${colors.text}!important}a{color:${colors.link}}.table,.table td,.table th{color:${colors.text};border-color:${colors.border}!important}.table-striped>tbody>tr:nth-of-type(odd),.table-hover>tbody>tr:hover{background:${colors.hover}!important}.dropdown-menu,.modal-content,.card,.breadcrumb,.navbar{background:${colors.surface}!important;color:${colors.text}!important;border-color:${colors.border}!important}.form-control,.form-select,select,input:not([type=checkbox]){background:${colors.input}!important;color:${colors.text}!important;border-color:${colors.border}!important}h1,h2,h3,h4,label{color:${colors.heading}}`;
    doc.querySelectorAll('a[href]').forEach(a=>{try{const u=new URL(a.href);if(u.origin===location.origin && /^\/(list|edit|logout)\//.test(u.pathname))a.target='_top';}catch{}});
  };
  window.addEventListener('vip:appearance',styleFrame);
  if (context.admin && /^\/list\/user\/?$/.test(location.pathname)) {
    const hint=node('aside','vip-account-hint','Administra cada cuenta desde sus accesos directos. Para aumentar o reducir espacio, ajusta su plan en Recursos. ');
    const plans=node('a','','Administrar planes');plans.href='/list/package/';hint.append(plans);heading.after(hint);
    document.querySelectorAll('.js-unit[data-sort-name]').forEach(row=>{
      const cell=row.querySelector('.units-table-heading-cell');
      if(!cell)return;
      const native=[...row.querySelectorAll('a[href]')].find(a=>{const u=new URL(a.href,location.origin);return u.origin===location.origin && u.pathname==='/login/' && u.searchParams.has('loginas') && u.searchParams.has('token');});
      const actions=node('div','vip-account-actions');
      for(const [label,target] of [['Web','/list/web/'],['Correo','/list/mail/'],['Bases de datos','/list/db/'],['Recursos','/edit/user/']]){
        const a=node('a','',label);
        if(native){const u=new URL(native.href);u.searchParams.set('edit_link',target);a.href=u.pathname+u.search;}
        else if(row.dataset.sortName===context.user){const own=[...row.querySelectorAll('a[href]')].find(a=>new URL(a.href).pathname==='/edit/user/');const u=new URL(target,location.origin);if(own){const token=new URL(own.href).searchParams.get('token');if(token)u.searchParams.set('token',token);}a.href=u.pathname+u.search;}
        else continue;
        actions.append(a);
      }
      if(actions.childElementCount)cell.append(actions);
    });
  }
  const cards = [];
  if (context.admin) {
    dashboard = node('section','via-dashboard'); dashboard.id = 'via-home';
    const server = context.server || {};
    const metrics = node('div','via-metrics');
    const metric = (label,value,note,percent) => {
      const box=node('div','via-metric'); box.append(node('span','via-muted',label),node('strong','',value),node('small','via-muted',note));
      if(Number.isFinite(percent)) {const meter=node('progress');meter.max=100;meter.value=Math.min(100,Math.max(0,percent));meter.setAttribute('aria-label',label);box.append(meter);}
      metrics.append(box);
    };
    const gib = bytes => (bytes/1073741824).toFixed(1)+' GiB';
    metric('CARGA DEL SISTEMA',server.load ? server.load[0].toFixed(2) : '—','Promedio de 1 minuto');
    const used=server.memoryTotal-server.memoryAvailable;
    metric('MEMORIA RAM',server.memoryTotal && server.memoryAvailable !== null ? (used/server.memoryTotal*100).toFixed(0)+' %' : '—',server.memoryTotal ? `${gib(used*1024)} de ${gib(server.memoryTotal*1024)}` : 'Sin datos',server.memoryTotal ? used/server.memoryTotal*100 : NaN);
    metric('DISCO DISPONIBLE',server.diskTotal ? gib(server.diskFree) : '—',server.diskTotal ? `${gib(server.diskTotal-server.diskFree)} usados de ${gib(server.diskTotal)}` : 'Sin datos',server.diskTotal ? (server.diskTotal-server.diskFree)/server.diskTotal*100 : NaN);
    metric('TIEMPO ACTIVO',server.uptime ? Math.floor(server.uptime/86400)+' días' : '—','Lectura al abrir esta página');
    dashboard.append(metrics);
    const columns=node('div','via-home-columns'); const tools=node('div');
    tools.append(node('h2','','Accesos frecuentes'));
    const favorites=node('div','via-favorites');
    const favoritePaths=['/list/user/#cuentas','/add/user/','/edit/server/','/list/server/','/list/server/?disk','/list/firewall/'];
    searchable.filter(x=>favoritePaths.includes(x.item[1])).forEach(({item})=>{
      const a=node('a','via-tool-card');a.href=secureHref(item[1]);const copy=node('div');copy.append(node('strong','',item[0]),node('p','',item[3]));a.append(icon(item[2]),copy);favorites.append(a);cards.push({a,text:item.join(' ')});
    });
    tools.append(favorites,node('h2','','Herramientas del servidor'));
    groups.filter(g=>g[0]!=='Panel'&&g[1].length).forEach(([label,items])=>{
      const section=node('section','via-tool-section');section.append(node('h3','',label));const list=node('div','via-tool-list');
      items.forEach(item=>{const a=linkFor(item);list.append(a);cards.push({a,text:item.join(' ')});});section.append(list);tools.append(section);
    });
    const info=node('aside','via-server-info');info.append(node('h2','','Información del servidor'));
    [['Hostname',server.host || '—'],['Usuario',context.user],['Panel','Virtual IA · HestiaCP'],['Sesión','Administración']].forEach(([label,value])=>{info.append(node('small','via-muted',label),node('p','',value));});
    info.append(node('p','via-muted','Los indicadores se actualizan al recargar. Los controles de cada herramienta conservan los permisos y confirmaciones de Hestia.'));
    columns.append(tools,info);dashboard.append(columns);content.append(dashboard);
  }
  const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  search.addEventListener('input',()=>{
    const q=normalize(search.value);
    searchable.forEach(x=>{x.a.hidden=!normalize(x.item.join(' ')).includes(q);if(q)x.details.open=true;});
    nav.querySelectorAll('details').forEach(d=>{d.hidden=![...d.querySelectorAll('a')].some(a=>!a.hidden);});
    cards.forEach(x=>{x.a.hidden=!normalize(x.text).includes(q);});
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape')setMenu(false);if((e.ctrlKey||e.metaKey)&&e.key==='/'){e.preventDefault();setMenu(true);search.focus();}});
  const update = () => {
    const isFiles=Boolean(nativeFileLink) && location.pathname===shellPath && location.hash==='#archivos';
    const isDevelopers=context.admin && location.pathname==='/list/user/' && location.hash==='#developers';
    const home=context.admin && /^\/list\/user\/?$/.test(location.pathname) && location.hash!=='#cuentas' && !isFiles && !isDevelopers;
    document.body.classList.toggle('via-is-developers',isDevelopers);
    document.body.classList.toggle('via-is-files',isFiles);
    if(isFiles && !fileFrame){fileFrame=node('iframe','vip-file-frame');fileFrame.title='Archivos y documentos';fileFrame.src='/fm/';fileFrame.addEventListener('load',styleFrame);files.append(fileFrame);}
    document.body.classList.toggle('via-is-home',home);
    let current;
    searchable.forEach(x=>{
      const u=new URL(x.a.href,location.origin);
      const active=u.pathname===location.pathname && comparableSearch(u.search)===comparableSearch(location.search) && (u.hash ? (home?u.hash==='#inicio':u.hash===location.hash) : true);
      x.a.classList.toggle('via-active',active);if(active){x.a.setAttribute('aria-current','page');current=x.item;}else x.a.removeAttribute('aria-current');
    });
    title.textContent=isFiles?'Archivos y documentos':home?'Inicio del servidor':current?.[0] || (location.pathname.startsWith('/edit/')?'Configuración':'Administración');
    sub.textContent=home ? `Gestiona tus cuentas, servicios y recursos · ${context.server?.host || ''}` : 'Inicio / '+title.textContent;
  };
  window.addEventListener('hashchange',update);update();
})();
