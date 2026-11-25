(() => {
  const ADMIN_ROLES = ['staff', 'admin'];
  const DAY_NAMES = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  let calendarMode = 'today';
  let anchorDate = startOfDay(new Date());

  const css = document.createElement('style');
  css.textContent = `
    .calendar-launch{margin:12px 0;width:100%}
    .calendar-toolbar{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:12px 0}
    .calendar-toolbar-group{display:flex;gap:8px;flex-wrap:wrap}
    .calendar-day{border:1px solid var(--line);border-radius:15px;margin:12px 0;overflow:hidden;background:#fff}
    .calendar-day-head{padding:12px 14px;background:#edf5f1;display:flex;justify-content:space-between;align-items:center;gap:10px}
    .calendar-day-head h3{margin:0}
    .calendar-slot{padding:12px 14px;border-top:1px solid var(--line)}
    .calendar-slot:first-of-type{border-top:0}
    .calendar-slot-time{font-weight:850;color:var(--green);min-width:92px}
    .calendar-entry{display:grid;grid-template-columns:92px 1fr;gap:10px;align-items:start}
    .calendar-booked{background:#fffaf0}
    .calendar-free{color:var(--muted)}
    .calendar-conflict{background:#fde8e8;color:#8f1d1d;border-radius:8px;padding:7px;margin-top:8px;font-weight:750}
    .calendar-badge{font-size:11px;font-weight:850;border-radius:99px;padding:4px 8px;background:#e6f0eb;color:var(--green)}
    .calendar-badge.flex{background:#fff1c7;color:#755817}
    .calendar-slot-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}
    .calendar-slot-actions button{padding:7px 10px;font-size:12px}
    .calendar-details{margin-top:5px;color:var(--muted);font-size:13px}
    .calendar-back{margin-bottom:8px}
    @media(max-width:520px){.calendar-entry{grid-template-columns:72px 1fr}.calendar-slot-time{min-width:72px}.calendar-toolbar>button{width:100%}}
  `;
  document.head.appendChild(css);

  function startOfDay(d){const x=new Date(d);x.setHours(0,0,0,0);return x}
  function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
  function isoDay(d){const n=d.getDay();return n===0?7:n}
  function localDateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
  function localDateTime(date,time){return new Date(`${localDateKey(date)}T${time}`)}
  function minutesBetween(a,b){return Math.round((new Date(b)-new Date(a))/60000)}
  function hhmm(v){return new Intl.DateTimeFormat('es-ES',{hour:'2-digit',minute:'2-digit'}).format(new Date(v))}
  function isAdminUser(){return !!state.profile && ADMIN_ROLES.includes(state.profile.role)}

  function installCalendarButton(){
    if(!isAdminUser() || document.querySelector('#openAdminCalendar')) return;
    const check=()=>{
      if(state.view!=='admin') return;
      const hero=content.querySelector('.hero');
      if(!hero || document.querySelector('#openAdminCalendar')) return;
      const btn=document.createElement('button');
      btn.id='openAdminCalendar';btn.type='button';btn.className='primary calendar-launch';btn.textContent='📅 Abrir calendario';
      btn.onclick=()=>openCalendar('today');
      hero.insertAdjacentElement('afterend',btn);
    };
    const observer=new MutationObserver(check);observer.observe(content,{childList:true,subtree:true});check();
  }

  async function loadCalendarData(from,to){
    const fromIso=from.toISOString();const toIso=to.toISOString();
    const [rulesRes,bookingsRes,exceptionsRes,periodsRes]=await Promise.all([
      db.from('schedule_rules').select('*,services:preferred_service_id(name,duration_minutes)').eq('active',true).order('start_time'),
      db.from('booking_schedule').select('*').in('status',['pending','confirmed']).gte('starts_at',fromIso).lt('starts_at',toIso).order('starts_at'),
      db.from('calendar_exceptions').select('*').gte('exception_date',localDateKey(from)).lte('exception_date',localDateKey(addDays(to,-1))),
      db.from('special_periods').select('*').eq('active',true).lte('starts_on',localDateKey(addDays(to,-1))).gte('ends_on',localDateKey(from))
    ]);
    const error=[rulesRes,bookingsRes,exceptionsRes,periodsRes].find(x=>x.error)?.error;
    if(error) throw error;
    return {rules:rulesRes.data||[],bookings:bookingsRes.data||[],exceptions:exceptionsRes.data||[],periods:periodsRes.data||[]};
  }

  function ruleApplies(rule,date,data){
    const key=localDateKey(date);const weekday=isoDay(date);
    const inSpecial=data.periods.some(p=>key>=p.starts_on&&key<=p.ends_on&&p.open_all_days);
    const datesOk=(!rule.valid_from||key>=rule.valid_from)&&(!rule.valid_to||key<=rule.valid_to);
    if(!datesOk) return false;
    if(rule.weekday===weekday) return true;
    // En periodos especiales, replicamos las horas/reglas del jueves como plantilla para martes/miércoles.
    return inSpecial && [2,3].includes(weekday) && rule.weekday===4;
  }

  function isClosed(date,time,data){
    const key=localDateKey(date);
    const matching=data.exceptions.filter(e=>e.exception_date===key&&(!e.start_time||e.start_time.slice(0,5)===time.slice(0,5)));
    const latest=matching[matching.length-1];
    return latest ? latest.exception_type==='closed' : false;
  }

  function overlaps(start,end,b){return start<new Date(b.ends_at)&&end>new Date(b.starts_at)}

  function renderDay(date,data){
    const rules=data.rules.filter(r=>ruleApplies(r,date,data));
    const dayBookings=data.bookings.filter(b=>localDateKey(new Date(b.starts_at))===localDateKey(date));
    const pieces=[];
    for(const rule of rules){
      const time=rule.start_time.slice(0,5);
      const closed=isClosed(date,time,data);
      const start=localDateTime(date,time);
      const duration=rule.services?.duration_minutes||60;
      const end=new Date(start.getTime()+duration*60000);
      const overlapsHere=closed?[]:dayBookings.filter(b=>overlaps(start,end,b));
      const exact=dayBookings.filter(b=>Math.abs(new Date(b.starts_at)-start)<60000);
      const conflict=overlapsHere.length>1;
      pieces.push(`<div class="calendar-slot ${closed?'calendar-closed':(overlapsHere.length?'calendar-booked':'calendar-free')}">
        <div class="calendar-entry"><div class="calendar-slot-time">${time}</div><div>
          <div class="row"><strong>${esc(rule.services?.name||'Actividad')}</strong><span class="calendar-badge ${rule.flexible?'flex':''}">${rule.flexible?'Flexible':'Preferente'}</span></div>
          ${closed?'<div class="calendar-details"><strong>Franja cerrada</strong></div>':(exact.length?exact.map(b=>`<div class="calendar-details"><strong>${esc(b.service_name)}</strong> · ${hhmm(b.starts_at)}–${hhmm(b.ends_at)} · ${b.participant_count||1} participante(s) · ${esc(b.status)}</div>`).join(''):'<div class="calendar-details">Disponible según patrón</div>')}
          ${overlapsHere.filter(b=>!exact.includes(b)).map(b=>`<div class="calendar-details">Bloqueado por ${esc(b.service_name)} ${hhmm(b.starts_at)}–${hhmm(b.ends_at)}</div>`).join('')}
          ${conflict?'<div class="calendar-conflict">⚠ Conflicto: hay actividades solapadas</div>':''}
          <div class="calendar-slot-actions">
            ${isClosed(date,time,data)
              ? `<button class="secondary" data-slot-open="1" data-date="${localDateKey(date)}" data-time="${time}" type="button">Abrir franja</button>`
              : `<button class="ghost" data-slot-close="1" data-date="${localDateKey(date)}" data-time="${time}" type="button" ${overlapsHere.length?'disabled title="Hay una reserva que ocupa esta franja"':''}>Cerrar franja</button>`}
          </div>
        </div></div></div>`);
    }
    const unslotted=dayBookings.filter(b=>!rules.some(r=>Math.abs(localDateTime(date,r.start_time.slice(0,5))-new Date(b.starts_at))<60000));
    for(const b of unslotted){pieces.push(`<div class="calendar-slot calendar-booked"><div class="calendar-entry"><div class="calendar-slot-time">${hhmm(b.starts_at)}</div><div><strong>${esc(b.service_name)}</strong><div class="calendar-details">${hhmm(b.starts_at)}–${hhmm(b.ends_at)} · ${b.participant_count||1} participante(s) · ${esc(b.status)}</div></div></div></div>`)}
    return `<section class="calendar-day"><div class="calendar-day-head"><h3>${DAY_NAMES[isoDay(date)]} ${date.toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</h3><span>${dayBookings.length} reserva(s)</span></div>${pieces.length?pieces.join(''):'<div class="calendar-slot calendar-free">Día cerrado o sin reglas.</div>'}</section>`;
  }

  async function setSlotException(date,time,type){
    if(!isAdminUser()) return toast('No tienes permisos de administración.');
    const label=type==='closed'?'cerrar':'abrir';
    if(!confirm(`¿Quieres ${label} la franja del ${new Date(date+'T12:00:00').toLocaleDateString('es-ES')} a las ${time}?`)) return;
    const {error}=await db.from('calendar_exceptions').insert({exception_date:date,start_time:time,exception_type:type,reason:type==='closed'?'Cerrada desde calendario':'Reabierta desde calendario',created_by:state.user.id});
    if(error){console.error(error);return toast('No se pudo actualizar la franja.');}
    toast(type==='closed'?'Franja cerrada.':'Franja abierta.');
    await openCalendar(calendarMode);
  }

  function bindSlotActions(){
    content.querySelectorAll('[data-slot-close]').forEach(b=>b.onclick=()=>setSlotException(b.dataset.date,b.dataset.time,'closed'));
    content.querySelectorAll('[data-slot-open]').forEach(b=>b.onclick=()=>setSlotException(b.dataset.date,b.dataset.time,'open'));
  }

  async function openCalendar(mode=calendarMode){
    calendarMode=mode;
    const from=mode==='today'?startOfDay(anchorDate):startOfDay(addDays(anchorDate,1-isoDay(anchorDate)));
    const days=mode==='today'?1:7;const to=addDays(from,days);
    content.innerHTML='<div class="card muted">Cargando calendario…</div>';
    try{
      const data=await loadCalendarData(from,to);
      content.innerHTML=`<button id="calendarBack" class="ghost calendar-back" type="button">← Volver a solicitudes</button>
        <div class="calendar-toolbar"><div class="calendar-toolbar-group"><button class="${mode==='today'?'secondary':'ghost'}" data-calendar-mode="today" type="button">Hoy</button><button class="${mode==='week'?'secondary':'ghost'}" data-calendar-mode="week" type="button">Semana</button></div><div class="calendar-toolbar-group"><button id="calendarPrev" class="ghost" type="button">←</button><button id="calendarCurrent" class="ghost" type="button">Hoy</button><button id="calendarNext" class="ghost" type="button">→</button></div></div>
        <div class="notice">El calendario muestra el patrón de invierno y bloquea visualmente los solapamientos por la duración real de cada reserva.</div>
        ${Array.from({length:days},(_,i)=>renderDay(addDays(from,i),data)).join('')}`;
      document.querySelector('#pageTitle').textContent='Calendario';
      document.querySelector('#calendarBack').onclick=()=>setView('admin');
      content.querySelectorAll('[data-calendar-mode]').forEach(x=>x.onclick=()=>openCalendar(x.dataset.calendarMode));
      document.querySelector('#calendarPrev').onclick=()=>{anchorDate=addDays(anchorDate,mode==='today'?-1:-7);openCalendar(mode)};
      document.querySelector('#calendarNext').onclick=()=>{anchorDate=addDays(anchorDate,mode==='today'?1:7);openCalendar(mode)};
      document.querySelector('#calendarCurrent').onclick=()=>{anchorDate=startOfDay(new Date());openCalendar(mode)};
      bindSlotActions();
    }catch(e){console.error(e);content.innerHTML='<button id="calendarBack" class="ghost" type="button">← Volver</button><div class="card error">No se pudo cargar el calendario. Verifica que ejecutaste motor_calendario_v1.sql.</div>';document.querySelector('#calendarBack').onclick=()=>setView('admin')}
  }

  const timer=setInterval(()=>{if(state.profile){installCalendarButton();clearInterval(timer)}},250);
})();

