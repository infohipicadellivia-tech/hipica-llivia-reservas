const cfg = window.HIPICA_CONFIG || {};

if (
  !cfg.supabaseUrl ||
  cfg.supabaseUrl.includes('TU-PROYECTO')
) {
  alert(
    'Configura config.js con la URL y la Publishable Key de Supabase.'
  );
}

const db = window.supabase.createClient(
  cfg.supabaseUrl,
  cfg.supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  }
);

const $ = selector => document.querySelector(selector);
const content = $('#content');

let state = {
  user: null,
  profile: null,
  passes: [],
  bookings: [],
  services: [],
  slots: [],
  view: 'home',
  reserve: {
    step: 1,
    service: null,
    slot: null,
    pass: null,
    notes: ''
  }
};

const statusLabel = {
  pending: 'Pendiente de confirmación',
  confirmed: 'Confirmada',
  completed: 'Realizada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
  cancelled_late: 'Cancelada fuera de plazo',
  no_show: 'No presentado'
};

function esc(value = '') {
  return String(value).replace(
    /[&<>'"]/g,
    character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    })[character]
  );
}

function toast(message) {
  const toastElement = $('#toast');

  toastElement.textContent = message;
  toastElement.classList.add('show');

  setTimeout(
    () => toastElement.classList.remove('show'),
    2800
  );
}

function formatDate(value) {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date(value));
}

function formatHour(value) {
  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('es-ES');
}

async function loadBase() {
  const uid = state.user.id;

  const [profileResult, passesResult, bookingsResult, servicesResult] =
    await Promise.all([
      db
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single(),

      db
        .from('passes')
        .select(
          '*,pass_services(service_id,services(name))'
        )
        .eq('customer_id', uid)
        .order('expires_at'),

      db
        .from('bookings')
        .select(
          '*,time_slots(starts_at,ends_at,services(name,duration_minutes))'
        )
        .eq('customer_id', uid)
        .order('requested_at', { ascending: false }),

      db
        .from('services')
        .select('*')
        .eq('active', true)
        .order('name')
    ]);

  for (const result of [
    profileResult,
    passesResult,
    bookingsResult,
    servicesResult
  ]) {
    if (result.error) {
      console.error(result.error);
    }
  }

  state.profile = profileResult.data;
  state.passes = passesResult.data || [];
  state.bookings = bookingsResult.data || [];
  state.services = servicesResult.data || [];
}

function setView(view) {
  state.view = view;

  document
    .querySelectorAll('.bottom-nav button')
    .forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.view === view
      );
    });

  const titles = {
    home: 'Inicio',
    reserve: 'Reservar',
    bookings: 'Mis reservas',
    passes: 'Mis bonos'
  };

  $('#pageTitle').textContent = titles[view] || 'Inicio';

  render();
}

function bookingCard(booking) {
  const slot = booking.time_slots || {};
  const service = slot.services || {};

  return `
    <article class="card row">
      <div>
        <h3>${esc(service.name || 'Actividad')}</h3>

        <div class="muted">
          ${
            slot.starts_at
              ? `${esc(formatDate(slot.starts_at))} · ${esc(
                  formatHour(slot.starts_at)
                )}`
              : 'Horario no disponible'
          }
        </div>
      </div>

      <span class="status ${esc(booking.status)}">
        ${esc(statusLabel[booking.status] || booking.status)}
      </span>
    </article>
  `;
}

function renderHome() {
  const activePasses = state.passes.filter(
    pass => pass.status === 'active'
  );

  const credits = activePasses.reduce(
    (total, pass) =>
      total + Number(pass.remaining_credits || 0),
    0
  );

  const nextBooking = [...state.bookings]
    .filter(
      booking =>
        ['pending', 'confirmed'].includes(booking.status) &&
        booking.time_slots?.starts_at &&
        new Date(booking.time_slots.starts_at) > new Date()
    )
    .sort(
      (first, second) =>
        new Date(first.time_slots.starts_at) -
        new Date(second.time_slots.starts_at)
    )[0];

  content.innerHTML = `
    <section class="hero">
      <h2>
        Hola, ${
          esc(
            state.profile?.full_name ||
            state.user.email
          )
        }
      </h2>

      <div>
        Tienes ${formatNumber(credits)} créditos disponibles
      </div>
    </section>

    <div class="grid">
      <button
        class="service-card"
        data-go="reserve"
        type="button"
      >
        <div class="metric">＋</div>
        <h3>Nueva reserva</h3>
        <div class="muted">Solicita día y hora</div>
      </button>

      <button
        class="service-card"
        data-go="passes"
        type="button"
      >
        <div class="metric">${formatNumber(credits)}</div>
        <h3>Mis bonos</h3>

        <div class="muted">
          ${activePasses.length}
          ${
            activePasses.length === 1
              ? 'bono activo'
              : 'bonos activos'
          }
        </div>
      </button>
    </div>

    <h2>Próxima actividad</h2>

    ${
      nextBooking
        ? bookingCard(nextBooking)
        : `
          <div class="card muted">
            No tienes próximas reservas.
          </div>
        `
    }
  `;

  content
    .querySelectorAll('[data-go]')
    .forEach(button => {
      button.onclick = () =>
        setView(button.dataset.go);
    });
}

