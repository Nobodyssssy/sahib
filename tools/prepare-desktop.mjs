import './build-book-catalog.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'dist');
if(path.dirname(out)!==root||path.basename(out)!=='dist')throw Error('Unexpected desktop output path');
process.chdir(root);
fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(out,{recursive:true});
// Copy a deliberate runtime allowlist. Never package .git, private imports, reports or tests.
for(const name of ['index.html','desktop-widget.html','css','js','assets','icons']){
 if(!fs.existsSync(name))throw Error('Missing runtime input '+name);
 fs.cpSync(name,path.join(out,name),{recursive:true,filter:src=>!src.endsWith('daily-rhythm.webp')});
}
const widgetEntry=path.join(out,'desktop-widget.html');
let widgetHTML=fs.readFileSync(widgetEntry,'utf8'),widgetCSS='';
widgetHTML=widgetHTML.replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g,(_,file)=>{widgetCSS+=fs.readFileSync(path.join(out,file),'utf8')+'\n';return '';});
fs.writeFileSync(path.join(out,'css/widget-runtime.css'),widgetCSS);
fs.writeFileSync(widgetEntry,widgetHTML.replace('</head>','<link rel="stylesheet" href="css/widget-runtime.css"></head>'));
// Only the packaged app loads the platform adapter.
const entry=path.join(out,'index.html');
let html=fs.readFileSync(entry,'utf8');
html=html.replace('</head>','<link rel="stylesheet" href="css/desktop.css"></head>')
 .replace(/(<script src="js\/app\.js[^\"]*"><\/script>)/,'<script src="js/desktop.js"></script>$1')
 ;
{
 const brand=path.join(root,'branding','sahib-0.2.4');
 for(const [source,target]of [['app-icon.svg','icon.svg'],['pwa-192.png','icon-192.png'],['pwa-512.png','icon-512.png']])fs.copyFileSync(path.join(brand,source),path.join(out,'icons',target));
 const mark=fs.readFileSync(path.join(brand,'sahib-mark.svg'),'utf8').replace('<svg ','<svg class="sahib-mark" ');
 html=html.replace('<img src="icons/icon.svg" alt="صاحب">',mark);
}
fs.writeFileSync(entry,html);
console.log('Prepared desktop runtime in dist/');
