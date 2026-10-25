/* Service worker della Beta 4. Cambiare CACHE a ogni rilascio impedisce che
   l'iPad rimanga bloccato su file della versione precedente. */
const CACHE='betabanda-0.4.0';
const FILES=['./','./index.html','./app.js','./v4.js','./style.css','./icon.svg','./manifest.webmanifest','./version.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return; e.respondWith(fetch(e.request).then(r=>{if(r.ok){const clone=r.clone();caches.open(CACHE).then(c=>c.put(e.request,clone))}return r}).catch(()=>caches.match(e.request)))});