function renderPasses() {
  if (!state.passes.length) {
    content.innerHTML = `
      <div class="card muted">
        No tienes bonos.
      </div>
    `;

    return;
  }

  content.innerHTML = state.passes
    .map(pass => {
      const initialCredits =
        Number(pass.initial_credits || 0);

      const remainingCredits =
        Number(pass.remaining_credits || 0);

      const consumedCredits =
        initialCredits - remainingCredits;

      const services = (pass.pass_services || [])
        .map(item => item.services?.name || '')
        .filter(Boolean)
        .map(esc)
        .join(' · ');

      return `
        <button
          class="service-card"
          data-pass-detail="${pass.id}"
          type="button"
        >
          <div class="row">
            <div>
              <h3>🎟️ ${esc(pass.name)}</h3>

              <div class="muted">
                ${
                  pass.expires_at
                    ? `Caduca: ${
                        new Date(
                          `${pass.expires_at}T12:00:00`
                        ).toLocaleDateString('es-ES')
                      }`
                    : 'Sin caducidad'
                }
              </div>
            </div>

            <div class="metric">
              ${formatNumber(remainingCredits)}
            </div>
          </div>

          <p class="muted">
            ${formatNumber(consumedCredits)}
            créditos consumidos ·
            ${formatNumber(remainingCredits)}
            disponibles
          </p>

          ${
            services
              ? `<p>${services}</p>`
              : ''
          }

          <div class="muted">
            Ver detalle e historial →
          </div>
        </button>
      `;
    })
    .join('');

  content
    .querySelectorAll('[data-pass-detail]')
    .forEach(button => {
      button.onclick = () =>
        renderPassDetail(button.dataset.passDetail);
    });
}

async function renderPassDetail(passId) {
  const pass = state.passes.find(
    item => item.id === passId
  );

  if (!pass) {
    toast('No se pudo encontrar el bono.');
    return;
  }

  content.innerHTML = `
    <div class="card muted">
      Cargando historial…
    </div>
  `;

  const { data: movements, error } = await db
    .from('pass_movements')
    .select(`
      *,
      bookings (
        id,
        status,
        credit_cost,
        participant_count,
        duration_minutes,
        time_slots (
          starts_at,
          ends_at,
          services (
            name
          )
        )
      )
    `)
    .eq('pass_id', passId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);

    content.innerHTML = `
      <button
        id="passBack"
        class="ghost"
        type="button"
      >
        ← Mis bonos
      </button>

      <div class="card error">
        No se pudo cargar el historial del bono.
      </div>
    `;

    $('#passBack').onclick = renderPasses;
    return;
  }

  const history = movements || [];

  const initialCredits =
    Number(pass.initial_credits || 0);

  const remainingCredits =
    Number(pass.remaining_credits || 0);

  const consumedCredits =
    initialCredits - remainingCredits;

  content.innerHTML = `
    <button
      id="passBack"
      class="ghost"
      type="button"
    >
      ← Mis bonos
    </button>

    <section class="card">
      <h2>🎟️ ${esc(pass.name)}</h2>

      <div class="metric">
        ${formatNumber(remainingCredits)}
      </div>

      <div class="muted">
        créditos disponibles
      </div>

      <p>
        <strong>Créditos iniciales:</strong>
        ${formatNumber(initialCredits)}
      </p>

      <p>
        <strong>Consumidos:</strong>
        ${formatNumber(consumedCredits)}
      </p>

      ${
        pass.expires_at
          ? `
            <p>
              <strong>Caducidad:</strong>
              ${
                new Date(
                  `${pass.expires_at}T12:00:00`
                ).toLocaleDateString('es-ES')
              }
            </p>
          `
          : ''
      }
    </section>

    <h2>Historial del bono</h2>

    ${
      history.length
        ? history
            .map(renderPassMovement)
            .join('')
        : `
          <div class="card muted">
            Este bono todavía no tiene movimientos.
          </div>
        `
    }
  `;

  $('#passBack').onclick = renderPasses;
}

