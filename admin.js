(() => {
  const ADMIN_ROLES = ['staff', 'admin'];
  let adminBookings = [];
  let adminReady = false;

  const css = document.createElement('style');
  css.textContent = `
    .bottom-nav.admin-enabled{grid-template-columns:repeat(5,1fr)}
    .admin-tabs{display:flex;gap:8px;overflow:auto;margin-bottom:12px}
    .admin-tabs button{white-space:nowrap}
    .admin-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
    .admin-actions .primary,.admin-actions .secondary,.admin-actions .danger{width:auto;margin:0;padding:10px 12px}
    .danger{border:0;border-radius:11px;background:#fde1e1;color:#8f1d1d;font-weight:800;cursor:pointer}
    .admin-meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
    .admin-meta div{background:#f7f9f8;border-radius:9px;padding:9px}
    .admin-empty{padding:24px;text-align:center;color:var(--muted)}
    @media(max-width:520px){.admin-meta{grid-template-columns:1fr}.bottom-nav.admin-enabled span{font-size:10px}}
  `;
  document.head.appendChild(css);

  function isAdmin() {
    return !!state.profile && ADMIN_ROLES.includes(state.profile.role);
  }

  function installAdminNav() {
    if (!isAdmin() || document.querySelector('[data-view="admin"]')) return;
    const nav = document.querySelector('.bottom-nav');
    nav.classList.add('admin-enabled');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.view = 'admin';
    button.innerHTML = '⚙<span>Gestión</span>';
    button.addEventListener('click', () => setView('admin'));
    nav.appendChild(button);
  }

  async function loadAdminBookings() {
    const result = await db
      .from('bookings')
      .select('*, customer:profiles!bookings_customer_id_fkey(full_name,phone), time_slots(starts_at,ends_at,services(name,duration_minutes))')
      .in('status', ['pending','confirmed'])
      .order('requested_at', { ascending: true });

    if (!result.error) {
      adminBookings = result.data || [];
      return;
    }

    console.error(result.error);
    const fallback = await db
      .from('bookings')
      .select('*,time_slots(starts_at,ends_at,services(name,duration_minutes))')
      .in('status', ['pending','confirmed'])
      .order('requested_at', { ascending: true });
    if (fallback.error) throw fallback.error;

    const ids = [...new Set((fallback.data || []).map(x => x.customer_id))];
    const profiles = ids.length
      ? await db.from('profiles').select('id,full_name,phone').in('id', ids)
      : { data: [] };
    const byId = Object.fromEntries((profiles.data || []).map(p => [p.id, p]));
    adminBookings = (fallback.data || []).map(b => ({ ...b, customer: byId[b.customer_id] || null }));
  }

  function adminCard(b) {
    const slot = b.time_slots || {};
    const service = slot.services || {};
    const customer = b.customer || {};
    const actions = b.status === 'pending'
      ? `<div class="admin-actions">
           <button class="primary" data-action="confirm" data-id="${b.id}" type="button">Confirmar</button>
           <button class="danger" data-action="reject" data-id="${b.id}" type="button">Rechazar</button>
         </div>`
      : `<div class="admin-actions">
           <button class="primary" data-action="complete" data-id="${b.id}" type="button">Realizada</button>
           <button class="danger" data-action="no-show" data-id="${b.id}" type="button">No presentado</button>
         </div>`;

    return `<article class="card">
      <div class="row">
        <div>
          <h3>${esc(customer.full_name || 'Cliente')}</h3>
          <div class="muted">${esc(service.name || 'Actividad')}</div>
        </div>
        <span class="status ${b.status}">${esc(statusLabel[b.status] || b.status)}</span>
      </div>
      <div class="admin-meta">
        <div><strong>Fecha</strong><br>${slot.starts_at ? esc(formatDate(slot.starts_at)) : 'Sin fecha'}</div>
        <div><strong>Hora</strong><br>${slot.starts_at ? esc(formatHour(slot.starts_at)) : 'Sin hora'}</div>
        <div><strong>Saldo a consumir</strong><br>${Number(b.credit_cost || 0)} sesión(es)</div>
        <div><strong>Teléfono</strong><br>${esc(customer.phone || 'No informado')}</div>
      </div>
      ${b.customer_notes ? `<div class="notice"><strong>Observaciones:</strong> ${esc(b.customer_notes)}</div>` : ''}
      ${actions}
    </article>`;
  }

  async function renderAdmin(filter = 'pending') {
    if (!isAdmin()) {
      content.innerHTML = '<div class="card error">No tienes permisos de administración.</div>';
      return;
    }
    content.innerHTML = '<div class="card muted">Cargando solicitudes…</div>';
    try {
      await loadAdminBookings();
      const rows = adminBookings.filter(x => filter === 'all' || x.status === filter);
      content.innerHTML = `
        <section class="hero"><h2>Panel de la Hípica</h2><div>${adminBookings.filter(x => x.status === 'pending').length} solicitudes pendientes</div></section>
        <div class="admin-tabs">
          <button type="button" class="${filter === 'pending' ? 'secondary' : 'ghost'}" data-filter="pending">Pendientes</button>
          <button type="button" class="${filter === 'confirmed' ? 'secondary' : 'ghost'}" data-filter="confirmed">Confirmadas</button>
          <button type="button" class="${filter === 'all' ? 'secondary' : 'ghost'}" data-filter="all">Todas activas</button>
        </div>
        ${rows.length ? rows.map(adminCard).join('') : '<div class="card admin-empty">No hay reservas en esta categoría.</div>'}`;
      content.querySelectorAll('[data-filter]').forEach(x => x.onclick = () => renderAdmin(x.dataset.filter));
      content.querySelectorAll('[data-action]').forEach(x => x.onclick = () => runAdminAction(x.dataset.action, x.dataset.id));
    } catch (e) {
      console.error(e);
      content.innerHTML = '<div class="card error">No se ha podido cargar el panel. Revisa los permisos RLS y vuelve a intentarlo.</div>';
    }
  }

  async function runAdminAction(action, id) {
    let rpc, args, success;
    if (action === 'confirm') {
      if (!confirm('¿Confirmar esta reserva?')) return;
      rpc = 'confirm_booking'; args = { p_booking_id: id, p_admin_notes: null }; success = 'Reserva confirmada.';
    } else if (action === 'reject') {
      const reason = prompt('Motivo del rechazo:');
      if (!reason || !reason.trim()) return;
      rpc = 'reject_booking'; args = { p_booking_id: id, p_reason: reason.trim(), p_admin_notes: null }; success = 'Reserva rechazada.';
    } else if (action === 'complete') {
      if (!confirm('¿Marcar como realizada? Se descontará el bono.')) return;
      rpc = 'complete_booking'; args = { p_booking_id: id }; success = 'Actividad realizada y bono actualizado.';
    } else if (action === 'no-show') {
      if (!confirm('¿Marcar como no presentado y consumir la sesión?')) return;
      rpc = 'mark_no_show'; args = { p_booking_id: id, p_consume_credit: true }; success = 'Ausencia registrada y sesión consumida.';
    }

    const { error } = await db.rpc(rpc, args);
    if (error) {
      console.error(error);
      toast('No se pudo completar la acción: ' + friendlyError(error));
      return;
    }
    toast(success);
    await loadBase();
    await renderAdmin(action === 'confirm' ? 'confirmed' : 'pending');
  }

  const originalSetView = setView;
  setView = function(v) {
    if (v !== 'admin') return originalSetView(v);
    state.view = 'admin';
    document.querySelectorAll('.bottom-nav button').forEach(x => x.classList.toggle('active', x.dataset.view === v));
    document.querySelector('#pageTitle').textContent = 'Gestión';
    renderAdmin('pending');
  };

  const originalRender = render;
  render = function() {
    if (state.view === 'admin') return renderAdmin('pending');
    return originalRender();
  };

  const timer = setInterval(() => {
    if (state.profile && !adminReady) {
      adminReady = true;
      installAdminNav();
      clearInterval(timer);
    }
  }, 250);
})();
