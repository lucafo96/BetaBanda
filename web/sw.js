/* BETABANDA PUSH SERVICE WORKER
 * Riceve notifiche dal servizio Supabase Edge Function.
 * Non contiene token, password o chiavi server.
 */
self.addEventListener('push', event => {
  let data={title:'BetaBanda',body:'Hai una nuova notifica',url:'./'};
  try { if(event.data) data={...data,...event.data.json()}; } catch (_) {}
  event.waitUntil(self.registration.showNotification(data.title, {
    body:data.body, icon:'./icon.svg', badge:'./icon.svg',
    tag:'bb-'+(data.id||Date.now()), data:{url:data.url||'./'}
  }));
});
self.addEventListener('notificationclick', event => {
 event.notification.close();
 event.waitUntil(clients.openWindow(event.notification.data?.url||'./'));
});
