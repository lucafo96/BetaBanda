/**
 * BETABANDA 0.9 - BETA ONLINE
 * ===========================
 * Questa beta usa davvero Supabase/PostgreSQL. Non contiene dataset locali
 * fittizi: ogni modifica avvenuta con successo viene salvata sul server.
 *
 * Sicurezza: le verifiche JavaScript migliorano solo l'interfaccia.
 * I permessi REALI sono sempre verificati dalle policy SQL in 004_beta_online.sql.
 * Una persona senza flag non può assegnarsene uno modificando il browser.
 *
 * Chat e moduli di PROVA hanno tabelle online e policy RLS dedicate.
 * Nessuna scrittura in Tesoreria equivale a un incasso o a una liquidazione reale.
 */
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './config.js';

const $=id=>document.getElementById(id), main=$('main'), nav=$('nav');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const configured=/^https:\/\/[\w-]+\.supabase\.co\/?$/.test(SUPABASE_URL)&&SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_');
const db=configured?createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY):null;
let user=null,account=null,roles=[],tab='dashboard',events=[],rooms=[];
let chatTarget=null;
const VERSION='1.0.0';
const dashCache={};
const localPrefKey='bb09-preferences';
function prefs(){try{return {...JSON.parse(localStorage.getItem('bb08-preferences')||'{}'),...JSON.parse(localStorage.getItem(localPrefKey)||'{}')}}catch{return {}}}
async function savePrefs(value){
 // Salviamo subito localmente per funzionare anche senza rete.
 const next={...prefs(),...value};localStorage.setItem(localPrefKey,JSON.stringify(next));
 // La migrazione 008 aggiunge un record per account: ritroviamo il tema su altri dispositivi.
 if(account){const r=await db.from('bb_user_prefs').upsert({account_id:account.id,prefs:next,updated_at:new Date().toISOString()});if(r.error)console.warn('Preferenze non sincronizzate:',r.error.message)}
}
async function loadRemotePrefs(){if(!account)return;const r=await db.from('bb_user_prefs').select('prefs').eq('account_id',account.id).maybeSingle();if(r.data?.prefs){localStorage.setItem(localPrefKey,JSON.stringify(r.data.prefs));applyAccessibility()}}

function applyAccessibility(){const p=prefs();document.documentElement.style.setProperty('--font-scale', String(Math.max(.8,Math.min(2,Number(p.scale)||1))));document.documentElement.dataset.font=p.font||'system';document.documentElement.dataset.contrast=p.contrast?'high':'normal';document.documentElement.dataset.theme=p.theme||'dark'}
applyAccessibility();
const can=r=>roles.includes(r),master=()=>can('total_master');
const aware=e=>{if(e)throw e};
function inform(message,error=false){$('alert').textContent=message;$('alert').className=error?'error':'';if(message)setTimeout(()=>{if($('alert').textContent===message)$('alert').textContent=''},6500)}
const safe=fn=>async(...args)=>{try{await fn(...args)}catch(e){console.error(e);inform(e.message||String(e),true)}};
const field=(name,label,type='text',value='',extra='')=>`<div><label for="${name}">${label}</label><input id="${name}" type="${type}" value="${esc(value)}" ${extra}></div>`;
/**
 * MENU DUE GRUPPI: la navigazione viene filtrata dalle autorizzazioni;
 * l'interfaccia non sostituisce MAI le policy RLS del database.
 * Il menu resta chiuso di default, per lasciare spazio alle tile.
 */
function allowedPages(){
 const items=[['dashboard','Dashboard','user'],['events','Calendario completo','user']];
 if(master()||roles.some(r=>['member','members_master','school_master','teacher','band_manager'].includes(r)))items.push(['rooms','Gestione aule','admin']);
 if(master()||can('members_master'))items.push(['people','Anagrafica','admin']);
 if(can('member')||can('musician_member'))items.push(['myuniform','La mia dotazione','user']);
 if(master())items.push(['master','Utenti e permessi','admin']);
 for(const [key,label,role] of [['treasury','Tesoreria','treasury'],['school','Scuola di musica','teacher'],['uniforms','Divise','uniform_manager'],['projects','Progetti','council'],['bookings','Prenotazioni','member'],['media','Media','media_manager'],['band','Attività banda','band_manager'],['family','Famiglie','school_master']]){
  if(can(role)||(master()&&key!=='treasury')||(key==='school'&&can('school_master'))||(key==='band'&&can('conductor'))||(key==='projects'&&can('treasury'))){
   if(key==='uniforms')items.push([key,'Gestione divise','admin']);
   else if(key==='school')items.push([key,'Scuola di musica','user']);
   else items.push([key,label,'user']);
   if(['treasury','projects','media','band'].includes(key))items.push([key,label+' · Gestione','admin']);
  }
 }
 items.push(['about','Stato dei moduli','user']);return items;
}
function navigate(key){tab=key;document.querySelector('#menuPopover')?.setAttribute('hidden','');render()}
function links(){
 const items=allowedPages();
 nav.innerHTML=`<div class="nav-group"><h3>Consultazione e utilizzo</h3>${items.filter(x=>x[2]==='user').map(([key,title])=>`<button class="${tab===key?'active':''}" data-tab="${key}">${esc(title)}</button>`).join('')}</div><div class="nav-group"><h3>Amministrazione e Master</h3>${items.filter(x=>x[2]==='admin').map(([key,title])=>`<button class="${tab===key?'active':''}" data-tab="${key}">${esc(title)}</button>`).join('')||'<p class="muted">Nessuna funzione assegnata.</p>'}</div><div class="nav-bottom"><button data-tab="settings">⚙ Impostazioni</button><button id="menuSignout" ${user?'':'hidden'}>Esci dall’account</button></div>`;
 nav.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>navigate(b.dataset.tab));
 const out=$('menuSignout');if(out)out.onclick=safe(async()=>{await db.auth.signOut();tab='dashboard';await refresh()});
}
/** Contatori live da Supabase: messaggi non letti e AVVISI non-chat. */
async function updateBadges(){
 let messages=0,notices=0;
 if(account){
  const [m,n]=await Promise.all([
   db.from('bb_messages').select('id',{count:'exact',head:true}).eq('recipient_id',account.id).is('read_at',null),
   db.from('bb_notifications').select('id',{count:'exact',head:true}).eq('recipient_id',account.id).is('seen_at',null).neq('kind','chat')
  ]);
  if(!m.error)messages=m.count||0;
  if(!n.error)notices=n.count||0;
 }
 for(const [id,num] of [['chatBadge',messages],['noticeBadge',notices]]){
  const el=$(id);if(!el)continue;el.textContent=num>99?'99+':String(num);el.hidden=num===0;
 }
}
async function showNotifications(){
 if(!account){entry('Notifiche','<section>Accedi per vedere le notifiche personali.</section>');return}
 const r=await db.from('bb_notifications').select('title,body,kind,created_at,seen_at').eq('recipient_id',account.id).neq('kind','chat').order('created_at',{ascending:false}).limit(80);aware(r.error);
 entry('Notifiche',`<section><h2>Avvisi dell’applicazione</h2><p><button id="markNotices" type="button">Segna tutte come lette</button></p><p class="muted">I messaggi privati sono conteggiati separatamente nella Chat.</p>${r.data?.map(x=>`<article class="notice-row"><b>${esc(x.title)}</b><p>${esc(x.body)}</p><small>${fmtDate(x.created_at)}${x.seen_at?' · Letta':' · Da leggere'}</small></article>`).join('')||'<p>Nessun avviso.</p>'}</section>`);
 const mark=$('markNotices');if(mark)mark.onclick=safe(async()=>{const x=await db.rpc('bb_mark_notices_read');aware(x.error);await updateBadges();await showNotifications()});
}
/** Aggiorna la barra senza interrompere le schermate già aperte. */
function wireHeader(){
 $('menuButton').onclick=()=>{$('menuPopover').hidden=!$('menuPopover').hidden};
 $('chatButton').onclick=()=>{if(!user){inform('Accedi per utilizzare la chat');return}navigate('chat')};
 $('noticeButton').onclick=()=>{navigate('notifications')};
 $('brandHome').onclick=()=>navigate('dashboard');
 document.querySelector('.app-header')?.addEventListener('click',ev=>{if(ev.target.closest('button,a,input'))return;navigate('dashboard')});
}
function entry(title,content){main.innerHTML=`<h1>${title}</h1>${content}`}
async function current(){
 const {data:{user:u},error}=await db.auth.getUser();if(error&&error.name!=='AuthSessionMissingError')throw error;user=u;
 account=null;roles=[];
 if(user){
   const res=await db.from('bb_accounts').select('id,username,status').eq('auth_user_id',user.id).maybeSingle();aware(res.error);account=res.data;
   if(account){const r=await db.from('bb_account_roles').select('role_code').eq('account_id',account.id);aware(r.error);roles=r.data.map(x=>x.role_code);await loadRemotePrefs()}
 }
 $('who').textContent=user?(account?account.username:user.email):'Visitatore';$('signout').hidden=!user;
}
async function getEvents(){const {data,error}=await db.from('bb_events').select('id,title,kind,starts_at,ends_at,notes,is_public,room_id').gte('starts_at',new Date(new Date().getFullYear()-1,0,1).toISOString()).order('starts_at').limit(1200);aware(error);events=data}
async function getRooms(){if(!user||!(master()||roles.some(r=>['member','members_master','school_master','teacher','band_manager'].includes(r)))){rooms=[];return}const {data,error}=await db.from('bb_rooms').select('id,name,description,active').order('name');aware(error);rooms=data}
const fmtDate=s=>new Date(s).toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short'});
/**
 * Dashboard 0.7: riepiloghi calcolati a partire dalle righe VISIBILI all'utente.
 * L'RLS limita i record già sul server; questa funzione non tenta mai di
 * aggirare i privilegi interrogando moduli ai quali l'utente non può accedere.
 * Le lezioni/prenotazioni della beta sono ancora dati di lavoro: sono mostrate
 * come agenda di prova, NON occupazione ufficiale delle aule.
 */