function renderPassMovement(movement) {
  const booking = movement.bookings || null;
  const slot = booking?.time_slots || null;
  const service = slot?.services || null;

  const bookingDetails = booking
    ? `
      <div class="pass-movement-booking">
        <strong>
          🐴 ${esc(service?.name || 'Actividad')}
        </strong>

        ${
          slot?.starts_at
            ? `
              <div class="muted">
                ${esc(formatDate(slot.starts_at))}
                ·
                ${esc(formatHour(slot.starts_at))}
              </div>
            `
            : ''
        }

        <div class="muted">
          ${
            booking.duration_minutes
              ? `${booking.duration_minutes} min`
              : ''
          }

          ${
            booking.participant_count
              ? `${
                  booking.duration_minutes
                    ? ' · '
                    : ''
                }${booking.participant_count} ${
                  booking.participant_count === 1
                    ? 'participante'
                    : 'participantes'
                }`
              : ''
          }
        </div>
      </div>
    `
    : '';

  return `
    <article class="card">
      <div class="row">
        <div>
          <strong>
            ${passMovementLabel(movement.movement_type)}
          </strong>

          <div class="muted">
            ${
              new Date(
                movement.created_at
              ).toLocaleDateString('es-ES')
            }
          </div>
        </div>

        <div class="metric">
          ${formatPassMovementCredits(movement)}
        </div>
      </div>

      ${bookingDetails}

      <p>
        ${esc(
          movement.reason ||
          'Movimiento del bono'
        )}
      </p>

      <div class="muted">
        Saldo después:
        ${formatNumber(movement.balance_after)}
        créditos
      </div>
    </article>
  `;
}

function passMovementLabel(type) {
  const labels = {
    issue: 'Alta del bono',
    consume: 'Actividad realizada',
    consumption: 'Actividad realizada',
    use: 'Actividad realizada',
    adjustment: 'Ajuste de saldo',
    refund: 'Devolución',
    cancellation: 'Cancelación',
    cancel: 'Cancelación',
    no_show: 'No asistencia'
  };

  return labels[type] || 'Movimiento del bono';
}

function formatPassMovementCredits(movement) {
  const credits = Number(movement.credits || 0);
  const formatted = Math.abs(credits).toLocaleString('es-ES');

  const positiveTypes = [
    'issue',
    'refund'
  ];

  const negativeTypes = [
    'consume',
    'consumption',
    'use',
    'cancellation',
    'cancel',
    'no_show'
  ];

  if (positiveTypes.includes(movement.movement_type)) {
    return `+${formatted}`;
  }

  if (negativeTypes.includes(movement.movement_type)) {
    return `−${formatted}`;
  }

  if (credits < 0) {
    return `−${formatted}`;
  }

  if (credits > 0) {
    return `+${formatted}`;
  }

  return '0';
}

function renderBookings() {
  content.innerHTML = state.bookings.length
    ? state.bookings
        .map(bookingCard)
        .join('')
    : `
      <div class="card muted">
        Todavía no tienes reservas.
      </div>
    `;
}

async function getSlots(serviceId) {
  const { data, error } = await db
    .from('slot_availability')
    .select('*')
    .eq('service_id', serviceId)
    .eq('status', 'open')
    .gt('starts_at', new Date().toISOString())
    .gt('available_places', 0)
    .order('starts_at');

  if (error) {
    toast('No se pudo cargar la disponibilidad.');
    return [];
  }

  return data || [];
}

function compatiblePasses(service) {
  const today = new Date()
    .toISOString()
    .slice(0, 10);

  return state.passes.filter(
    pass =>
      pass.status === 'active' &&
      (!pass.valid_from || pass.valid_from <= today) &&
      (!pass.expires_at || pass.expires_at >= today) &&
      Number(pass.remaining_credits) >=
        Number(service.credit_cost) &&
      pass.pass_services?.some(
        item => item.service_id === service.id
      )
  );
}

async function chooseService(id) {
  state.reserve = {
    step: 2,
    service: state.services.find(
      service => service.id === id
    ),
    slot: null,
    pass: null,
    notes: ''
  };

  state.slots = await getSlots(id);

  renderReserve();
}

