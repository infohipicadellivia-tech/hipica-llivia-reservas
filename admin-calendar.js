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
    .calendar-day-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
    .calendar-day.closed-day{opacity:.82}
    .calendar-day.closed-day .calendar-day-head{background:#fde8e8}
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
    .two-months{display:grid;grid-template-columns:1fr 1fr;gap:16px}.month-card{border:1px solid var(--line);border-radius:15px;padding:12px;background:#fff}.month-card h3{text-align:center;margin:4px 0 12px}.month-weekdays,.month-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}.month-weekdays div{text-align:center;font-size:11px;font-weight:800;color:var(--muted);padding:4px}.month-cell{min-height:76px;border:1px solid var(--line);border-radius:8px;background:#fff;padding:5px;text-align:left;cursor:pointer;overflow:hidden}.month-cell.empty{border-color:transparent;background:transparent;cursor:default}.month-cell.closed{background:#fde8e8}.month-cell.has-booking{background:#f3f8f5}.month-num{font-weight:850}.month-event{font-size:10px;line-height:1.25;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.month-event.pending{color:#866609}.month-event.confirmed{color:#176b3a}.month-more{font-size:10px;color:var(--muted);margin-top:3px}.jump-date{display:flex;gap:8px;align-items:end;flex-wrap:wrap}.jump-date label{margin:0}.jump-date input{margin-top:4px}.jump-date button{margin-bottom:0}.calendar-limit{font-size:12px;color:var(--muted)}.period-card.inactive{opacity:.62}.period-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.period-form{border:1px solid var(--line);border-radius:15px;padding:14px;margin:12px 0;background:#fff}@media(max-width:700px){.two-months{grid-template-columns:1fr}}
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
    const [rulesRes,bookingsRes,exceptionsRes,periodsRes,overridesRes,servicesRes]=await Promise.all([
      db.from('schedule_rules').select('*,services:preferred_service_id(name,duration_minutes)').eq('active',true).order('start_time'),
      db.from('booking_schedule').select('*').in('status',['pending','confirmed']).gte('starts_at',fromIso).lt('starts_at',toIso).order('starts_at'),
      db.from('calendar_exceptions').select('*').gte('exception_date',localDateKey(from)).lte('exception_date',localDateKey(addDays(to,-1))),
      db.from('special_periods').select('*').eq('active',true).lte('starts_on',localDateKey(addDays(to,-1))).gte('ends_on',localDateKey(from)),
      db.from('slot_service_overrides').select('*,services:service_id(name,duration_minutes)').gte('override_date',localDateKey(from)).lte('override_date',localDateKey(addDays(to,-1))),
      db.from('services').select('id,name,duration_minutes').eq('active',true)
    ]);
    const error=[rulesRes,bookingsRes,exceptionsRes,periodsRes,overridesRes,servicesRes].find(x=>x.error)?.error;
    if(error) throw error;
    return {rules:rulesRes.data||[],bookings:bookingsRes.data||[],exceptions:exceptionsRes.data||[],periods:periodsRes.data||[],overrides:overridesRes.data||[],services:servicesRes.data||[]};
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

  function isDayClosed(date,data){
    const key=localDateKey(date);
    const matching=data.exceptions.filter(e=>e.exception_date===key&&!e.start_time);
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
      const override=data.overrides.find(o=>o.override_date===localDateKey(date)&&o.start_time.slice(0,5)===time);
      const effectiveService=override?.services||rule.services;
      const effectiveServiceId=override?.service_id||rule.preferred_service_id;
      const closed=isClosed(date,time,data);
      const start=localDateTime(date,time);
      const duration=effectiveService?.duration_minutes||60;
      const end=new Date(start.getTime()+duration*60000);
      const overlapsHere=closed?[]:dayBookings.filter(b=>overlaps(start,end,b));
       new Date(booking.starts_at).getTime() -
      start.getTime()
    ) < 60000
);

const exactParticipants = exact.reduce(
  (total, booking) =>
    total + Number(booking.participant_count || 0),
  0
);

const recommendedCapacity = 6;
const overCapacity =
  exactParticipants > recommendedCapacity;

const activityGroups = new Set(
  overlapsHere.map(booking => [
    booking.service_id,
    new Date(booking.starts_at).getTime(),
    new Date(booking.ends_at).getTime()
  ].join('|'))
);

const conflict = activityGroups.size > 1;
      const exactParticipants = exact.reduce(
  (total, booking) =>
    total + Number(booking.participant_count || 0),
  0
);

const recommendedCapacity = 6;
const overCapacity =
  exactParticipants > recommendedCapacity;
      const activityGroups = new Set(
  overlapsHere.map(booking => [
    booking.service_id,
    new Date(booking.starts_at).getTime(),
    new Date(booking.ends_at).getTime()
  ].join('|'))
);

const conflict = activityGroups.size > 1;
      pieces.push(`<div class="calendar-slot ${closed?'calendar-closed':(overlapsHere.length?'calendar-booked':'calendar-free')}">
        <div class="calendar-entry"><div class="calendar-slot-time">${time}</div><div>
          <div class="row"><strong>${esc(effectiveService?.name||'Actividad')}</strong><span class="calendar-badge ${rule.flexible?'flex':''}">${rule.flexible?'Flexible':'Preferente'}</span></div>
          ${closed?'<div class="calendar-details"><strong>Franja cerrada</strong></div>':(exact.length?exact.map(b=>`<div class="calendar-details"><strong>${esc(b.service_name)}</strong> · ${hhmm(b.starts_at)}–${hhmm(b.ends_at)} · ${b.participant_count||1} participante(s) · ${esc(b.status)}</div>`).join(''):'<div class="calendar-details">Disponible según patrón</div>')}
          ${overlapsHere.filter(b=>!exact.includes(b)).map(b=>`<div class="calendar-details">Bloqueado por ${esc(b.service_name)} ${hhmm(b.starts_at)}–${hhmm(b.ends_at)}</div>`).join('')}
          ${exact.length ? `
  <div class="notice">
    <strong>
      Ocupación: ${exactParticipants}/${recommendedCapacity}
    </strong>
    ${overCapacity ? `
      <div class="calendar-conflict">
        ⚠ Aforo recomendado superado en
        ${exactParticipants - recommendedCapacity}
        persona(s)
      </div>
    ` : ''}
  </div>
` : ''}
          ${conflict?'<div class="calendar-conflict">⚠ Conflicto: hay actividades solapadas</div>':''}
          ${rule.flexible && !overlapsHere.length ? `<div class="calendar-slot-actions"><button class="secondary" data-flex-change="1" data-date="${localDateKey(date)}" data-time="${time}" data-current-service="${effectiveServiceId}" type="button">Cambiar ${esc(effectiveService?.name||'actividad')}</button>${override?`<button class="ghost" data-flex-reset="1" data-date="${localDateKey(date)}" data-time="${time}" type="button">Restaurar preferencia</button>`:''}</div>`:''}
          <div class="calendar-slot-actions">
            ${isClosed(date,time,data)
              ? `<button class="secondary" data-slot-open="1" data-date="${localDateKey(date)}" data-time="${time}" type="button">Abrir franja</button>`
              : `<button class="ghost" data-slot-close="1" data-date="${localDateKey(date)}" data-time="${time}" type="button" ${overlapsHere.length?'disabled title="Hay una reserva que ocupa esta franja"':''}>Cerrar franja</button>`}
          </div>
        </div></div></div>`);
    }
    const unslotted=dayBookings.filter(b=>!rules.some(r=>Math.abs(localDateTime(date,r.start_time.slice(0,5))-new Date(b.starts_at))<60000));
    for(const b of unslotted){pieces.push(`<div class="calendar-slot calendar-booked"><div class="calendar-entry"><div class="calendar-slot-time">${hhmm(b.starts_at)}</div><div><strong>${esc(b.service_name)}</strong><div class="calendar-details">${hhmm(b.starts_at)}–${hhmm(b.ends_at)} · ${b.participant_count||1} participante(s) · ${esc(b.status)}</div></div></div></div>`)}
    const dayClosed=isDayClosed(date,data);
    return `<section class="calendar-day ${dayClosed?'closed-day':''}"><div class="calendar-day-head"><h3>${DAY_NAMES[isoDay(date)]} ${date.toLocaleDateString('es-ES',{day:'numeric',month:'short'})}${dayClosed?' · CERRADO':''}</h3><div class="calendar-day-actions"><span>${dayBookings.length} reserva(s)</span>${dayClosed?`<button class="secondary" data-day-open="1" data-date="${localDateKey(date)}" type="button">Abrir día</button>`:`<button class="ghost" data-day-close="1" data-date="${localDateKey(date)}" data-bookings="${dayBookings.length}" type="button">Cerrar día</button>`}</div></div>${pieces.length?pieces.join(''):'<div class="calendar-slot calendar-free">Día cerrado o sin reglas.</div>'}</section>`;
  }

  async function setSlotException(date,time,type){
    if(!isAdminUser()) return toast('No tienes permisos de administración.');
    const label=type==='closed'?'cerrar':'abrir';
    if(!confirm(`¿Quieres ${label} la franja del ${new Date(date+'T12:00:00').toLocaleDateString('es-ES')} a las ${time}?`)) return;
    const {error}=await db.rpc('set_calendar_exception',{
      p_exception_date:date,
      p_start_time:time,
      p_exception_type:type,
      p_reason:type==='closed'?'Cerrada desde calendario':'Reabierta desde calendario'
    });
    if(error){console.error(error);return toast((error.message||'').includes('FORBIDDEN')?'Tu usuario no tiene rol admin/staff.':'No se pudo actualizar la franja.');}
    toast(type==='closed'?'Franja cerrada.':'Franja abierta.');
    await openCalendar(calendarMode);
  }

  async function setDayException(date,type,bookingCount){
    if(!isAdminUser()) return toast('No tienes permisos de administración.');
    let msg=type==='closed'
      ? `¿Quieres cerrar el ${new Date(date+'T12:00:00').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})} completo?`
      : `¿Quieres volver a abrir el ${new Date(date+'T12:00:00').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})}?`;
    if(type==='closed' && Number(bookingCount)>0){
      msg += `\n\nATENCIÓN: hay ${bookingCount} reserva(s) activa(s). Cerrar el día NO las cancela ni devuelve/consume bonos. Debes gestionarlas por separado.`;
    }
    if(!confirm(msg)) return;
    const {error}=await db.rpc('set_calendar_exception',{
      p_exception_date:date,
      p_start_time:null,
      p_exception_type:type,
      p_reason:type==='closed'?'Día cerrado desde calendario':'Día reabierto desde calendario'
    });
    if(error){console.error(error);return toast('No se pudo actualizar el día.');}
    toast(type==='closed'?'Día cerrado.':'Día abierto.');
    await openCalendar(calendarMode);
  }

  function bindDayActions(){
    content.querySelectorAll('[data-day-close]').forEach(b=>b.onclick=()=>setDayException(b.dataset.date,'closed',b.dataset.bookings));
    content.querySelectorAll('[data-day-open]').forEach(b=>b.onclick=()=>setDayException(b.dataset.date,'open',0));
  }

  async function changeFlexibleService(date,time,currentServiceId){
    const currentData=await loadCalendarData(new Date(date+'T00:00:00'),addDays(new Date(date+'T00:00:00'),1));
    const alternatives=currentData.services.filter(x=>x.id!==currentServiceId && (/clase/i.test(x.name)||/ruta|paseo/i.test(x.name)));
    if(!alternatives.length) return toast('No hay otra actividad disponible.');
    showFlexibleServicePicker(date,time,alternatives);
  }

  function showFlexibleServicePicker(date,time,alternatives){
    content.innerHTML=`<button id="backFlexible" class="ghost" type="button">← Volver al calendario</button>
      <h2>Cambiar actividad</h2>
      <div class="notice">Cambio puntual para ${new Date(date+'T12:00:00').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})} a las ${time}. El patrón habitual no cambia.</div>
      ${alternatives.map(x=>`<button class="service-card" data-flex-target="${x.id}" type="button"><h3>${esc(x.name)}</h3><div class="muted">${x.duration_minutes||60} min</div></button>`).join('')}`;
    document.querySelector('#backFlexible').onclick=()=>openCalendar(calendarMode);
    content.querySelectorAll('[data-flex-target]').forEach(b=>b.onclick=()=>applyFlexibleService(date,time,b.dataset.flexTarget,alternatives));
  }

  async function applyFlexibleService(date,time,serviceId,alternatives){
    const target=alternatives.find(x=>x.id===serviceId);
    if(!target) return;
    if(!confirm(`¿Cambiar puntualmente ${date} ${time} a ${target.name}?`)) return;
    const {error}=await db.rpc('set_flexible_slot_service',{p_override_date:date,p_start_time:time,p_service_id:target.id});
    if(error){console.error(error);return toast((error.message||'').includes('SLOT_HAS_BOOKINGS')?'No se puede cambiar: ya hay reservas en esta franja.':'No se pudo cambiar la actividad.');}
    toast(`Franja cambiada a ${target.name}.`); await openCalendar(calendarMode);
  }
  async function resetFlexibleService(date,time){
    if(!confirm('¿Restaurar la actividad preferente de esta franja?')) return;
    const {error}=await db.rpc('clear_flexible_slot_service',{p_override_date:date,p_start_time:time});
    if(error){console.error(error);return toast('No se pudo restaurar la actividad.');}
    toast('Preferencia restaurada.'); await openCalendar(calendarMode);
  }
  function bindFlexibleActions(){
    content.querySelectorAll('[data-flex-change]').forEach(b=>b.onclick=()=>changeFlexibleService(b.dataset.date,b.dataset.time,b.dataset.currentService));
    content.querySelectorAll('[data-flex-reset]').forEach(b=>b.onclick=()=>resetFlexibleService(b.dataset.date,b.dataset.time));
  }

  function bindSlotActions(){
    content.querySelectorAll('[data-slot-close]').forEach(b=>b.onclick=()=>setSlotException(b.dataset.date,b.dataset.time,'closed'));
    content.querySelectorAll('[data-slot-open]').forEach(b=>b.onclick=()=>setSlotException(b.dataset.date,b.dataset.time,'open'));
  }

  function monthStart(d){return new Date(d.getFullYear(),d.getMonth(),1)}
  function monthEndExclusive(d){return new Date(d.getFullYear(),d.getMonth()+1,1)}
  function addMonths(d,n){return new Date(d.getFullYear(),d.getMonth()+n,1)}
  function withinTwoMonthWindow(d){const today=startOfDay(new Date());const max=new Date(today.getFullYear(),today.getMonth()+3,0,23,59,59);return d>=today&&d<=max}
  function renderMonth(month,data){
    const first=monthStart(month), next=monthEndExclusive(month), offset=isoDay(first)-1;
    const cells=Array(offset).fill('<div class="month-cell empty"></div>');
    for(let d=new Date(first);d<next;d=addDays(d,1)){
      const key=localDateKey(d), bookings=data.bookings.filter(b=>localDateKey(new Date(b.starts_at))===key), closed=isDayClosed(d,data);
      const events=bookings.slice(0,3).map(b=>`<div class="month-event ${b.status}">${hhmm(b.starts_at)} ${esc(b.service_name)} · ${b.participant_count||1}</div>`).join('');
      cells.push(`<button type="button" class="month-cell ${closed?'closed':''} ${bookings.length?'has-booking':''}" data-month-day="${key}"><div class="month-num">${d.getDate()}${closed?' · ⛔':''}</div>${events}${bookings.length>3?`<div class="month-more">+${bookings.length-3} más</div>`:''}</button>`);
    }
    return `<section class="month-card"><h3>${first.toLocaleDateString('es-ES',{month:'long',year:'numeric'})}</h3><div class="month-weekdays"><div>L</div><div>M</div><div>X</div><div>J</div><div>V</div><div>S</div><div>D</div></div><div class="month-grid">${cells.join('')}</div></section>`;
  }
  async function openSpecialPeriods(){
    content.innerHTML='<div class="card muted">Cargando periodos especiales…</div>';
    const r=await db.from('special_periods').select('*').order('starts_on',{ascending:true});
    if(r.error){console.error(r.error);return toast('No se pudieron cargar los periodos especiales.');}
    const rows=r.data||[];
    content.innerHTML=`<button id="periodBack" class="ghost" type="button">← Volver al calendario</button><h2>Periodos especiales</h2>
      <div class="notice">Durante un periodo con “Abrir todos los días”, martes y miércoles adoptan la misma parrilla horaria base que el jueves. Puedes cerrar días o franjas concretas después desde el calendario.</div>
      <div class="period-form"><h3>Nuevo periodo</h3><label>Nombre<input id="periodName" placeholder="Navidad, Semana Santa, Agosto…"></label><div class="grid"><label>Desde<input id="periodFrom" type="date"></label><label>Hasta<input id="periodTo" type="date"></label></div><label><input id="periodAllDays" type="checkbox" checked style="width:auto"> Abrir todos los días</label><label>Notas<textarea id="periodNotes" rows="2"></textarea></label><button id="periodCreate" class="primary" type="button">Crear periodo</button></div>
      <h3>Periodos configurados</h3>${rows.map(x=>`<article class="card period-card ${x.active?'':'inactive'}"><div class="row"><div><h3>${esc(x.name)}</h3><div class="muted">${new Date(x.starts_on+'T12:00:00').toLocaleDateString('es-ES')} → ${new Date(x.ends_on+'T12:00:00').toLocaleDateString('es-ES')} · ${x.open_all_days?'Todos los días':'Sin apertura total'}</div></div><span class="status ${x.active?'confirmed':'completed'}">${x.active?'Activo':'Inactivo'}</span></div>${x.notes?`<p>${esc(x.notes)}</p>`:''}<div class="period-actions"><button class="secondary" data-period-toggle="${x.id}" data-active="${x.active?'false':'true'}" type="button">${x.active?'Desactivar':'Activar'}</button><button class="ghost" data-period-edit="${x.id}" type="button">Editar</button><button class="danger" data-period-delete="${x.id}" type="button">Eliminar</button></div></article>`).join('')||'<div class="card muted">No hay periodos configurados.</div>'}`;
    document.querySelector('#pageTitle').textContent='Periodos especiales';
    document.querySelector('#periodBack').onclick=()=>openCalendar('months');
    document.querySelector('#periodCreate').onclick=()=>savePeriod(null);
    content.querySelectorAll('[data-period-toggle]').forEach(b=>b.onclick=()=>togglePeriod(b.dataset.periodToggle,b.dataset.active==='true'));
    content.querySelectorAll('[data-period-edit]').forEach(b=>b.onclick=()=>editPeriod(rows.find(x=>x.id===b.dataset.periodEdit)));
    content.querySelectorAll('[data-period-delete]').forEach(b=>b.onclick=()=>deletePeriod(b.dataset.periodDelete));
  }
  async function savePeriod(id){
    const name=document.querySelector('#periodName').value.trim(),from=document.querySelector('#periodFrom').value,to=document.querySelector('#periodTo').value,all=document.querySelector('#periodAllDays').checked,notes=document.querySelector('#periodNotes').value.trim()||null;
    if(!name||!from||!to)return toast('Completa nombre y fechas.');if(to<from)return toast('La fecha final no puede ser anterior a la inicial.');
    const {error}=await db.rpc('admin_save_special_period',{p_id:id,p_name:name,p_starts_on:from,p_ends_on:to,p_open_all_days:all,p_notes:notes});
    if(error){console.error(error);return toast('No se pudo guardar el periodo.');}toast(id?'Periodo actualizado.':'Periodo creado.');openSpecialPeriods();
  }
  function editPeriod(x){
    content.querySelector('#periodName').value=x.name;content.querySelector('#periodFrom').value=x.starts_on;content.querySelector('#periodTo').value=x.ends_on;content.querySelector('#periodAllDays').checked=x.open_all_days;content.querySelector('#periodNotes').value=x.notes||'';
    const btn=content.querySelector('#periodCreate');btn.textContent='Guardar cambios';btn.onclick=()=>savePeriod(x.id);content.querySelector('.period-form').scrollIntoView({behavior:'smooth'});
  }
  async function togglePeriod(id,active){const {error}=await db.rpc('admin_toggle_special_period',{p_id:id,p_active:active});if(error){console.error(error);return toast('No se pudo cambiar el estado.');}toast(active?'Periodo activado.':'Periodo desactivado.');openSpecialPeriods()}
  async function deletePeriod(id){if(!confirm('¿Eliminar definitivamente este periodo especial?'))return;const {error}=await db.rpc('admin_delete_special_period',{p_id:id});if(error){console.error(error);return toast('No se pudo eliminar el periodo.');}toast('Periodo eliminado.');openSpecialPeriods()}

  async function openTwoMonths(){
    calendarMode='months';
    const today=startOfDay(new Date()), first=monthStart(today), second=addMonths(first,1), to=addMonths(first,2);
    content.innerHTML='<div class="card muted">Cargando 2 meses…</div>';
    try{
      const data=await loadCalendarData(first,to);
      content.innerHTML=`<button id="calendarBack" class="ghost calendar-back" type="button">← Volver a solicitudes</button>
        <div class="calendar-toolbar"><div class="calendar-toolbar-group"><button class="ghost" data-calendar-mode="today" type="button">Hoy</button><button class="ghost" data-calendar-mode="week" type="button">Semana</button><button class="secondary" type="button">2 meses</button><button id="specialPeriodsBtn" class="ghost" type="button">Periodos especiales</button></div>
        <div class="jump-date"><label>Ir a fecha<input id="jumpDate" type="date" min="${localDateKey(today)}" max="${localDateKey(new Date(today.getFullYear(),today.getMonth()+3,0))}"></label><button id="jumpBtn" class="ghost" type="button">Ir</button></div></div>
        <div class="notice">Vista de planificación: pulsa cualquier día para abrir su detalle. Se muestran el mes actual y el siguiente.</div>
        <div class="two-months">${renderMonth(first,data)}${renderMonth(second,data)}</div>`;
      document.querySelector('#pageTitle').textContent='Calendario · 2 meses';
      document.querySelector('#calendarBack').onclick=()=>setView('admin');
      content.querySelectorAll('[data-calendar-mode]').forEach(x=>x.onclick=()=>openCalendar(x.dataset.calendarMode));
      document.querySelector('#specialPeriodsBtn').onclick=openSpecialPeriods;
      content.querySelectorAll('[data-month-day]').forEach(x=>x.onclick=()=>{anchorDate=startOfDay(new Date(x.dataset.monthDay+'T12:00:00'));openCalendar('today')});
      document.querySelector('#jumpBtn').onclick=()=>{const v=document.querySelector('#jumpDate').value;if(!v)return toast('Selecciona una fecha.');const d=startOfDay(new Date(v+'T12:00:00'));if(!withinTwoMonthWindow(d))return toast('Selecciona una fecha dentro de los próximos 2 meses.');anchorDate=d;openCalendar('today')};
    }catch(e){console.error(e);content.innerHTML='<button id="calendarBack" class="ghost">← Volver</button><div class="card error">No se pudo cargar la vista de 2 meses.</div>';document.querySelector('#calendarBack').onclick=()=>setView('admin')}
  }

  async function openCalendar(mode=calendarMode){
    if(mode==='months') return openTwoMonths();
    calendarMode=mode;
    const from=mode==='today'?startOfDay(anchorDate):startOfDay(addDays(anchorDate,1-isoDay(anchorDate)));
    const days=mode==='today'?1:7;const to=addDays(from,days);
    content.innerHTML='<div class="card muted">Cargando calendario…</div>';
    try{
      const data=await loadCalendarData(from,to);
      content.innerHTML=`<button id="calendarBack" class="ghost calendar-back" type="button">← Volver a solicitudes</button>
        <div class="calendar-toolbar"><div class="calendar-toolbar-group"><button class="${mode==='today'?'secondary':'ghost'}" data-calendar-mode="today" type="button">Hoy</button><button class="${mode==='week'?'secondary':'ghost'}" data-calendar-mode="week" type="button">Semana</button><button class="ghost" data-calendar-mode="months" type="button">2 meses</button></div><div class="calendar-toolbar-group"><button id="calendarPrev" class="ghost" type="button">←</button><button id="calendarCurrent" class="ghost" type="button">Hoy</button><button id="calendarNext" class="ghost" type="button">→</button></div></div>
        <div class="notice">El calendario muestra el patrón de invierno y bloquea visualmente los solapamientos por la duración real de cada reserva.</div>
        ${Array.from({length:days},(_,i)=>renderDay(addDays(from,i),data)).join('')}`;
      document.querySelector('#pageTitle').textContent='Calendario';
      document.querySelector('#calendarBack').onclick=()=>setView('admin');
      content.querySelectorAll('[data-calendar-mode]').forEach(x=>x.onclick=()=>openCalendar(x.dataset.calendarMode));
      document.querySelector('#calendarPrev').onclick=()=>{anchorDate=addDays(anchorDate,mode==='today'?-1:-7);openCalendar(mode)};
      document.querySelector('#calendarNext').onclick=()=>{anchorDate=addDays(anchorDate,mode==='today'?1:7);openCalendar(mode)};
      document.querySelector('#calendarCurrent').onclick=()=>{anchorDate=startOfDay(new Date());openCalendar(mode)};
      bindSlotActions();
      bindDayActions();
      bindFlexibleActions();
    }catch(e){console.error(e);content.innerHTML='<button id="calendarBack" class="ghost" type="button">← Volver</button><div class="card error">No se pudo cargar el calendario. Verifica que ejecutaste motor_calendario_v1.sql.</div>';document.querySelector('#calendarBack').onclick=()=>setView('admin')}
  }

  const timer=setInterval(()=>{if(state.profile){installCalendarButton();clearInterval(timer)}},250);
})();
