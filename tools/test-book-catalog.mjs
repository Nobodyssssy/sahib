import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createHash} from 'node:crypto';
const context=vm.createContext({});vm.runInContext(fs.readFileSync('js/books-data.js','utf8')+';globalThis.catalog={categories:BOOK_CATEGORIES,books:BOOKS};',context);
const books=context.catalog.books;
assert.equal(createHash('sha256').update(JSON.stringify(books.filter(b=>b.source==='legacy').map(b=>({id:b.id,file:b.file})))).digest('hex'),'dad49575823f21fa6e7a25c02aa8910880fa1f07dd4aafee52a14cb32d085f19','Legacy ID/path mappings changed; review persistence migration');
assert.equal(new Set(books.map(b=>b.id)).size,books.length);
assert.equal(books.filter(b=>b.readingOrder).length,10);
for(const b of books){assert.equal(b.downloadAllowed,b.rights?.redistribution==='verified'&&!!b.rights.evidence);if(b.file)assert.equal(decodeURIComponent(b.file.split('/').map(encodeURIComponent).join('/')),b.file);}
assert.ok(!fs.readFileSync('sw.js','utf8').includes('const smallBooks'));
console.log('Catalog: stable 70 legacy IDs/URLs, unique IDs, 10 reading-order entries, encoding and rights gates passed');
