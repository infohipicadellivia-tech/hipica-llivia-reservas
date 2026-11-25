(() => {
  const LEVELS=[['none','Sin experiencia'],['beginner','Iniciación'],['intermediate','Intermedio'],['advanced','Avanzado']];
  let services=[],customers=[],passes=[],draft={};
  const isStaff=()=>state.profile&&['staff','admin'].includes(state.profile.role);

  function install(){
    if(!isStaff()||document.querySelector('#newPhoneBooking')) return;
    const check=()=>{if(state.view!=='admin')return;const hero=content.querySelector('.hero');if(!hero||document.querySelector('#newPhoneBooking'))return;const b=document.createElement('button');b.id='newPhoneBooking';b.type='button';b.className='primary calendar-launch';b.textContent='＋ Nueva reserva';b.onclick=start;hero.insertAdjacentElement('afterend',b)};
    new MutationObserver(check).observe(content,{childList:true,subtree:true});check();
  }
  async function start(){
    const [s,c]=await Promise.all([db.from('services').select('*,service_durations(duration_minutes)').eq('active',true).order('name'),db.from('profiles').select('id,full_name,phone').eq('active',true).order('full_name')]);
    if(s.error||c.error)return toast('No se pudieron cargar clientes/actividades.');services=s.data||[];customers=c.data||[];renderBase();
  }
  function renderBase(){
    content.innerHTML=`<button id="pbBack" class="ghost">← Volver</button><h2>Nueva reserva</h2>
    <label>Origen de la reserva<select id="pbSource"><option value="phone">☎️ Teléfono</option><option value="whatsapp">💬 WhatsApp</option><option value="walk_in">👤 Presencial</option><option value="admin">⚙️ Administración</option></select></label>
    <label>Cliente existente<select id="pbCustomer"><option value="">Selecciona cliente</option>${customers.map(x=>`<option value="${x.id}">${esc(x.full_name||'Sin nombre')} · ${esc(x.phone||'sin teléfono')}</option>`).join('')}</select></label>
    <label>Teléfono de contacto *<input id="pbPhone" type="tel" required></label>
    <label>Actividad<select id="pbService"><option value="">Selecciona actividad</option>${services.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></label>
    <label>Duración<select id="pbDuration"><option value="">Selecciona primero actividad</option></select></label>
    <label>Nº participantes<input id="pbCount" type="number" min="1" max="20" value="1"></label>
    <div id="pbParticipants"></div><label>Fecha<input id="pbDate" type="date"></label><label>Hora<input id="pbTime" type="time"></label>
    <label>Bono<select id="pbPass"><option value="">Cargar al seleccionar cliente</option></select></label>
    <label>Observaciones<textarea id="pbNotes" rows="3"></textarea></label><button id="pbCreate" class="primary">Crear reserva confirmada</button>`;
    $('#pbBack').onclick=()=>setView('admin');$('#pbCustomer').onchange=customerChanged;$('#pbService').onchange=serviceChanged;$('#pbCount').oninput=participants;$('#pbCreate').onclick=create;participants();
  }
  async function customerChanged(e){const c=customers.find(x=>x.id===e.target.value);$('#pbPhone').value=c?.phone||'';if(!c)return;const r=await db.from('passes').select('*').eq('customer_id',c.id).eq('status','active');passes=r.data||[];$('#pbPass').innerHTML='<option value="">Sin bono</option>'+passes.map(x=>`<option value="${x.id}">${esc(x.name)} · ${x.remaining_credits} disp.</option>`).join('')}
  function serviceChanged(e){const s=services.find(x=>x.id===e.target.value);const ds=(s?.service_durations||[]).filter(x=>x.active!==false).map(x=>x.duration_minutes).sort((a,b)=>a-b);$('#pbDuration').innerHTML=ds.map(x=>`<option value="${x}">${x===60?'1 h':x===90?'1 h 30':x===120?'2 h':x+' min'}</option>`).join('');participants()}
  function participants(){const n=Math.max(1,Math.min(20,Number($('#pbCount')?.value||1)));const box=$('#pbParticipants');if(!box)return;box.innerHTML=Array.from({length:n},(_,i)=>`<div class="card"><h3>Participante ${i+1}</h3><label>Nombre *<input data-p-name="${i}"></label><label><input style="width:auto" type="checkbox" data-p-minor="${i}"> Menor de edad</label><label>Edad si es menor<input type="number" min="1" max="17" data-p-age="${i}"></label><label>Nivel<select data-p-level="${i}">${LEVELS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label></div>`).join('')}
  async function create(){
    const source=$('#pbSource').value,customer=$('#pbCustomer').value,service=$('#pbService').value,phone=$('#pbPhone').value.trim(),date=$('#pbDate').value,time=$('#pbTime').value,duration=Number($('#pbDuration').value),count=Number($('#pbCount').value),pass=$('#pbPass').value||null;
    if(!customer||!service||!phone||!date||!time||!duration)return toast('Completa cliente, teléfono, actividad, duración, fecha y hora.');
    const ps=Array.from({length:count},(_,i)=>({full_name:document.querySelector(`[data-p-name="${i}"]`).value.trim(),is_minor:document.querySelector(`[data-p-minor="${i}"]`).checked,age:document.querySelector(`[data-p-age="${i}"]`).value||null,rider_level:document.querySelector(`[data-p-level="${i}"]`).value,notes:null}));
    if(ps.some(x=>!x.full_name))return toast('Indica el nombre de todos los participantes.');
    const start=new Date(`${date}T${time}:00`);
    const srv=services.find(x=>x.id===service);if(ps.some(x=>x.is_minor&&Number(x.age)<Number(srv.minimum_age||0)))return toast(`La edad mínima para ${srv.name} es ${srv.minimum_age} años.`);
    const btn=$('#pbCreate');btn.disabled=true;btn.textContent='Creando…';const c=customers.find(x=>x.id===customer);
    const {error}=await db.rpc('admin_create_booking',{p_customer_id:customer,p_full_name:c?.full_name||'',p_contact_phone:phone,p_service_id:service,p_start_at:start.toISOString(),p_duration_minutes:duration,p_participants:ps,p_pass_id:pass,p_customer_notes:$('#pbNotes').value.trim()||null,p_booking_source:source});
    if(error){console.error(error);btn.disabled=false;btn.textContent='Crear reserva confirmada';const m=(error.message||'');if(m.includes('TIME_OVERLAP'))return toast('Este horario se solapa con otra actividad.');if(m.includes('MINIMUM_AGE_NOT_MET'))return toast('Algún menor no cumple la edad mínima.');if(m.includes('PASS_REQUIRED'))return toast('Esta actividad requiere un bono válido.');return toast('No se pudo crear la reserva.');}
    toast('Reserva creada y confirmada.');await loadBase();setView('admin');
  }
  const timer=setInterval(()=>{if(state.profile){install();clearInterval(timer)}},250);
})();
