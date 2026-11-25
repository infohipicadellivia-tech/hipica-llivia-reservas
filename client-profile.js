(() => {
  const isCustomer=()=>state.profile?.role==='customer';
  let client=null;

  function installProfileNav(){
    if(!isCustomer() || document.querySelector('[data-view="profile"]')) return;
    const nav=document.querySelector('.bottom-nav');
    if(!nav)return;
    nav.style.gridTemplateColumns='repeat(5,1fr)';
    const b=document.createElement('button');
    b.type='button';b.dataset.view='profile';b.innerHTML='●<span>Perfil</span>';
    b.onclick=()=>setView('profile');nav.appendChild(b);
  }

  async function loadClient(){
    const r=await db.from('customers').select('*').eq('auth_user_id',state.user.id).single();
    if(r.error)throw r.error;client=r.data;
  }

  async function renderProfile(){
    content.innerHTML='<div class="card muted">Cargando perfil…</div>';
    try{await loadClient()}catch(e){console.error(e);content.innerHTML='<div class="card error">No se pudo cargar tu ficha de cliente.</div>';return}
    content.innerHTML=`<h2>Mi perfil</h2>
      <section class="card"><h3>Datos de contacto</h3><label>Nombre y apellidos *<input id="cpName" value="${esc(client.full_name||'')}"></label><label>Teléfono *<input id="cpContactPhone" type="tel" value="${esc(client.phone||'')}"></label><label>Email<input id="cpContactEmail" type="email" value="${esc(client.email||'')}"></label><button id="cpSaveData" class="secondary" type="button">Guardar datos</button></section>
      <div class="notice">Estas preferencias se utilizan únicamente para comunicaciones relacionadas con tus reservas y bonos.</div>
      <section class="card"><h3>Cómo quiero recibir avisos</h3>
        <label><input id="cpWhatsapp" type="checkbox" style="width:auto" ${client.booking_whatsapp_enabled?'checked':''}> WhatsApp</label>
        <label><input id="cpEmail" type="checkbox" style="width:auto" ${client.booking_email_enabled?'checked':''} ${client.email?'':'disabled'}> Email ${client.email?'':'(no tienes email informado)'}</label>
        <label><input id="cpPhone" type="checkbox" style="width:auto" ${client.booking_phone_enabled?'checked':''}> Teléfono</label>
        <label>Canal preferido<select id="cpPreferred"><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="phone">Teléfono</option></select></label>
        <button id="cpSave" class="primary" type="button">Guardar preferencias</button>
      </section>`;
    $('#cpPreferred').value=client.preferred_contact_channel||'whatsapp';
    $('#cpSave').onclick=save;$('#cpSaveData').onclick=saveContactData;
  }

  async function saveContactData(){
    const name=$('#cpName').value.trim(),phone=$('#cpContactPhone').value.trim(),email=$('#cpContactEmail').value.trim()||null;
    if(!name)return toast('Indica tu nombre.');
    if(phone.replace(/\D/g,'').length<9)return toast('Indica un teléfono válido.');
    const btn=$('#cpSaveData');btn.disabled=true;btn.textContent='Guardando…';
    const {error}=await db.rpc('customer_update_profile',{p_full_name:name,p_phone:phone,p_email:email});
    btn.disabled=false;btn.textContent='Guardar datos';
    if(error){console.error(error);return toast((error.message||'').includes('INVALID_EMAIL')?'El email no es válido.':'No se pudieron guardar los datos.');}
    if(state.profile){state.profile.full_name=name;state.profile.phone=phone;}
    toast('Datos de contacto actualizados.');await renderProfile();
  }

  async function save(){
    const w=$('#cpWhatsapp').checked,e=$('#cpEmail').checked,p=$('#cpPhone').checked,preferred=$('#cpPreferred').value;
    if(!w&&!e&&!p)return toast('Debes mantener al menos un canal habilitado.');
    if((preferred==='whatsapp'&&!w)||(preferred==='email'&&!e)||(preferred==='phone'&&!p))return toast('El canal preferido debe estar habilitado.');
    const btn=$('#cpSave');btn.disabled=true;btn.textContent='Guardando…';
    const {error}=await db.rpc('customer_update_contact_preferences',{p_whatsapp:w,p_email:e,p_phone:p,p_preferred:preferred});
    btn.disabled=false;btn.textContent='Guardar preferencias';
    if(error){console.error(error);return toast((error.message||'').includes('EMAIL_REQUIRED')?'Necesitas informar un email antes de activar ese canal.':'No se pudieron guardar las preferencias.');}
    toast('Preferencias actualizadas.');await renderProfile();
  }

  const oldSetView=setView;
  setView=function(v){
    if(v==='profile'&&isCustomer()){
      state.view='profile';
      document.querySelectorAll('.bottom-nav button').forEach(x=>x.classList.toggle('active',x.dataset.view==='profile'));
      $('#pageTitle').textContent='Mi perfil';
      renderProfile();return;
    }
    return oldSetView(v);
  };

  const timer=setInterval(()=>{if(state?.profile){installProfileNav();clearInterval(timer)}},150);
})();