function renderReserve() {
  const reservation = state.reserve;

  if (reservation.step === 1) {
    content.innerHTML = `
      <div class="progress">
        Paso 1 de 3 · Actividad
      </div>

      ${
        state.services.length
          ? state.services
              .map(
                service => `
                  <button
                    class="service-card"
                    data-id="${service.id}"
                    type="button"
                  >
                    <h3>${esc(service.name)}</h3>

                    <div class="muted">
                      ${esc(service.description || '')}
                      · ${service.duration_minutes} min
                      · ${formatNumber(service.credit_cost)}
                      créditos
                    </div>
                  </button>
                `
              )
              .join('')
          : `
            <div class="card muted">
              No hay actividades activas.
            </div>
          `
      }
    `;

    content
      .querySelectorAll('[data-id]')
      .forEach(button => {
        button.onclick = () =>
          chooseService(button.dataset.id);
      });

    return;
  }

  if (reservation.step === 2) {
    const groups = {};

    state.slots.forEach(slot => {
      const date = formatDate(slot.starts_at);

      if (!groups[date]) {
        groups[date] = [];
      }

      groups[date].push(slot);
    });

    content.innerHTML = `
      <div class="progress">
        Paso 2 de 3 · Día y hora
      </div>

      <button
        id="backService"
        class="ghost"
        type="button"
      >
        ← Cambiar actividad
      </button>

      <h2>${esc(reservation.service.name)}</h2>

      ${
        Object.keys(groups).length
          ? Object.entries(groups)
              .map(
                ([date, slots]) => `
                  <div class="day">
                    <h3>${esc(date)}</h3>

                    ${slots
                      .map(
                        slot => `
                          <button
                            class="slot"
                            data-id="${slot.time_slot_id}"
                            type="button"
                          >
                            ${esc(formatHour(slot.starts_at))}
                            · ${slot.available_places}
                            ${
                              slot.available_places === 1
                                ? 'plaza'
                                : 'plazas'
                            }
                          </button>
                        `
                      )
                      .join('')}
                  </div>
                `
              )
              .join('')
          : `
            <div class="card muted">
              No hay horarios disponibles.
            </div>
          `
      }
    `;

    $('#backService').onclick = () => {
      reservation.step = 1;
      renderReserve();
    };

    content
      .querySelectorAll('.slot')
      .forEach(button => {
        button.onclick = () =>
          chooseSlot(button.dataset.id);
      });

    return;
  }

  const passes = compatiblePasses(
    reservation.service
  );

  if (!reservation.pass && passes.length === 1) {
    reservation.pass = passes[0];
  }

  content.innerHTML = `
    <div class="progress">
      Paso 3 de 3 · Confirmar
    </div>

    <button
      id="backSlot"
      class="ghost"
      type="button"
    >
      ← Cambiar horario
    </button>

    <article class="card">
      <h2>Tu solicitud</h2>

      <p>
        <strong>Actividad:</strong>
        ${esc(reservation.service.name)}
      </p>

      <p>
        <strong>Fecha:</strong>
        ${esc(formatDate(reservation.slot.starts_at))}
      </p>

      <p>
        <strong>Hora:</strong>
        ${esc(formatHour(reservation.slot.starts_at))}
      </p>

      <p>
        <strong>Duración:</strong>
        ${reservation.service.duration_minutes} min
      </p>
    </article>

    ${
      passes.length
        ? `
          <label>
            Bono

            <select id="passSelect">
              ${passes
                .map(
                  pass => `
                    <option
                      value="${pass.id}"
                      ${
                        reservation.pass?.id === pass.id
                          ? 'selected'
                          : ''
                      }
                    >
                      ${esc(pass.name)}
                      · ${formatNumber(pass.remaining_credits)}
                      créditos disponibles
                    </option>
                  `
                )
                .join('')}
            </select>
          </label>

          <label>
            Observaciones (opcional)

            <textarea
              id="notes"
              maxlength="500"
              rows="3"
            >${esc(reservation.notes)}</textarea>
          </label>

          <div class="notice">
            La reserva quedará pendiente hasta que la Hípica
            la confirme. No se descontará ningún crédito ahora.
          </div>

          <button
            id="requestBtn"
            class="primary"
            type="button"
          >
            Solicitar reserva
          </button>
        `
        : `
          <div class="notice">
            No tienes un bono válido para reservar esta actividad.
          </div>
        `
    }
  `;

  $('#backSlot').onclick = () => {
    reservation.step = 2;
    renderReserve();
  };

  if (passes.length) {
    $('#passSelect').onchange = event => {
      reservation.pass = passes.find(
        pass => pass.id === event.target.value
      );
    };

    $('#notes').oninput = event => {
      reservation.notes = event.target.value;
    };

    $('#requestBtn').onclick = requestBooking;
  }
}

