# BetaBanda — consegna tecnica iniziale

## Stato effettivo

Questo pacchetto contiene una **prima PWA dimostrativa funzionante**, senza server né account reali, e uno **schema PostgreSQL iniziale**. NON è il gestionale di produzione. Nessuna funzione di pagamento, accesso reale, invio messaggi, push, condivisione online o liquidazione irrevocabile è attiva.

**Non inserire dati personali veri, password, documenti riservati o importi di pagamenti reali nella demo.** I dati salvati nel browser non sono protetti come un backend autenticato.

## Come provarla sul PC

Apri `web/index.html` in un browser per vedere l'interfaccia. Per provare l'installazione PWA e il service worker devi servirla via HTTPS (ad esempio GitHub Pages) o localhost.

Da un terminale nella cartella `web`:

```bash
python -m http.server 8080
```

Apri `http://localhost:8080`.

Su GitHub Pages: carica il contenuto della cartella `web` nella root del repository o in `/docs` e attiva Pages dalla branch scelta. I percorsi sono relativi, quindi la PWA può essere ospitata anche in una sottocartella.

## Funzioni realmente operative nella demo

- Dashboard con contenuti ed eventi fittizi.
- Menu di tutte le schede pianificate e layout responsive.
- Aggiunta di un evento dimostrativo.
- Prenotazione locale per studio con controllo base di collisione in una stessa aula.
- Cambio tema chiaro/scuro/automatico.
- Regolazione dimensione caratteri 80–150%.
- Salvataggio locale nel browser via localStorage.
- Esportazione JSON e ripristino dei dati fittizi del browser.
- Manifest e predisposizione installazione PWA.

## Non ancora operativo

Database online; login con username/password; almeno un Master reale; ruoli lato server; anagrafiche reali; import CSV/XLS; lezioni; compensi; liquidazioni; prenotazioni condivise; push; chat; documenti; PayPal; Meta; backup integrale indipendente; report Excel/PDF.

## Database

Il file `db/001_schema.sql` è **un modello iniziale**, non una migrazione approvata per la produzione. Rappresenta le entità e i legami fondamentali. Manca il livello di autorizzazioni lato server (RLS), la gestione robusta di collisioni delle aule, le stored procedure atomiche di doppia conferma, la protezione dei record finalizzati, le migrazioni e la configurazione dell'identità senza email. Non applicarlo a un progetto contenente dati reali.

## Decisioni architetturali per la fase successiva

1. Autenticazione username senza obbligo di email, reset da Master e codice di recupero nella beta a Master singolo.
2. 14 flag indipendenti + accesso base senza flag: dashboard pubblica, notizie, concerti e social.
3. Anagrafica generale distinta da account e registri soci annuali.
4. Un calendario centralizzato e un registro economico centrale senza duplicazioni.
5. Pagamenti: l'azione finale richiede Tesoreria; pagamento soci con conferma bilaterale; insegnanti pagati a pacchetti di lezioni.
6. Backup ZIP autosufficiente con LEGGIMI_PRIMA, tabelle aperte, allegati e checksum. Il pulsante di backup effettivo arriverà con il backend.

## Installazione PWA e test

L'icona è temporanea come concordato. La beta grafica definitiva verrà dopo il collaudo. Su iPhone aggiungi la pagina alla schermata Home tramite Safari; su Android tramite Chrome; su PC apri il browser. Al momento i dati della demo non si sincronizzano tra dispositivi.

## Proprietà e continuità

Il codice è in file HTML/CSS/JS leggibili e lo schema in SQL testuale. Conserva lo ZIP sorgente e registra ogni versione. Prima di introdurre dati reali andranno aggiunti test automatizzati, audit trail protetto, backup e politiche GDPR.


## Aggiornamento V2 — Gestione divise

Inclusa la scheda **Gestione divise** nella demo locale: creazione di articoli per taglia, costi/prezzi, giacenze, richieste, conferme di consegna, assegnazioni proprietà banda, vendite proprietà socio, restituzioni riutilizzabili/scarto e registro movimenti. Il 14° ruolo è **Gestore divise**.

Per provarla apri `web/index.html`, scheda **Gestione divise**. Tutti i dati sono simulati e locali al browser. Le vendite NON effettuano pagamenti reali e NON scrivono ancora nella Tesoreria cloud. La procedura guidata al primo accesso socio, il collegamento alle anagrafiche reali, la gestione resi parziali, le richieste di cambio taglia e l'autenticazione/ruoli lato server sono requisiti NON ancora implementati.

Nuovo file `db/002_divise.sql` con schema relazionale, ruoli, varianti, richieste, dotazioni e movimenti stock. Solo specifica per sviluppo: senza policy RLS e API non deve essere esposto a utenti reali.
