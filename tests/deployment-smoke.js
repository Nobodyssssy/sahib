(async()=>{
 const checks=[],check=(name,pass)=>checks.push({name,pass:!!pass});
 const base=new URL('./',location.href),manifestURL=new URL('manifest.webmanifest',base);
 const manifest=await(await fetch(manifestURL)).json();
 check('Manifest start URL',new URL(manifest.start_url,manifestURL).href===base.href);
 check('Manifest scope',new URL(manifest.scope,manifestURL).href===base.href);
 for(const icon of manifest.icons){const response=await fetch(new URL(icon.src,manifestURL));check('Manifest icon '+icon.sizes,response.ok&&response.headers.get('content-type').startsWith('image/'));}
 const registration=await navigator.serviceWorker.ready;
 check('Service-worker scope',registration.scope===base.href);
 check('Service-worker script',registration.active.scriptURL===new URL('sw.js',base).href);
 const names=await caches.keys(),shell=names.find(n=>/^sahib-v/.test(n));
 check('Versioned shell installed',shell==='sahib-v2.13.8');
 const cache=await caches.open(shell),entries=await cache.keys();
 check('Complete app shell',entries.length>=116);
 check('Cached assets stay under app path',entries.every(r=>r.url.startsWith(base.href)));
 check('Offline document',!!await cache.match(new URL('index.html',base)));
 check('Existing IndexedDB contract',(await openDB()).name==='adkar-db');
 await store.setMeta('deploymentVerification','preserved');localStorage.setItem('sahib-deployment-verification','preserved');
 // The proxy remains on its existing origin; request a real library PDF through browser CORS.
 const url=offlineBookUrl('jazariyyah');
 const pdf=await fetch(url);const bytes=new Uint8Array(await pdf.arrayBuffer());
 check('Proxy PDF via CORS',pdf.ok&&String.fromCharCode(...bytes.slice(0,5))==='%PDF-');
 await openReader('jazariyyah');
 check('Vendored PDF reader renders proxy book',_readerTotalPages>0&&document.querySelectorAll('#reader-body canvas').length>0);
 _closeReaderFromHistory();goHomeView();
 check('Dedicated PDF cache preserved',(await caches.keys()).includes('sahib-books'));
 return checks;
})()
