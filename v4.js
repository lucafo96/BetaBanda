'use strict';
/**
 * BetaBanda 0.4.0 — estensioni della demo.
 *
 * ORGANIZZAZIONE: questo file espande la Beta 3 senza cambiare le tabelle
 * dimostrative precedenti. Per la futura versione cloud le funzioni saranno
 * separate in moduli e l'autorizzazione verrà sempre verificata sul server.
 *
 * SICUREZZA: NON immettere dati veri. localStorage è leggibile e modificabile
 * da chi ha accesso al dispositivo. I flag qui sono SOLO una simulazione UI.
 */
const VERSION='0.4.0';
const TODAY=()=>new Date().toLocaleDateString('en-CA');
const uid=()=>Date.now()+Math.floor(Math.random()*100000);
const euro=x=>Number(x||0).toLocaleString('it-IT',{style:'currency',currency:'EUR'});
const sel=(values,v)=>values.map(x=>`<option value="${esc(x)}" ${x===v?'selected':''}>${esc(x)}</option>`).join('');
const formField=(label,id,type='text',value='')=>`<div><label for="${id}">${label}</label><input id="${id}" type="${type}" value="${esc(value)}"></div>`;
const personLabel=id=>personName(state.people.find(p=>p.id===Number(id))||{firstName:'Sconosciuto',lastName:''});
// Espansione sicura dello stato: niente azzeramento dei dati locali della Beta 3.
state.classrooms??=state.rooms.map((name,i)=>({id:i+1,name,active:true}));
state.classrooms=state.classrooms.map((x,i)=>typeof x==='string'?{id:i+1,name:x,active:true}:x);
state.ledger??=[{id:1,date:'2026-10-20',kind:'entrata',category:'Quote soci',description:'Quote dimostrative',amount:40},{id:2,date:'2026-10-21',kind:'uscita',category:'Materiali',description:'Materiale dimostrativo',amount:25}];
state.lessons??=[{id:1,date:TODAY(),from:'16:00',to:'17:00',room:'Aula 1',teacher:'Mario Rossi',student:'Giulia Verdi',status:'programmata'}];
state.chats??=[{id:1,from:'Master beta',to:'Mario Rossi',body:'Messaggio dimostrativo di benvenuto',at:new Date().toISOString()}];
state.projects??=[{id:1,title:'Concerto di primavera (esempio)',status:'aperto',income:300,cost:140}];
state.uniformPrices??=[];
state.families??=[];
state.panelCatalog??=[
  {id:'calendar',label:'Calendario',enabled:true,scope:'both'},
  {id:'rooms',label:'Disponibilità aule',enabled:true,scope:'internal'},
  {id:'news',label:'Avvisi',enabled:true,scope:'both'},
  {id:'treasury',label:'Tesoreria · riepilogo',enabled:true,scope:'treasury'},
  {id:'lessons',label:'Lezioni del giorno',enabled:true,scope:'teacher'},
  {id:'uniforms',label:'Divise · richieste',enabled:true,scope:'uniform_manager'},
  {id:'projects',label:'Progetti',enabled:true,scope:'council'},
  {id:'clock',label:'Orologio e data',enabled:true,scope:'both'},
  {id:'social',label:'Social e link',enabled:true,scope:'both'},
  {id:'video',label:'Video YouTube',enabled:true,scope:'both'},
  {id:'donation',label:'Donazioni',enabled:true,scope:'both'},
  {id:'shortcuts',label:'Scorciatoie',enabled:true,scope:'both'}
];
state.myPanels??=['calendar','rooms','news','treasury','lessons','uniforms','projects','social','donation'];
state.previewRole??='master';
state.calendarView??='week';
state.calendarOffset??=0;
state.fontFamily??='calibri';
state.highContrast??=false;
state.videoUrl??='';
state.socialUrl??='https://www.instagram.com/';
state.messageFrom??='Master beta';
state.familyView??=null;
state.schoolMaterials??=[{id:1,title:'Metodo di clarinetto (esempio)',teacher:'Mario Rossi',url:'',views:3}];
state.participations??=[];
state.customInfo??='Benvenuti nella banda! Contenuti dimostrativi modificabili dal Master.';
// L'uso di dataset.dataset è soltanto per simulare le azioni; nessuna API remota.
const pushState=()=>{save();render()};
function viewVisibility(id){
  const item=state.panelCatalog.find(p=>p.id===id);
  if(!item?.enabled)return false;
  // Le regole simulate separano il visitatore dall'utente con privilegi.
  const role=state.previewRole;
  if(role==='master')return true;
  if(item.scope==='both')return true;
  if(role==='public')return false;
  if(item.scope==='internal')return true;
  if(item.scope===role)return true;
  if(item.scope==='teacher'&&role==='member')return false;
  return false;
}
function allEvents(){
  const ev=state.events.map(e=>({id:'e'+e.id,date:e.date,from:e.time||'00:00',to:e.to||'',title:e.title,type:e.type,room:e.room||'',who:''}));
  const bk=state.bookings.map(b=>({id:'b'+b.id,date:b.date,from:b.from,to:b.to,title:'Prenotazione · '+b.kind,type:'Prenotazione',room:b.room,who:b.who}));
  const le=state.lessons.map(l=>({id:'l'+l.id,date:l.date,from:l.from,to:l.to,title:'Lezione · '+l.teacher+' / '+l.student,type:'Lezione',room:l.room,who:l.student}));
  const list=[...ev,...bk,...le].sort((a,b)=>(a.date+a.from).localeCompare(b.date+b.from));
  return state.previewRole==='public'?list.filter(x=>['Concerto','Servizio'].includes(x.type)):list;
}
const localDay=d=>new Date(d+'T12:00:00');
const isoDate=d=>{const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`};
function calendarWidget(){
 const now=localDay(TODAY()),base=new Date(now);base.setDate(base.getDate()+state.calendarOffset*(state.calendarView==='day'?1:state.calendarView==='week'?7:30));
 const current=isoDate(base),events=allEvents();let content='';
 if(state.calendarView==='day'){
   const rows=events.filter(e=>e.date===current);
   content=rows.length?rows.map(x=>`<div class="eventrow"><b>${esc(x.from)}${x.to?'–'+esc(x.to):''}</b><span><strong>${esc(x.title)}</strong><small>${esc(x.room||x.type)} ${esc(x.who)}</small></span></div>`).join(''):'<p class="note">Nessuna attività prevista in questa giornata.</p>';
 }else if(state.calendarView==='week'){
   const start=new Date(base);start.setDate(start.getDate()-(start.getDay()+6)%7);
   content=`<div class="weekgrid">${Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);const key=isoDate(d),items=events.filter(e=>e.date===key);return `<button class="daycard" data-calendar-day="${key}"><b>${['Lun','Mar','Mer','Gio','Ven','Sab','Dom'][i]} ${d.getDate()}</b>${items.map(x=>`<span class="eventdot">${esc(x.from)} ${esc(x.title)}</span>`).join('')||'<small>—</small>'}</button>`}).join('')}</div>`;
 }else{
   const first=new Date(base.getFullYear(),base.getMonth(),1),last=new Date(base.getFullYear(),base.getMonth()+1,0),blanks=(first.getDay()+6)%7;
   content=`<div class="monthgrid">${['L','M','M','G','V','S','D'].map(x=>`<b>${x}</b>`).join('')}${Array.from({length:blanks},()=>'<span></span>').join('')}${Array.from({length:last.getDate()},(_,i)=>{const day=i+1,k=isoDate(new Date(base.getFullYear(),base.getMonth(),day)),c=events.filter(e=>e.date===k).length;return `<button data-calendar-day="${k}"><b>${day}</b>${c?`<small>${c} eventi</small>`:''}</button>`}).join('')}</div>`;
 }
 return `<div class="calendar-controls"><div><button class="secondary" data-cal-step="-1">‹</button> <b>${base.toLocaleDateString('it-IT',{month:'long',year:'numeric'})}</b> <button class="secondary" data-cal-step="1">›</button> <button class="secondary" id="calToday">Oggi</button></div><div>${[['day','Giorno'],['week','Settimana'],['month','Mese']].map(([v,t])=>`<button class="${state.calendarView===v?'btn':'secondary'}" data-cal-view="${v}">${t}</button>`).join('')}</div></div>${content}`;
}
function roomOverview(){
 const time=new Date().toTimeString().slice(0,5),day=TODAY(),rooms=state.classrooms.filter(x=>x.active);
 const occupied=rooms.filter(r=>allEvents().some(e=>e.date===day&&e.room===r.name&&e.from<=time&&(e.to||'23:59')>time));
 return `<p><strong>${rooms.length-occupied.length}/${rooms.length}</strong> aule disponibili secondo il calendario · <strong>${occupied.length}</strong> occupate in questa fascia.</p><div class="chips">${rooms.map(r=>`<span class="pill">${esc(r.name)}: ${occupied.some(x=>x.id===r.id)?'occupata':'libera'}</span>`).join('')}</div><p class="note">Stima basata sulle prenotazioni e lezioni, non sulla presenza fisica.</p>`;
}
const ledgerTotals=()=>state.ledger.reduce((a,x)=>{a[x.kind==='entrata'?'income':'expense']+=Number(x.amount)||0;return a},{income:0,expense:0});
function donutWidget(){
 const t=ledgerTotals(),sum=t.income+t.expense,angle=sum?t.income/sum*360:0;
 return `<div class="moneywidget"><div class="donut" style="--angle:${angle}deg"><span>${euro(t.income-t.expense)}</span></div><div><p>Entrate: <strong>${euro(t.income)}</strong></p><p>Uscite: <strong>${euro(t.expense)}</strong></p><p>${t.income>=t.expense?'Avanzo':'Disavanzo'}: <strong>${euro(Math.abs(t.income-t.expense))}</strong></p><button class="secondary" data-tab="treasury">Apri Tesoreria</button></div></div>`;
}
function widgetContent(id){
 if(id==='calendar')return card('Calendario',calendarWidget());
 if(id==='rooms')return card('Situazione sede',roomOverview());
 if(id==='news')return card('Comunicazioni',`<p>${esc(state.customInfo)}</p>`);
 if(id==='treasury')return card('Tesoreria · riepilogo',donutWidget());
 if(id==='lessons')return card('Lezioni di oggi',state.lessons.filter(l=>l.date===TODAY()).map(l=>`<p>${esc(l.from)} · ${esc(l.student)} con ${esc(l.teacher)} · ${esc(l.room)}</p>`).join('')||'<p>Nessuna lezione programmata oggi.</p>');
 if(id==='uniforms')return card('Divise · richieste in attesa',`<p class="num">${state.uniformRequests.filter(r=>r.status==='pending').length}</p><button class="secondary" data-tab="uniforms">Apri magazzino</button>`);
 if(id==='projects')return card('Progetti del consiglio',state.projects.map(p=>`<p>${esc(p.title)} · ${esc(p.status)}</p>`).join(''));
 if(id==='clock')return card('Data e ora',`<p class="num" id="clockLive">${new Date().toLocaleString('it-IT')}</p>`);
 if(id==='social')return card('Social della banda',`<p><a href="${esc(state.socialUrl)}" target="_blank" rel="noopener noreferrer">Apri il collegamento social ↗</a></p>`);
 if(id==='video')return card('Video',state.videoUrl?`<p><a href="${esc(state.videoUrl)}" target="_blank" rel="noopener noreferrer">Apri video selezionato ↗</a></p>`:'<p>Il Master può inserire un collegamento YouTube.</p>');
 if(id==='donation')return card('Sostieni la banda','<p>Donazioni previste tramite PayPal; i pagamenti sono disabilitati in questa demo.</p>');
 if(id==='shortcuts')return card('Accesso rapido',`<div class="actions">${[['calendar','Calendario'],['people','Anagrafica'],['uniforms','Divise']].map(([id,n])=>`<button class="secondary" data-tab="${id}">${n}</button>`).join('')}</div>`);
 return '';
}
screens.dashboard=()=>{
 const ids=state.myPanels.filter(id=>viewVisibility(id));
 const display=['calendar',...ids.filter(id=>id!=='calendar')];
 return `<p class="note">Vista dimostrativa: <select id="previewRole" class="smallselect">${[['master','Master'],['member','Socio attivo'],['teacher','Insegnante'],['treasury','Tesoriere'],['public','Visitatore senza login']].map(([k,v])=>`<option value="${k}" ${k===state.previewRole?'selected':''}>${v}</option>`).join('')}</select> · cambia ruolo per verificare la visibilità, senza autenticazione reale.</p>${display.filter((id,i)=>display.indexOf(id)===i&&viewVisibility(id)).map(widgetContent).join('')||'<p>Nessun pannello disponibile.</p>'}`;
};
screens.calendar=()=>`${card('Calendario condiviso',calendarWidget())}${state.previewRole==='public'?card('Calendario pubblico','<p>Le prove, le lezioni e le prenotazioni non sono visibili ai visitatori.</p>'):card('Eventi e prenotazioni',`<div class="actions"><button class="btn" id="sampleEvent">Aggiungi evento demo</button></div>${table(['Data','Dalle','Tipo','Titolo','Luogo'],allEvents().map(x=>[x.date,x.from,x.type,x.title,x.room]))}`)}`;
screens.treasury=()=>`${card('Quadro economico · dati fittizi',donutWidget())}${card('Registra entrata o uscita dimostrativa',`<div class="grid2"><div><label>Data</label><input id="ldDate" type="date" value="${TODAY()}"></div><div><label>Movimento</label><select id="ldKind"><option value="entrata">Entrata</option><option value="uscita">Uscita</option></select></div>${formField('Categoria','ldCat','text','Quote soci')}${formField('Importo €','ldAmount','number','20')}${formField('Descrizione','ldDesc','text','')}</div><div class="actions"><button class="btn" id="ldSave">Registra movimento demo</button></div><p class="note">Un movimento non rappresenta un pagamento certificato né una liquidazione irrevocabile.</p>`)}${card('Registro economico',`<div class="scroll"><table><thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrizione</th><th>Importo</th></tr></thead><tbody>${state.ledger.map(x=>`<tr><td>${esc(x.date)}</td><td>${esc(x.kind)}</td><td>${esc(x.category)}</td><td>${esc(x.description)}</td><td>${euro(x.amount)}</td></tr>`).join('')}</tbody></table></div>`)}${card('Liquidazioni · progettazione protetta','<p>Il futuro sistema separerà compensi dei soci, pagamenti degli insegnanti e musicanti esterni. La doppia conferma annuale dei soci sarà disponibile solo dopo aver implementato transazioni atomiche e autorizzazioni sul server.</p>')}`;
screens.messages=()=>`${card('Messaggi · demo locale',`<p class="note">Questi messaggi esistono soltanto su questo dispositivo e NON vengono recapitati ad altri utenti.</p><div class="grid2">${formField('Da (simulato)','msgFrom','text',state.messageFrom)}${formField('Destinatario','msgTo','text','Mario Rossi')}</div><label>Messaggio</label><textarea id="msgBody" rows="4" placeholder="Scrivi un messaggio di prova"></textarea><div class="actions"><button class="btn" id="msgSend">Inserisci messaggio demo</button></div>`)}${card('Conversazioni archiviate',state.chats.slice().reverse().map(m=>`<article class="message"><strong>${esc(m.from)} → ${esc(m.to)}</strong><small>${new Date(m.at).toLocaleString('it-IT')}</small><p>${esc(m.body)}</p></article>`).join(''))}${card('Messaggistica cloud','<p>Da realizzare: recapito server, identità verificata, allegati, notifiche, letture, controllo dei contatti dei minorenni.</p>')}`;
screens.school=()=>`${card('Lezioni programmate',`${table(['Data','Dalle','Alle','Insegnante','Alunno','Aula','Stato'],state.lessons.map(l=>[l.date,l.from,l.to,l.teacher,l.student,l.room,l.status]))}`)}${card('Nuova lezione demo',`<div class="grid2">${formField('Data','scDate','date',TODAY())}${formField('Dalle','scFrom','time','16:00')}${formField('Alle','scTo','time','17:00')}${formField('Insegnante','scTeacher','text','Mario Rossi')}${formField('Alunno','scStudent','text','Giulia Verdi')}<div><label>Aula</label><select id="scRoom">${state.classrooms.filter(x=>x.active).map(x=>`<option>${esc(x.name)}</option>`).join('')}</select></div></div><div class="actions"><button class="btn" id="scAdd">Aggiungi lezione demo</button></div>`)}${card('Presenze, recuperi e materiali',`<div class="actions">${state.lessons.filter(l=>l.status==='programmata').slice(0,8).map(l=>`<button class="secondary" data-lesson-done="${l.id}">Segna svolta · ${esc(l.student)} · ${esc(l.date)}</button>`).join('')}</div><h3>Materiali</h3>${state.schoolMaterials.map(f=>`<p>${esc(f.title)} · Consultazioni demo: ${f.views} <button class="secondary" data-material="${f.id}">Apri / conta consultazione</button></p>`).join('')}<p class="note">Lezioni collettive, lezioni ricorrenti e recuperi complessi richiedono il backend definitivo.</p>`)}`;
screens.council=()=>`${card('Progetti del consiglio',table(['Progetto','Stato','Entrate','Costi','Risultato'],state.projects.map(p=>[p.title,p.status,euro(p.income),euro(p.cost),euro(p.income-p.cost)])))}${card('Nuovo progetto demo',`<div class="grid2">${formField('Titolo','prTitle')}${formField('Entrate previste €','prIncome','number','0')}${formField('Costi previsti €','prCost','number','0')}</div><div class="actions"><button class="btn" id="prCreate">Crea progetto</button></div>`)}${card('Gestione stato',state.projects.map(p=>`<p>${esc(p.title)} · ${esc(p.status)} ${p.status==='aperto'?`<button class="secondary" data-project-close="${p.id}">Chiudi progetto</button>`:''}</p>`).join(''))}`;
screens.music=()=>`${card('Concerti, servizi e prove',`<div class="actions"><button class="btn" id="sampleEvent">Aggiungi evento demo</button></div>${table(['Data','Ora','Tipo','Descrizione'],state.events.map(x=>[x.date,x.time,x.type,x.title]))}`)}${card('Nuovo evento musicale demo',`<div class="grid2">${formField('Titolo','evTitle')}${formField('Data','evDate','date',TODAY())}${formField('Ora','evTime','time','20:45')}<div><label>Tipo</label><select id="evType">${sel(['Concerto','Servizio','Prova'],'Concerto')}</select></div></div><button class="btn" id="evAdd">Registra evento</button>`)}${card('Presenze e spartiti','<p>Predisposti nel modello: presenze per musicante, invitati esterni, spartiti PDF e compensi per fascia. In questa versione non vengono effettuati pagamenti.</p>')}`;
screens.media=()=>`${card('Comunicazioni Dashboard',`<label>Testo pubblico</label><textarea id="infoText" rows="4">${esc(state.customInfo)}</textarea><button class="btn" id="saveInfo">Aggiorna testo demo</button>`)}${card('Collegamenti social e video',`${formField('URL social','socialUrl','url',state.socialUrl)}${formField('URL video YouTube','videoUrl','url',state.videoUrl)}<div class="actions"><button class="btn" id="saveMedia">Salva collegamenti</button></div><p class="note">Pubblicazione tramite Meta API non implementata.</p>`)}`;
const oldMasterScreen=screens.master;
screens.master=()=>{
 const roomRows=state.classrooms.map(r=>`<tr><td>${esc(r.name)}</td><td><input id="roomName${r.id}" value="${esc(r.name)}"></td><td><input type="checkbox" style="width:auto" data-room-active="${r.id}" ${r.active?'checked':''}></td><td><button class="secondary" data-room-rename="${r.id}">Salva</button></td></tr>`).join('');
 const widgetRows=state.panelCatalog.map(p=>`<label class="role-check"><input type="checkbox" style="width:auto" data-catalog="${p.id}" ${p.enabled?'checked':''}> ${esc(p.label)} <small>(${esc(p.scope)})</small></label>`).join('');
 return oldMasterScreen()+card('Gestione aule',`<div class="grid2">${formField('Nome nuova aula','newRoom')}</div><button class="btn" id="addRoom">Aggiungi aula</button><div class="scroll"><table><thead><tr><th>Aula</th><th>Nuovo nome</th><th>Attiva</th><th>Azioni</th></tr></thead><tbody>${roomRows}</tbody></table></div>`)+card('Libreria widget',`<p class="note">Il Master abilita i pannelli; ogni utente personalizza solo quelli consentiti.</p>${widgetRows}`);
};

// Il legame familiare è autonomo rispetto ai 14 flag: un genitore può non essere socio.
const prevPeopleScreen=screens.people;
screens.people=()=>prevPeopleScreen()+card('Rappresentanti legali · demo',`
 <p class="note">L'accesso del genitore è una delega personale verificata. Questa demo permette solo di simulare il collegamento: nessuna identità è verificata.</p>
 <div class="grid2"><div><label>Figlio / figlia</label><select id="familyChild">${optionsPeople()}</select></div><div><label>Genitore (nome dimostrativo)</label><input id="familyParent" placeholder="Nome del rappresentante"></div></div>
 <button class="btn" id="familyLink">Collega rappresentante</button>
 ${table(['Minore','Rappresentante','Stato'],state.families.map(x=>[personLabel(x.child),x.parent,x.active?'Attiva fino ai 18 anni':'Terminata']))}
 <p class="note">Alla maggiore età la delega ordinaria termina; non viene cancellato lo storico. L'account personale del minore può coesistere con quello del genitore.</p>`);
