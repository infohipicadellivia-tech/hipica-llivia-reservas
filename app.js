const cfg=window.HIPICA_CONFIG||{};
if(!cfg.supabaseUrl||cfg.supabaseUrl.includes('TU-PROYECTO')) alert('Configura config.js con la URL y la Publishable Key de Supabase.');
const db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true}});
const $=s=>document.querySelector(s); const content=$('#content');
let state={user:null,profile:null,passes:[],bookings:[],services:[],slots:[],view:'home',reserve:{step:1,service:null,slot:null,pass:null,notes:''}};
const statusLabel={pending:'Pendiente de confirmación',confirmed:'Confirmada',completed:'Realizada',rejected:'Rechazada',cancelled:'Cancelada',cancelled_late:'Cancelada fuera de plazo',no_show:'No presentado'};
function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2800)}
function formatDate(v){return new Intl.DateTimeFormat('es-ES',{weekday:'long',day:'numeric',month:'long'}).format(new Date(v))}
function formatHour(v){return new Intl.DateTimeFormat('es-ES',{hour:'2-digit',minute:'2-digit'}).format(new Date(v))}
async function loadBase(){
 const uid=state.user.id;
 const [p,pa,b,s]=await Promise.all([
  db.from('profiles').select('*').eq('id',uid).single(),
  db.from('passes').select('*,pass_services(service_id,services(name))').eq('customer_id',uid).order('expires_at'),
  db.from('bookings').select('*,time_slots(starts_at,ends_at,services(name,duration_minutes))').eq('customer_id',uid).order('requested_at',{ascending:false}),
  db.from('services').select('*').eq('active',true).order('name')
 ]);
 for(const r of [p,pa,b,s]) if(r.error) console.error(r.error);
 state.profile=p.data;state.passes=pa.data||[];state.bookings=b.data||[];state.services=s.data||[];
}
function setView(v){state.view=v;document.querySelectorAll('.bottom-nav button').forEach(x=>x.classList.toggle('active',x.dataset.view===v));$('#pageTitle').textContent={home:'Inicio',reserve:'Reservar',bookings:'Mis reservas',passes:'Mis bonos'}[v];render()}
function bookingCard(b){const slot=b.time_slots||{},sv=slot.services||{};return `<article class="card row"><div><h3>${esc(sv.name||'Actividad')}</h3><div class="muted">${slot.starts_at?esc(formatDate(slot.starts_at))+' · '+esc(formatHour(slot.starts_at)):'Horario no disponible'}</div></div><span class="status ${b.status}">${esc(statusLabel[b.status]||b.status)}</span></article>`}
function renderHome(){
  const active=state.passes.filter(p=>p.status==='active');

  const credits=active.reduce(
    (a,p)=>a+Number(p.remaining_credits||0),
    0
  );

  const next=[...state.bookings]
    .filter(
      b=>
        ['pending','confirmed'].includes(b.status) &&
        b.time_slots?.starts_at &&
        new Date(b.time_slots.starts_at)>new Date()
    )
    .sort(
      (a,b)=>
        new Date(a.time_slots.starts_at)-
        new Date(b.time_slots.starts_at)
    )[0];

  content.innerHTML=`
      <section class="hero">
      <h2>Hola, ${esc(state.profile?.full_name||state.user.email)}</h2>
      <div>Tienes ${credits} créditos disponibles</div>
    </section>

    <div class="grid">
      <button class="service-card" data-go="reserve">
        <div class="metric">＋</div>
        <h3>Nueva reserva</h3>
        <div class="muted">Solicita día y hora</div>
      </button>

      <button class="service-card" data-go="passes">
        <div class="metric">${credits}</div>
        <h3>Mis bonos</h3>
        <div class="muted">${active.length} bono(s) activo(s)</div>
      </button>
    </div>

    <h2>Próxima actividad</h2>

    ${
      next
        ? bookingCard(next)
        : '<div class="card muted">No tienes próximas reservas.</div>'
    }
  `;

  content.querySelectorAll('[data-go]').forEach(
    b=>b.onclick=()=>setView(b.dataset.go)
  );
}
function renderPasses(){content.innerHTML=state.passes.length?state.passes.map(p=>`<article class="card"><div class="row"><div><h3>${esc(p.name)}</h3><div class="muted">${p.expires_at?'Caduca: '+new Date(p.expires_at+'T00:00:00').toLocaleDateString('es-ES'):'Sin caducidad'}</div></div><div class="metric">${Number(p.remaining_credits)}</div></div><p class="muted">${Number(p.initial_credits)-Number(p.remaining_credits)} consumidas · ${Number(p.remaining_credits)} disponibles · ${esc(p.status)}</p><p>${(p.pass_services||[]).map(x=>esc(x.services?.name||'')).filter(Boolean).join(' · ')}</p></article>`).join(''):'<div class="card muted">No tienes bonos.</div>'}
function renderBookings(){content.innerHTML=state.bookings.length?state.bookings.map(bookingCard).join(''):'<div class="card muted">Todavía no tienes reservas.</div>'}
async function getSlots(serviceId){const {data,error}=await db.from('slot_availability').select('*').eq('service_id',serviceId).eq('status','open').gt('starts_at',new Date().toISOString()).gt('available_places',0).order('starts_at');if(error){toast('No se pudo cargar la disponibilidad.');return []}return data||[]}
function compatiblePasses(service){return state.passes.filter(p=>p.status==='active'&&(!p.valid_from||p.valid_from<=new Date().toISOString().slice(0,10))&&(!p.expires_at||p.expires_at>=new Date().toISOString().slice(0,10))&&Number(p.remaining_credits)>=Number(service.credit_cost)&&p.pass_services?.some(x=>x.service_id===service.id))}
async function chooseService(id){state.reserve={step:2,service:state.services.find(s=>s.id===id),slot:null,pass:null,notes:''};state.slots=await getSlots(id);renderReserve()}
function renderReserve(){const r=state.reserve;if(r.step===1){content.innerHTML=`<div class="progress">Paso 1 de 3 · Actividad</div>${state.services.map(s=>`<button class="service-card" data-id="${s.id}"><h3>${esc(s.name)}</h3><div class="muted">${esc(s.description||'')} · ${s.duration_minutes} min · ${Number(s.credit_cost)} sesión(es)</div></button>`).join('')||'<div class="card muted">No hay actividades activas.</div>'}`;content.querySelectorAll('[data-id]').forEach(x=>x.onclick=()=>chooseService(x.dataset.id));return}
 if(r.step===2){const groups={};state.slots.forEach(s=>(groups[formatDate(s.starts_at)]??=[]).push(s));content.innerHTML=`<div class="progress">Paso 2 de 3 · Día y hora</div><button id="backService" class="ghost">← Cambiar actividad</button><h2>${esc(r.service.name)}</h2>${Object.entries(groups).map(([d,ss])=>`<div class="day"><h3>${esc(d)}</h3>${ss.map(s=>`<button class="slot" data-id="${s.time_slot_id}">${esc(formatHour(s.starts_at))} · ${s.available_places} plaza(s)</button>`).join('')}</div>`).join('')||'<div class="card muted">No hay horarios disponibles.</div>'}`;$('#backService').onclick=()=>{r.step=1;renderReserve()};content.querySelectorAll('.slot').forEach(x=>x.onclick=()=>chooseSlot(x.dataset.id));return}
 const passes=compatiblePasses(r.service);if(!r.pass&&passes.length===1)r.pass=passes[0];content.innerHTML=`<div class="progress">Paso 3 de 3 · Confirmar</div><button id="backSlot" class="ghost">← Cambiar horario</button><article class="card"><h2>Tu solicitud</h2><p><strong>Actividad:</strong> ${esc(r.service.name)}</p><p><strong>Fecha:</strong> ${esc(formatDate(r.slot.starts_at))}</p><p><strong>Hora:</strong> ${esc(formatHour(r.slot.starts_at))}</p><p><strong>Duración:</strong> ${r.service.duration_minutes} min</p></article>${passes.length?`<label>Bono<select id="passSelect">${passes.map(p=>`<option value="${p.id}" ${r.pass?.id===p.id?'selected':''}>${esc(p.name)} · ${Number(p.remaining_credits)} disponibles</option>`).join('')}</select></label><label>Observaciones (opcional)<textarea id="notes" maxlength="500" rows="3">${esc(r.notes)}</textarea></label><div class="notice">La reserva quedará pendiente hasta que la Hípica la confirme. No se descontará ninguna sesión ahora.</div><button id="requestBtn" class="primary">Solicitar reserva</button>`:'<div class="notice">No tienes un bono válido para reservar esta actividad.</div>'}`;$('#backSlot').onclick=()=>{r.step=2;renderReserve()};if(passes.length){$('#passSelect').onchange=e=>r.pass=passes.find(p=>p.id===e.target.value);$('#notes').oninput=e=>r.notes=e.target.value;$('#requestBtn').onclick=requestBooking}}
