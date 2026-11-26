(() => {
  let rows=[];
  const isStaff=()=>state.profile&&['staff','admin'].includes(state.profile.role);

  function install(){
    if(!isStaff()||document.querySelector('#openPasses'))return;
    const check=()=>{
      if(state.view!=='admin')return;
      const hero=content.querySelector('.hero');
      if(!hero||document.querySelector('#openPasses'))return;
      const b=document.createElement('button');
      b.id='openPasses';b.type='button';b.className='secondary calendar-launch';
      b.textContent='🎟️ Bonos';b.onclick=openPasses;
      const clients=document.querySelector('#openClients');
      clients?clients.insertAdjacentElement('afterend',b):hero.insertAdjacentElement('afterend',b);
    };
    new MutationObserver(check).observe(content,{childList:true,subtree:true});check();
  }

  async function openPasses(){
    content.innerHTML='<div class="card muted">Cargando bonos…</div>';
    const r=await db.from('passes').select('*,customers:client_id(full_name,phone,email)').order('created_at',{ascending:false});
    if(r.error){console.error(r.error);return toast('No se pudieron cargar los bonos.');}
    rows=r.data||[];render();
  }

  function render(filter=''){
    const f=filter.trim().toLowerCase();
    const list=rows.filter(p=>!f||(p.customers?.full_name||'').toLowerCase().includes(f)||(p.customers?.phone||'').includes(filter)||(p.name||'').toLowerCase().includes(f));
    const active=rows.filter(p=>p.status==='active');
    const credits=active.reduce((s,p)=>s+Number(p.remaining_credits||0),0);
    const soon=active.filter(p=>p.expires_at&&new Date(p.expires_at+'T12:00:00')<=new Date(Date.now()+30*86400000)).length;
    content.innerHTML=`<button id="passBack" class="ghost">← Volver</button><h2>🎟️ Bonos</h2>
      <div class="grid"><div class="card"><div class="metric">${active.length}</div><strong>Bonos activos</strong></div><div class="card"><div class="metric">${credits}</div><strong>Créditos disponibles</strong></div><div class="card"><div class="metric">${soon}</div><strong>Caducan ≤30 días</strong></div></div>
      <label>Buscar cliente, teléfono o bono<input id="passSearch" value="${esc(filter)}" placeholder="Ej. Maria, 600... o Bono particular"></label>
      ${list.map(p=>`<article class="card"><div class="row"><div><h3>${esc(p.customers?.full_name||'Cliente')}</h3><div class="muted">${esc(p.name)}${p.customers?.phone?' · '+esc(p.customers.phone):''}</div></div><span class="status ${p.status==='active'?'confirmed':'completed'}">${esc(p.status)}</span></div><div class="row"><div><strong>${Number(p.remaining_credits)} / ${Number(p.initial_credits)} créditos</strong><div class="muted">${p.expires_at?'Caduca '+new Date(p.expires_at+'T12:00:00').toLocaleDateString('es-ES'):'Sin caducidad'}</div></div><button class="secondary" data-pass-client="${p.client_id}">Abrir cliente</button></div></article>`).join('')||'<div class="card muted">No hay bonos con este filtro.</div>'}`;
    $('#passBack').onclick=()=>setView('admin');
    $('#passSearch').oninput=e=>render(e.target.value);
    content.querySelectorAll('[data-pass-client]').forEach(b=>b.onclick=async()=>{if(window.openAdminClients)await window.openAdminClients();if(window.openAdminClient)window.openAdminClient(b.dataset.passClient)});
  }

  const timer=setInterval(()=>{if(state?.profile){install();clearInterval(timer)}},250);
})();