async function showDashboard(){
 const pref=prefs(), allWidgets=['agenda','rooms','news','school','uniforms','projects','treasury','links'];
 const available=allWidgets.filter(x=>{
  if(x==='treasury')return can('treasury');
  if(x==='rooms')return master()||can('member')||can('teacher')||can('school_master');
  if(x==='school')return master()||can('teacher')||can('school_master');
  if(x==='uniforms')return master()||can('uniform_manager');
  if(x==='projects')return master()||can('council')||can('treasury');
  return true;
 });
 const selected=(pref.widgets||['agenda','rooms','news','school','uniforms','projects','treasury','links']).filter(x=>available.includes(x));
 const data={};
 for(const name of ['school','uniforms','projects','treasury','bookings','media']){
  const allowed=(name==='treasury'?can('treasury'):name==='school'?(master()||can('teacher')||can('school_master')):name==='uniforms'?(master()||can('uniform_manager')):name==='projects'?(master()||can('council')||can('treasury')):name==='bookings'?(master()||can('member')):(master()||can('media_manager')));
  if(allowed){const r=await db.from('bb_work_items').select('id,module,title,details,created_at').eq('module',name).order('created_at',{ascending:false}).limit(200);if(!r.error)data[name]=r.data||[];}
 }
 const today=new Date().toISOString().slice(0,10);
 // Unifica SOLO PER LA VISUALIZZAZIONE eventi reali e attività di prova.
 // Le lezioni sono date di lavoro, non ancora prenotazioni vincolanti.
 const addedRows=[...(data.school||[]).filter(x=>x.details?.date).map(x=>({title:x.title,kind:'lezione (prova)',starts_at:x.details.date,ends_at:new Date(new Date(x.details.date).getTime()+3600000).toISOString()})),
 ...(data.bookings||[]).filter(x=>x.details?.date).map(x=>({title:x.title,kind:'aula (prova)',starts_at:x.details.date,ends_at:x.details.end||new Date(new Date(x.details.date).getTime()+3600000).toISOString()}))];
 const calendarRows=[...events,...addedRows].sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));
 const dateValue=x=>x?.details?.date||'';
 const schoolToday=(data.school||[]).filter(x=>dateValue(x).slice(0,10)===today);
 const pendingUniforms=(data.uniforms||[]).filter(x=>x.details?.status==='richiesta');
 const latestProjects=(data.projects||[]).slice(0,4);
 const cash=(dir)=>(data.treasury||[]).filter(x=>x.details?.direction===dir).reduce((total,x)=>total+(Number(x.details?.amount)||0),0);
 let html=`<div class="dashboard-title"><div><h1>La tua Dashboard</h1><p class="muted">Riquadri personalizzabili · Dati condivisi online</p></div><div class="row"><button id="editDashboard" type="button">✥ Organizza</button><button id="customizeDashboard" type="button">＋ Riquadri</button></div></div><p class="edit-hint" id="editHint" hidden>Modalità modifica: trascina i riquadri; usa ◀ ▶ per riordinarli o il pulsante dimensione. <button id="finishEdit">Fine</button></p>`;
 const blocks={
 agenda:`<section><div class="row split"><h2>📅 Calendario della banda</h2><div class="row viewchoice"><button data-view="day">Giorno</button><button data-view="week">Settimana</button><button data-view="month">Mese</button></div></div><div class="calendar-toolbar"><button type="button" id="calPrev" aria-label="Periodo precedente">‹</button><span id="calendarPeriod"></span><button type="button" id="calToday">Oggi</button><button type="button" id="calNext" aria-label="Periodo successivo">›</button></div><div id="calendarWidget"></div><p><button data-route="events">Apri calendario completo</button></p></section>`,
 rooms:`<section><h2>🏠 Situazione aule</h2><p><b>${rooms.filter(x=>x.active).length}</b> aule attive configurate.</p><p><b>${(data.bookings||[]).filter(x=>x.details?.date && new Date(x.details.date)<=new Date()&&new Date(x.details.end)>new Date() && x.details.status!=='rifiutata').length}</b> prenotazioni di prova previste ora.</p><p class="muted">Le prenotazioni e le lezioni di prova non costituiscono ancora una disponibilità certificata.</p><button data-route="rooms">Gestisci / consulta aule</button></section>`,
 news:`<section><h2>📣 Aggiornamenti</h2>${(data.media||[]).filter(x=>x.details?.status==='pubblicato'&&x.details?.channel==='dashboard').slice(0,3).map(x=>`<p><b>${esc(x.title)}</b> ${esc(x.details?.notes||'')}</p>`).join('')||'<p class="muted">Nessuna comunicazione della banda.</p>'}</section>`,
 school:`<section><h2>🎼 Lezioni di oggi</h2><p><b>${schoolToday.length}</b> lezioni in archivio di prova per oggi.</p>${schoolToday.slice(0,4).map(x=>`<p>${esc(x.title)} · ${esc(x.details?.student||'')} · ${esc(x.details?.room||'')}</p>`).join('')}<button data-route="school">Apri scuola</button></section>`,
 uniforms:`<section><h2>👕 Richieste divise</h2><p class="stat">${pendingUniforms.length}</p><p>Richieste da evadere nel registro sperimentale.</p><button data-route="uniforms">Gestisci divise</button></section>`,
 projects:`<section><h2>📁 Progetti recenti</h2>${latestProjects.map(x=>`<p>${esc(x.title)} · ${esc(x.details?.status||'')}</p>`).join('')||'<p>Nessun progetto.</p>'}<button data-route="projects">Apri progetti</button></section>`,
 treasury:`<section><h2>💶 Tesoreria · Riepilogo</h2><div class="grid"><div><span class="muted">Entrate prova</span><div class="stat">${cash('entrata').toFixed(2)} €</div></div><div><span class="muted">Uscite prova</span><div class="stat">${cash('uscita').toFixed(2)} €</div></div><div><span class="muted">Differenza</span><div class="stat">${(cash('entrata')-cash('uscita')).toFixed(2)} €</div></div></div><div class="barline" aria-label="Ripartizione entrate e uscite"><div style="width:${cash('entrata')+cash('uscita')?Math.max(0,Math.min(100,100*cash('entrata')/(cash('entrata')+cash('uscita')))):50}%"></div></div><p class="muted">Registro test: non è un bilancio fiscale né conferma incassi reali.</p><button data-route="treasury">Apri Tesoreria</button></section>`,
 links:`<section><h2>⚡ Azioni rapide</h2><div class="row"><button data-route="events">Calendario</button><button data-route="chat">Chat</button>${master()?'<button data-route="master">Utenti e permessi</button>':''}</div></section>`
 };
 const sizes=pref.tileSizes||{};
 html+=`<div class="tile-grid" id="tileGrid">`+selected.map((id,idx)=>`<div class="tile tile-${esc(sizes[id]||(id==='agenda'?'wide':'small'))}" data-tile="${esc(id)}" draggable="false"><div class="tile-tools"><button type="button" data-move="-1" data-id="${esc(id)}" aria-label="Sposta a sinistra">◀</button><button type="button" data-size="${esc(id)}" aria-label="Cambia dimensione">⤢</button><button type="button" data-move="1" data-id="${esc(id)}" aria-label="Sposta a destra">▶</button><button type="button" data-remove="${esc(id)}" aria-label="Nascondi riquadro">×</button></div>${blocks[id]}</div>`).join('')+`</div>`;
 if(!selected.length)html+='<section>Nessun riquadro attivo. Premi «+ Riquadri».</section>';
 entry('Dashboard',html);
 document.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>{tab=b.dataset.route;render()});
 const pane=$('calendarWidget');
 /**
  * CALENDARIO: tre rappresentazioni REALMENTE differenti.
  * La funzione filtra per intervallo ma non trasforma una vista in una lista.
  * Gli eventi sono quelli già restituiti da Supabase secondo RLS.
  * Il layout settimanale usa sette colonne; il mensile usa una griglia 7xN.
  */
 let calendarOffset=0;
 const dayStart=(date)=>{const d=new Date(date);d.setHours(0,0,0,0);return d};
 const addDays=(date,n)=>{const d=new Date(date);d.setDate(d.getDate()+n);return d};
 const isoDay=(date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
 const byDay=(date)=>calendarRows.filter(row=>{const a=new Date(row.starts_at),b=new Date(row.ends_at);return a<addDays(date,1)&&b>date});
 const eventChip=(ev)=>`<button type="button" class="calendar-chip" data-route="events" title="${esc(ev.title)}"><small>${esc(new Date(ev.starts_at).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}))}</small><span>${esc(ev.title)}</span></button>`;
 const calendarLabel=$('calendarPeriod');
 const draw=(mode)=>{
  if(!pane)return;
  let now=dayStart(new Date());
  let anchor=addDays(now,mode==='day'?calendarOffset:mode==='week'?7*calendarOffset:0);
  if(mode==='month')anchor=new Date(now.getFullYear(),now.getMonth()+calendarOffset,1);
  let html='';
  if(mode==='day'){
   const list=byDay(anchor).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));
   html=`<div class="calendar-daily">${list.length?list.map(ev=>`<div class="agenda-row"><b>${esc(new Date(ev.starts_at).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}))}</b><span class="tag">${esc(ev.kind)}</span>${esc(ev.title)}</div>`).join(''):'<p class="muted">Nessuna attività prevista.</p>'}</div>`;
   if(calendarLabel)calendarLabel.textContent=anchor.toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  }else if(mode==='week'){
   const monday=addDays(anchor,-(anchor.getDay()+6)%7);
   const days=Array.from({length:7},(_,i)=>addDays(monday,i));
   html=`<div class="calendar-week" role="grid" aria-label="Settimana">${days.map(d=>`<div class="calendar-day-column"><div class="calendar-day-heading">${esc(d.toLocaleDateString('it-IT',{weekday:'short'}))}<strong>${d.getDate()}</strong></div><div class="calendar-day-events">${byDay(d).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at)).map(eventChip).join('')||'<span class="calendar-empty">—</span>'}</div></div>`).join('')}</div>`;
   if(calendarLabel)calendarLabel.textContent=`${days[0].toLocaleDateString('it-IT',{day:'numeric',month:'short'})} – ${days[6].toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'})}`;
  }else{
   const first=new Date(anchor.getFullYear(),anchor.getMonth(),1);
   const offset=(first.getDay()+6)%7;
   const gridStart=addDays(first,-offset);
   const numberOfDays=Math.ceil((offset+new Date(first.getFullYear(),first.getMonth()+1,0).getDate())/7)*7;
   const days=Array.from({length:numberOfDays},(_,i)=>addDays(gridStart,i));
   html=`<div class="calendar-month" role="grid" aria-label="Mese"><div class="calendar-month-head">${['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(d=>`<span>${d}</span>`).join('')}</div><div class="calendar-month-days">${days.map(d=>{const evs=byDay(d);const onMonth=d.getMonth()===first.getMonth();return `<button class="calendar-date ${onMonth?'':'outside'} ${isoDay(d)===isoDay(now)?'today':''}" type="button" data-calendar-date="${isoDay(d)}" aria-label="${d.toLocaleDateString('it-IT')}: ${evs.length} attività"><strong>${d.getDate()}</strong><span class="calendar-dots">${evs.slice(0,4).map(x=>`<i title="${esc(x.title)}"></i>`).join('')}</span>${evs.length?`<small>${evs.length} att.</small>`:''}</button>`}).join('')}</div></div>`;
   if(calendarLabel)calendarLabel.textContent=first.toLocaleDateString('it-IT',{month:'long',year:'numeric'});
  }
  pane.innerHTML=html;
  pane.querySelectorAll('[data-route]').forEach(el=>el.onclick=()=>navigate(el.dataset.route));
  pane.querySelectorAll('[data-calendar-date]').forEach(el=>el.onclick=()=>{const selected=new Date(`${el.dataset.calendarDate}T12:00:00`);const diff=Math.round((dayStart(selected)-now)/86400000);calendarOffset=diff;savePrefs({calendarView:'day'});draw('day')});
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===mode));
 };
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{calendarOffset=0;savePrefs({calendarView:b.dataset.view});draw(b.dataset.view)});
 $('calPrev').onclick=()=>{calendarOffset--;draw(prefs().calendarView||'week')};$('calNext').onclick=()=>{calendarOffset++;draw(prefs().calendarView||'week')};$('calToday').onclick=()=>{calendarOffset=0;draw(prefs().calendarView||'week')};
 draw(pref.calendarView||'week');
 /** Modalità modifica: pressione lunga su touch, spostamento mediante drag/drop
 * o controlli accessibili. Preferenze persistenti nel browser di questa beta.
 */
 const grid=$('tileGrid');let editing=false,pressTimer=null;
 const setEditing=value=>{editing=value;grid?.classList.toggle('is-editing',value);$('editHint').hidden=!value;grid?.querySelectorAll('.tile').forEach(t=>t.draggable=value)};
 $('editDashboard').onclick=()=>setEditing(!editing);
 $('finishEdit').onclick=()=>setEditing(false);
 const reorder=(id,destination)=>{const order=[...selected],from=order.indexOf(id);if(from<0||destination<0||destination>=order.length||from===destination)return;order.splice(from,1);order.splice(destination,0,id);savePrefs({widgets:order});showDashboard()};
 grid?.querySelectorAll('.tile').forEach(tile=>{
  const start=()=>{clearTimeout(pressTimer);pressTimer=setTimeout(()=>setEditing(true),550)};
  tile.addEventListener('pointerdown',ev=>{if(ev.target.closest('button,input,select,a,textarea'))return;start()});
  for(const event of ['pointerup','pointerleave','pointercancel'])tile.addEventListener(event,()=>clearTimeout(pressTimer));
  tile.addEventListener('dragstart',ev=>{if(!editing){ev.preventDefault();return}ev.dataTransfer.setData('text/plain',tile.dataset.tile)});
  tile.addEventListener('dragover',ev=>{if(editing)ev.preventDefault()});
  tile.addEventListener('drop',ev=>{ev.preventDefault();if(editing)reorder(ev.dataTransfer.getData('text/plain'),selected.indexOf(tile.dataset.tile))});
 });
 grid?.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>reorder(b.dataset.id,selected.indexOf(b.dataset.id)+Number(b.dataset.move)));
 grid?.querySelectorAll('[data-size]').forEach(b=>b.onclick=()=>{const size={...prefs().tileSizes},id=b.dataset.size;size[id]=size[id]==='small'?'medium':size[id]==='medium'?'wide':'small';savePrefs({tileSizes:size});showDashboard()});
 grid?.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{savePrefs({widgets:selected.filter(x=>x!==b.dataset.remove)});showDashboard()});
 $('customizeDashboard').onclick=()=>{entry('Personalizza la Dashboard',`<section><p>Scegli i pannelli disponibili per il tuo account. Il Master può utilizzare le autorizzazioni per determinare chi vede i moduli.</p><form id="widgetsForm">${available.map(x=>`<label class="choice"><input type="checkbox" name="widget" value="${x}" ${selected.includes(x)?'checked':''}> ${({agenda:'Calendario',rooms:'Situazione aule',news:'Comunicazioni',school:'Lezioni',uniforms:'Divise',projects:'Progetti',treasury:'Tesoreria',links:'Azioni rapide'})[x]}</label>`).join('')}<p><button class="primary">Salva la mia Dashboard</button> <button id="backDashboard" type="button">Annulla</button></p></form></section>`);$('widgetsForm').onsubmit=ev=>{ev.preventDefault();savePrefs({widgets:[...document.querySelectorAll('input[name=widget]:checked')].map(x=>x.value)});showDashboard()};$('backDashboard').onclick=()=>showDashboard()};
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
 const report=exportsPanel('Anagrafiche',data,[{title:'Cognome',value:x=>x.last_name},{title:'Nome',value:x=>x.first_name},{title:'Data di nascita',value:x=>x.birth_date},{title:'Ingresso associazione',value:x=>x.association_join_date},{title:'Telefono',value:x=>x.phone}]);document.querySelector('main section').insertAdjacentHTML('afterbegin',report.buttons);report.wire();
 function edit(id){const p=data.find(x=>x.id===id);$('personTitle').textContent=p?'Modifica scheda':'Nuova scheda';$('personId').value=p?.id||'';for(const [node,key] of [['first','first_name'],['last','last_name'],['birth','birth_date'],['phone','phone'],['email','email'],['address','address'],['joined','association_join_date']])$(node).value=p?.[key]||''}
 document.querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>edit(b.dataset.person));$('clearPerson').onclick=()=>edit();
 $('personForm').onsubmit=safe(async ev=>{ev.preventDefault();const id=$('personId').value;const record={first_name:$('first').value.trim(),last_name:$('last').value.trim(),birth_date:$('birth').value,phone:$('phone').value||null,email:$('email').value||null,address:$('address').value||null,association_join_date:$('joined').value||null,updated_at:new Date().toISOString()};const res=id?await db.from('bb_people').update(record).eq('id',id):await db.from('bb_people').insert(record);aware(res.error);inform('Anagrafica salvata online');await refresh()});
}
async function showMaster(){const [a,r]=await Promise.all([db.from('bb_accounts').select('id,username,status,auth_user_id').order('created_at'),db.from('bb_account_roles').select('account_id,role_code')]);aware(a.error);aware(r.error);
 entry('Master — Utenti e permessi',`<section><p>Gli amici accedono con Google, scelgono uno username e appaiono qui. Senza flag hanno accesso soltanto ai contenuti pubblici.</p><div class="tablewrap"><table><tr><th>Account</th><th>Stato</th><th>Flag attuali</th><th></th></tr>${a.data.map(x=>`<tr><td>${esc(x.username)}</td><td>${esc(x.status)}</td><td>${r.data.filter(z=>z.account_id===x.id).map(z=>esc(z.role_code)).join(', ')||'—'}</td><td><button data-account="${x.id}">Permessi</button></td></tr>`).join('')}</table></div></section><section id="rolesSection"><p>Seleziona un account per modificare i suoi flag.</p></section>`);
 const report=exportsPanel('Utenti_e_permessi',a.data,[{title:'Username',value:x=>x.username},{title:'Stato',value:x=>x.status},{title:'Flag',value:x=>r.data.filter(z=>z.account_id===x.id).map(z=>z.role_code).join(', ')}]);document.querySelector('main section').insertAdjacentHTML('afterbegin',report.buttons);report.wire();
 const {data:allRoles,error}=await db.from('bb_roles').select('code,display_name').order('display_name');aware(error);
 document.querySelectorAll('[data-account]').forEach(b=>b.onclick=()=>{const id=b.dataset.account,x=a.data.find(z=>z.id===id),set=new Set(r.data.filter(z=>z.account_id===id).map(z=>z.role_code));$('rolesSection').innerHTML=`<h2>Permessi di ${esc(x.username)}</h2><p>Le modifiche diventano effettive al prossimo caricamento dell'account.</p>${allRoles.map(p=>`<label style="margin:6px 0;font-weight:400"><input type="checkbox" style="width:auto" data-role="${esc(p.code)}" ${set.has(p.code)?'checked':''}> ${esc(p.display_name)}</label>`).join('')}`;
 $('rolesSection').querySelectorAll('[data-role]').forEach(c=>c.onchange=safe(async()=>{const res=await db.rpc('bb_set_role',{p_account_id:id,p_role:c.dataset.role,p_enabled:c.checked});aware(res.error);inform('Permesso aggiornato su Supabase');await showMaster()}));
 });
}
function showAbout(){entry('Moduli in sviluppo',`<section><p><b>Questa è una beta online parziale:</b> autenticazione Google, account, ruoli, anagrafiche, aule ed eventi sono realmente collegati a Supabase.</p><p>Chat e schede di lavoro sono disponibili online dopo SQL 005. Le schede economiche e di magazzino sono registri SPERIMENTALI, non liquidazioni o inventario contabile definitivo. Push su telefono: richiede configurazione dell'invio server e autorizzazione del browser. Deleghe genitoriali, backup completo e pagamenti definitivi restano da implementare.</p><p>Non inserire informazioni personali reali finché non avremo completato i controlli privacy e le procedure di backup.</p></section>`)}
function showSignup(){entry('Completa il primo accesso',`<section><p>Accesso Google riuscito. Scegli il tuo username BetaBanda: il tuo account verrà creato <b>senza flag</b>. Solo il Master può concederti autorizzazioni.</p><form id="signup"><div class="fields">${field('newUser','Username BetaBanda','text','','required minlength="3" maxlength="60"')}</div><button class="primary">Crea account</button></form></section>`);
 $('signup').onsubmit=safe(async e=>{e.preventDefault();const res=await db.rpc('bb_register_account',{p_username:$('newUser').value.trim()});aware(res.error);inform('Account creato online');await refresh()});}