function chooseSlot(id){state.reserve.slot=state.slots.find(s=>s.time_slot_id===id);state.reserve.step=3;renderReserve()}
function friendlyError(e){const t=(e?.message||'').toUpperCase();const map={SLOT_NOT_FOUND:'Este horario ya no está disponible.',SLOT_NOT_AVAILABLE:'Este horario ya no está disponible.',SLOT_FULL:'Esta sesión acaba de quedarse sin plazas.',DUPLICATE_BOOKING:'Ya tienes una solicitud o reserva para esta sesión.',PASS_REQUIRED:'Necesitas un bono para reservar esta actividad.',PASS_NOT_FOUND:'No hemos podido encontrar el bono seleccionado.',PASS_NOT_ACTIVE:'Este bono ya no está activo.',PASS_OUTSIDE_VALIDITY:'Este bono no es válido en esta fecha.',INSUFFICIENT_CREDITS:'No tienes suficientes sesiones disponibles.',PASS_NOT_VALID_FOR_SERVICE:'Este bono no puede utilizarse para esta actividad.'};return Object.entries(map).find(([k])=>t.includes(k))?.[1]||'No hemos podido realizar la solicitud. Inténtalo de nuevo.'}
async function requestBooking(){const btn=$('#requestBtn');btn.disabled=true;btn.textContent='Enviando…';const r=state.reserve;const {error}=await db.rpc('request_booking',{p_time_slot_id:r.slot.time_slot_id,p_pass_id:r.pass.id,p_customer_notes:r.notes.trim()||null});if(error){toast(friendlyError(error));btn.disabled=false;btn.textContent='Solicitar reserva';if((error.message||'').match(/SLOT_FULL|SLOT_NOT_AVAILABLE/)){state.slots=await getSlots(r.service.id);r.step=2;renderReserve()}return}await loadBase();toast('Solicitud enviada correctamente.');state.reserve={step:1,service:null,slot:null,pass:null,notes:''};setView('bookings')}
function render(){if(state.view==='home')renderHome();else if(state.view==='passes')renderPasses();else if(state.view==='bookings')renderBookings();else renderReserve()}
async function enter(session){
  state.user=session.user;

  $('#loginView').classList.add('hidden');
  $('#privateView').classList.remove('hidden');

  await loadBase();

  const params=new URLSearchParams(window.location.search);
  const requestedView=params.get('view');

  const allowedViews=[
    'home',
    'reserve',
    'bookings',
    'passes'
  ];

  const initialView=allowedViews.includes(requestedView)
    ? requestedView
    : 'home';

  setView(initialView);
}

$('#loginForm').onsubmit=async e=>{e.preventDefault();$('#loginError').textContent='';const {data,error}=await db.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#password').value});if(error){$('#loginError').textContent='Email o contraseña incorrectos.';return}await enter(data.session)};
$('#logoutBtn').onclick=async()=>{await db.auth.signOut();state.user=null;$('#privateView').classList.add('hidden');$('#loginView').classList.remove('hidden')};
document.querySelectorAll('.bottom-nav button').forEach(b=>b.onclick=()=>setView(b.dataset.view));
(async()=>{const {data:{session}}=await db.auth.getSession();if(session)await enter(session)})();
