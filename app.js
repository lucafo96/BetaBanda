/**
 * BETABANDA 0.5 - BETA ONLINE
 * ===========================
 * Questa beta usa davvero Supabase/PostgreSQL. Non contiene dataset locali
 * fittizi: ogni modifica avvenuta con successo viene salvata sul server.
 *
 * Sicurezza: le verifiche JavaScript migliorano solo l'interfaccia.
 * I permessi REALI sono sempre verificati dalle policy SQL in 004_beta_online.sql.
 * Una persona senza flag non può assegnarsene uno modificando il browser.
 *
 * Moduli volutamente rimandati: pagamenti, chat, scuola, divise, minorenni.
 * Non simulare come reali funzioni che ancora non hanno un backend protetto.
 */
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './config.js';

const $=id=>document.getElementById(id), main=$('main'), nav=$('nav');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const configured=/^https:\/\/[\w-]+\.supabase\.co\/?$/.test(SUPABASE_URL)&&SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_');
const db=configured?createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY):null;
let user=null,account=null,roles=[],tab='dashboard',events=[],rooms=[];
const can=r=>roles.includes(r),master=()=>can('total_master');
const aware=e=>{if(e)throw e};
function inform(message,error=false){$('alert').textContent=message;$('alert').className=error?'error':'';if(message)setTimeout(()=>{if($('alert').textContent===message)$('alert').textContent=''},6500)}
const safe=fn=>async(...args)=>{try{await fn(...args)}catch(e){console.error(e);inform(e.message||String(e),true)}};
const field=(name,label,type='text',value='',extra='')=>`<div><label for="${name}">${label}</label><input id="${name}" type="${type}" value="${esc(value)}" ${extra}></div>`;
function links(){const items=[['dashboard','Dashboard'],['events','Calendario']];if(master()||roles.some(r=>['member','members_master','school_master','teacher','band_manager'].includes(r)))items.push(['rooms','Aule']);if(master()||can('members_master'))items.push(['people','Anagrafica']);if(master())items.push(['master','Master']);items.push(['about','Moduli in sviluppo']);nav.innerHTML=items.map(([key,title])=>`<button class="${tab===key?'active':''}" data-tab="${key}">${title}</button>`).join('');nav.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render()})}
function entry(title,content){main.innerHTML=`<h1>${title}</h1>${content}`}
async function current(){
 const {data:{user:u},error}=await db.auth.getUser();if(error&&error.name!=='AuthSessionMissingError')throw error;user=u;
 account=null;roles=[];
 if(user){
   const res=await db.from('bb_accounts').select('id,username,status').eq('auth_user_id',user.id).maybeSingle();aware(res.error);account=res.data;
   if(account){const r=await db.from('bb_account_roles').select('role_code').eq('account_id',account.id);aware(r.error);roles=r.data.map(x=>x.role_code)}
 }
 $('who').textContent=user?(account?account.username:user.email):'Visitatore';$('signout').hidden=!user;
}
async function getEvents(){const {data,error}=await db.from('bb_events').select('id,title,kind,starts_at,ends_at,notes,is_public,room_id').gte('starts_at',new Date(Date.now()-14*864e5).toISOString()).order('starts_at').limit(100);aware(error);events=data}
async function getRooms(){if(!user||!(master()||roles.some(r=>['member','members_master','school_master','teacher','band_manager'].includes(r)))){rooms=[];return}const {data,error}=await db.from('bb_rooms').select('id,name,description,active').order('name');aware(error);rooms=data}
const fmtDate=s=>new Date(s).toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short'});
function showDashboard(){
 const upcoming=events.filter(x=>new Date(x.ends_at)>new Date()).slice(0,8);
 entry('Dashboard',`<section><h2>Prossimi eventi</h2><p class="muted">Il calendario mostra solo i contenuti consentiti dal tuo account.</p>${upcoming.length?upcoming.map(e=>`<p><span class="tag">${esc(e.kind)}</span> <b>${esc(e.title)}</b> — ${fmtDate(e.starts_at)}</p>`).join(''):'<p>Nessun evento in programma.</p>'}<button id="openCalendar">Apri calendario</button></section>
 <div class="grid"><section><h2>Accesso</h2><p>${user?'Connesso con Google.':'Visitatore, visualizzi solo eventi pubblici.'}</p><p>${roles.length?'Permessi: '+roles.map(esc).join(', '):'Nessun flag autorizzato'}</p></section>
 <section><h2>Sede</h2><p>${user?'Aule configurate: '+rooms.filter(r=>r.active).length:'Accesso alle aule riservato agli utenti registrati.'}</p></section></div>`);
 $('openCalendar').onclick=()=>{tab='events';render()};
}
function showEvents(){
 const editable=master()||can('band_manager');
 entry('Calendario eventi',`<section><p>Concerti e servizi pubblicabili sono visibili anche senza login. Prove e appuntamenti interni solo ai ruoli autorizzati.</p><div class="tablewrap"><table><tr><th>Data</th><th>Tipo</th><th>Evento</th><th>Luogo / Aula</th><th>Pubblico</th><th></th></tr>${events.map(e=>`<tr><td>${fmtDate(e.starts_at)}</td><td>${esc(e.kind)}</td><td>${esc(e.title)}</td><td>${esc(rooms.find(r=>r.id===e.room_id)?.name||e.notes||'—')}</td><td>${e.is_public?'Sì':'No'}</td><td>${editable?`<button data-edit-event="${e.id}">Modifica</button>`:''}</td></tr>`).join('')}</table></div></section>`+(editable?`<section><h2 id="eventTitle">Nuovo evento</h2><form id="eventForm"><input id="eventId" type="hidden"><div class="fields">${field('eventName','Titolo')}
 <div><label for="eventKind">Tipo</label><select id="eventKind"><option value="concerto">Concerto</option><option value="servizio">Servizio musicale</option><option value="prova">Prova</option><option value="altro">Altro</option></select></div>
 ${field('eventStart','Inizio','datetime-local')}${field('eventEnd','Fine','datetime-local')}
 <div><label for="eventRoom">Aula / locale</label><select id="eventRoom"><option value="">Nessuna</option>${rooms.filter(x=>x.active).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></div>
 ${field('eventNotes','Luogo esterno / note')}</div><p><label><input type="checkbox" style="width:auto" id="eventPublic"> Visibile pubblicamente (solo concerti e servizi)</label></p><button class="primary" type="submit">Salva evento online</button><button type="button" id="eventClear">Nuovo</button></form></section>`:''));
 if(editable){
  function edit(id){const e=events.find(x=>x.id===id);$('eventTitle').textContent=e?'Modifica evento':'Nuovo evento';$('eventId').value=e?.id||'';$('eventName').value=e?.title||'';$('eventKind').value=e?.kind||'concerto';$('eventStart').value=e?.starts_at?new Date(e.starts_at).toLocaleString('sv-SE').replace(' ','T').slice(0,16):'';$('eventEnd').value=e?.ends_at?new Date(e.ends_at).toLocaleString('sv-SE').replace(' ','T').slice(0,16):'';$('eventRoom').value=e?.room_id||'';$('eventNotes').value=e?.notes||'';$('eventPublic').checked=!!e?.is_public;}
  document.querySelectorAll('[data-edit-event]').forEach(b=>b.onclick=()=>edit(b.dataset.editEvent));$('eventClear').onclick=()=>edit();
  $('eventForm').onsubmit=safe(async ev=>{ev.preventDefault();const id=$('eventId').value;const kind=$('eventKind').value;const record={title:$('eventName').value.trim(),kind,starts_at:new Date($('eventStart').value).toISOString(),ends_at:new Date($('eventEnd').value).toISOString(),room_id:$('eventRoom').value||null,notes:$('eventNotes').value,is_public:['concerto','servizio'].includes(kind)&&$('eventPublic').checked};if(!id)record.created_by=user.id;
   const res=id?await db.from('bb_events').update(record).eq('id',id):await db.from('bb_events').insert(record);aware(res.error);inform('Evento salvato nel database online');await refresh()});
 }
}
function showRooms(){entry('Aule',`<section><p>Le aule sono conservate nel database condiviso. Soltanto il Master può crearle, rinominarle o disattivarle.</p><div class="tablewrap"><table><tr><th>Nome</th><th>Descrizione</th><th>Attiva</th><th></th></tr>${rooms.map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(r.description)}</td><td>${r.active?'Sì':'No'}</td><td>${master()?`<button data-room="${r.id}">Modifica</button>`:''}</td></tr>`).join('')}</table></div></section>`+(master()?`<section><h2 id="roomTitle">Nuova aula</h2><form id="roomForm"><input type="hidden" id="roomId"><div class="fields">${field('roomName','Nome aula')}${field('roomDescription','Descrizione')}</div><p><label><input type="checkbox" id="roomActive" style="width:auto" checked> Aula attiva</label></p><button class="primary">Salva online</button> <button type="button" id="clearRoom">Nuova</button></form></section>`:''));
 if(master()){
  function edit(id){const r=rooms.find(x=>x.id===id);$('roomId').value=id||'';$('roomTitle').textContent=id?'Modifica aula':'Nuova aula';$('roomName').value=r?.name||'';$('roomDescription').value=r?.description||'';$('roomActive').checked=r?.active??true}
  document.querySelectorAll('[data-room]').forEach(b=>b.onclick=()=>edit(b.dataset.room));$('clearRoom').onclick=()=>edit();
  $('roomForm').onsubmit=safe(async e=>{e.preventDefault();const data={name:$('roomName').value.trim(),description:$('roomDescription').value,active:$('roomActive').checked},id=$('roomId').value;const res=id?await db.from('bb_rooms').update(data).eq('id',id):await db.from('bb_rooms').insert(data);aware(res.error);inform('Aula salvata online');await refresh()});
 }
}
async function showPeople(){const {data,error}=await db.from('bb_people').select('*').order('last_name').limit(500);aware(error);
 entry('Anagrafica',`<section><p>Anagrafiche condivise online. Gli account Google sono separati dalle schede delle persone.</p><div class="tablewrap"><table><tr><th>Cognome e nome</th><th>Nascita</th><th>Telefono</th><th></th></tr>${data.map(p=>`<tr><td>${esc(p.last_name)} ${esc(p.first_name)}</td><td>${esc(p.birth_date)}</td><td>${esc(p.phone)}</td><td><button data-person="${p.id}">Apri scheda</button></td></tr>`).join('')}</table></div></section>
 <section><h2 id="personTitle">Nuova scheda</h2><form id="personForm"><input type="hidden" id="personId"><div class="fields">${field('first','Nome')}${field('last','Cognome')}${field('birth','Data di nascita','date')}${field('phone','Telefono')}${field('email','Email','email')}${field('address','Indirizzo')}${field('joined','Ingresso associazione','date')}</div><button class="primary">Salva anagrafica</button> <button type="button" id="clearPerson">Nuova</button></form></section>`);
 function edit(id){const p=data.find(x=>x.id===id);$('personTitle').textContent=p?'Modifica scheda':'Nuova scheda';$('personId').value=p?.id||'';for(const [node,key] of [['first','first_name'],['last','last_name'],['birth','birth_date'],['phone','phone'],['email','email'],['address','address'],['joined','association_join_date']])$(node).value=p?.[key]||''}
 document.querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>edit(b.dataset.person));$('clearPerson').onclick=()=>edit();
 $('personForm').onsubmit=safe(async ev=>{ev.preventDefault();const id=$('personId').value;const record={first_name:$('first').value.trim(),last_name:$('last').value.trim(),birth_date:$('birth').value,phone:$('phone').value||null,email:$('email').value||null,address:$('address').value||null,association_join_date:$('joined').value||null,updated_at:new Date().toISOString()};const res=id?await db.from('bb_people').update(record).eq('id',id):await db.from('bb_people').insert(record);aware(res.error);inform('Anagrafica salvata online');await refresh()});
}
async function showMaster(){const [a,r]=await Promise.all([db.from('bb_accounts').select('id,username,status,auth_user_id').order('created_at'),db.from('bb_account_roles').select('account_id,role_code')]);aware(a.error);aware(r.error);
 entry('Master — Utenti e permessi',`<section><p>Gli amici accedono con Google, scelgono uno username e appaiono qui. Senza flag hanno accesso soltanto ai contenuti pubblici.</p><div class="tablewrap"><table><tr><th>Account</th><th>Stato</th><th>Flag attuali</th><th></th></tr>${a.data.map(x=>`<tr><td>${esc(x.username)}</td><td>${esc(x.status)}</td><td>${r.data.filter(z=>z.account_id===x.id).map(z=>esc(z.role_code)).join(', ')||'—'}</td><td><button data-account="${x.id}">Permessi</button></td></tr>`).join('')}</table></div></section><section id="rolesSection"><p>Seleziona un account per modificare i suoi flag.</p></section>`);
 const {data:allRoles,error}=await db.from('bb_roles').select('code,display_name').order('display_name');aware(error);
 document.querySelectorAll('[data-account]').forEach(b=>b.onclick=()=>{const id=b.dataset.account,x=a.data.find(z=>z.id===id),set=new Set(r.data.filter(z=>z.account_id===id).map(z=>z.role_code));$('rolesSection').innerHTML=`<h2>Permessi di ${esc(x.username)}</h2><p>Le modifiche diventano effettive al prossimo caricamento dell'account.</p>${allRoles.map(p=>`<label style="margin:6px 0;font-weight:400"><input type="checkbox" style="width:auto" data-role="${esc(p.code)}" ${set.has(p.code)?'checked':''}> ${esc(p.display_name)}</label>`).join('')}`;
 $('rolesSection').querySelectorAll('[data-role]').forEach(c=>c.onchange=safe(async()=>{const res=await db.rpc('bb_set_role',{p_account_id:id,p_role:c.dataset.role,p_enabled:c.checked});aware(res.error);inform('Permesso aggiornato su Supabase');await showMaster()}));
 });
}
function showAbout(){entry('Moduli in sviluppo',`<section><p><b>Questa è una beta online parziale:</b> autenticazione Google, account, ruoli, anagrafiche, aule ed eventi sono realmente collegati a Supabase.</p><p>Non sono ancora operative: Tesoreria, pagamenti, chat, scuola, divise, deleghe genitori, backup completo e prenotazione aule. Per queste funzioni sono necessari ulteriori tabelle, policy e collaudi.</p><p>Non inserire informazioni personali reali finché non avremo completato i controlli privacy e le procedure di backup.</p></section>`)}
function showSignup(){entry('Completa il primo accesso',`<section><p>Accesso Google riuscito. Scegli il tuo username BetaBanda: il tuo account verrà creato <b>senza flag</b>. Solo il Master può concederti autorizzazioni.</p><form id="signup"><div class="fields">${field('newUser','Username BetaBanda','text','','required minlength="3" maxlength="60"')}</div><button class="primary">Crea account</button></form></section>`);
 $('signup').onsubmit=safe(async e=>{e.preventDefault();const res=await db.rpc('bb_register_account',{p_username:$('newUser').value.trim()});aware(res.error);inform('Account creato online');await refresh()});}
