import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'dist');
if(path.dirname(out)!==root||path.basename(out)!=='dist')throw Error('Unexpected desktop output path');
process.chdir(root);
fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(out,{recursive:true});
// Copy a deliberate runtime allowlist. Never package .git, private imports, reports or tests.
for(const name of ['index.html','desktop-widget.html','manifest.webmanifest','css','js','assets','icons']){
 if(!fs.existsSync(name))throw Error('Missing runtime input '+name);
 fs.cpSync(name,path.join(out,name),{recursive:true,filter:src=>!src.endsWith('daily-rhythm.webp')});
}
// Only the packaged app loads the platform adapter and bypasses the browser service worker.
const entry=path.join(out,'index.html');
let html=fs.readFileSync(entry,'utf8');
html=html.replace('</head>','<link rel="stylesheet" href="css/desktop.css"></head>')
 .replace(/(<script src="js\/app\.js[^\"]*"><\/script>)/,'<script src="js/desktop.js"></script>$1')
 .replace("if ('serviceWorker' in navigator)","if (!window.__TAURI__ && 'serviceWorker' in navigator)");
fs.writeFileSync(entry,html);
console.log('Prepared desktop runtime in dist/');
