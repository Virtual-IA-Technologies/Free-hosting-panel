(() => {
  'use strict';
  const el=document.getElementById('via-context');if(!el)return;
  const context=JSON.parse(el.textContent);if(!context.admin)return;
  const s=context.server||{},content=document.querySelector('.app-content');
  const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  if(location.pathname==='/list/server/' && content){
    // Expose the existing native controls, including their tokens and confirmations.
    content.querySelectorAll('.js-unit .units-table-row-actions a[href]').forEach(a=>{
      const action=new URL(a.href,location.origin).pathname;
      const label={'/restart/service/':'Reiniciar'}[action];
      if(!label)return;
      a.classList.add('vip-service-control');
      a.closest('.units-table-row-action')?.classList.add('vip-service-action');
      const text=a.querySelector('span');
      if(text){text.classList.remove('u-hide-desktop');text.textContent=label;}
      else a.append(node('span','',label));
      a.setAttribute('aria-label',label+' '+(a.closest('.js-unit').dataset.sortName||'servicio'));
    });
    const params=new URLSearchParams(location.search),view=['disk','mem','cpu','net','web','dns','mail'].find(k=>params.has(k))||'overview';
    const panel=node('section','vip-resource-panel');panel.dataset.resourceView=view;let meters;
    const group=title=>{panel.append(node('h2','vip-resource-heading',title));meters=node('div','vip-resource-meters');panel.append(meters);};
    const gib=b=>(b/1073741824).toFixed(1)+' GiB';const bytes=n=>n>=1073741824?gib(n):n>=1048576?(n/1048576).toFixed(1)+' MiB':(n/1024).toFixed(1)+' KiB';
    const gauge=(label,pct,value,detail)=>{
      if(!Number.isFinite(pct))return;
      const card=node('article','vip-resource-meter'),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('role','img');svg.setAttribute('aria-label',label+': '+value);
      for(const[cls,amount]of [['vip-track',100],['vip-value',Math.min(100,Math.max(0,pct))]]){const c=document.createElementNS(svg.namespaceURI,'circle');for(const[k,v]of Object.entries({cx:50,cy:50,r:40,fill:'none','stroke-width':7,'stroke-dasharray':`${amount*2.513274} 251.3274`}))c.setAttribute(k,String(v));c.setAttribute('class',cls);svg.append(c);}
      const copy=node('div');copy.append(node('span','',label),node('strong','',value),node('small','',detail));card.append(svg,copy);meters.append(card);
    };
    const bars=(title,items,note)=>{
      const card=node('article','vip-resource-bars');card.append(node('h3','',title));const max=Math.max(1,...items.map(i=>i.value));
      for(const item of items){const row=node('div','vip-resource-bar');row.append(node('span','',item.label),node('strong','',item.display));const meter=node('progress');meter.max=max;meter.value=item.value;meter.setAttribute('aria-label',item.label+': '+item.display);row.append(meter);card.append(row);}
      if(note)card.append(node('small','via-muted',note));meters.append(card);
    };
    const ram=()=>{if(s.memoryTotal && Number.isFinite(s.memoryAvailable)){const used=s.memoryTotal-s.memoryAvailable;gauge('RAM utilizada',used/s.memoryTotal*100,(used/s.memoryTotal*100).toFixed(0)+' %',gib(used*1024)+' de '+gib(s.memoryTotal*1024));}};
    const swap=()=>{if(s.swapTotal && Number.isFinite(s.swapFree))gauge('Swap utilizada',(s.swapTotal-s.swapFree)/s.swapTotal*100,((s.swapTotal-s.swapFree)/s.swapTotal*100).toFixed(0)+' %',gib((s.swapTotal-s.swapFree)*1024)+' de '+gib(s.swapTotal*1024));};
    const disk=()=>{if(s.diskTotal && Number.isFinite(s.diskFree))gauge('Disco principal',(s.diskTotal-s.diskFree)/s.diskTotal*100,((s.diskTotal-s.diskFree)/s.diskTotal*100).toFixed(0)+' %',gib(s.diskFree)+' disponibles');};
    if(view==='disk'){
      const raw=[...content.querySelectorAll('.console-output')].map(e=>e.textContent).join('\n'),parts=[],inodes=[];let section='';
      for(const line of raw.split('\n')){
        if(/Filesystem\s+Size\s+Used/.test(line)){section='space';continue;}
        if(/Filesystem\s+Inodes\s+IUsed/.test(line)){section='inodes';continue;}
        const m=line.trim().match(/^(\/dev\/\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\d+)%\s+(.+)$/);
        if(m)(section==='inodes'?inodes:parts).push({device:m[1],size:m[2],used:m[3],free:m[4],percent:Number(m[5]),mount:m[6]});
      }
      group('Espacio de las particiones');
      if(parts.length)parts.forEach(p=>gauge(p.mount,p.percent,p.percent+' %',`${p.used} usados de ${p.size} · ${p.free} libres · ${p.device}`));else disk();
      if(inodes.length){group('Inodos: capacidad para archivos');inodes.forEach(p=>gauge(p.mount,p.percent,p.percent+' %',`${p.used} usados de ${p.size} · ${p.free} disponibles`));}
      const lines=raw.split('\n');let ioHeader;
      for(const line of lines){const values=line.trim().split(/\s+/);if(values[0]==='Device' && values.some(v=>/read\/s/.test(v))){ioHeader=values;continue;}if(ioHeader && /^(sd|vd|nvme|dm-)/.test(values[0])){const read=ioHeader.findIndex(v=>/read\/s/.test(v)),write=ioHeader.findIndex(v=>/wrtn\/s|writ\/s/.test(v));if(read<0||write<0)continue;const r=Number(values[read]),w=Number(values[write]);if(Number.isFinite(r)&&Number.isFinite(w)){if(!panel.querySelector('[data-io]')){group('Lectura y escritura');meters.dataset.io='true';}bars(values[0],[{label:'Lectura',value:r,display:values[read]+' '+ioHeader[read].replace('kB_read','kB').replace('MB_read','MB')},{label:'Escritura',value:w,display:values[write]+' '+ioHeader[write].replace('kB_wrtn','kB').replace('MB_wrtn','MB')}],'Tasas reportadas por iostat.');}}}
    }else if(view==='mem'){
      group('Memoria física');ram();
      if(s.memoryTotal && Number.isFinite(s.memoryAvailable))gauge('RAM disponible',s.memoryAvailable/s.memoryTotal*100,gib(s.memoryAvailable*1024),'Memoria que el sistema puede asignar');
      group('Distribución de memoria');bars('Componentes de la RAM',[['Libre sin caché',s.memoryFree],['Caché',s.memoryCached],['Búferes',s.memoryBuffers]].filter(i=>Number.isFinite(i[1])).map(([label,value])=>({label,value,display:gib(value*1024)})),'Los valores de caché y disponibilidad no se suman entre sí.');
      if(s.swapTotal){group('Memoria de intercambio');swap();gauge('Swap disponible',s.swapFree/s.swapTotal*100,gib(s.swapFree*1024),'Capacidad de intercambio libre');}
    }else if(view==='cpu'){
      group('Carga del procesador');
      if(s.load && s.cpuCount)s.load.forEach((load,i)=>gauge('Promedio de '+[1,5,15][i]+' min',load/s.cpuCount*100,load.toFixed(2),`${s.cpuCount} CPU · carga respecto a capacidad; no es % de uso`));
      if(s.load){group('Comparación de carga');bars('Evolución reciente',[1,5,15].map((minutes,i)=>({label:minutes+' min',value:s.load[i],display:s.load[i].toFixed(2)})),'Promedios de carga del sistema; no constituyen un historial muestreado.');}
    }else if(view==='net'){
      group('Tráfico por interfaz');
      for(const network of s.network||[]){bars(network.name,[{label:'Recibido',value:network.received,display:bytes(network.received)},{label:'Enviado',value:network.sent,display:bytes(network.sent)}],'Contadores acumulados desde el arranque.');bars(network.name+' · paquetes',[{label:'Recibidos',value:network.rxPackets,display:network.rxPackets.toLocaleString()},{label:'Enviados',value:network.txPackets,display:network.txPackets.toLocaleString()}],network.errors+' errores registrados');}
    }else if(view==='overview'){
      group('Resumen del servidor');ram();disk();swap();
    }
    if(panel.querySelector('.vip-resource-meter,.vip-resource-bars'))content.querySelector('.via-page-heading')?.after(panel);
    // The native technical report remains visible, in its original location.
  }
  if(/^\/list\/user\/?$/.test(location.pathname))document.querySelectorAll('.js-unit[data-sort-name]').forEach(row=>{const cell=row.querySelectorAll('.units-table-cell')[5];if(!cell)return;const m=cell.textContent.match(/([\d.,]+)\s*(kb|mb|gb|tb)\s*\/\s*([\d.,]+)\s*(kb|mb|gb|tb)/i);if(!m)return;const u={kb:1,mb:1024,gb:1048576,tb:1073741824},total=Number(m[3].replace(',','.'))*u[m[4].toLowerCase()];if(!total)return;const used=Number(m[1].replace(',','.'))*u[m[2].toLowerCase()],meter=node('progress','vip-quota-meter');meter.max=100;meter.value=Math.min(100,used/total*100);meter.title=(used/total*100).toFixed(2)+' % del espacio asignado';meter.setAttribute('aria-label',meter.title);cell.append(meter);});
})();
