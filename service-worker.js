const VERSION='packers-central-v10';
const ASSETS=['./','./index.html','./schedule.html','./season.html','./hub.html','./styles.css','./app.js','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(x=>x!==VERSION).map(x=>caches.delete(x)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;
 const url=new URL(e.request.url);
 if(url.pathname.includes('/data/')){
   e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{if(r.ok)caches.open(VERSION).then(c=>c.put(e.request,r.clone()));return r;}).catch(()=>caches.match(e.request)));
   return;
 }
 e.respondWith(fetch(e.request).then(r=>{if(r.ok&&r.type==='basic')caches.open(VERSION).then(c=>c.put(e.request,r.clone()));return r;}).catch(()=>caches.match(e.request)));
});