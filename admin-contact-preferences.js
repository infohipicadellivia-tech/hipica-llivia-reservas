(() => {
  let activeClientId=null;
  const isStaff=()=>state.profile&&['staff','admin'].includes(state.profile.role);

  async function openPreferences(clientId){
    if(!isStaff()) return toast('No tienes permisos.');
    const r=await db.from('customers').select('*').eq('id',clientId).single();
    if(r.error){console.error(r.error);return toast('No se pudo cargar la ficha.');}
    activeClientId=clientId; const c=r.data;
    content.innerHTML=`<button id="prefBack" class="ghost" type="button">← Volver al cliente</button>
      <h2>Preferencias de contacto</h2>
      <section class="card"><h3>${esc(c.full_name)}</h3><div class="muted">${esc(c.phone||'')}${c.email?' · '+esc(c.email):''}</div></section>
      <div class="notice">Estas preferencias se usan únicamente para gestionar reservas y bonos, no para comunicaciones comerciales.</div>
      <section class="card"><h3>Canales permitidos</h3>
        <label><input id="prefWhatsapp" type="checkbox" style="width:auto" ${c.booking_whatsapp_enabled?'checked':''}> 💬 WhatsApp</label>
        <label><input id="prefEmail" type="checkbox" style="width:auto" ${c.booking_email_enabled?'checked':''} ${c.email?'':'disabled'}> ✉️ Email ${c.email?'':'(sin email)'}</label>
        <label><input id="prefPhone" type="checkbox" style="width:auto" ${c.booking_phone_enabled?'checked':''}> ☎️ Teléfono</label>
        <label>Canal preferido<select id="prefPreferred"><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="phone">Teléfono</option></select></label>
        <button id="prefSave" class="primary" type="button">Guardar preferencias</button>
      </section>
      <h3>Historial</h3><div id="prefHistory" class="card muted">Cargando…</div>`;
    $('#prefPreferred').value=c.preferred_contact_channel||'whatsapp';
    $('#prefBack').onclick=()=>window.openClientFromPreferences?window.openClientFromPreferences(clientId):setView('admin');
    $('#prefSave').onclick=savePreferences;
    loadHistory(clientId);
  }

  async function savePreferences(){
    const w=$('#prefWhatsapp').checked,e=$('#prefEmail').checked,p=$('#prefPhone').checked,preferred=$('#prefPreferred').value;
    if(!w&&!e&&!p)return toast('Debe quedar al menos un canal habilitado.');
    if((preferred==='whatsapp'&&!w)||(preferred==='email'&&!e)||(preferred==='phone'&&!p))return toast('El canal preferido debe estar habilitado.');
    const {error}=await db.rpc('admin_update_contact_preferences',{p_client_id:activeClientId,p_whatsapp:w,p_email:e,p_phone:p,p_preferred:preferred,p_source:'admin'});
    if(error){console.error(error);return toast((error.message||'').includes('EMAIL_REQUIRED')?'Añade un email antes de activar ese canal.':'No se pudieron guardar las preferencias.');}
    toast('Preferencias guardadas.');openPreferences(activeClientId);
  }
  async function loadHistory(id){const r=await db.from('contact_preference_history').select('*').eq('client_id',id).order('created_at',{ascending:false}).limit(10);const box=$('#prefHistory');if(r.error){box.textContent='No se pudo cargar el historial.';return}box.innerHTML=(r.data||[]).map(x=>`<div class="listitem"><div><strong>${new Date(x.created_at).toLocaleString('es-ES')}</strong><div class="muted">Preferido: ${esc(x.preferred_channel)} · Origen: ${esc(x.source)}</div></div><div class="muted">W ${x.whatsapp_enabled?'✓':'×'} · E ${x.email_enabled?'✓':'×'} · T ${x.phone_enabled?'✓':'×'}</div></div>`).join('')||'Sin cambios registrados.'}

  // Expone la función para que admin-clients.js pueda abrirla.
  window.openCustomerContactPreferences=openPreferences;
})();
