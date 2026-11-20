const CACHE_NAME='kbr-recipe-menu-shell-sync-v11-update-guard-v3-offline-nav-v1-ingredient-remap-v1-remap-recovery-v2-remap-panes-v3-remap-progress-v4-remap-selected-v5-remap-colors-v6-remap-compact-v7-remap-save-return-v8-remap-toast-v9-remap-unmark-v10-linked-drinks-v11';const FILES=["./page-tools.js?v=recipe-recovery-v2","./page-tools.css",'./','./index.html','./recipe.html','./costing.html','./styles.css?v=remap-v10','./app.js?v=remap-recovery-v2','./recipe-menu-management.js?v=3-photo-editor','./costing.js?v=remap-v1','./ingredient-remapping.js?v=11','./sync-config.js','./sync-core.js?v=recipe-session-v2','./sync-login.html','./sync.css','./recipe-update.js','./excel-recipes.json'];self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(FILES.map(url=>new Request(url,{cache:'reload'}))))));self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting();});self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('kbr-recipe-')&&k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',event=>{
 const u=new URL(event.request.url),scope=new URL(self.registration.scope);
 if(event.request.method!=='GET'||u.origin!==scope.origin||!u.pathname.startsWith(scope.pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE_NAME);
  const navigation=event.request.mode==='navigate';
  if(navigation){
   try{const response=await fetch(event.request,{cache:'no-store'});if(response.ok)await cache.put(event.request,response.clone());return response;}
   catch(error){
    const exact=await cache.match(event.request);if(exact)return exact;
    const clean=new URL(u);clean.search='';clean.hash='';
    const saved=await cache.match(clean.href);if(saved)return saved;
    const alias=new URL(clean.href);if(alias.pathname.endsWith('/'))alias.pathname+='index.html';else if(!/\.[a-z0-9]+$/i.test(alias.pathname))alias.pathname+='.html';
    const fallback=await cache.match(alias.href);if(fallback)return fallback;
    return new Response('<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><h2>Offline</h2><p>Open this page online once before using it offline.</p>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});
   }
  }
  const saved=await cache.match(event.request);if(saved)return saved;
  const response=await fetch(event.request);if(response.ok)await cache.put(event.request,response.clone());return response;
 })());
});
