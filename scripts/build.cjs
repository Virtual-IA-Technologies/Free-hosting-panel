/* Production artifacts are committed; the server does not need Node. */
const esbuild=require('esbuild');
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),check=process.argv.includes('--check');
const sets={
 'panel.min.js':['js/appearance.js','js/navigation.js','js/domains.js','js/service-inventory.js','js/resources.js','js/tabs.js','js/tools.js','js/database-links.js','js/interactions.js','js/software-loader.js','js/boot.js'],
 'software.min.js':['js/software.js'],
 'files.min.js':['js/files.js'],
 'login.min.js':['js/appearance.js','js/login.js'],
 'panel.min.css':['css/appearance.css','css/navigation.css','css/interactions.css','css/tabs.css','css/software.css'],
 'login.min.css':['css/appearance.css'],
 'virtualia.min.css':['css/virtualia.css']
};
let original=0,compressed=0;
fs.mkdirSync(path.join(root,'dist'),{recursive:true});
for(const [target,sources] of Object.entries(sets)){
 const loader=target.endsWith('.js')?'js':'css';
 const input=sources.map(p=>fs.readFileSync(path.join(root,'src',p),'utf8')).join(loader==='js'?'\n;\n':'\n');
 const output=esbuild.transformSync(input,{loader,minify:true,target:loader==='js'?'es2020':'chrome111',legalComments:'none',charset:'utf8'}).code;
 const dest=path.join(root,'dist',target);
 if(check){if(!fs.existsSync(dest)||fs.readFileSync(dest,'utf8')!==output)throw Error('Recompilar '+target);}
 else fs.writeFileSync(dest,output);
 const raw=Buffer.byteLength(input),min=Buffer.byteLength(output),gzip=zlib.gzipSync(output).length;
 original+=raw;compressed+=min;
 console.log(`${target}: ${raw} -> ${min} bytes; gzip ${gzip} bytes`);
}
console.log(`Reducción sin gzip: ${((1-compressed/original)*100).toFixed(1)} %`);