screens.band=()=>card('La mia banda',`<p><strong>Corpo Bandistico “Città di Lavagna”</strong></p><p>Questa pagina accoglierà descrizione ufficiale, foto, statuto e regolamento dell'associazione.</p><p>${esc(state.customInfo)}</p><p class="note">I documenti ufficiali verranno caricati dopo l'attivazione dello storage protetto.</p>`);
screens.settings=()=>`${card('Versione BetaBanda',`<p><strong>BetaBanda ${VERSION}</strong> · PWA dimostrativa</p><button class="secondary" id="checkUpdate">Controlla aggiornamenti</button><p class="note" id="updateResult">Controllo manifest remoto: disponibile se il sito è servito via HTTP(S). Un nuovo aggiornamento richiede un nuovo rilascio sul sito.</p>`)}${card('Tema e accessibilità',`<div class="grid2"><div><label>Tema</label><select id="theme">${[['auto','Automatico'],['light','Chiaro'],['dark','Scuro']].map(([id,t])=>`<option value="${id}" ${state.theme===id?'selected':''}>${t}</option>`).join('')}</select></div><div><label>Carattere</label><select id="family">${[['calibri','Calibri / alternativa compatibile'],['hyper','Atkinson Hyperlegible / alternativa'],['system','Carattere originale']].map(([id,t])=>`<option value="${id}" ${state.fontFamily===id?'selected':''}>${t}</option>`).join('')}</select></div></div><label>Dimensione caratteri · ${state.font}%</label><input id="font" type="range" min="80" max="200" step="5" value="${state.font}"><label><input type="checkbox" id="contrast" style="width:auto" ${state.highContrast?'checked':''}> Modalità contrasto elevato</label><p class="note">I font non installati sul dispositivo usano un'alternativa locale. Non vengono redistribuiti caratteri proprietari.</p>`)}${card('La mia Dashboard',`<p>Attiva e ordina i widget concessi dal Master. La configurazione viene conservata soltanto in questo browser.</p>${state.panelCatalog.filter(x=>x.enabled).map(x=>`<label class="role-check"><input type="checkbox" style="width:auto" data-my-panel="${x.id}" ${state.myPanels.includes(x.id)?'checked':''}> ${esc(x.label)} ${!viewVisibility(x.id)?'<small>(non visibile nella modalità attuale)</small>':''}</label>`).join('')}<button class="secondary" id="defaultPanels">Ripristina pannelli predefiniti</button>`)}`;
// Mantiene l'handler della Beta 3, aggiungendo esclusivamente gli eventi nuovi.
const previousWire=wire;
wire=function(){previousWire();let el;
 const on=(id,cb)=>{const x=$('#'+id);if(x)x.addEventListener('click',cb)};
 const val=id=>$('#'+id)?.value?.trim()||'';
 if(el=$('#previewRole'))el.onchange=()=>{state.previewRole=el.value;pushState()};
 document.querySelectorAll('[data-cal-view]').forEach(x=>x.onclick=()=>{state.calendarView=x.dataset.calView;state.calendarOffset=0;pushState()});
 document.querySelectorAll('[data-cal-step]').forEach(x=>x.onclick=()=>{state.calendarOffset+=Number(x.dataset.calStep);pushState()});
 document.querySelectorAll('[data-calendar-day]').forEach(x=>x.onclick=()=>{state.calendarView='day';state.calendarOffset=Math.round((localDay(x.dataset.calendarDay)-localDay(TODAY()))/86400000);pushState()});
 on('calToday',()=>{state.calendarOffset=0;state.calendarView='day';pushState()});
 on('familyLink',()=>{const child=Number(val('familyChild')),parent=val('familyParent');if(!child||!parent)return alert('Seleziona minore e rappresentante.');const p=state.people.find(x=>x.id===child);if(!p?.birthDate)return alert('Inserire prima la data di nascita.');const age=(Date.now()-new Date(p.birthDate+'T12:00:00'))/(365.2425*86400000);if(age>=18)return alert('La persona è già maggiorenne: serve un diverso tipo di delega.');state.families.push({id:uid(),child,parent,active:true});pushState()});
 on('ldSave',()=>{const amount=Number(val('ldAmount'));if(!Number.isFinite(amount)||amount<=0||!val('ldDate')||!val('ldCat'))return alert('Inserisci categoria, data e importo valido.');state.ledger.push({id:uid(),date:val('ldDate'),kind:val('ldKind'),category:val('ldCat'),description:val('ldDesc'),amount});pushState()});
 on('msgSend',()=>{if(!val('msgFrom')||!val('msgTo')||!val('msgBody'))return alert('Compila mittente, destinatario e messaggio.');state.messageFrom=val('msgFrom');state.chats.push({id:uid(),from:val('msgFrom'),to:val('msgTo'),body:val('msgBody'),at:new Date().toISOString()});pushState()});
 on('scAdd',()=>{if(!val('scDate')||!val('scTeacher')||!val('scStudent')||val('scFrom')>=val('scTo'))return alert('Controlla i dati della lezione.');if(state.bookings.some(b=>b.room===val('scRoom')&&b.date===val('scDate')&&val('scFrom')<b.to&&b.from<val('scTo'))||state.lessons.some(l=>l.room===val('scRoom')&&l.date===val('scDate')&&val('scFrom')<l.to&&l.from<val('scTo')))return alert('Aula già occupata.');state.lessons.push({id:uid(),date:val('scDate'),from:val('scFrom'),to:val('scTo'),teacher:val('scTeacher'),student:val('scStudent'),room:val('scRoom'),status:'programmata'});pushState()});
 document.querySelectorAll('[data-lesson-done]').forEach(x=>x.onclick=()=>{const l=state.lessons.find(l=>l.id===Number(x.dataset.lessonDone));if(l)l.status='svolta';pushState()});
 document.querySelectorAll('[data-material]').forEach(x=>x.onclick=()=>{const m=state.schoolMaterials.find(m=>m.id===Number(x.dataset.material));if(m)m.views++;pushState()});
 on('prCreate',()=>{if(!val('prTitle'))return alert('Inserisci il titolo.');const income=Number(val('prIncome')),cost=Number(val('prCost'));if(!Number.isFinite(income)||!Number.isFinite(cost)||income<0||cost<0)return alert('Importi non validi.');state.projects.push({id:uid(),title:val('prTitle'),income,cost,status:'aperto'});pushState()});
 document.querySelectorAll('[data-project-close]').forEach(x=>x.onclick=()=>{const p=state.projects.find(p=>p.id===Number(x.dataset.projectClose));if(p)p.status='chiuso';pushState()});
 on('evAdd',()=>{if(!val('evTitle')||!val('evDate'))return alert('Titolo e data obbligatori.');state.events.push({id:uid(),title:val('evTitle'),date:val('evDate'),time:val('evTime'),type:val('evType'),room:''});pushState()});
 on('saveInfo',()=>{state.customInfo=val('infoText');pushState()});
 on('saveMedia',()=>{const goodUrl=url=>!url||/^https:\/\//i.test(url);if(!goodUrl(val('socialUrl'))||!goodUrl(val('videoUrl')))return alert('Usa collegamenti HTTPS.');state.socialUrl=val('socialUrl');state.videoUrl=val('videoUrl');pushState()});
 on('addRoom',()=>{const name=val('newRoom');if(!name)return; if(state.classrooms.some(x=>norm(x.name)===norm(name)))return alert('Aula già presente.');state.classrooms.push({id:uid(),name,active:true});state.rooms=state.classrooms.filter(x=>x.active).map(x=>x.name);pushState()});
 document.querySelectorAll('[data-room-rename]').forEach(x=>x.onclick=()=>{const r=state.classrooms.find(r=>String(r.id)===x.dataset.roomRename),name=val('roomName'+x.dataset.roomRename);if(!r||!name)return;if(state.classrooms.some(z=>z.id!==r.id&&norm(z.name)===norm(name)))return alert('Nome già in uso.');const old=r.name;r.name=name;state.bookings.forEach(b=>{if(b.room===old)b.room=name});state.lessons.forEach(l=>{if(l.room===old)l.room=name});state.rooms=state.classrooms.filter(z=>z.active).map(z=>z.name);pushState()});
 document.querySelectorAll('[data-room-active]').forEach(x=>x.onchange=()=>{const r=state.classrooms.find(r=>String(r.id)===x.dataset.roomActive);if(r)r.active=x.checked;state.rooms=state.classrooms.filter(r=>r.active).map(r=>r.name);pushState()});
 document.querySelectorAll('[data-catalog]').forEach(x=>x.onchange=()=>{const p=state.panelCatalog.find(p=>p.id===x.dataset.catalog);if(p)p.enabled=x.checked;pushState()});
 document.querySelectorAll('[data-my-panel]').forEach(x=>x.onchange=()=>{if(x.checked&&!state.myPanels.includes(x.dataset.myPanel))state.myPanels.push(x.dataset.myPanel);if(!x.checked)state.myPanels=state.myPanels.filter(id=>id!==x.dataset.myPanel);pushState()});
 on('defaultPanels',()=>{state.myPanels=['calendar','rooms','news','social','donation'];pushState()});
 if(el=$('#family'))el.onchange=()=>{state.fontFamily=el.value;pushState()};
 if(el=$('#contrast'))el.onchange=()=>{state.highContrast=el.checked;pushState()};
 on('checkUpdate',async()=>{const label=$('#updateResult');if(!label)return;try{const response=await fetch('./version.json?nocache='+Date.now(),{cache:'no-store'});if(!response.ok)throw Error('Versione remota non raggiungibile');const data=await response.json();label.textContent=data.version===VERSION?'Hai la versione più recente pubblicata.':`Versione pubblicata: ${data.version}. Ricarica la pagina per ricevere gli aggiornamenti.`;if(data.version!==VERSION&&navigator.serviceWorker?.controller)navigator.serviceWorker.getRegistration().then(reg=>reg?.update())}catch{label.textContent='Impossibile verificare online. Apri la PWA via HTTPS o localhost e riprova.'}});
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;save();render();$('#menu').classList.remove('open')});
};
const oldRender=render;
render=function(){
 document.body.classList.toggle('high-contrast',!!state.highContrast);
 document.documentElement.style.setProperty('--font',state.font+'%');
 document.documentElement.style.setProperty('--app-family',state.fontFamily==='calibri'?"Calibri,Carlito,'Segoe UI',sans-serif":state.fontFamily==='hyper'?"'Atkinson Hyperlegible','Verdana',sans-serif":"system-ui,-apple-system,'Segoe UI',sans-serif");
 oldRender();
 document.body.classList.toggle('high-contrast',!!state.highContrast);
};
// Riprende la visualizzazione usando lo stato già salvato; nessun dato viene cancellato.
save();render();