async function render(){links();if(!user){tab='dashboard'}else if(!account){nav.innerHTML='';showSignup();return}
 if(tab==='dashboard')showDashboard();else if(tab==='events')showEvents();else if(tab==='rooms'&&(master()||roles.some(r=>['member','members_master','school_master','teacher','band_manager'].includes(r))))showRooms();else if(tab==='people'&&(master()||can('members_master')))await showPeople();else if(tab==='master'&&master())await showMaster();else if(tab==='about')showAbout();else{tab='dashboard';showDashboard()}}
async function refresh(){await current();await getRooms();await getEvents();await render()}
$('signout').onclick=safe(async()=>{await db.auth.signOut();tab='dashboard';await refresh()});
async function initialize(){if(!configured){entry('Configurazione mancante',`<section>Inserisci Project URL e Publishable Key in <code>config.js</code>, poi ricarica la pagina.</section>`);return}
 await refresh();if(!user){entry('Benvenuto in BetaBanda',`<section><p>Puoi consultare gli eventi pubblici senza login, oppure accedere con Google per utilizzare i moduli abilitati.</p><button class="primary" id="login">Accedi con Google</button></section><section><h2>Eventi pubblici</h2>${events.length?events.map(x=>`<p><b>${esc(x.title)}</b> — ${fmtDate(x.starts_at)}</p>`).join(''):'Nessun evento pubblico inserito.'}</section>`);
 $('login').onclick=safe(async()=>{const res=await db.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}});aware(res.error)});nav.innerHTML='<button id="publicEvents">Calendario pubblico</button>';$('publicEvents').onclick=()=>{tab='events';showEvents()};}
}
initialize().catch(e=>{console.error(e);inform(e.message,true);entry('Errore di collegamento',`<section><p>${esc(e.message)}</p><p>Verifica la migrazione SQL 004 e le impostazioni di Supabase.</p></section>`)});
