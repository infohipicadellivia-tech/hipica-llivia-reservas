(() => {
  const LEVELS=[['none','Sin experiencia'],['beginner','Iniciación'],['intermediate','Intermedio'],['advanced','Avanzado']];
  let flow={step:1,service:null,duration:null,count:1,participants:[],phone:'',slots:[],slot:null,passes:[],passId:null,notes:''};
  const isCustomer=()=>state.profile?.role==='customer';
  function reset(){flow={step:1,service:null,duration:null,count:1,participants:[],phone:state.profile?.phone||'',slots:[],slot:null,passes:[],passId:null,notes:''}}
  const oldRenderReserve=renderReserve;
  renderReserve=function(){if(!isCustomer())return oldRenderReserve();renderStep()};
  function renderStep(){
    if(flow.step===1){content.innerHTML=`<div class="progress">Paso 1 de 5 · Actividad</div>${state.services.map(s=>`<button class="service-card" data-s="${s.id}"><h3>${esc(s.name)}</h3><div class="muted">Edad mínima ${s.minimum_age||'-'} años</div></button>`).join('')}`;content.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>chooseService(b.dataset.s));return}
    if(flow.step===2){content.innerHTML=`<button class="ghost" id="rBack">← Actividad</button><div class="progress">Paso 2 de 5 · Duración y participantes</div><h2>${esc(flow.service.name)}</h2><label>Duración<select id="rDuration">${flow.service.service_durations.map(d=>`<option value="${d.duration_minutes}">${d.duration_minutes===60?'1 h':d.duration_minutes===90?'1 h 30':d.duration_minutes===120?'2 h':d.duration_minutes+' min'}</option>`).join('')}</select></label><label>Nº participantes<input id="rCount" type="number" min="1" max="20" value="${flow.count}"></label><div id="rPeople"></div><label>Teléfono de contacto *<input id="rPhone" type="tel" value="${esc(flow.phone||'')}"></label><button id="rNext" class="primary">Ver disponibilidad</button>`;$('#rBack').onclick=()=>{flow.step=1;renderStep()};$('#rCount').oninput=renderPeople;$('#rNext').onclick=loadAvailability;renderPeople();return}
    if(flow.step===3){content.innerHTML=`<button class="ghost" id="rBack">← Datos</button><div class="progress">Paso 3 de 5 · Horario</div><h2>Disponibilidad</h2>${flow.slots.length?flow.slots.map(x=>`<button class="service-card" data-slot="${x.start.toISOString()}"><h3>${formatDate(x.start)} · ${formatHour(x.start)}</h3><div class="muted">${flow.duration} min</div></button>`).join(''):'<div class="card muted">No hay horarios compatibles en los próximos 60 días.</div>'}`;$('#rBack').onclick=()=>{flow.step=2;renderStep()};content.querySelectorAll('[data-slot]').forEach(b=>b.onclick=()=>chooseSlot(b.dataset.slot));return}
    if(flow.step===4){
  const credits=Number(flow.duration)/60*flow.count;

  content.innerHTML=`
    <button class="ghost" id="rBack">← Horario</button>
    <div class="progress">Paso 4 de 5 · Bono</div>
    <h2>¿Cómo quieres reservar?</h2>

    <button class="service-card ${!flow.passId?'selected':''}" data-pass="">
      <h3>Actividad suelta</h3>
      <div class="muted">No consume créditos</div>
    </button>

    ${flow.passes.map(p=>{
      const saldo=Number(p.remaining_credits);
      const saldoFinal=saldo-credits;

      return `
        <button class="service-card ${flow.passId===p.id?'selected':''}" data-pass="${p.id}">
          <h3>${esc(p.name)}</h3>
          <div><strong>Saldo de tu bono: ${saldo} créditos</strong></div>
          <div class="muted">
            Esta reserva consumirá ${credits} créditos ·
            Después te quedarán ${saldoFinal} créditos
          </div>
        </button>
      `;
    }).join('')}

    ${flow.passes.length ? `
      <div class="notice" style="margin-top:16px">
        <strong>¿Cómo se consumen los créditos?</strong>
        <p>Los créditos se descuentan según la duración de la actividad y el número de participantes:</p>
        <div>60 min → <strong>1 crédito por persona</strong></div>
        <div>90 min → <strong>1,5 créditos por persona</strong></div>
        <div>120 min → <strong>2 créditos por persona</strong></div>
        <p class="muted" style="margin-bottom:0">
          Ejemplo: una ruta de 90 minutos para 2 personas consume 3 créditos.
        </p>
      </div>
    ` : ''}

    <button id="rNext" class="primary">Continuar</button>
  `;

  $('#rBack').onclick=()=>{
    flow.step=3;
    renderStep();
  };

  content.querySelectorAll('[data-pass]').forEach(b=>
    b.onclick=()=>{
      flow.passId=b.dataset.pass||null;
      renderStep();
    }
  );

  $('#rNext').onclick=()=>{
    flow.step=5;
    renderStep();
  };

  return;
};content.innerHTML=`<button class="ghost" id="rBack">← Horario</button><div class="progress">Paso 4 de 5 · Bono</div><h2>¿Cómo quieres reservar?</h2><button class="service-card ${!flow.passId?'selected':''}" data-pass=""><h3>Actividad suelta</h3><div class="muted">No consume créditos</div></button>${flow.passes.map(p=>`<button class="service-card ${flow.passId===p.id?'selected':''}" data-pass="${p.id}"><h3>${esc(p.name)}</h3><div class="muted">${Number(p.remaining_credits)} créditos disponibles · Esta reserva consumirá ${credits}</div></button>`).join('')}<button id="rNext" class="primary">Continuar</button>`;$('#rBack').onclick=()=>{flow.step=3;renderStep()};content.querySelectorAll('[data-pass]').forEach(b=>b.onclick=()=>{flow.passId=b.dataset.pass||null;renderStep()});$('#rNext').onclick=()=>{flow.step=5;renderStep()};return}
    const credits=flow.passId?(Number(flow.duration)/60*flow.count):0,pass=flow.passes.find(p=>p.id===flow.passId);content.innerHTML=`<button class="ghost" id="rBack">← Bono</button><div class="progress">Paso 5 de 5 · Confirmar</div><article class="card"><h2>Tu solicitud</h2><p><strong>${esc(flow.service.name)}</strong></p><p>${formatDate(flow.slot)} · ${formatHour(flow.slot)} · ${flow.duration} min</p><p>${flow.count} participante(s) · Tel. ${esc(flow.phone)}</p><p>${pass?`Bono: ${esc(pass.name)} · Esta reserva consumirá ${credits} créditos · Saldo después de realizar la actividad: ${Number(pass.remaining_credits)-credits} créditos`:'Actividad suelta · sin consumo de bono'}</p></article><label>Observaciones<textarea id="rNotes" rows="3"></textarea></label><div class="notice">La solicitud quedará pendiente de confirmación. El bono no se descontará hasta realizar la actividad.</div><button id="rSubmit" class="primary">Solicitar reserva</button>`;$('#rBack').onclick=()=>{flow.step=4;renderStep()};$('#rSubmit').onclick=submit;
  }
  async function chooseService(id){const r=await db.from('services').select('*,service_durations(duration_minutes)').eq('id',id).single();if(r.error)return toast('No se pudo cargar la actividad.');flow.service=r.data;flow.duration=r.data.service_durations?.[0]?.duration_minutes||r.data.duration_minutes;flow.step=2;renderStep()}
  function renderPeople(){const n=Math.max(1,Math.min(20,Number($('#rCount').value||1)));flow.count=n;const box=$('#rPeople');box.innerHTML=Array.from({length:n},(_,i)=>`<div class="card"><h3>Participante ${i+1}</h3><label>Nombre *<input data-r-name="${i}" value="${i===0?esc(state.profile?.full_name||''):''}"></label><label><input style="width:auto" type="checkbox" data-r-minor="${i}"> Menor</label><label>Edad si es menor<input type="number" min="1" max="17" data-r-age="${i}"></label><label>Nivel<select data-r-level="${i}">${LEVELS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label></div>`).join('')}
  function collectPeople(){return Array.from({length:flow.count},(_,i)=>({full_name:document.querySelector(`[data-r-name="${i}"]`).value.trim(),is_minor:document.querySelector(`[data-r-minor="${i}"]`).checked,age:document.querySelector(`[data-r-age="${i}"]`).value||null,rider_level:document.querySelector(`[data-r-level="${i}"]`).value,notes:null}))}
  async function loadAvailability(){flow.duration=Number($('#rDuration').value);flow.phone=$('#rPhone').value.trim();flow.participants=collectPeople();if(!flow.phone||flow.phone.replace(/\D/g,'').length<9)return toast('Indica un teléfono válido.');if(flow.participants.some(x=>!x.full_name))return toast('Indica el nombre de todos los participantes.');if(flow.participants.some(x=>x.is_minor&&!x.age))return toast('Indica la edad de los menores.');if(flow.participants.some(x=>x.is_minor&&Number(x.age)<Number(flow.service.minimum_age||0)))return toast(`Edad mínima: ${flow.service.minimum_age} años.`);const start=new Date(),end=new Date(Date.now()+60*86400000);const [rules,periods,exceptions,overrides,bookings]=await Promise.all([db.from('schedule_rules').select('*').eq('active',true),db.from('special_periods').select('*').eq('active',true),db.from('calendar_exceptions').select('*').gte('exception_date',start.toISOString().slice(0,10)).lte('exception_date',end.toISOString().slice(0,10)),db.from('slot_service_overrides').select('*').gte('override_date',start.toISOString().slice(0,10)).lte('override_date',end.toISOString().slice(0,10)),db.from('booking_schedule').select('*').in('status',['pending','confirmed']).gte('starts_at',start.toISOString()).lt('starts_at',end.toISOString())]);flow.slots=[];for(let d=new Date(start);d<end;d.setDate(d.getDate()+1)){for(const h of ['10:00','11:00','12:00','13:00','16:00','17:00']){const st=new Date(`${d.toISOString().slice(0,10)}T${h}:00`);if(st<=new Date())continue;const iso=((st.getDay()||7)),special=periods.data?.some(p=>st.toISOString().slice(0,10)>=p.starts_on&&st.toISOString().slice(0,10)<=p.ends_on&&p.open_all_days),rule=rules.data?.find(r=>r.start_time.slice(0,5)===h&&(r.weekday===iso||(special&&[2,3].includes(iso)&&r.weekday===4)));if(!rule)continue;const ov=overrides.data?.find(o=>o.override_date===st.toISOString().slice(0,10)&&o.start_time.slice(0,5)===h),sid=ov?.service_id||rule.preferred_service_id;if(sid!==flow.service.id)continue;const ex=(exceptions.data||[]).filter(e=>e.exception_date===st.toISOString().slice(0,10)&&(!e.start_time||e.start_time.slice(0,5)===h)).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).pop();if(ex?.exception_type==='closed')continue;const en=new Date(st.getTime()+flow.duration*60000),busy=(bookings.data||[]).some(b=>st<new Date(b.ends_at)&&en>new Date(b.starts_at));if(!busy)flow.slots.push({start:new Date(st)})}}flow.step=3;renderStep()}
  async function chooseSlot(iso){flow.slot=new Date(iso);const c=await db.from('customers').select('id').eq('auth_user_id',state.user.id).single();if(c.error)return toast('No encontramos tu ficha de cliente.');const p=await db.from('passes').select('*,pass_services(service_id)').eq('client_id',c.data.id).eq('status','active');flow.passes=(p.data||[]).filter(x=>x.pass_services?.some(ps=>ps.service_id===flow.service.id)&&Number(x.remaining_credits)>=Number(flow.duration)/60*flow.count);flow.passId=null;flow.step=4;renderStep()}
  async function submit(){const btn=$('#rSubmit');btn.disabled=true;btn.textContent='Enviando…';const {error}=await db.rpc('request_booking_web_v3',{p_service_id:flow.service.id,p_start_at:flow.slot.toISOString(),p_duration_minutes:flow.duration,p_contact_phone:flow.phone,p_participants:flow.participants,p_pass_id:flow.passId,p_customer_notes:$('#rNotes').value.trim()||null});if(error){console.error(error);btn.disabled=false;btn.textContent='Solicitar reserva';return toast('No se pudo crear la solicitud: '+(error.message||''));}await loadBase();toast('Solicitud enviada. Pendiente de confirmación.');reset();setView('bookings')}
  const oldSetView=setView;setView=function(v){if(v==='reserve'&&isCustomer())reset();return oldSetView(v)};
})();
