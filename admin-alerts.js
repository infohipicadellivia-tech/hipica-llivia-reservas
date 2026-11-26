(() => {
  const isStaff=()=>state.profile&&['staff','admin'].includes(state.profile.role);
  let currentStatus='pending', currentAudience='all';

  function install(){
    if(!isStaff()||document.querySelector('#openAlerts'))return;
    const check=()=>{
      if(state.view!=='admin')return;
      const hero=content.querySelector('.hero');
      if(!hero||document.querySelector('#openAlerts'))return;
      const b=document.createElement('button');
      b.id='openAlerts';b.type='button';b.className='secondary calendar-launch';
      b.textContent='🔔 Bandeja de avisos';b.onclick=()=>openAlerts('pending','all');
      hero.insertAdjacentElement('afterend',b);
    };
    new MutationObserver(check).observe(content,{childList:true,subtree:true});check();
  }

  async function openAlerts(status=currentStatus,audience=currentAudience){
    currentStatus=status;currentAudience=audience;
    content.innerHTML='<div class="card muted">Cargando avisos…</div>';
    let q=db.from('operational_alerts').select('*,customers:client_id(full_name,phone,email)').order('created_at',{ascending:false}).limit(150);
    if(status!=='all')q=q.eq('status',status);
    if(audience!=='all')q=q.eq('audience',audience);
    const r=await q;
    if(r.error){console.error(r.error);return toast('No se pudieron cargar los avisos.');}
    const rows=r.data||[];
    content.innerHTML=`<button id="alertBack" class="ghost">← Volver</button><h2>🔔 Bandeja de avisos</h2>
      <div class="notice">👤 Cliente = comunicación potencial según sus preferencias. 🔒 Interno = tarea o recordatorio exclusivo de la Hípica.</div>
      <h3>Tipo</h3><div class="admin-tabs"><button data-aa="all" class="${audience==='all'?'secondary':'ghost'}">Todos</button><button data-aa="customer" class="${audience==='customer'?'secondary':'ghost'}">👤 Clientes</button><button data-aa="internal" class="${audience==='internal'?'secondary':'ghost'}">🔒 Internos</button></div>
      <h3>Estado</h3><div class="admin-tabs"><button data-as="pending" class="${status==='pending'?'secondary':'ghost'}">Pendientes</button><button data-as="handled" class="${status==='handled'?'secondary':'ghost'}">Gestionados</button><button data-as="cancelled" class="${status==='cancelled'?'secondary':'ghost'}">Descartados</button><button data-as="all" class="${status==='all'?'secondary':'ghost'}">Todos</button></div>
      ${rows.map(a=>renderAlert(a)).join('')||'<div class="card muted">No hay avisos con estos filtros.</div>'}`;
    $('#alertBack').onclick=()=>setView('admin');
    content.querySelectorAll('[data-aa]').forEach(b=>b.onclick=()=>openAlerts(currentStatus,b.dataset.aa));
    content.querySelectorAll('[data-as]').forEach(b=>b.onclick=()=>openAlerts(b.dataset.as,currentAudience));
    content.querySelectorAll('[data-done]').forEach(b=>b.onclick=()=>setStatus(b.dataset.done,'handled'));
    content.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>setStatus(b.dataset.cancel,'cancelled'));
    content.querySelectorAll('[data-reopen]').forEach(b=>b.onclick=()=>setStatus(b.dataset.reopen,'pending'));
  }

  function renderAlert(a){
    const internal=a.audience==='internal';
    const badge=internal?'🔒 Interno':'👤 Cliente';
    const destination=internal?'Solo Hípica':(a.preferred_channel==='email'?(a.recipient_email||'Sin email'):(a.recipient_phone||'Sin teléfono'));
    return `<article class="card" style="border-left:5px solid ${internal?'#755817':'#176b3a'}"><div class="row"><div><h3>${badge} · ${esc(a.title)}</h3><div class="muted">${esc(a.customers?.full_name||'Cliente')} · ${new Date(a.created_at).toLocaleString('es-ES')}</div></div><span class="status ${a.status==='pending'?'pending':'completed'}">${esc(a.status)}</span></div><p>${esc(a.message)}</p><div class="notice"><strong>${internal?'Destino':'Canal preferido'}:</strong> ${internal?'🔒 Solo Hípica':channelLabel(a.preferred_channel)}<br>${esc(destination)}</div><div class="admin-actions">${a.status==='pending'?`<button class="primary" data-done="${a.id}">${internal?'Marcar revisado':'Marcar gestionado'}</button><button class="ghost" data-cancel="${a.id}">Descartar</button>`:`<button class="secondary" data-reopen="${a.id}">Reabrir</button>`}</div></article>`;
  }

  function channelLabel(c){return c==='whatsapp'?'💬 WhatsApp':c==='email'?'✉️ Email':'☎️ Teléfono'}
  async function setStatus(id,status){
    const {error}=await db.rpc('admin_set_alert_status',{p_alert_id:id,p_status:status});
    if(error){console.error(error);return toast('No se pudo actualizar el aviso.');}
    toast('Aviso actualizado.');openAlerts(currentStatus,currentAudience);
  }
  const timer=setInterval(()=>{if(state.profile){install();clearInterval(timer)}},250);
})();
