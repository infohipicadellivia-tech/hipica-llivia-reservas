(() => {
  let clients=[],selected=null;
  const isStaff=()=>state.profile&&['staff','admin'].includes(state.profile.role);

  function install(){
    if(!isStaff()||document.querySelector('#openClients'))return;
    const check=()=>{
      if(state.view!=='admin')return;
      const hero=content.querySelector('.hero');
      if(!hero||document.querySelector('#openClients'))return;
      const b=document.createElement('button');
      b.id='openClients';b.type='button';b.className='secondary calendar-launch';
      b.textContent='👥 Clientes y bonos';b.onclick=openClients;
      hero.insertAdjacentElement('afterend',b);
    };
    new MutationObserver(check).observe(content,{childList:true,subtree:true});check();
  }

  async function openClients(){
    content.innerHTML='<div class="card muted">Cargando clientes…</div>';
    const r=await db.from('customer_admin_summary').select('*').eq('active',true).order('full_name');
    if(r.error){console.error(r.error);return toast('No se pudieron cargar los clientes.');}
    clients=r.data||[];renderList();
  }

  function renderList(filter=''){
    const f=filter.toLowerCase();
    const rows=clients.filter(c=>!f||c.full_name?.toLowerCase().includes(f)||c.phone?.includes(filter)||c.email?.toLowerCase().includes(f));
    content.innerHTML=`<button id="clBack" class="ghost">← Volver</button><h2>Clientes y bonos</h2>
      <label>Buscar por nombre, teléfono o email<input id="clSearch" value="${esc(filter)}" placeholder="Ej. Maria o 600123123"></label>
      <div id="clRows">${rows.map(c=>`<button class="service-card" data-client="${c.client_id}" type="button"><div class="row"><div><h3>${esc(c.full_name)}</h3><div class="muted">${esc(c.phone||'Sin teléfono')}${c.email?' · '+esc(c.email):''}</div></div><div style="text-align:right"><strong>${Number(c.visible_credit_total||0)} créditos</strong><div class="muted">${c.active_pass_count} bono(s)</div></div></div></button>`).join('')||'<div class="card muted">No hay clientes.</div>'}</div>`;
    $('#clBack').onclick=()=>setView('admin');
    $('#clSearch').oninput=e=>renderList(e.target.value);
    content.querySelectorAll('[data-client]').forEach(b=>b.onclick=()=>openClient(b.dataset.client));
  }

  async function openClient(id){
    selected=clients.find(x=>x.client_id===id);if(!selected)return;
    const [bookings,passes,products]=await Promise.all([
      db.from('booking_schedule').select('*').eq('client_id',selected.client_id).order('starts_at',{ascending:false}).limit(20),
      db.from('passes').select('*').eq('client_id',selected.client_id).order('created_at',{ascending:false}),
      db.from('pass_products').select('*').eq('active',true).order('price')
    ]);
    content.innerHTML=`<button id="clientBack" class="ghost">← Clientes</button>
      <section class="hero"><h2>${esc(selected.full_name)}</h2><div>${esc(selected.phone||'')}${selected.email?' · '+esc(selected.email):''}</div></section>
      <div class="grid">
        <button id="contactPrefs" class="secondary service-card" type="button"><strong>📞 Preferencias de contacto</strong><div class="muted">Canales para reservas y bonos</div></button>
        <button id="clientFiles" class="secondary service-card" type="button"><strong>📎 Archivos</strong><div class="muted">Fotos y documentos internos</div></button>
      </div>
      <div class="grid"><div class="card"><div class="metric">${Number(selected.visible_credit_total||0)}</div><strong>Créditos disponibles</strong></div><div class="card"><div class="metric">${selected.booking_count||0}</div><strong>Reservas</strong></div></div>
      <h2>Bonos</h2>
      <div class="card"><label>Crear bono<select id="productSelect">${(products.data||[]).map(p=>`<option value="${p.code}">${esc(p.name)} · ${p.price} €</option>`).join('')}</select></label><label>Caducidad opcional<input id="passExpiry" type="date"></label><button id="issuePass" class="primary" type="button">Crear bono</button></div>
      ${(passes.data||[]).map(p=>`<article class="card"><div class="row"><div><h3>${esc(p.name)}</h3><div class="muted">${p.purchase_price!=null?Number(p.purchase_price)+' € · ':''}${esc(p.status)}</div></div><div class="metric">${Number(p.remaining_credits)}</div></div><div class="muted">de ${Number(p.initial_credits)} créditos${p.expires_at?' · caduca '+new Date(p.expires_at+'T12:00:00').toLocaleDateString('es-ES'):''}</div><div class="admin-actions"><button class="secondary" data-adjust="${p.id}" data-delta="1" type="button">+1 crédito</button><button class="ghost" data-adjust="${p.id}" data-delta="-1" type="button">-1 crédito</button><button class="ghost" data-moves="${p.id}" type="button">Movimientos</button></div></article>`).join('')||'<div class="card muted">Sin bonos.</div>'}
      <h2>Últimas reservas</h2>${(bookings.data||[]).map(b=>`<div class="card row"><div><strong>${esc(b.service_name)}</strong><div class="muted">${formatDate(b.starts_at)} · ${formatHour(b.starts_at)} · ${b.participant_count||1} persona(s)</div></div><span class="status ${b.status}">${esc(b.status)}</span></div>`).join('')||'<div class="card muted">Sin reservas.</div>'}`;

    $('#clientBack').onclick=()=>renderList();
    $('#contactPrefs').onclick=()=>window.openCustomerContactPreferences?window.openCustomerContactPreferences(id):toast('No se ha cargado Preferencias de contacto.');
    $('#clientFiles').onclick=()=>window.openCustomerFiles?window.openCustomerFiles(id):toast('No se ha cargado el módulo de archivos. Revisa index.html.');
    $('#issuePass').onclick=()=>issuePass(id);
    content.querySelectorAll('[data-adjust]').forEach(b=>b.onclick=()=>adjustPass(b.dataset.adjust,Number(b.dataset.delta)));
    content.querySelectorAll('[data-moves]').forEach(b=>b.onclick=()=>showMovements(b.dataset.moves));
  }

  async function issuePass(clientId){
    const code=$('#productSelect').value,expiry=$('#passExpiry').value||null;
    if(!confirm('¿Crear este bono para el cliente?'))return;
    const {error}=await db.rpc('admin_issue_customer_pass',{p_client_id:clientId,p_product_code:code,p_expires_at:expiry});
    if(error){console.error(error);return toast('No se pudo crear el bono.');}
    toast('Bono creado.');await openClients();await openClient(clientId);
  }

  async function adjustPass(passId,delta){
    const reason=prompt(`Motivo del ajuste de ${delta>0?'+':''}${delta} crédito:`);if(!reason)return;
    const {error}=await db.rpc('adjust_pass_balance',{p_pass_id:passId,p_delta:delta,p_reason:reason});
    if(error){console.error(error);return toast('No se pudo ajustar el saldo.');}
    toast('Saldo actualizado.');await openClients();await openClient(selected.client_id);
  }

  async function showMovements(passId){
    const r=await db.from('pass_movements').select('*').eq('pass_id',passId).order('created_at',{ascending:false});
    if(r.error)return toast('No se cargaron los movimientos.');
    content.innerHTML=`<button id="moveBack" class="ghost">← Volver al cliente</button><h2>Movimientos del bono</h2>${(r.data||[]).map(m=>`<div class="card row"><div><strong>${esc(m.reason)}</strong><div class="muted">${new Date(m.created_at).toLocaleString('es-ES')} · ${esc(m.movement_type)}</div></div><div><strong>${Number(m.credits)>0?'+':''}${Number(m.credits)}</strong><div class="muted">Saldo ${Number(m.balance_after)}</div></div></div>`).join('')||'<div class="card muted">Sin movimientos.</div>'}`;
    $('#moveBack').onclick=()=>openClient(selected.client_id);
  }

  const timer=setInterval(()=>{if(state.profile){install();clearInterval(timer)}},250);
  window.openClientFromPreferences=(clientId)=>openClient(clientId);
})();
