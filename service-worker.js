// Packers Central: update HTML, scripts, styles and SVGs from the network on every navigation.
// Only use the offline cache when the network is unavailable; never prefer an outdated team logo.
const VERSION='packers-central-v14';
const ASSETS=[
  './','./index.html','./schedule.html','./season.html','./matchup.html','./hub.html',
  './styles.css?v=14','./scout.css?v=14','./app.js?v=14','./scout.js?v=14',
  './packers-mark-2026.svg','./packers-icon-2026.svg','./manifest.webmanifest?v=14'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys
    .filter(key=>key.startsWith('packers-central-')&&key!==VERSION)
    .map(key=>caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
  event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{
    if(response.ok&&response.type==='basic'){
      const copy=response.clone();
      event.waitUntil(caches.open(VERSION).then(cache=>cache.put(request,copy)));
    }
    return response;
  }).catch(()=>caches.match(request).then(cached=>cached||Response.error())));
});
