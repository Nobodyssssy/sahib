import {spawnSync as runCatalogCheck} from 'node:child_process';
if(runCatalogCheck(process.execPath,['tools/build-book-catalog.mjs','--check'],{stdio:'inherit'}).status)process.exit(1);
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const failures=[];let scripts=0,links=0;
function fail(message){failures.push(message)}
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)])}
const runtimeJs=walk('js').filter(f=>f.endsWith('.js')&&!f.includes(`${path.sep}vendor${path.sep}`));
for(const file of runtimeJs){scripts++;const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status)fail(`${file}: ${r.stderr}`)}
for(const file of runtimeJs){const source=fs.readFileSync(file,'utf8');for(const fixture of ['Zurich memory fixture','Local acceptance profile'])if(source.includes(fixture))fail(`QA fixture in runtime: ${file}`)}
for(const page of ['index.html','desktop-widget.html']){const html=fs.readFileSync(page,'utf8');for(const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)){const raw=m[1];if(/^(?:https?:|data:|mailto:)/.test(raw))continue;const f=raw.split('?')[0];if(!fs.existsSync(f))fail(`Missing HTML resource in ${page}: ${raw}`);else links++}}
for(const file of walk('css').filter(f=>f.endsWith('.css')&&!f.endsWith('.orig.css'))){for(const m of fs.readFileSync(file,'utf8').matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)){if(/^(?:data:|https?:|#)/.test(m[1]))continue;const f=path.resolve(path.dirname(file),decodeURIComponent(m[1].split('?')[0]));if(!fs.existsSync(f))fail(`Missing CSS resource ${file}: ${m[1]}`)}}
const expected={'nasser-al-qatami.mp3':'cd03617918becddddf79fc41bea663402365ee4002432db4257b5edb45cfb0f7','nasser-al-qatami-fajr.mp3':'be394449da2eed7c396bcb465129ce67eb4a2845eff184b5d4f5801ee1dda1e1'};
for(const [name,hash]of Object.entries(expected)){const file='assets/adhan/'+name;if(!fs.existsSync(file)||createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==hash)fail(`Audio integrity ${name}`)}
const notices=fs.readFileSync('assets/adhan/LICENSES.md','utf8');if(!notices.includes('Sharjah Quran')||!notices.includes('not relicensed'))fail('Recording rights notice');
console.log(JSON.stringify({scripts,htmlResources:links,audioFiles:2,failures},null,2));if(failures.length)process.exitCode=1;
