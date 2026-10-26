# BetaBanda 0.6.0 — Beta condivisa online

## Stato reale

- Supabase Auth Google e le funzioni 0.5 rimangono operative.
- Chat: ricerca destinatari **tra account attivi registrati**, invio e lettura messaggi salvati nel database, notifiche **interne** alla ricezione.
- Schede di lavoro sperimentali online: Tesoreria, Scuola, Divise, Progetti, Prenotazioni, Media, Banda, Famiglie. Sono archivi condivisi di **prova**, non i processi gestionali definitivi.
- Push: service worker, registrazione della sottoscrizione e funzione server forniti. **Le push sul telefono non arrivano finché la funzione e un webhook sicuro non sono configurati.**
- Grafica: volutamente provvisoria. Non usare dati personali reali o contabilizzare pagamenti veri.

## Installazione

1. Supabase → SQL Editor → New query: eseguire `db/005_moduli_chat_push.sql` **una volta**, dopo lo script `004` già applicato. Non ripetere `004` e non cancellare tabelle.
2. Lasciare inalterati i valori Supabase già corretti nel `web/config.js` **locale** (URL + `sb_publishable_`). Sostituire nel repository GitHub Pages i file dell'app con il contenuto di `web/`.
3. Aprire `https://lucafo96.github.io/BetaBanda/`, forzare aggiornamento (Ctrl+Shift+R), verificare che in fondo compaia `0.6.0`.
4. Test: due account Google distinti e attivi. Ricercare nella Chat almeno 2 lettere dello username del destinatario, inviare un messaggio. Sul secondo account aprire Impostazioni per consultare le notifiche interne e Chat per rispondere. Non occorre il flag `member` per chattare; serve account registrato.
5. Per provare i moduli, assegnare all'amico i flag appropriati nel pannello Master; **Tesoreria richiede sempre `treasury`** anche per il Master. Tutti i dati sperimentali sono memorizzati in `bb_work_items`.

## Push su telefono — attivazione separata

1. Generare una coppia di chiavi VAPID con un generatore affidabile (es. `npx web-push generate-vapid-keys` su una macchina fidata). Salvare la private key **solo** come segreto di Supabase Edge Functions.
2. Impostare la chiave **pubblica** in `web/push-config.js`. Mai includere la private key o `service_role` nei file pubblicati su GitHub.
3. Modificare l'indirizzo `mailto:` dell'Edge Function con un indirizzo tecnico valido. Distribuire `edge-functions/push-notify/index.ts` come funzione Supabase `push-notify`. Impostare segreti `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PUSH_WEBHOOK_SECRET` (segreto robusto) e verificare `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` assegnati all'ambiente funzione.
4. Impostare autenticazione della Edge Function e del webhook secondo la documentazione corrente Supabase: il codice verifica `x-bb-secret`; il webhook deve trasmetterlo. Non disabilitare protezioni o esporre segreti per risolvere un errore.
5. Configurare **Database Webhooks** in Supabase: INSERT su `public.bb_notifications` → funzione `push-notify`, intestazione `x-bb-secret` uguale a `PUSH_WEBHOOK_SECRET`.
6. Su iOS/iPadOS, aprire il sito in Safari e usare «Aggiungi a schermata Home», poi **dall'app installata** aprire Impostazioni e autorizzare le push. Su Android e desktop usare un browser compatibile.
7. Collaudare end-to-end **prima di dichiarare push operative**. In caso di errori controllare i log Edge Function e database. La possibilità di ricevere push dipende da OS, autorizzazioni, rete e configurazione browser.

## Limitazioni dichiarate

- Chat testuale 1:1; ancora senza allegati, ricerca avanzata o gruppi. Nessuna notifica push senza configurazione dell'invio remoto.
- Le schede `bb_work_items` non bloccano liquidazioni, magazzino negativo o appuntamenti sovrapposti: perciò **non gestiscono ancora operazioni definitive**.
- Le notifiche interne si vedono nella pagina Impostazioni ricaricandola; non c'è ancora aggiornamento realtime.
- La visualizzazione delle anagrafiche resta limitata al Master e Soci master. La relazione genitore/figlio è dimostrativa, **non** concede deleghe operative.
- Prima di dati reali: backup, privacy, validazione dei permessi per ogni modulo e collaudo dispositivi.

## Manutenzione

- `web/app.js`: componenti applicativi, con funzioni commentate. `MODULES` definisce il prototipo dei moduli.
- `db/005_moduli_chat_push.sql`: strutture, vincoli, policy RLS (prima barriera di sicurezza).
- `web/sw.js`: visualizzazione notifiche push.
- `edge-functions/push-notify/index.ts`: invio push server-side opzionale; **non** può girare dentro GitHub Pages.
- Tutte le modifiche allo schema devono essere nuove migrazioni numerate e documentate. **Non eliminare l'archivio esistente.**
