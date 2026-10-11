// Packers Central: update HTML, scripts, styles and SVGs from the network on every navigation.
// Only use the offline cache when the network is unavailable; never prefer an outdated team logo.
const VERSION='packers-central-v16';
const ASSETS=[
  './','./index.html','./schedule.html','./season.html','./matchup.html','./seventeen.html','./hub.html',
  './styles.css?v=15','./scout.css?v=15','./app.js?v=15','./scout.js?v=15','./seventeen.css?v=1','./seventeen.js?v=2',
  './data/draft-1999-2002.json','./data/draft-2003-2006.json','./data/draft-2007-2010.json',
  './data/draft-2011-2014.json','./data/draft-2015-2017.json','./data/draft-2018-2021.json','./data/draft-2022-2025.json',
  './packers-mark-2026.svg','./packers-icon-2026.svg','./manifest.webmanifest?v=15'
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
