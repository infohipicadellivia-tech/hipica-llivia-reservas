(() => {
  const isStaff=()=>state.profile&&['staff','admin'].includes(state.profile.role);

  function install(){
    if(!isStaff())return;
    const marker=document.querySelector('[data-current-booking-id]');
    if(!marker||document.querySelector('#calendarBookingActions'))return;
    const bookingId=marker.dataset.currentBookingId;
    const box=document.createElement('div');
    box.id='calendarBookingActions';box.className='admin-actions';
    box.innerHTML=`<button id="calendarReschedule" class="secondary" type="button">✏️ Modificar reserva</button><button id="calendarCancel" class="danger" type="button">❌ Cancelar reserva</button>`;
    marker.insertAdjacentElement('afterend',box);
    $('#calendarReschedule').onclick=()=>openReschedule(bookingId);
    $('#calendarCancel').onclick=()=>cancelBooking(bookingId);
  }

  async function openReschedule(bookingId){
    const r=await db.from('booking_schedule').select('*').eq('booking_id',bookingId).single();
    if(r.error){console.error(r.error);return toast('No se pudo cargar la reserva.');}
    const b=r.data;
    const from=new Date();from.setHours(0,0,0,0);
    const to=new Date(from);to.setDate(to.getDate()+60);
    const slots=await db.from('time_slots').select('*').eq('service_id',b.service_id).eq('status','open').gte('starts_at',from.toISOString()).lte('starts_at',to.toISOString()).neq('starts_at',b.starts_at).order('starts_at').limit(150);
    if(slots.error){console.error(slots.error);return toast('No se pudieron cargar las franjas disponibles.');}
    const rows=slots.data||[];
    content.innerHTML=`<button id="rescheduleBack" class="ghost" type="button">← Volver al detalle</button><h2>✏️ Modificar reserva</h2><section class="card"><strong>${esc(b.client_name)}</strong><div class="muted">${esc(b.service_name)} · Actual: ${new Date(b.starts_at).toLocaleDateString('es-ES')} ${new Intl.DateTimeFormat('es-ES',{hour:'2-digit',minute:'2-digit'}).format(new Date(b.starts_at))}</div></section><label>Nueva franja<select id="newSlot"><option value="">Selecciona nueva fecha y hora</option>${rows.map(s=>`<option value="${s.id}">${new Date(s.starts_at).toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'})} · ${new Intl.DateTimeFormat('es-ES',{hour:'2-digit',minute:'2-digit'}).format(new Date(s.starts_at))}–${new Intl.DateTimeFormat('es-ES',{hour:'2-digit',minute:'2-digit'}).format(new Date(s.ends_at))}</option>`).join('')}</select></label><label>Observaciones del cambio<textarea id="rescheduleNotes" rows="3"></textarea></label><button id="saveReschedule" class="primary" type="button">Guardar modificación</button>`;
    $('#rescheduleBack').onclick=()=>window.openCalendarBookingDetail?window.openCalendarBookingDetail(bookingId):window.reopenAdminCalendar?.('today');
    $('#saveReschedule').onclick=async()=>{
      const slot=$('#newSlot').value;if(!slot)return toast('Selecciona una nueva franja.');
      if(!confirm('¿Confirmas el cambio de fecha/hora de esta reserva?'))return;
      const btn=$('#saveReschedule');btn.disabled=true;btn.textContent='Guardando…';
      const {error}=await db.rpc('reschedule_booking',{p_booking_id:bookingId,p_new_time_slot_id:slot,p_admin_notes:$('#rescheduleNotes').value.trim()||null});
      btn.disabled=false;btn.textContent='Guardar modificación';
      if(error){console.error(error);const m=error.message||'';if(m.includes('TIME_OVERLAP'))return toast('La nueva franja produce un solapamiento.');return toast('No se pudo modificar la reserva.');}
      toast('Reserva modificada. Google Calendar se actualizará automáticamente.');
      window.reopenAdminCalendar?.('today');
    };
  }

  async function cancelBooking(bookingId){
    const reason=prompt('Motivo de cancelación:');if(!reason)return;
    if(!confirm('¿Confirmas la cancelación de esta reserva? Se aplicará la política de cancelación configurada.'))return;
    const {error}=await db.rpc('cancel_booking',{p_booking_id:bookingId,p_reason:reason.trim()});
    if(error){console.error(error);return toast('No se pudo cancelar la reserva.');}
    toast('Reserva cancelada. Google Calendar se actualizará automáticamente.');
    window.reopenAdminCalendar?.('today');
  }

  const observer=new MutationObserver(()=>setTimeout(install,0));
  observer.observe(content,{childList:true,subtree:true});
})();