/**
 * MODULI DI LAVORO DELLA BETA
 * ---------------------------
 * I dati sono reali (salvati su PostgreSQL) ma i processi sono sperimentali:
 * NON registriamo pagamenti definitivi, proprietà di beni o dichiarazioni fiscali.
 * Una futura migrazione convertirà questi record JSON in tabelle specializzate.
 * I ruoli sono verificati anche da bb_module_allowed() nelle policy SQL.
 */
const MODULES={
 treasury:{title:'Tesoreria · Registro sperimentale',role:'treasury',label:'Movimento',fields:[['category','Categoria','text'],['direction','Entrata / uscita','select','entrata|uscita'],['amount','Importo (€)','number'],['date','Data','date'],['notes','Note','text']]},
 school:{title:'Scuola di musica · Lezioni',role:'teacher',label:'Lezione',fields:[['teacher','Insegnante','text'],['student','Alunno','text'],['room','Aula','text'],['date','Data e ora','datetime-local'],['status','Stato','select','programmata|svolta|assente|recupero'],['notes','Note','text']]},
 uniforms:{title:'Divise · Movimenti di prova',role:'uniform_manager',label:'Articolo / richiesta',fields:[['person','Socio','text'],['article','Articolo','text'],['size','Taglia','text'],['quantity','Quantità','number'],['status','Stato','select','richiesta|consegnata|restituita|venduta'],['price','Costo / prezzo indicativo (€)','number']]},
 projects:{title:'Consiglio · Progetti',role:'council',label:'Progetto',fields:[['owner','Responsabile','text'],['status','Stato','select','aperto|chiuso'],['income','Entrate previste (€)','number'],['expense','Spese previste (€)','number'],['notes','Descrizione','text']]},
 bookings:{title:'Prenotazioni aule · Prova',role:'member',label:'Prenotazione',fields:[['room','Aula','text'],['date','Inizio','datetime-local'],['end','Fine','datetime-local'],['kind','Motivo','select','studio|festa'],['status','Stato','select','richiesta|approvata|rifiutata']]},
 media:{title:'Media · Comunicazioni',role:'media_manager',label:'Contenuto',fields:[['channel','Canale','select','dashboard|facebook|instagram|youtube'],['url','URL (facoltativo)','url'],['status','Stato','select','bozza|pubblicato'],['notes','Testo','text']]},
 band:{title:'Attività banda · Appunti operativi',role:'band_manager',label:'Attività',fields:[['type','Tipo','select','prova|concerto|servizio'],['date','Data','date'],['participants','Partecipanti','text'],['notes','Note','text']]},
 family:{title:'Famiglie · Schede di prova',role:'school_master',label:'Collegamento',fields:[['adult','Rappresentante legale','text'],['child','Figlio / figlia','text'],['status','Stato','select','da_verificare|verificato|revocato'],['notes','Note','text']]}
};
/** Le stringhe dei campi sono visualizzate soltanto dopo escaping HTML. */
async function showWorkModule(module){
 const cfg=MODULES[module];const result=await db.from('bb_work_items').select('*').eq('module',module).order('created_at',{ascending:false}).limit(100);aware(result.error);
 const records=result.data||[];
 const extra=module==='treasury'?(()=>{const sum=(dir)=>records.filter(x=>x.details.direction===dir).reduce((a,x)=>a+Number(x.details.amount||0),0);let inc=sum('entrata'),out=sum('uscita');return `<section><h2>Situazione sperimentale</h2><p>Entrate registrate: <b>${inc.toFixed(2)} €</b> · Uscite registrate: <b>${out.toFixed(2)} €</b> · Differenza: <b>${(inc-out).toFixed(2)} €</b></p><p class="muted">Importi dimostrativi: non equivalgono a pagamenti verificati.</p></section>`})():'';
 /**
  * Azioni suggerite specifiche per ogni modulo. Non sono liquidazioni,
  * inventari certificati o conferme di presenza: solo registri di prova.
  */
 const guidance={
  treasury:'Inserisci un movimento di prova e verifica come cambia il riepilogo nella Dashboard. Le liquidazioni definitive NON sono attive.',
  school:'Inserisci la lezione, indicando insegnante, alunno, aula e data. Modifica in seguito lo stato per simulare presenza o recupero.',
  uniforms:'Crea una richiesta con taglia e quantità; apri la scheda per impostare «consegnata», «restituita» o «venduta». Le giacenze ufficiali non sono ancora calcolate.',
  projects:'Crea il progetto con entrate e spese previste, poi cambia lo stato in «chiuso». La Tesoreria NON registra automaticamente un incasso reale.',
  bookings:'Registra una richiesta di aula con data e ora; usa lo stato per simulare l’approvazione. La verifica dei conflitti non è ancora applicata.',
  media:'Crea una comunicazione destinata alla Dashboard e imposta lo stato «pubblicato»: apparirà nel riepilogo del Master/Media.',
  band:'Registra l’attività operativa; per concerti e servizi pubblici utilizza la scheda Calendario, che ha la visibilità corretta.',
  family:'Registra un collegamento da verificare tra rappresentante e figlio. Non concede accesso reale alle anagrafiche minorili.'
 };
 const stateCounts=module==='uniforms'?`<div class="metric-line"><b>${records.filter(x=>x.details?.status==='richiesta').length}</b> richieste · <b>${records.filter(x=>x.details?.status==='consegnata').length}</b> consegnati · <b>${records.filter(x=>x.details?.status==='restituita').length}</b> restituiti</div>`:
 module==='projects'?`<div class="metric-line"><b>${records.filter(x=>x.details?.status==='aperto').length}</b> aperti · <b>${records.filter(x=>x.details?.status==='chiuso').length}</b> chiusi</div>`:
 module==='school'?`<div class="metric-line"><b>${records.filter(x=>x.details?.status==='programmata').length}</b> programmate · <b>${records.filter(x=>x.details?.status==='recupero').length}</b> recuperi</div>`:'';
 const rows=records.map(x=>`<tr><td>${esc(x.title)}</td><td>${esc(Object.entries(x.details||{}).map(([k,v])=>k+': '+v).join(' · '))}</td><td><button data-edit-item="${x.id}">Modifica</button></td></tr>`).join('');
 const report=exportsPanel(cfg.title,records,reportCols(cfg.fields));
 const inputs=cfg.fields.map(([key,label,type,choices])=>type==='select'?`<div><label for="work_${key}">${esc(label)}</label><select id="work_${key}">${choices.split('|').map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select></div>`:field('work_'+key,esc(label),type));
 entry(cfg.title,`${extra}<section><h2>Come provarlo</h2><p>${esc(guidance[module])}</p>${stateCounts}${report.buttons}<p class="muted">Le modifiche sono condivise su Supabase. I flussi gestionali definitivi sono ancora in costruzione.</p><div class="tablewrap"><table><tr><th>${esc(cfg.label)}</th><th>Dettagli</th><th></th></tr>${rows}</table></div></section><section><h2 id="workHeading">Nuovo elemento</h2><form id="workForm"><input type="hidden" id="workId">${field('workTitle','Titolo / descrizione breve','text','','required')}<div class="fields">${inputs.join('')}</div><button class="primary">Salva online</button> <button id="workClear" type="button">Nuovo</button></form></section>`);
 report.wire();
 const open=(id)=>{const row=records.find(x=>x.id===id);$('workHeading').textContent=row?'Modifica elemento':'Nuovo elemento';$('workId').value=id||'';$('workTitle').value=row?.title||'';cfg.fields.forEach(([key])=>{$('work_'+key).value=row?.details?.[key]??''})};
 document.querySelectorAll('[data-edit-item]').forEach(b=>b.onclick=()=>open(b.dataset.editItem));$('workClear').onclick=()=>open('');
 $('workForm').onsubmit=safe(async ev=>{ev.preventDefault();const id=$('workId').value;const details={};cfg.fields.forEach(([key])=>details[key]=$('work_'+key).value);const payload={title:$('workTitle').value.trim(),details,module,updated_at:new Date().toISOString()};const res=id?await db.from('bb_work_items').update(payload).eq('id',id):await db.from('bb_work_items').insert(payload);aware(res.error);inform('Salvato online');await showWorkModule(module)});
}

