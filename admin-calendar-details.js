(() => {
  const LEVEL_LABELS = {
    none: 'Sin experiencia',
    beginner: 'Iniciación',
    intermediate: 'Intermedio',
    advanced: 'Avanzado'
  };

  const STATUS_LABELS = {
    pending: 'Pendiente',
    confirmed: 'Confirmada',
    completed: 'Realizada',
    cancelled: 'Cancelada',
    cancelled_late: 'Cancelada fuera de plazo',
    rejected: 'Rechazada',
    no_show: 'No presentado'
  };

  const isStaff = () =>
    state.profile && ['staff', 'admin'].includes(state.profile.role);

  const hhmm = value =>
    new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));

  let enriching = false;
  let lastCalendarDate = null;
  let returnCalendarDate = null;
  let returnCalendarMode = 'today';

  function installStyles() {
    if (document.querySelector('#calendarDetailsStyles')) return;

    const style = document.createElement('style');
    style.id = 'calendarDetailsStyles';
    style.textContent = `
      .calendar-booking-list{margin-top:10px}
      .calendar-booking-card{
        margin-top:8px;
        padding:12px;
        border:1px solid var(--line);
        border-radius:12px;
        background:#fff;
      }
      .calendar-booking-client{
        font-size:15px;
        font-weight:850;
        color:var(--text);
      }
      .calendar-booking-meta{
        margin-top:3px;
        color:var(--muted);
        font-size:13px;
      }
      .calendar-participant-list{
        margin:8px 0 0;
        padding-left:18px;
        color:var(--muted);
        font-size:13px;
      }
      .calendar-participant-list li{margin:4px 0}
      .calendar-booking-card button{margin-top:9px;padding:7px 10px;font-size:12px}
      .booking-detail-grid{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:12px;
        margin-top:12px;
      }
      @media(max-width:600px){.booking-detail-grid{grid-template-columns:1fr}}
    `;

    document.head.appendChild(style);
  }

  async function loadParticipants(bookingIds) {
    if (!bookingIds.length) return [];

    const result = await db
      .from('booking_participants')
      .select('*')
      .in('booking_id', bookingIds)
      .order('created_at');

    if (result.error) throw result.error;
    return result.data || [];
  }

  async function enrichCalendar() {
    if (!isStaff() || enriching) return;

    const slots = [...content.querySelectorAll('.calendar-slot')]
      .filter(slot => !slot.dataset.bookingDetailsLoaded);

    if (!slots.length) return;

    enriching = true;

    try {
      for (const slot of slots) {
        const control = slot.querySelector('[data-slot-close], [data-slot-open]');
        const date = control?.dataset.date;
        const time = control?.dataset.time || slot.querySelector('.calendar-slot-time')?.textContent?.trim();
        const serviceName = slot.querySelector('.calendar-entry > div:nth-child(2) .row strong')?.textContent?.trim();

        if (!date || !time || !serviceName) {
          slot.dataset.bookingDetailsLoaded = '1';
          continue;
        }

        lastCalendarDate = date;
        const dayStart = new Date(`${date}T00:00:00`).toISOString();
        const dayEnd = new Date(`${date}T23:59:59`).toISOString();

        const bookingResult = await db
          .from('booking_schedule')
          .select('*')
          .in('status', ['pending', 'confirmed'])
          .eq('service_name', serviceName)
          .gte('starts_at', dayStart)
          .lte('starts_at', dayEnd)
          .order('starts_at');

        if (bookingResult.error) throw bookingResult.error;

        const matching = (bookingResult.data || []).filter(
          booking => hhmm(booking.starts_at) === time
        );

        if (!matching.length) {
          slot.dataset.bookingDetailsLoaded = '1';
          continue;
        }

        const bookingIds = matching.map(x => x.booking_id).filter(Boolean);
        const participants = await loadParticipants(bookingIds);

        const host = slot.querySelector('.calendar-entry > div:nth-child(2)');
        if (!host) continue;

        // Oculta las líneas genéricas anteriores para evitar duplicidad visual.
        host.querySelectorAll(':scope > .calendar-details').forEach(line => {
          const text = line.textContent || '';
          if (text.includes('participante(s)') && text.includes(serviceName)) {
            line.style.display = 'none';
          }
        });

        const list = document.createElement('div');
        list.className = 'calendar-booking-list';

        list.innerHTML = matching.map(booking => {
          const bookingParticipants = participants.filter(
            person => person.booking_id === booking.booking_id
          );

          const participantHtml = bookingParticipants.length
            ? bookingParticipants.map(person => `
                <li>
                  <strong>${esc(person.full_name || 'Participante')}</strong>
                  · ${esc(LEVEL_LABELS[person.rider_level] || person.rider_level || 'Nivel no informado')}
                  ${person.is_minor && person.age ? ` · ${Number(person.age)} años` : ''}
                </li>
              `).join('')
            : `<li>${Number(booking.participant_count || 1)} participante(s), sin detalle individual</li>`;

          return `
            <article class="calendar-booking-card">
              <div class="row">
                <div>
                  <div class="calendar-booking-client">
                    ${esc(booking.client_name || 'Cliente sin nombre')}
                  </div>
                  <div class="calendar-booking-meta">
                    ${hhmm(booking.starts_at)}–${hhmm(booking.ends_at)}
                    · ${esc(participantSummary(booking, bookingParticipants))}
                    · ${esc(STATUS_LABELS[booking.status] || booking.status)}
                  </div>
                </div>
              </div>
              <ul class="calendar-participant-list">${participantHtml}</ul>
              <button
                class="ghost"
                type="button"
                data-calendar-booking-detail="${booking.booking_id}">
                Ver reserva
              </button>
            </article>
          `;
        }).join('');

        const occupancy = host.querySelector('.notice');
        if (occupancy) occupancy.insertAdjacentElement('beforebegin', list);
        else host.appendChild(list);

        slot.dataset.bookingDetailsLoaded = '1';
      }

      content.querySelectorAll('[data-calendar-booking-detail]').forEach(button => {
        if (button.dataset.bound === '1') return;
        button.dataset.bound = '1';
        button.onclick = () => openBookingDetail(button.dataset.calendarBookingDetail);
      });
    } catch (error) {
      console.error('Error enriqueciendo el calendario:', error);
    } finally {
      enriching = false;
    }
  }

  function participantSummary(booking, participants) {
    const total = Number(booking.participant_count || participants.length || 1);
    const minors = (participants || []).filter(p => p.is_minor);
    if (!minors.length) return `${total} participante${total === 1 ? '' : 's'}`;
    const adults = Math.max(0, total - minors.length);
    const parts = [];
    if (adults > 0) parts.push(`${adults} adulto${adults === 1 ? '' : 's'}`);
    minors.forEach(p => parts.push(p.age ? `${Number(p.age)} años` : 'menor'));
    return `${total} participantes (${parts.join(', ')})`;
  }

  async function openBookingDetail(bookingId) {
    returnCalendarDate = lastCalendarDate;
    returnCalendarMode = document.querySelector('[data-calendar-mode].secondary')?.dataset.calendarMode || 'today';
    content.innerHTML = '<div class="card muted">Cargando reserva…</div>';

    const [bookingResult, participantsResult] = await Promise.all([
      db
        .from('booking_schedule')
        .select('*')
        .eq('booking_id', bookingId)
        .single(),
      db
        .from('booking_participants')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at')
    ]);

    if (bookingResult.error || participantsResult.error) {
      console.error('Detalle booking_schedule:', bookingResult.error);
      console.error('Detalle booking_participants:', participantsResult.error);
      content.innerHTML = `
        <button id="bookingDetailBackError" class="ghost" type="button">← Volver al calendario</button>
        <div class="card error">No se pudo cargar el detalle de la reserva.</div>`;
      $('#bookingDetailBackError').onclick = returnToCalendar;
      return;
    }

    const booking = bookingResult.data;
    const participants = participantsResult.data || [];

    content.innerHTML = `
      <button id="bookingDetailBack" class="ghost" type="button">← Volver al calendario</button>
      <h2>Detalle de reserva</h2>

      <section class="card">
        <div class="row">
          <div>
            <h3>${esc(booking.service_name || 'Actividad')}</h3>
            <div class="muted">
              ${new Date(booking.starts_at).toLocaleDateString('es-ES', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
              · ${hhmm(booking.starts_at)}–${hhmm(booking.ends_at)}
            </div>
          </div>
          <span class="status ${booking.status}">
            ${esc(STATUS_LABELS[booking.status] || booking.status)}
          </span>
        </div>

        <div class="booking-detail-grid">
          <div>
            <strong>Cliente</strong>
            <div>${esc(booking.client_name || 'No informado')}</div>
          </div>
          <div>
            <strong>Teléfono</strong>
            <div>${esc(booking.client_phone || booking.contact_phone || 'No informado')}</div>
          </div>
          <div>
            <strong>Participantes</strong>
            <div>${esc(participantSummary(booking, participants))}</div>
          </div>
          <div>
            <strong>Origen</strong>
            <div>${esc(booking.booking_source || 'No informado')}</div>
          </div>
          <div>
            <strong>Duración</strong>
            <div>${Number(booking.duration_minutes || 0)} min</div>
          </div>
        </div>

        ${booking.customer_notes ? `
          <h3>Observaciones</h3>
          <p>${esc(booking.customer_notes)}</p>
        ` : ''}
      </section>

      <h2>Participantes</h2>
      ${participants.map((person, index) => `
        <article class="card">
          <h3>${index + 1}. ${esc(person.full_name || 'Participante')}</h3>
          <div class="booking-detail-grid">
            <div>
              <strong>Nivel</strong>
              <div>${esc(LEVEL_LABELS[person.rider_level] || person.rider_level || 'No informado')}</div>
            </div>
            <div>
              <strong>Menor</strong>
              <div>${person.is_minor ? `Sí${person.age ? ` · ${Number(person.age)} años` : ''}` : 'No'}</div>
            </div>
          </div>
          ${person.notes ? `<p class="muted">${esc(person.notes)}</p>` : ''}
        </article>
      `).join('') || '<div class="card muted">No hay detalle individual de participantes.</div>'}
    `;

    $('#bookingDetailBack').onclick = returnToCalendar;
  }

  function returnToCalendar() {
    if (typeof window.openAdminCalendarAtDate === 'function' && returnCalendarDate) {
      window.openAdminCalendarAtDate(returnCalendarDate, returnCalendarMode || 'today');
      return;
    }

    if (typeof window.reopenAdminCalendar === 'function') {
      window.reopenAdminCalendar(returnCalendarMode || 'today');
      return;
    }

    setView('admin');
  }

  installStyles();

  const observer = new MutationObserver(() => {
    setTimeout(enrichCalendar, 0);
  });

  observer.observe(content, {
    childList: true,
    subtree: true
  });

  const timer = setInterval(() => {
    if (state?.profile) {
      enrichCalendar();
      clearInterval(timer);
    }
  }, 250);
})();
