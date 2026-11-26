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
    rejected: 'Rechazada',
    cancelled: 'Cancelada',
    cancelled_late: 'Cancelada fuera de plazo',
    no_show: 'No presentado',
    completed: 'Realizada'
  };

  const isStaff = () =>
    state.profile && ['staff', 'admin'].includes(state.profile.role);

  const localDateKey = date =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const hhmm = value =>
    new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));

  let cache = new Map();
  let loading = false;

  function installStyles() {
    if (document.querySelector('#calendarDetailsStyles')) return;

    const style = document.createElement('style');
    style.id = 'calendarDetailsStyles';
    style.textContent = `
      .calendar-booking-card{
        margin-top:9px;
        padding:10px 12px;
        border:1px solid var(--line);
        border-radius:11px;
        background:#fff;
      }
      .calendar-booking-card + .calendar-booking-card{margin-top:7px}
      .calendar-booking-client{font-weight:850;color:var(--text)}
      .calendar-participant-list{margin:7px 0 0;padding-left:18px;color:var(--muted);font-size:13px}
      .calendar-participant-list li{margin:3px 0}
      .calendar-booking-card button{margin-top:8px;padding:7px 10px;font-size:12px}
      .booking-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      @media(max-width:600px){.booking-detail-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  async function loadDay(date) {
    const key = date;
    if (cache.has(key)) return cache.get(key);

    const from = new Date(`${date}T00:00:00`).toISOString();
    const to = new Date(`${date}T23:59:59`).toISOString();

    const bookingsRes = await db
      .from('booking_schedule')
      .select('*')
      .in('status', ['pending', 'confirmed'])
      .gte('starts_at', from)
      .lte('starts_at', to)
      .order('starts_at');

    if (bookingsRes.error) throw bookingsRes.error;

    const bookings = bookingsRes.data || [];
    const ids = bookings.map(x => x.id).filter(Boolean);
    let participants = [];

    if (ids.length) {
      const participantsRes = await db
        .from('booking_participants')
        .select('*')
        .in('booking_id', ids)
        .order('created_at');

      if (participantsRes.error) throw participantsRes.error;
      participants = participantsRes.data || [];
    }

    const enriched = bookings.map(booking => ({
      ...booking,
      participants: participants.filter(p => p.booking_id === booking.id)
    }));

    cache.set(key, enriched);
    return enriched;
  }

  async function enrichCalendar() {
    if (!isStaff() || loading) return;

    const slots = [...content.querySelectorAll('.calendar-slot')]
      .filter(slot => !slot.dataset.detailsLoaded);

    if (!slots.length) return;

    loading = true;

    try {
      for (const slot of slots) {
        const control = slot.querySelector('[data-slot-close], [data-slot-open]');
        const date = control?.dataset.date;
        const time = control?.dataset.time || slot.querySelector('.calendar-slot-time')?.textContent?.trim();
        const serviceName = slot.querySelector('.calendar-entry > div:nth-child(2) .row strong')?.textContent?.trim();

        if (!date || !time || !serviceName) {
          slot.dataset.detailsLoaded = '1';
          continue;
        }

        const bookings = await loadDay(date);
        const matching = bookings.filter(booking =>
          booking.service_name === serviceName &&
          hhmm(booking.starts_at) === time
        );

        if (!matching.length) {
          slot.dataset.detailsLoaded = '1';
          continue;
        }

        const host = slot.querySelector('.calendar-entry > div:nth-child(2)');
        const occupancy = host?.querySelector('.notice');
        const wrapper = document.createElement('div');
        wrapper.className = 'calendar-booking-details-list';

        wrapper.innerHTML = matching.map(booking => {
          const participantRows = booking.participants?.length
            ? booking.participants.map(person => `
                <li>
                  <strong>${esc(person.full_name || 'Participante')}</strong>
                  · ${esc(LEVEL_LABELS[person.rider_level] || person.rider_level || 'Nivel no informado')}
                  ${person.is_minor && person.age ? ` · ${Number(person.age)} años` : ''}
                </li>
              `).join('')
            : `<li>${Number(booking.participant_count || 1)} participante(s), sin detalle disponible</li>`;

          return `
            <article class="calendar-booking-card">
              <div class="row">
                <div>
                  <div class="calendar-booking-client">
                    ${esc(booking.full_name || booking.customer_name || 'Cliente')}
                  </div>
                  <div class="calendar-details">
                    ${hhmm(booking.starts_at)}–${hhmm(booking.ends_at)}
                    · ${Number(booking.participant_count || 1)} participante(s)
                    · ${esc(STATUS_LABELS[booking.status] || booking.status)}
                  </div>
                </div>
              </div>
              <ul class="calendar-participant-list">${participantRows}</ul>
              <button
                class="ghost"
                type="button"
                data-calendar-booking-detail="${booking.id}">
                Ver reserva
              </button>
            </article>
          `;
        }).join('');

        if (occupancy) occupancy.insertAdjacentElement('beforebegin', wrapper);
        else host?.appendChild(wrapper);

        slot.dataset.detailsLoaded = '1';
      }

      content.querySelectorAll('[data-calendar-booking-detail]').forEach(button => {
        if (button.dataset.bound) return;
        button.dataset.bound = '1';
        button.onclick = () => openBookingDetail(button.dataset.calendarBookingDetail);
      });
    } catch (error) {
      console.error('No se pudieron cargar los participantes del calendario:', error);
    } finally {
      loading = false;
    }
  }

  async function openBookingDetail(bookingId) {
    content.innerHTML = '<div class="card muted">Cargando reserva…</div>';

    const [bookingRes, participantsRes] = await Promise.all([
      db.from('booking_schedule').select('*').eq('id', bookingId).single(),
      db.from('booking_participants').select('*').eq('booking_id', bookingId).order('created_at')
    ]);

    if (bookingRes.error || participantsRes.error) {
      console.error(bookingRes.error || participantsRes.error);
      content.innerHTML = '<div class="card error">No se pudo cargar el detalle de la reserva.</div>';
      return;
    }

    const booking = bookingRes.data;
    const participants = participantsRes.data || [];

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
            <div>${esc(booking.full_name || booking.customer_name || 'No informado')}</div>
          </div>
          <div>
            <strong>Teléfono</strong>
            <div>${esc(booking.contact_phone || booking.phone || 'No informado')}</div>
          </div>
          <div>
            <strong>Participantes</strong>
            <div>${Number(booking.participant_count || participants.length || 1)}</div>
          </div>
          <div>
            <strong>Origen</strong>
            <div>${esc(booking.booking_source || 'No informado')}</div>
          </div>
        </div>

        ${booking.customer_notes || booking.notes ? `
          <h3>Observaciones</h3>
          <p>${esc(booking.customer_notes || booking.notes)}</p>
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

    $('#bookingDetailBack').onclick = () => {
      if (typeof window.reopenAdminCalendar === 'function') {
        window.reopenAdminCalendar();
      } else {
        setView('admin');
      }
    };
  }

  installStyles();
  const observer = new MutationObserver(() => setTimeout(enrichCalendar, 0));
  observer.observe(content, { childList: true, subtree: true });

  const timer = setInterval(() => {
    if (state?.profile) {
      enrichCalendar();
      clearInterval(timer);
    }
  }, 250);
})();