/**
 * REPORT DI COLLAUDO: esporta le righe effettivamente lette tramite RLS.
 * Non crea un rendiconto fiscale e non aggira i permessi del modulo.
 * Stampa PDF: finestra di stampa del browser, quindi "Salva come PDF".
 * CSV: esportazione semplice con separatori correttamente escapati.
 */
function exportsPanel(title, rows, columns){
 const id='report-'+Math.random().toString(36).slice(2);
 const data=rows.map(row=>columns.map(c=>String(c.value(row)??'')));
 const csvCell=value=>'"'+String(value).replace(/"/g,'""')+'"';
 const csv=[columns.map(c=>csvCell(c.title)),...data.map(row=>row.map(csvCell))].map(r=>r.join(';')).join('\r\n');
 const buttons=`<div class="row report-actions"><button type="button" id="${id}-pdf">🖨 Esporta PDF / Stampa</button><button type="button" id="${id}-csv">⬇ Esporta CSV</button></div>`;
 const wire=()=>{
  const pdf=$(id+'-pdf'),download=$(id+'-csv');
  if(pdf)pdf.onclick=()=>{
   const body=`<h1>${esc(title)}</h1><p>BetaBanda · Esportato il ${new Date().toLocaleString('it-IT')}</p><table border="1" cellspacing="0" cellpadding="7"><thead><tr>${columns.map(c=>`<th>${esc(c.title)}</th>`).join('')}</tr></thead><tbody>${data.map(row=>`<tr>${row.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table><p>Totale righe: ${data.length}</p>`;
   const popup=window.open('','_blank');if(!popup){inform('Consenti le finestre popup per stampare il report.',true);return}
   popup.document.write(`<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:12px Arial;padding:22px;color:#111}table{width:100%;border-collapse:collapse}th{background:#eee}td{word-break:break-word}@page{size:A4 landscape;margin:14mm}</style></head><body>${body}</body></html>`);popup.document.close();popup.focus();popup.print();
  };
  if(download)download.onclick=()=>{const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='BetaBanda_'+title.replace(/[^a-z0-9]/gi,'_')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)};
 };
 return {buttons,wire};
}
function reportCols(fields){return [{title:'Titolo',value:r=>r.title},...fields.map(([key,title])=>({title,value:r=>r.details?.[key]}))]}
/**
 * SCUOLA: pannello insegnante e studente distinti, stessi dati sperimentali.
 * Gli identificativi personali delle lezioni dovranno diventare relazioni
 * strutturate prima di consentire accesso ai singoli alunni in produzione.
 */
async function showSchool(){
 const teacher=master()||can('teacher')||can('school_master');
 if(!teacher){entry('Le mie lezioni',`<section><h2>Lezioni e materiale didattico</h2><p>La scheda personale dell'alunno verrà collegata solo dopo aver configurato l'associazione sicura tra account, anagrafica e lezioni.</p><p class="muted">Per proteggere gli alunni, non vengono mostrati i dati degli altri studenti.</p></section>`);return}
 const res=await db.from('bb_work_items').select('*').eq('module','school').order('created_at',{ascending:false}).limit(300);aware(res.error);
 const rows=res.data||[],today=new Date().toLocaleDateString('sv-SE');
 const lessons=rows.filter(x=>String(x.details?.date||'').slice(0,10)===today).sort((a,b)=>String(a.details.date).localeCompare(String(b.details.date)));
 const upcoming=rows.filter(x=>String(x.details?.date||'').slice(0,10)>=today).sort((a,b)=>String(a.details.date).localeCompare(String(b.details.date)));
 const tile=x=>`<article class="lesson-card"><div><strong>${esc(x.title)}</strong><p>${esc(x.details?.student||'Alunno non indicato')} · ${esc(x.details?.room||'Aula non indicata')}</p><small>${esc(x.details?.date||'')} · ${esc(x.details?.status||'programmata')}</small></div><div class="row">${['svolta|✓ Registra presenza','recupero|↪ Rinvia','assente|✕ Assente'].map(z=>{const [status,label]=z.split('|');return `<button type="button" data-lesson-status="${x.id}" data-status="${status}">${label}</button>`}).join('')}</div></article>`;
 entry('Scuola di musica',`<section><h2>Le mie lezioni di oggi</h2>${lessons.map(tile).join('')||'<p>Nessuna lezione registrata per oggi.</p>'}</section><section><h2>Prossime lezioni</h2><div class="lesson-week">${Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()+i);const k=d.toLocaleDateString('sv-SE');const filtered=upcoming.filter(x=>String(x.details?.date||'').slice(0,10)===k);return `<div class="lesson-day"><b>${esc(d.toLocaleDateString('it-IT',{weekday:'short',day:'numeric'}))}</b>${filtered.map(x=>`<p>${esc(x.details.date.slice(11,16))}<br>${esc(x.details?.student||x.title)}</p>`).join('')||'<span>—</span>'}</div>`}).join('')}</div></section><section><h2>Materiale didattico</h2><p class="muted">Il caricamento dei file richiede l'archivio Storage e le autorizzazioni per docente e alunni; non è ancora operativo.</p></section><section><h2>Gestione lezioni · Registro di prova</h2><p>Inserisci e modifica le lezioni nella sezione amministrativa. I comandi di presenza qui aggiornano il registro sperimentale, non certificano compensi.</p><button id="schoolManage">Gestisci lezioni di prova</button></section><section><h2>Report scuola</h2><div id="schoolExports"></div></section>`);
 $('schoolManage').onclick=()=>showWorkModule('school');
 document.querySelectorAll('[data-lesson-status]').forEach(b=>b.onclick=safe(async()=>{const row=rows.find(x=>x.id===b.dataset.lessonStatus);if(!row)return;const r=await db.from('bb_work_items').update({details:{...row.details,status:b.dataset.status}}).eq('id',row.id);aware(r.error);await showSchool()}));
 const report=exportsPanel('Lezioni_scuola',rows,reportCols(MODULES.school.fields));$('schoolExports').innerHTML=report.buttons;report.wire();
}
/**
 * MODULO DIVISE: consultazione per socio volutamente indipendente
 * dalle tabelle amministrative finché le deleghe RLS non sono pronte.
 */
async function showMyUniform(){
 if(window.bbUniforms){return window.bbUniforms.mine(db,account,entry,esc,safe,inform)}
 entry('La mia dotazione',`<section><h2>La mia divisa</h2><p>Qui compariranno capi, taglie, quantità e proprietà del materiale collegato alla tua anagrafica.</p><p class="muted">L'attuale archivio sperimentale delle divise usa nominativi testuali, non identificativi univoci: non è sicuro mostrare dotazioni individuali o inviare richieste per conto di un socio finché non introdurremo una relazione verificata tra account e anagrafica.</p><button id="requestUniform" type="button" disabled>Richiedi cambio/divisa · in preparazione</button></section>`);
}
async function showUniformManager(){return window.bbUniforms?.manager(db,account,roles,entry,esc,safe,inform) ?? entry('Gestione divise','<p>Modulo non caricato.</p>');}
async function legacyUniformManager(){
 const res=await db.from('bb_work_items').select('*').eq('module','uniforms').order('created_at',{ascending:false}).limit(300);aware(res.error);const rows=res.data||[];
 const pending=rows.filter(x=>x.details?.status==='richiesta');
 entry('Gestione divise',`<section><h2>Richieste dei soci</h2><p><strong>${pending.length}</strong> richieste da verificare (registro di prova).</p>${pending.map(x=>`<article class="lesson-card"><strong>${esc(x.details?.person||'Socio')}</strong><p>${esc(x.details?.article||x.title)} · ${esc(x.details?.size||'')} · q.tà ${esc(x.details?.quantity||'1')}</p></article>`).join('')||'<p>Nessuna richiesta in attesa.</p>'}</section><section><h2>Magazzino e movimenti</h2><p class="muted">Le righe attuali non costituiscono ancora un inventario con giacenze certificate. Puoi continuare a provare inserimenti e cambi di stato.</p><button id="uniformManage">Apri registro divise di prova</button></section><section><h2>Report divise</h2><div id="uniformExports"></div></section>`);
 $('uniformManage').onclick=()=>showWorkModule('uniforms');const report=exportsPanel('Divise_movimenti',rows,reportCols(MODULES.uniforms.fields));$('uniformExports').innerHTML=report.buttons;report.wire();
}
/**
 * CHAT: ricerca username tramite RPC bb_find_recipients, che restituisce
 * SOLO gli username attivi. Il server vieta di consultare messaggi altrui.
 */
async function showChat(){
 if(!account){entry('Chat','<p>Accedi per utilizzare la chat.</p>');return}
 entry('Chat tra utenti',`<section><h2>Cerca destinatario</h2><p>Scrivi almeno due caratteri dello username registrato.</p>${field('recipientSearch','Cerca username')}<div id="recipients"></div></section><section><h2 id="conversationHeading">Conversazione</h2><div id="conversation" class="messages"><p>Scegli un destinatario.</p></div><form id="messageForm"><label for="messageText">Messaggio</label><textarea id="messageText" maxlength="10000" rows="3" required></textarea><p><button class="primary" type="submit">Invia messaggio</button> <button type="button" id="chatReload">Aggiorna chat</button></p></form></section>`);
 // La migrazione 008 di Claude restituisce SOLO le conversazioni dell'account corrente.
 // Se non è installata, manteniamo utilizzabile la ricerca per username.
 const history=await db.rpc('bb_conversations');
 if(!history.error && history.data?.length){
  const target=$('recipients'); const previous=document.createElement('section');
  previous.innerHTML='<h3>Conversazioni recenti</h3>'+history.data.map(c=>`<button type="button" data-recent="${esc(c.partner_id)}" data-name="${esc(c.partner_name)}">${esc(c.partner_name)}${Number(c.unread)?` · ${Number(c.unread)} da leggere`:''}</button>`).join(' ');
  target.parentElement.after(previous);
  previous.querySelectorAll('[data-recent]').forEach(b=>b.onclick=()=>{chatTarget={id:b.dataset.recent,name:b.dataset.name};loadConversation()});
 }
 const search=safe(async()=>{const q=$('recipientSearch').value.trim();if(q.length<2){$('recipients').innerHTML='';return}const res=await db.rpc('bb_find_recipients',{q});aware(res.error);$('recipients').innerHTML=res.data?.length?res.data.map(x=>`<button type="button" data-recipient="${x.id}" data-name="${esc(x.username)}">${esc(x.username)}</button>`).join(' '):'<p>Nessun utente trovato.</p>';document.querySelectorAll('[data-recipient]').forEach(b=>b.onclick=()=>{chatTarget={id:b.dataset.recipient,name:b.dataset.name};loadConversation()})});
 let debounce;$('recipientSearch').oninput=()=>{clearTimeout(debounce);debounce=setTimeout(search,250)};
 $('chatReload').onclick=safe(async()=>await loadConversation());
 $('messageForm').onsubmit=safe(async ev=>{ev.preventDefault();if(!chatTarget)throw Error('Seleziona prima un destinatario');const body=$('messageText').value.trim();if(!body)return;const res=await db.from('bb_messages').insert({sender_id:account.id,recipient_id:chatTarget.id,body});aware(res.error);$('messageText').value='';await loadConversation();updateBadges().catch(console.warn)});
 if(chatTarget)await loadConversation();
}
async function loadConversation(){if(!chatTarget||!$('conversation'))return;$('conversationHeading').textContent='Conversazione con '+chatTarget.name;
 const res=await db.from('bb_messages').select('id,sender_id,recipient_id,body,sent_at,read_at').or(`and(sender_id.eq.${account.id},recipient_id.eq.${chatTarget.id}),and(sender_id.eq.${chatTarget.id},recipient_id.eq.${account.id})`).order('sent_at',{ascending:true}).limit(200);aware(res.error);
 $('conversation').innerHTML=(res.data||[]).map(x=>`<div class="message ${x.sender_id===account.id?'mine':'theirs'}"><small>${x.sender_id===account.id?'Tu':esc(chatTarget.name)} · ${fmtDate(x.sent_at)}</small><div>${esc(x.body)}</div></div>`).join('')||'<p>Non ci sono ancora messaggi.</p>';
 for(const m of res.data||[]){if(m.recipient_id===account.id&&!m.read_at){const r=await db.rpc('bb_mark_message_read',{p_message:m.id});if(r.error)console.warn(r.error)}}
 updateBadges().catch(console.warn);
}
/** Notifiche in-app: disponibili appena viene eseguito lo SQL 005. */
async function showSettings(){
 const res=await db.from('bb_notifications').select('title,body,created_at').order('created_at',{ascending:false}).limit(15);aware(res.error);
 entry('Impostazioni',`<section><h2>BetaBanda 0.9.0</h2><p>Controllo versione: aggiorna la pagina dopo la pubblicazione. La grafica rimane provvisoria.</p><button id="reloadNow">Ricarica e verifica aggiornamenti</button></section><section><h2>Aspetto e accessibilità</h2><div class="fields"><div><label for="themeSelect">Tema</label><select id="themeSelect"><option value="auto">Automatico</option><option value="light">Chiaro</option><option value="dark">Scuro</option></select></div><div><label for="fontSelect">Carattere</label><select id="fontSelect"><option value="system">Sistema (originale)</option><option value="calibri">Calibri / alternativa</option><option value="hyper">Atkinson Hyperlegible (alternativa accessibile)</option></select></div><div><label for="fontScale">Ingrandimento caratteri <span id="fontScaleValue"></span></label><input type="range" min="80" max="200" step="5" id="fontScale"></div></div><label class="choice"><input id="highContrast" type="checkbox"> Contrasto elevato</label><p>Le preferenze sono salvate in questo browser. Il font Calibri o Atkinson può utilizzare una alternativa se non installato.</p></section><section><h2>Notifiche interne</h2>${res.data?.map(x=>`<p><b>${esc(x.title)}</b> · ${fmtDate(x.created_at)}<br>${esc(x.body)}</p>`).join('')||'<p>Nessuna notifica.</p>'}</section><section><h2>Notifiche push sul dispositivo</h2><p>Richiedono HTTPS, autorizzazione del browser, Service Worker e un servizio di invio configurato. Su iPhone sono disponibili nelle web app aggiunte alla schermata Home.</p><button id="enablePush">Attiva notifiche push</button><p id="pushStatus" class="muted">La consegna remota sarà operativa solo dopo la configurazione della funzione server.</p></section>`);
 $('reloadNow').onclick=()=>location.reload();const myPrefs=prefs();$('themeSelect').value=myPrefs.theme||'dark';$('fontSelect').value=myPrefs.font||'system';$('fontScale').value=String(Math.round((Number(myPrefs.scale)||1)*100));$('highContrast').checked=!!myPrefs.contrast;const upd=()=>{$('fontScaleValue').textContent=$('fontScale').value+'%';savePrefs({theme:$('themeSelect').value,font:$('fontSelect').value,scale:Number($('fontScale').value)/100,contrast:$('highContrast').checked});applyAccessibility()};['themeSelect','fontSelect','fontScale','highContrast'].forEach(x=>$(x).oninput=upd);$('fontScaleValue').textContent=$('fontScale').value+'%';$('enablePush').onclick=safe(async()=>{
 if(!('serviceWorker' in navigator)||!('PushManager' in window))throw Error('Notifiche push non supportate in questo browser. Su iPhone aggiungi BetaBanda alla schermata Home.');
 if(!window.BETABANDA_VAPID_PUBLIC_KEY)throw Error('Manca la chiave VAPID pubblica: configurare push-config.js dopo il deploy della Edge Function.');
 const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('Autorizzazione non concessa');
 const reg=await navigator.serviceWorker.register('./sw.js');const subscription=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64ToBytes(window.BETABANDA_VAPID_PUBLIC_KEY)});
 const payload={account_id:account.id,endpoint:subscription.endpoint,subscription:subscription.toJSON()};const result=await db.from('bb_push_subscriptions').upsert(payload,{onConflict:'endpoint'});aware(result.error);
 $('pushStatus').textContent='Dispositivo iscritto alle notifiche. La consegna dipende dalla funzione server configurata.';
 });
}
function base64ToBytes(value){const str=atob(value.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(str,c=>c.charCodeAt(0))}

async function render(){links();updateBadges().catch(console.warn);if(!user){tab='dashboard'}else if(!account){nav.innerHTML='';showSignup();return}
 if(tab==='dashboard')showDashboard();else if(tab==='events')showEvents();else if(tab==='rooms'&&(master()||roles.some(r=>['member','members_master','school_master','teacher','band_manager'].includes(r))))showRooms();else if(tab==='people'&&(master()||can('members_master')))await showPeople();else if(tab==='myuniform')await showMyUniform();else if(tab==='master'&&master())await showMaster();else if(tab==='chat')await showChat();else if(tab==='notifications')await showNotifications();else if(tab==='school'&&(master()||can('teacher')||can('student')||can('school_master')))await showSchool();else if(tab==='uniforms'&&(master()||can('uniform_manager')))await showUniformManager();else if(MODULES[tab] && ((tab!=='treasury'&&can('total_master'))||can(MODULES[tab].role)||(tab==='school'&&can('school_master'))||(tab==='band'&&can('conductor'))||(tab==='projects'&&can('treasury'))))await showWorkModule(tab);else if(tab==='settings')await showSettings();else if(tab==='about')showAbout();else{tab='dashboard';showDashboard()}}
async function refresh(){await current();await getRooms();await getEvents();await render()}
$('signout').onclick=safe(async()=>{await db.auth.signOut();tab='dashboard';await refresh()});
async function initialize(){if(!configured){entry('Configurazione mancante',`<section>Inserisci Project URL e Publishable Key in <code>config.js</code>, poi ricarica la pagina.</section>`);return}
 await refresh();if(!user){entry('Benvenuto in BetaBanda',`<section><p>Puoi consultare gli eventi pubblici senza login, oppure accedere con Google per utilizzare i moduli abilitati.</p><button class="primary" id="login">Accedi con Google</button></section><section><h2>Eventi pubblici</h2>${events.length?events.map(x=>`<p><b>${esc(x.title)}</b> — ${fmtDate(x.starts_at)}</p>`).join(''):'Nessun evento pubblico inserito.'}</section>`);
 $('login').onclick=safe(async()=>{const res=await db.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}});aware(res.error)});nav.innerHTML='<button id="publicEvents">Calendario pubblico</button>';$('publicEvents').onclick=()=>{tab='events';showEvents()};}
}
wireHeader();setInterval(()=>{if(user)updateBadges().catch(console.warn)},30000);initialize().catch(e=>{console.error(e);inform(e.message,true);entry('Errore di collegamento',`<section><p>${esc(e.message)}</p><p>Verifica la migrazione SQL 004 e le impostazioni di Supabase.</p></section>`)});
