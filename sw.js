/**
 * Service Worker BetaBanda 1.0: aggiornamenti prevedibili, non offline completo.
 * Per HTML/JS/CSS si usa SEMPRE la rete quando disponibile, così una vecchia
 * versione non resta bloccata su iOS. I soli file statici possono essere letti
 * dalla cache in caso di assenza rete; le chiamate Supabase NON si memorizzano.
 */
const CACHE='betabanda-shell-1.0.1';
const SHELL=['./','./index.html','./style.css?v=1.0.1','./app.js?v=1.0.1','./uniforms.js?v=1.0.1','./config.js','./icon.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('betabanda-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
 event.respondWith(fetch(req).then(response=>{
  if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)))}
  return response;
 }).catch(async()=>await caches.match(req)||new Response('Connessione assente: ricarica quando torna la rete.',{status:503})));
});
self.addEventListener('push', event => {
 let data={title:'BetaBanda',body:'Hai una nuova notifica',url:'./'};
 try {if(event.data)data={...data,...event.data.json()}}catch(_){}
 event.waitUntil(self.registration.showNotification(data.title,{body:data.body,icon:'./icon.svg',badge:'./icon.svg',tag:'bb-'+(data.id||Date.now()),data:{url:data.url||'./'}}));
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.openWindow(event.notification.data?.url||'./'))});
