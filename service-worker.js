const CACHE='kbr-recipe-cloud-v2-frappe-sizes';
const FILES=['./','index.html','styles.css?v=row-editor-5','recipe-cloud.css','data.js','ingredients.js?v=row-editor-5','rows.js?v=row-editor-5','app.js?v=row-editor-5','recipe-model.js','sync-config.js','sync-core.js','sync.css','sync-login.html','recipe-cloud.js','recipe-update.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('kbr-recipe-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(response=>{if(response.ok&&new URL(e.request.url).pathname.includes('/images/')){const copy=response.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return response;})));});
