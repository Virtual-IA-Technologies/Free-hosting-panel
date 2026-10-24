"""Initialize native Hestia form helpers inside a scoped record sheet."""


def build_assets(root):
    native = (root/'web/js/dist/main.min.js').read_text()
    if not native.strip():
        raise ValueError('No se encontró el inicializador nativo de formularios.')
    prefix = r'''
/* Native Hestia helpers, scoped to the active form. Original source is unchanged. */
window.vipInitNativeForm = function(root, href) {
 const realDocument=document,realWindow=window,url=new URL(href,location.origin),cleanups=[];
 let scopedDocument;
 const scopedWindow=new Proxy(realWindow,{
  get(target,key){
   if(key==='document')return scopedDocument;
   if(key==='location')return url;
   if(key==='addEventListener')return(type,handler,options)=>{target.addEventListener(type,handler,options);cleanups.push(()=>target.removeEventListener(type,handler,options));};
   const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }
 });
 scopedDocument=new Proxy(realDocument,{
  get(target,key){
   if(key==='body')return root;
   if(key==='querySelector')return selector=>root.querySelector(selector)||(selector==='#token'?target.querySelector(selector):null);
   if(key==='querySelectorAll')return selector=>root.querySelectorAll(selector);
   if(key==='getElementById')return id=>root.querySelector('#'+CSS.escape(id));
   if(key==='addEventListener')return(type,handler,options)=>{if(type==='alpine:init')return;root.addEventListener(type,handler,options);};
   if(key==='removeEventListener')return(type,handler,options)=>root.removeEventListener(type,handler,options);
   const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }
 });
 const scopedFetch=(input,options)=>realWindow.fetch(typeof input==='string'?new URL(input,url):input,options);
 try {
 (function(document,window,location,fetch){
'''
    suffix = r'''
 })(scopedDocument,scopedWindow,url,scopedFetch);
 }catch(error){cleanups.forEach(cleanup=>cleanup());throw error;}
 return ()=>cleanups.forEach(cleanup=>cleanup());
};
'''
    return {'web/js/virtualia/native-forms.js': (prefix+native+'\n'+suffix).encode()}
