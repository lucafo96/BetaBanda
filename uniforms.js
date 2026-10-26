/**
 * BETABANDA - DIVISE REALI (BETA) - MODULO AUTONOMO
 * Il browser NON modifica direttamente le giacenze: ogni consegna viene eseguita
 * in una transazione SQL con controllo del ruolo e verifica dello stock.
 * Le vendite e i cambi con restituzione non sono ancora operativi: meglio
 * un bottone assente che un'operazione economica falsamente registrata.
 *
 * account_id identifica il possessore in questa beta; prima della migrazione
 * ufficiale dei soci occorre collegare e verificare account -> bb_people.
 */
window.bbUniforms = (() => {
 const fld=(id,title,type='text')=>`<label for="${id}">${title}</label><input id="${id}" type="${type}" required>`;
 const $=id=>document.getElementById(id);
 const check=r=>{if(r.error)throw r.error;return r.data};
 async function manager(db,account,roles,entry,esc,safe,inform){
  if(!roles.includes('total_master')&&!roles.includes('uniform_manager'))throw Error('Accesso al magazzino non autorizzato');
  const [v,r]=await Promise.all([db.from('bb_uniform_variants').select('*').order('item_name'),db.from('bb_uniform_requests').select('id,account_id,variant_id,quantity,request_type,status,created_at').eq('status','pending').order('created_at')]);
  const variants=check(v),requests=check(r),lookup=new Map(variants.map(x=>[x.id,x]));
  const ac=check(await db.from('bb_accounts').select('id,username'));
  const names=new Map(ac.map(x=>[x.id,x.username]));
  entry('Gestione divise · Magazzino',`<section><h2>Giacenze per articolo e taglia</h2><div class="tablewrap"><table><tr><th>Articolo</th><th>Taglia</th><th>Disponibili</th><th>Costo (€)</th><th>Prezzo (€)</th></tr>${variants.map(x=>`<tr><td>${esc(x.item_name)}</td><td>${esc(x.size_label)}</td><td>${x.stock}</td><td>${x.acquisition_cost}</td><td>${x.sale_price}</td></tr>`).join('')}</table></div></section>
  <section><h2>Carica un articolo o una nuova fornitura</h2><p class="muted">Se nome e taglia esistono, somma la quantità. Costo e prezzo aggiornano i valori correnti. Per correggere quantità errate servirà una rettifica motivata.</p><form id="stockForm">${fld('un','Articolo')}${fld('us','Taglia')}${fld('uq','Quantità da caricare','number')}${fld('uc','Costo unitario (€)','number')}${fld('up','Prezzo di vendita (€)','number')}<p><button class="primary">Registra carico</button></p></form></section>
  <section><h2>Richieste da evadere (${requests.length})</h2>${requests.map(x=>`<div class="item"><b>${esc(names.get(x.account_id)||'Account')}</b>: ${esc(lookup.get(x.variant_id)?.item_name||'Articolo')} · ${esc(lookup.get(x.variant_id)?.size_label||'')} · quantità ${x.quantity} (${x.request_type==='exchange'?'cambio':'nuova'}) <div class="row"><button data-yes="${x.id}">Consegna</button><button data-no="${x.id}">Rifiuta</button></div></div>`).join('')||'<p>Nessuna richiesta pendente.</p>'}</section><section><p class="muted">Vendite, restituzioni e rettifiche contabili saranno abilitate dopo le relative verifiche.</p></section>`);
  $('stockForm').onsubmit=safe(async e=>{e.preventDefault();check(await db.rpc('bb_uniform_add_stock',{p_name:$('un').value,p_size:$('us').value,p_qty:Number($('uq').value),p_cost:Number($('uc').value),p_price:Number($('up').value)}));inform('Carico salvato sul server');manager(db,account,roles,entry,esc,safe,inform)});
  document.querySelectorAll('[data-yes],[data-no]').forEach(b=>b.onclick=safe(async()=>{if(!confirm('Confermi la gestione della richiesta?'))return;check(await db.rpc('bb_uniform_resolve',{p_request:b.dataset.yes||b.dataset.no,p_accept:!!b.dataset.yes}));inform('Richiesta gestita');manager(db,account,roles,entry,esc,safe,inform)}));
 }
 async function mine(db,account,entry,esc,safe,inform){
  if(!account){entry('La mia dotazione','<p>Accedi per consultare la tua dotazione.</p>');return}
  const [v,r,m]=await Promise.all([db.from('bb_uniform_variants').select('id,item_name,size_label,stock').eq('active',true),db.from('bb_uniform_requests').select('id,variant_id,quantity,status,created_at').eq('account_id',account.id).order('created_at',{ascending:false}),db.from('bb_uniform_movements').select('variant_id,quantity_delta,action').eq('account_id',account.id)]);
  const variants=check(v),requests=check(r),movements=check(m),map=new Map(variants.map(x=>[x.id,x]));
  const assigned=new Map();for(const x of movements)assigned.set(x.variant_id,(assigned.get(x.variant_id)||0)-x.quantity_delta);
  entry('La mia dotazione',`<section><h2>Articoli che ti sono stati consegnati</h2>${[...assigned].filter(([,n])=>n>0).map(([id,n])=>`<div class="item">${esc(map.get(id)?.item_name||'Articolo')} · ${esc(map.get(id)?.size_label||'')} · quantità ${n}</div>`).join('')||'<p>Nessuna consegna ancora registrata.</p>'}<p class="muted">La dotazione riguarda per ora questo account verificato, non l’archivio soci storico.</p></section>
  <section><h2>Richiedi cambio/divisa</h2><form id="askUniform"><label for="uv">Articolo e taglia</label><select id="uv" required>${variants.map(x=>`<option value="${x.id}">${esc(x.item_name)} · ${esc(x.size_label)}</option>`).join('')}</select><label for="uqty">Quantità</label><input type="number" id="uqty" min="1" max="50" value="1" required><label for="utype">Richiesta</label><select id="utype"><option value="new">Nuova divisa</option><option value="exchange">Cambio taglia (richiede verifica)</option></select><label for="unote">Note</label><textarea id="unote" maxlength="1000"></textarea><p><button class="primary">Invia richiesta</button></p></form></section>
  <section><h2>Le mie richieste</h2>${requests.map(x=>`<div class="item">${esc(map.get(x.variant_id)?.item_name||'Articolo')} · quantità ${x.quantity} · ${esc(x.status)}</div>`).join('')||'<p>Non hai richieste.</p>'}</section>`);
  $('askUniform').onsubmit=safe(async e=>{e.preventDefault();check(await db.rpc('bb_uniform_request',{p_variant:$('uv').value,p_quantity:Number($('uqty').value),p_type:$('utype').value,p_note:$('unote').value}));inform('Richiesta salvata');mine(db,account,entry,esc,safe,inform)});
 }
 return {manager,mine};
})();
