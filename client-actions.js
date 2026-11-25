(() => {
  const CUTOFF_HOURS = 6;

  function canManageBooking(b) {
    return ['pending', 'confirmed'].includes(b.status) && b.time_slots?.starts_at;
  }

  function hoursUntil(startsAt) {
    return (new Date(startsAt).getTime() - Date.now()) / 3600000;
  }

  function clientActionButtons(b) {
    if (!canManageBooking(b)) return '';
    const canModify = hoursUntil(b.time_slots.starts_at) > CUTOFF_HOURS;
    return `<div class="admin-actions client-booking-actions">
      ${canModify
        ? `<button class="secondary" data-client-action="modify" data-id="${b.id}" type="button">Modificar</button>`
        : `<button class="secondary" type="button" disabled title="No se puede modificar cuando faltan 6 horas o menos">Modificar · fuera de plazo</button>`}
      <button class="danger" data-client-action="cancel" data-id="${b.id}" type="button">Cancelar</button>
    </div>`;
  }

  const css = document.createElement('style');
  css.textContent = `
    .client-booking-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
    .client-booking-actions .secondary,.client-booking-actions .danger{width:auto;margin:0;padding:10px 12px}
    .client-booking-actions button:disabled{opacity:.55;cursor:not-allowed}
    .danger{border:0;border-radius:11px;background:#fde1e1;color:#8f1d1d;font-weight:800;cursor:pointer}
  `;
  document.head.appendChild(css);

  function enhancedBookingCard(b) {
    const slot = b.time_slots || {};
    const sv = slot.services || {};
    return `<article class="card">
      <div class="row">
        <div>
          <h3>${esc(sv.name || 'Actividad')}</h3>
          <div class="muted">${slot.starts_at ? esc(formatDate(slot.starts_at)) + ' · ' + esc(formatHour(slot.starts_at)) : 'Horario no disponible'}</div>
        </div>
        <span class="status ${b.status}">${esc(statusLabel[b.status] || b.status)}</span>
      </div>
      ${canManageBooking(b) && hoursUntil(slot.starts_at) <= CUTOFF_HOURS
        ? `<div class="notice">Faltan 6 horas o menos. La reserva ya no se puede modificar.${b.status === 'confirmed' ? ' Si cancelas, se descontará 1 sesión.' : ''}</div>`
        : ''}
      ${clientActionButtons(b)}
    </article>`;
  }

  bookingCard = enhancedBookingCard;

  renderBookings = function () {
    content.innerHTML = state.bookings.length
      ? state.bookings.map(enhancedBookingCard).join('')
      : '<div class="card muted">Todavía no tienes reservas.</div>';
  };

  // Delegación global: hace funcionar Modificar/Cancelar tanto en Inicio como en Mis reservas.
  content.addEventListener('click', (event) => {
    const button = event.target.closest('[data-client-action]');
    if (!button || !content.contains(button)) return;
    event.preventDefault();
    runClientBookingAction(button.dataset.clientAction, button.dataset.id);
  });

  async function runClientBookingAction(action, id) {
    const booking = state.bookings.find(b => b.id === id);
    if (!booking) return toast('No se ha encontrado la reserva.');
    if (action === 'modify') return startClientReschedule(booking);
    if (action === 'cancel') return cancelClientBooking(booking);
  }

  async function cancelClientBooking(booking) {
    const late = hoursUntil(booking.time_slots.starts_at) <= CUTOFF_HOURS;
    let message = '¿Quieres cancelar esta reserva?';
    if (late && booking.status === 'confirmed') {
      message = 'Faltan 6 horas o menos. Si cancelas ahora, se descontará 1 sesión de tu bono. ¿Quieres continuar?';
    } else if (late && booking.status === 'pending') {
      message = 'La solicitud está pendiente. Puedes cancelarla sin consumir el bono. ¿Quieres continuar?';
    }
    if (!confirm(message)) return;

    const { error } = await db.rpc('cancel_booking', {
      p_booking_id: booking.id,
      p_reason: 'Cancelada por el cliente'
    });
    if (error) {
      console.error(error);
      return toast(friendlyError(error));
    }
    await loadBase();
    toast(booking.status === 'confirmed' && late ? 'Reserva cancelada. Se ha descontado 1 sesión.' : 'Reserva cancelada.');
    setView('bookings');
  }

  async function startClientReschedule(booking) {
    if (hoursUntil(booking.time_slots.starts_at) <= CUTOFF_HOURS) {
      return toast('No se puede modificar cuando faltan 6 horas o menos.');
    }

    const slotInfo = await db.from('time_slots').select('service_id').eq('id', booking.time_slot_id).single();
    if (slotInfo.error) return toast('No se pudo identificar la actividad.');

    const availability = await db
      .from('slot_availability')
      .select('*')
      .eq('service_id', slotInfo.data.service_id)
      .eq('status', 'open')
      .gt('starts_at', new Date().toISOString())
      .gt('available_places', 0)
      .neq('time_slot_id', booking.time_slot_id)
      .order('starts_at');

    if (availability.error) {
      console.error(availability.error);
      return toast('No se pudo cargar la disponibilidad.');
    }
    if (!availability.data?.length) return toast('No hay otros horarios disponibles para esta actividad.');

    showRescheduleChoices(booking, availability.data);
  }

  function showRescheduleChoices(booking, slots) {
    content.innerHTML = `<button id="backBookings" class="ghost" type="button">← Volver</button>
      <h2>Modificar reserva</h2>
      <div class="notice">Elige un nuevo horario. La reserva volverá a quedar pendiente de confirmación y no se descontará ninguna sesión.</div>
      ${slots.map(slot => `<button class="service-card" data-new-slot="${slot.time_slot_id}" type="button">
        <h3>${esc(formatDate(slot.starts_at))} · ${esc(formatHour(slot.starts_at))}</h3>
        <div class="muted">${slot.available_places} plaza(s) disponible(s)</div>
      </button>`).join('')}`;
    document.querySelector('#backBookings').onclick = () => setView('bookings');
    content.querySelectorAll('[data-new-slot]').forEach(button => {
      button.onclick = () => submitClientReschedule(booking, button.dataset.newSlot, slots);
    });
  }

  async function submitClientReschedule(booking, newSlotId, slots) {
    const target = slots.find(s => s.time_slot_id === newSlotId);
    if (!target) return;
    if (!confirm(`¿Cambiar la reserva a ${formatDate(target.starts_at)} a las ${formatHour(target.starts_at)}? Volverá a quedar pendiente de confirmación.`)) return;

    const { error } = await db.rpc('reschedule_booking', {
      p_booking_id: booking.id,
      p_new_time_slot_id: newSlotId,
      p_admin_notes: null
    });
    if (error) {
      console.error(error);
      const message = (error.message || '').toUpperCase();
      if (message.includes('RESCHEDULE_CUTOFF_REACHED')) return toast('Ya no se puede modificar: faltan 6 horas o menos.');
      if (message.includes('SLOT_FULL')) return toast('El nuevo horario acaba de quedarse sin plazas.');
      if (message.includes('SLOT_NOT_AVAILABLE')) return toast('El nuevo horario ya no está disponible.');
      return toast('No se pudo modificar la reserva.');
    }

    await loadBase();
    toast('Reserva modificada. Está pendiente de nueva confirmación.');
    setView('bookings');
  }
})();
