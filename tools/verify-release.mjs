import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const failures=[];let scripts=0,links=0;
function fail(message){failures.push(message)}
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)])}
for(const file of walk('js').filter(f=>f.endsWith('.js')&&!f.includes(`${path.sep}vendor${path.sep}`))){scripts++;const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status)fail(`${file}: ${r.stderr}`)}
const sw=fs.readFileSync('sw.js','utf8');if(spawnSync(process.execPath,['--check','sw.js']).status)fail('Service-worker syntax');
const shell=[...sw.split('const APP_SHELL = [')[1].split('];')[0].matchAll(/'\.\/([^']*)'/g)].map(m=>m[1]);
for(const raw of shell){const file=raw.split('?')[0];if(file&&!fs.existsSync(file))fail(`Missing precache: ${raw}`)}
const html=fs.readFileSync('index.html','utf8');for(const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)){const raw=m[1];if(/^(?:https?:|data:|mailto:)/.test(raw))continue;const f=raw.split('?')[0];if(!fs.existsSync(f))fail(`Missing HTML resource ${raw}`);else links++;if(/\?v=/.test(raw)&&!shell.includes(raw))fail(`Version mismatch in precache: ${raw}`)}
// Deployment paths must work both at localhost root and at the official Pages subpath.
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
for(const base of ['https://example.test/','https://nobodyssssy.github.io/sahib/']){
 const manifestURL=new URL('manifest.webmanifest',base);
 for(const value of [manifest.start_url,manifest.scope,...manifest.icons.map(i=>i.src),...manifest.shortcuts.flatMap(s=>[s.url,...s.icons.map(i=>i.src)]),...shell]){
  const resolved=new URL(value,manifestURL);
  if(resolved.origin!==new URL(base).origin||!resolved.pathname.startsWith(new URL(base).pathname))fail(`Deployment path escapes app directory: ${value}`);
 }
}
if(!html.includes('https://nobodyssssy.github.io/sahib/'))fail('Official application URL missing');
for(const file of walk('css').filter(f=>f.endsWith('.css'))){for(const m of fs.readFileSync(file,'utf8').matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)){if(/^(?:data:|https?:|#)/.test(m[1]))continue;const f=path.resolve(path.dirname(file),decodeURIComponent(m[1].split('?')[0]));if(!fs.existsSync(f))fail(`Missing CSS resource ${file}: ${m[1]}`)}}
const expected={'nasser-al-qatami.mp3':'cd03617918becddddf79fc41bea663402365ee4002432db4257b5edb45cfb0f7','nasser-al-qatami-fajr.mp3':'be394449da2eed7c396bcb465129ce67eb4a2845eff184b5d4f5801ee1dda1e1'};
for(const [name,hash]of Object.entries(expected)){const file='assets/adhan/'+name;if(!fs.existsSync(file)||createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==hash)fail(`Audio integrity ${name}`)}
const notices=fs.readFileSync('assets/adhan/LICENSES.md','utf8');if(!notices.includes('Sharjah Quran')||!notices.includes('not relicensed'))fail('Recording rights notice');
console.log(JSON.stringify({scripts,htmlResources:links,precacheAssets:shell.length,audioFiles:2,failures},null,2));if(failures.length)process.exitCode=1;
