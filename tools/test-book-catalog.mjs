import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createHash} from 'node:crypto';
const context=vm.createContext({});vm.runInContext(fs.readFileSync('js/books-data.js','utf8')+';globalThis.catalog={categories:BOOK_CATEGORIES,books:BOOKS};',context);
const books=context.catalog.books;
assert.equal(createHash('sha256').update(JSON.stringify(books.filter(b=>b.source==='legacy').map(b=>({id:b.id,file:b.file})))).digest('hex'),'dad49575823f21fa6e7a25c02aa8910880fa1f07dd4aafee52a14cb32d085f19','Legacy ID/path mappings changed; review persistence migration');
assert.equal(new Set(books.map(b=>b.id)).size,books.length);
assert.equal(books.filter(b=>b.readingOrder).length,10);
const policy=JSON.parse(fs.readFileSync('catalog/download-policy.json','utf8'));
assert.equal(books.filter(b=>b.downloadAllowed).length,67);
assert.deepEqual(Array.from(books).filter(b=>!b.downloadAllowed).map(b=>b.id).sort(),['atomic-habits','deep-work','thinking-fast-and-slow']);
for(const b of books){assert.equal(b.downloadAllowed,!policy.restrictedIds.includes(b.id)&&((b.rights?.redistribution==='verified'&&!!b.rights.evidence)||(b.source==='legacy'&&policy.legacyDownloadIds.includes(b.id))));if(b.file)assert.equal(decodeURIComponent(b.file.split('/').map(encodeURIComponent).join('/')),b.file);}
assert.ok(!fs.readFileSync('sw.js','utf8').includes('const smallBooks'));
console.log('Catalog: stable 70 legacy IDs/URLs, unique IDs, 10 reading-order entries, encoding and scoped download policy passed');

const cached=new Map();let downloads=0;
const runtime=vm.createContext({window:{},caches:{open:async()=>({match:async url=>cached.get(url),put:async(url,response)=>cached.set(url,response)})},fetch:async()=>{downloads++;return {ok:true,clone(){return this;}};}});
vm.runInContext(fs.readFileSync('js/books-data.js','utf8')+`;function getBookById(id){return BOOKS.find(b=>b.id===id)};function resolveBookPath(b){return 'https://sahib-proxy.sahib-app.workers.dev/books/'+b.file.split('/').map(encodeURIComponent).join('/')};`+fs.readFileSync('js/offline-books.js','utf8'),runtime);
const offline=runtime.window.OFFLINE_BOOKS;
await offline.cacheBookById('tadabbur-quran');assert.equal(downloads,1);
await offline.cacheBookById('tadabbur-quran');assert.equal(downloads,1);
for(const id of policy.restrictedIds){
 await assert.rejects(offline.cacheBookById(id),/permission/);assert.equal(downloads,1);
 cached.set(offline.offlineBookUrl(id),{cached:true});
 assert.equal((await offline.cacheBookById(id)).skipped,true);assert.equal(downloads,1);
}
console.log('Offline runtime: legacy fetch, cache reuse, all three exclusions without network, and existing restricted caches passed');
