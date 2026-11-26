(() => {
  async function syncBooking(bookingId, button) {
    if (!bookingId) return toast('Falta el identificador de la reserva.');
    const previous = button.textContent;
    button.disabled = true;
    button.textContent = 'Sincronizando…';
    const { data, error } = await db.functions.invoke('sync-google-calendar-session', {
      body: { booking_id: bookingId }
    });
    button.disabled = false;
    button.textContent = previous;
    if (error) { console.error(error); return toast('No se pudo sincronizar con Google Calendar.'); }
    if (data?.error) { console.error(data); return toast(data.error); }
    toast(data.action === 'created' ? 'Sesión creada en Google Calendar.' : 'Google Calendar actualizado.');
    if (data.htmlLink) window.open(data.htmlLink, '_blank', 'noopener');
  }

  function install() {
    const detailBack = document.querySelector('#bookingDetailBack');
    if (!detailBack || document.querySelector('#syncGoogleCalendar')) return;
    const bookingId = document.querySelector('[data-current-booking-id]')?.dataset.currentBookingId;
    if (!bookingId) return;
    const button = document.createElement('button');
    button.id = 'syncGoogleCalendar';
    button.type = 'button';
    button.className = 'secondary calendar-launch';
    button.textContent = '📅 Sincronizar sesión con Google Calendar';
    button.onclick = () => syncBooking(bookingId, button);
    detailBack.insertAdjacentElement('afterend', button);
  }

  const observer = new MutationObserver(install);
  observer.observe(content, { childList: true, subtree: true });
})();
