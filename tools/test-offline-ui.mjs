import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const body={innerHTML:''},modal={classList:{add(){},remove(){}}},progress={style:{},innerHTML:'',querySelector:()=>({textContent:''})};
const files=new Map(),downloads=[],messages=[];let cleared=false;
const cache={keys:async()=>Array.from(files.keys(),url=>({url})),match:async request=>files.get(request.url||request),put:async(url,response)=>files.set(url,response)};
const context=vm.createContext({window:{SAHIB_I18N:{language:'en'}},document:{getElementById:id=>id==='ov-offline-books'?modal:id==='offline-ui-body'?body:id==='offline-ui-progress'?progress:null},caches:{open:async()=>cache,delete:async()=>{files.clear();cleared=true;}},navigator:{storage:{estimate:async()=>({quota:100000,usage:1000})}},AbortController,console,confirm:()=>true,toast:message=>messages.push(message),icon:()=>'',esc:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;'),fetch:async url=>{downloads.push(url);return {ok:true,headers:{get:()=>null},blob:async()=>({size:1024}),clone(){return this;}};}});
vm.runInContext(fs.readFileSync('js/books-data.js','utf8')+`;function getBookById(id){return BOOKS.find(b=>b.id===id)};function resolveBookPath(b){return 'https://sahib-proxy.sahib-app.workers.dev/books/'+b.file.split('/').map(encodeURIComponent).join('/')};`+fs.readFileSync('js/offline-books.js','utf8')+fs.readFileSync('js/offline-ui.js','utf8'),context);
const ui=context.window.OFFLINE_UI;
await ui.open();assert(body.innerHTML.includes('All available books'));assert(body.innerHTML.includes('67 of 67'));
await ui.start('library');assert.equal(downloads.length,67);assert.equal(files.size,67);assert(body.innerHTML.includes('Downloaded books'));assert(body.innerHTML.includes('31 Benefits in Contemplating the Quran'));assert(body.innerHTML.includes('0.1 MB'));assert(!downloads.some(url=>/Atomic-Habits|Deep%20Work|Thinking/.test(url)));
await ui.start('library');assert.equal(downloads.length,67);assert(messages.includes('Already cached'));
await ui.clear();assert(cleared&&files.size===0);assert(body.innerHTML.includes('Cached: 0 books'));
context.window.SAHIB_I18N.language='ar';await ui.start('beginner');assert.equal(files.size,10);assert(body.innerHTML.includes('الكتب المنزّلة'));
const view=fs.readFileSync('js/views/books.js','utf8');assert(view.slice(view.indexOf('async function renderDesktopLibrary')).includes('onclick="window.OFFLINE_UI.open()"'));
console.log('Downloads manager: desktop entry, 67 allowed bulk downloads, three exclusions, cache reuse, actual-byte fallback, EN/AR inventory, clear and beginner job passed');
