(() => {
  const LEVELS=[['none','Sin experiencia'],['beginner','Iniciación'],['intermediate','Intermedio'],['advanced','Avanzado']];
  let services=[],customers=[],passes=[];
  const isStaff=()=>state.profile&&['staff','admin'].includes(state.profile.role);
  function install(){if(!isStaff()||document.querySelector('#newPhoneBooking'))return;const check=()=>{if(state.view!=='admin')return;const hero=content.querySelector('.hero');if(!hero||document.querySelector('#newPhoneBooking'))return;const b=document.createElement('button');b.id='newPhoneBooking';b.type='button';b.className='primary calendar-launch';b.textContent='＋ Nueva reserva';b.onclick=start;hero.insertAdjacentElement('afterend',b)};new MutationObserver(check).observe(content,{childList:true,subtree:true});check()}
  async function start(){const [s,c]=await Promise.all([db.from('services').select('*,service_durations(duration_minutes)').eq('active',true).order('name'),db.from('customers').select('*').eq('active',true).order('full_name')]);if(s.error||c.error){console.error(s.error||c.error);return toast('No se pudieron cargar clientes/actividades.')}services=s.data||[];customers=c.data||[];renderBase()}
  function renderBase(){content.innerHTML=`<button id="pbBack" class="ghost">← Volver</button><h2>Nueva reserva</h2>
  <label>Origen<select id="pbSource"><option value="phone">☎️ Teléfono</option><option value="whatsapp">💬 WhatsApp</option><option value="walk_in">👤 Presencial</option><option value="admin">⚙️ Administración</option></select></label>
  <div class="admin-tabs"><button id="existingTab" class="secondary" type="button">Cliente existente</button><button id="newTab" class="ghost" type="button">Nuevo cliente</button></div>
  <div id="existingBox"><label>Cliente<select id="pbCustomer"><option value="">Selecciona cliente</option>${customers.map(x=>`<option value="${x.id}">${esc(x.full_name)} · ${esc(x.phone)}</option>`).join('')}</select></label></div>
  <div id="newBox" class="hidden"><div class="card"><h3>Alta de cliente</h3><label>Nombre y apellidos *<input id="newName"></label><label>Teléfono *<input id="newPhone" type="tel"></label><label>Email opcional<input id="newEmail" type="email"></label><label>Observaciones<input id="newNotes"></label><button id="createCustomer" class="secondary" type="button">Crear cliente</button></div></div>
  <label>Teléfono de contacto *<input id="pbPhone" type="tel"></label><label>Actividad<select id="pbService"><option value="">Selecciona actividad</option>${services.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></label><label>Duración<select id="pbDuration"><option value="">Selecciona actividad</option></select></label><label>Nº participantes<input id="pbCount" type="number" min="1" max="20" value="1"></label><div id="pbParticipants"></div><label>Fecha<input id="pbDate" type="date"></label><label>Hora<input id="pbTime" type="time"></label><label>Bono<select id="pbPass"><option value="">Sin bono</option></select></label><label>Observaciones<textarea id="pbNotes" rows="3"></textarea></label><button id="pbCreate" class="primary">Crear reserva confirmada</button>`;
  $('#pbBack').onclick=()=>setView('admin');$('#existingTab').onclick=()=>toggleCustomerMode(false);$('#newTab').onclick=()=>toggleCustomerMode(true);$('#createCustomer').onclick=createCustomer;$('#pbCustomer').onchange=customerChanged;$('#pbService').onchange=serviceChanged;$('#pbCount').oninput=participants;$('#pbCreate').onclick=createBooking;participants()}
  function toggleCustomerMode(isNew){$('#newBox').classList.toggle('hidden',!isNew);$('#existingBox').classList.toggle('hidden',isNew);$('#newTab').className=isNew?'secondary':'ghost';$('#existingTab').className=isNew?'ghost':'secondary'}
  async function createCustomer(){const name=$('#newName').value.trim(),phone=$('#newPhone').value.trim(),email=$('#newEmail').value.trim()||null,notes=$('#newNotes').value.trim()||null;if(!name||!phone)return toast('Nombre y teléfono son obligatorios.');const btn=$('#createCustomer');btn.disabled=true;const {data,error}=await db.rpc('admin_create_customer',{p_full_name:name,p_phone:phone,p_email:email,p_notes:notes});btn.disabled=false;if(error){console.error(error);return toast((error.message||'').includes('INVALID_EMAIL')?'El email no es válido.':'No se pudo crear el cliente.');}const c=Array.isArray(data)?data[0]:data;customers.push(c);const opt=document.createElement('option');opt.value=c.id;opt.textContent=`${c.full_name} · ${c.phone}`;$('#pbCustomer').appendChild(opt);$('#pbCustomer').value=c.id;$('#pbPhone').value=c.phone;prefillFirstParticipant(c.full_name);toggleCustomerMode(false);toast('Cliente creado. Ya puedes completar la reserva.');await customerChanged({target:$('#pbCustomer')})}
  function prefillFirstParticipant(fullName){
    const first=document.querySelector('[data-p-name="0"]');
    if(!first||!fullName)return;
    if(!first.value.trim()||first.dataset.autoFilled==='true'){
      first.value=fullName;
      first.dataset.autoFilled='true';
    }
    first.addEventListener('input',()=>{first.dataset.autoFilled='false'},{once:true});
  }
  async function customerChanged(e){const c=customers.find(x=>x.id===e.target.value);$('#pbPhone').value=c?.phone||'';prefillFirstParticipant(c?.full_name||'');passes=[];if(!c){$('#pbPass').innerHTML='<option value="">Sin bono</option>';return}const r=await db.from('passes').select('*,pass_services(service_id)').eq('client_id',c.id).eq('status','active');if(r.error){console.error(r.error);$('#pbPass').innerHTML='<option value="">Sin bono</option>';return}passes=r.data||[];refreshPassOptions()}
  function serviceChanged(e){const s=services.find(x=>x.id===e.target.value);const ds=(s?.service_durations||[]).map(x=>x.duration_minutes).sort((a,b)=>a-b);$('#pbDuration').innerHTML=ds.map(x=>`<option value="${x}">${x===60?'1 h':x===90?'1 h 30':x===120?'2 h':x+' min'}</option>`).join('');refreshPassOptions();participants()}
  function refreshPassOptions(){const serviceId=$('#pbService')?.value;const compatible=serviceId?passes.filter(p=>p.pass_services?.some(ps=>ps.service_id===serviceId)):passes;$('#pbPass').innerHTML='<option value="">Actividad suelta / sin bono</option>'+compatible.map(x=>`<option value="${x.id}">${esc(x.name)} · ${Number(x.remaining_credits)} créditos disp.</option>`).join('')}
  function participants(){const n=Math.max(1,Math.min(20,Number($('#pbCount')?.value||1))),box=$('#pbParticipants');if(!box)return;box.innerHTML=Array.from({length:n},(_,i)=>`<div class="card"><h3>Participante ${i+1}</h3><label>Nombre *<input data-p-name="${i}"></label><label><input style="width:auto" type="checkbox" data-p-minor="${i}"> Menor</label><label>Edad si es menor<input type="number" min="1" max="17" data-p-age="${i}"></label><label>Nivel<select data-p-level="${i}">${LEVELS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label></div>`).join('');const selected=customers.find(x=>x.id===$('#pbCustomer')?.value);if(selected)prefillFirstParticipant(selected.full_name)}
  async function createBooking() {
  const source = $('#pbSource').value;
  const customer = $('#pbCustomer').value;
  const service = $('#pbService').value;
  const phone = $('#pbPhone').value.trim();
  const date = $('#pbDate').value;
  const time = $('#pbTime').value;
  const duration = Number($('#pbDuration').value);
  const count = Number($('#pbCount').value);
  const pass = $('#pbPass').value || null;

  if (
    !customer ||
    !service ||
    !phone ||
    !date ||
    !time ||
    !duration
  ) {
    return toast(
      'Completa cliente, teléfono, actividad, duración, fecha y hora.'
    );
  }

  const participants = Array.from(
    { length: count },
    (_, index) => ({
      full_name: document
        .querySelector(`[data-p-name="${index}"]`)
        .value
        .trim(),

      is_minor: document
        .querySelector(`[data-p-minor="${index}"]`)
        .checked,

      age:
        document.querySelector(`[data-p-age="${index}"]`).value ||
        null,

      rider_level: document
        .querySelector(`[data-p-level="${index}"]`)
        .value,

      notes: null
    })
  );

  if (participants.some(person => !person.full_name)) {
    return toast('Indica todos los nombres.');
  }

  const selectedService = services.find(
    item => item.id === service
  );

  if (
    participants.some(
      person =>
        person.is_minor &&
        Number(person.age) <
          Number(selectedService.minimum_age || 0)
    )
  ) {
    return toast(
      `Edad mínima: ${selectedService.minimum_age} años.`
    );
  }

  const start = new Date(`${date}T${time}:00`);

  /*
   * COMPROBACIÓN DEL AFORO RECOMENDADO
   *
   * Muestra:
   * - ocupación actual;
   * - clientes ya apuntados;
   * - niveles;
   * - resultado después de añadir la reserva;
   * - advertencia si se supera 6/6.
   */
  if (
    typeof window.checkAdminCapacityBeforeCreate ===
    'function'
  ) {
    const capacityCheck =
      await window.checkAdminCapacityBeforeCreate(
        service,
        start.toISOString(),
        count
      );

    if (!capacityCheck.allow) {
      return;
    }
  }

  const selectedCustomer = customers.find(
    item => item.id === customer
  );

  const button = $('#pbCreate');
  button.disabled = true;
  button.textContent = 'Creando…';

  const { error } = await db.rpc(
    'admin_create_booking',
    {
      p_customer_id: customer,
      p_full_name: selectedCustomer.full_name,
      p_contact_phone: phone,
      p_service_id: service,
      p_start_at: start.toISOString(),
      p_duration_minutes: duration,
      p_participants: participants,
      p_pass_id: pass,
      p_customer_notes:
        $('#pbNotes').value.trim() || null,
      p_booking_source: source
    }
  );

  button.disabled = false;
  button.textContent = 'Crear reserva confirmada';

  if (error) {
    console.error(error);

    const message = error.message || '';

    if (message.includes('TIME_OVERLAP')) {
      return toast('El horario se solapa.');
    }

    if (message.includes('PASS_REQUIRED')) {
      return toast(
        'Esta actividad requiere bono. Para un cliente nuevo, crea o asigna primero un bono.'
      );
    }

    if (message.includes('INSUFFICIENT_CREDITS')) {
      return toast(
        'El bono no tiene créditos suficientes.'
      );
    }

    return toast('No se pudo crear la reserva.');
  }

  toast('Reserva creada y confirmada.');

  await loadBase();

  setView('admin');
}
  const timer = setInterval(() => {
  if (state.profile) {
    install();
    clearInterval(timer);
  }
}, 250);
})();