function chooseSlot(id) {
  state.reserve.slot = state.slots.find(
    slot => slot.time_slot_id === id
  );

  state.reserve.step = 3;

  renderReserve();
}

function friendlyError(error) {
  const text = (error?.message || '').toUpperCase();

  const messages = {
    SLOT_NOT_FOUND:
      'Este horario ya no está disponible.',

    SLOT_NOT_AVAILABLE:
      'Este horario ya no está disponible.',

    SLOT_FULL:
      'Esta sesión acaba de quedarse sin plazas.',

    DUPLICATE_BOOKING:
      'Ya tienes una solicitud o reserva para esta sesión.',

    PASS_REQUIRED:
      'Necesitas un bono para reservar esta actividad.',

    PASS_NOT_FOUND:
      'No hemos podido encontrar el bono seleccionado.',

    PASS_NOT_ACTIVE:
      'Este bono ya no está activo.',

    PASS_OUTSIDE_VALIDITY:
      'Este bono no es válido en esta fecha.',

    INSUFFICIENT_CREDITS:
      'No tienes suficientes créditos disponibles.',

    PASS_NOT_VALID_FOR_SERVICE:
      'Este bono no puede utilizarse para esta actividad.'
  };

  const match = Object.entries(messages).find(
    ([code]) => text.includes(code)
  );

  return match
    ? match[1]
    : 'No hemos podido realizar la solicitud. Inténtalo de nuevo.';
}

async function requestBooking() {
  const button = $('#requestBtn');

  button.disabled = true;
  button.textContent = 'Enviando…';

  const reservation = state.reserve;

  const { error } = await db.rpc(
    'request_booking',
    {
      p_time_slot_id:
        reservation.slot.time_slot_id,

      p_pass_id:
        reservation.pass.id,

      p_customer_notes:
        reservation.notes.trim() || null
    }
  );

  if (error) {
    toast(friendlyError(error));

    button.disabled = false;
    button.textContent = 'Solicitar reserva';

    if (
      (error.message || '').match(
        /SLOT_FULL|SLOT_NOT_AVAILABLE/
      )
    ) {
      state.slots = await getSlots(
        reservation.service.id
      );

      reservation.step = 2;

      renderReserve();
    }

    return;
  }

  await loadBase();

  toast('Solicitud enviada correctamente.');

  state.reserve = {
    step: 1,
    service: null,
    slot: null,
    pass: null,
    notes: ''
  };

  setView('bookings');
}

function render() {
  if (state.view === 'home') {
    renderHome();
    return;
  }

  if (state.view === 'passes') {
    renderPasses();
    return;
  }

  if (state.view === 'bookings') {
    renderBookings();
    return;
  }

  renderReserve();
}

async function enter(session) {
  state.user = session.user;

  $('#loginView').classList.add('hidden');
  $('#privateView').classList.remove('hidden');

  await loadBase();

  const params = new URLSearchParams(
    window.location.search
  );

  const requestedView = params.get('view');

  const allowedViews = [
    'home',
    'reserve',
    'bookings',
    'passes'
  ];

  const initialView =
    allowedViews.includes(requestedView)
      ? requestedView
      : 'home';

  setView(initialView);
}

$('#loginForm').onsubmit = async event => {
  event.preventDefault();

  $('#loginError').textContent = '';

  const { data, error } =
    await db.auth.signInWithPassword({
      email: $('#email').value.trim(),
      password: $('#password').value
    });

  if (error) {
    $('#loginError').textContent =
      'Email o contraseña incorrectos.';

    return;
  }

  await enter(data.session);
};

$('#logoutBtn').onclick = async () => {
  await db.auth.signOut();

  state.user = null;

  $('#privateView').classList.add('hidden');
  $('#loginView').classList.remove('hidden');
};

document
  .querySelectorAll('.bottom-nav button')
  .forEach(button => {
    button.onclick = () =>
      setView(button.dataset.view);
  });

(async () => {
  const {
    data: { session }
  } = await db.auth.getSession();

  if (session) {
    await enter(session);
  }
})();
