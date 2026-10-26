/**
 * BetaBanda — Verifica OAuth Google.
 *
 * Flusso: pulsante -> Google -> callback Supabase -> ritorno a questa pagina.
 * Supabase JS conserva e rinnova la sessione nel browser.
 * L'identità autenticata NON equivale a un'autorizzazione applicativa:
 * tutte le autorizzazioni saranno verificate dalle policy RLS e dal backend.
 *
 * Dipendenza caricata da CDN ESM. In versione di produzione bloccare la
 * versione, verificare e gestire adeguatamente la distribuzione delle dipendenze.
 */
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const status = document.querySelector('#status');
const details = document.querySelector('#details');
const login = document.querySelector('#login');
const logout = document.querySelector('#logout');

const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(SUPABASE_URL) && SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_');
if (!configured) {
  status.textContent = 'Configurazione mancante: apri config.js e inserisci Project URL e Publishable Key.';
} else {
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const render = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error && error.name !== 'AuthSessionMissingError') {
      status.textContent = 'Errore autenticazione: ' + error.message;
    } else if (user) {
      status.textContent = 'Accesso Google completato correttamente.';
      details.hidden = false;
      details.textContent = 'Utente Supabase ID: ' + user.id + '\nEmail Google: ' + (user.email || 'non disponibile') + '\n\nNon hai ancora il ruolo Master.';
    } else {
      status.textContent = 'Non sei collegato. Premi Accedi con Google per provare.';
      details.hidden = true;
    }
    login.hidden = Boolean(user);
    logout.hidden = !user;
  };
  login.onclick = async () => {
    login.disabled = true;
    status.textContent = 'Apertura di Google…';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if (error) { status.textContent = error.message; login.disabled = false; }
  };
  logout.onclick = async () => { await supabase.auth.signOut(); await render(); };
  await render();
}
