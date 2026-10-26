/**
 * BetaBanda - Edge Function di invio notifiche Web Push.
 * Esempio di implementazione: VA DISTRIBUITO e configurato a parte.
 * Il payload del webhook PostgreSQL contiene {type,table,record}.
 * La password PUSH_WEBHOOK_SECRET impedisce chiamate arbitrarie.
 * NON mettere VAPID_PRIVATE_KEY, SERVICE_ROLE_KEY né segreti nel browser.
 */
import webpush from 'npm:web-push@3.6.7';
import {createClient} from 'npm:@supabase/supabase-js@2.49.4';

Deno.serve(async req => {
 if(req.method !== 'POST') return new Response('Method not allowed',{status:405});
 const secret=Deno.env.get('PUSH_WEBHOOK_SECRET');
 if(!secret || req.headers.get('x-bb-secret')!==secret) return new Response('Forbidden',{status:403});
 const vapidPublic=Deno.env.get('VAPID_PUBLIC_KEY');
 const vapidPrivate=Deno.env.get('VAPID_PRIVATE_KEY');
 const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 const url=Deno.env.get('SUPABASE_URL');
 if(!vapidPublic||!vapidPrivate||!serviceKey||!url) return new Response('Missing configuration',{status:500});
 const payload=await req.json();
 if(payload.type!=='INSERT'||payload.table!=='bb_notifications'||!payload.record?.recipient_id)
   return new Response('Ignored',{status:200});
 const notification=payload.record;
 const admin=createClient(url,serviceKey);
 const {data:targets,error}=await admin.from('bb_push_subscriptions')
   .select('id,subscription').eq('account_id',notification.recipient_id);
 if(error) return new Response('Database error',{status:500});
 webpush.setVapidDetails('mailto:admin@example.invalid',vapidPublic,vapidPrivate);
 let delivered=0;
 for(const target of targets||[]){
  try{
   await webpush.sendNotification(target.subscription,JSON.stringify({
    id:notification.id,title:notification.title,body:notification.body,url:'/BetaBanda/'
   }));delivered++;
  }catch(e){
   // Le sottoscrizioni revocate (410/404) vanno cancellate: il dispositivo
   // dovrà richiedere nuovamente il permesso al successivo utilizzo.
   if(e?.statusCode===410||e?.statusCode===404)
     await admin.from('bb_push_subscriptions').delete().eq('id',target.id);
   else console.error('Web Push error',e?.statusCode||String(e));
  }
 }
 return new Response(JSON.stringify({delivered}),{headers:{'content-type':'application/json'}});
});
