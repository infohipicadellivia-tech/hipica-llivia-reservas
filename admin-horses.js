(() => {
  let horseClientId = null;
  let currentHorseId = null;

  const isStaff = () =>
    state.profile && ['staff', 'admin'].includes(state.profile.role);

  const sexLabel = {
    mare: 'Yegua',
    stallion: 'Caballo',
    gelding: 'Castrado',
    unknown: 'Sin especificar'
  };

  const healthLabel = {
    vaccine: 'Vacuna',
    deworming: 'Desparasitación',
    farrier: 'Herrador',
    dentist: 'Dentista',
    veterinary: 'Veterinario',
    medication: 'Medicación',
    other: 'Otro'
  };

  async function openHorses(clientId) {
    if (!isStaff()) return;
    horseClientId = clientId;

    const [c, h] = await Promise.all([
      db.from('customers').select('id,full_name').eq('id', clientId).single(),
      db.from('horse_admin_summary').select('*').eq('client_id', clientId).order('name')
    ]);

    if (c.error || h.error) {
      console.error(c.error || h.error);
      return toast('No se pudieron cargar los caballos.');
    }

    content.innerHTML = `
      <button id="horseBack" class="ghost">← Volver al cliente</button>
      <h2>🐴 Caballos · ${esc(c.data.full_name)}</h2>
      <button id="addHorse" class="primary calendar-launch">＋ Añadir caballo</button>
      ${(h.data || []).map(x => `
        <button class="service-card" data-open-horse="${x.horse_id}" type="button">
          <div class="row">
            <div>
              <h3>${esc(x.name)}</h3>
              <div class="muted">${sexLabel[x.sex] || x.sex}${x.breed ? ' · ' + esc(x.breed) : ''}${x.coat ? ' · ' + esc(x.coat) : ''}</div>
            </div>
            <span class="status ${x.boarding_status === 'active' ? 'confirmed' : 'completed'}">
              ${x.boarding_status === 'active' ? 'Pupilaje activo' : (x.boarding_status || 'Sin pupilaje')}
            </span>
          </div>
        </button>
      `).join('') || '<div class="card muted">Este cliente todavía no tiene caballos registrados.</div>'}
    `;

    $('#horseBack').onclick = () =>
      window.openClientFromPreferences
        ? window.openClientFromPreferences(clientId)
        : setView('admin');

    $('#addHorse').onclick = renderNewHorse;

    content.querySelectorAll('[data-open-horse]').forEach(
      b => b.onclick = () => openHorse(b.dataset.openHorse)
    );
  }

  function renderNewHorse() {
    content.innerHTML = `
      <button id="newHorseBack" class="ghost">← Caballos</button>
      <h2>Nuevo caballo</h2>
      <label>Nombre *<input id="hName"></label>
      <div class="grid">
        <label>Fecha de nacimiento<input id="hBirth" type="date"></label>
        <label>Edad aproximada<input id="hAge" type="number" min="0" max="50"></label>
      </div>
      <label>Sexo
        <select id="hSex">
          <option value="unknown">Sin especificar</option>
          <option value="mare">Yegua</option>
          <option value="stallion">Caballo</option>
          <option value="gelding">Castrado</option>
        </select>
      </label>
      <label>Raza<input id="hBreed"></label>
      <label>Capa<input id="hCoat"></label>
      <label>Microchip<input id="hChip"></label>
      <label>Pasaporte<input id="hPassport"></label>
      <label>Observaciones<textarea id="hNotes" rows="3"></textarea></label>
      <h3>Pupilaje</h3>
      <label>Fecha de inicio<input id="hBoardStart" type="date"></label>
      <label>Tipo de pupilaje<input id="hBoardType" placeholder="Ej. Pupilaje completo"></label>
      <label>Precio mensual (€)<input id="hPrice" type="number" min="0" step="0.01"></label>
      <button id="hCreate" class="primary">Crear caballo</button>
    `;

    $('#newHorseBack').onclick = () => openHorses(horseClientId);
    $('#hCreate').onclick = createHorse;
  }

  async function createHorse() {
    const name = $('#hName').value.trim();
    const birth = $('#hBirth').value || null;
    const age = $('#hAge').value ? Number($('#hAge').value) : null;

    if (!name) return toast('Indica el nombre del caballo.');
    if (birth && age !== null) return toast('Indica fecha de nacimiento o edad aproximada, no ambas.');

    const year = age === null ? null : (new Date().getFullYear() - age);

    const { error } = await db.rpc('admin_create_horse', {
      p_client_id: horseClientId,
      p_name: name,
      p_birth_date: birth,
      p_approximate_birth_year: year,
      p_sex: $('#hSex').value,
      p_breed: $('#hBreed').value.trim() || null,
      p_coat: $('#hCoat').value.trim() || null,
      p_microchip_number: $('#hChip').value.trim() || null,
      p_passport_number: $('#hPassport').value.trim() || null,
      p_general_notes: $('#hNotes').value.trim() || null,
      p_boarding_starts_on: $('#hBoardStart').value || null,
      p_boarding_type: $('#hBoardType').value.trim() || null,
      p_monthly_price: $('#hPrice').value ? Number($('#hPrice').value) : null
    });

    if (error) {
      console.error(error);
      return toast('No se pudo crear el caballo.');
    }

    toast('Caballo creado.');
    openHorses(horseClientId);
  }

  async function openHorse(horseId) {
    currentHorseId = horseId;

    const [h, health, docs] = await Promise.all([
      db.from('horses').select('*').eq('id', horseId).single(),
      db.from('horse_health_events').select('*').eq('horse_id', horseId).order('event_date', { ascending: false }),
      db.from('horse_documents').select('*').eq('horse_id', horseId).eq('document_type', 'photo').order('created_at', { ascending: false })
    ]);

    if (h.error || health.error || docs.error) {
      console.error(h.error || health.error || docs.error);
      return toast('No se pudo cargar la ficha del caballo.');
    }

    const horse = h.data;
    const photo = (docs.data || []).find(x => x.id === horse.primary_photo_document_id) || (docs.data || [])[0];

    content.innerHTML = `
      <button id="horseDetailBack" class="ghost">← Caballos</button>
      <h2>🐴 ${esc(horse.name)}</h2>

      <section class="card">
        <div id="horsePhoto">${photo ? '<div class="muted">Cargando foto…</div>' : '<div class="muted">Sin foto principal</div>'}</div>
        <label>Foto principal<input id="horsePhotoInput" type="file" accept="image/jpeg,image/png,image/webp"></label>
        <button id="uploadHorsePhoto" class="secondary">Subir foto</button>
      </section>

      <h2>🩺 Salud</h2>
      <section class="card">
        <label>Tipo
          <select id="healthType">
            ${Object.entries(healthLabel).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
          </select>
        </label>
        <div class="grid">
          <label>Fecha<input id="healthDate" type="date"></label>
          <label>Próxima fecha<input id="healthNext" type="date"></label>
        </div>
        <label>Profesional<input id="healthProfessional"></label>
        <label>Descripción<input id="healthDescription"></label>
        <label>Notas<textarea id="healthNotes" rows="2"></textarea></label>
        <label><input id="healthVisible" type="checkbox" style="width:auto"> Visible para propietario</label>
        <button id="addHealth" class="primary">Añadir evento</button>
      </section>

      ${(health.data || []).map(e => `
        <article class="card">
          <div class="row">
            <div>
              <strong>${healthLabel[e.event_type] || e.event_type}</strong>
              <div class="muted">
                ${new Date(e.event_date + 'T12:00:00').toLocaleDateString('es-ES')}
                ${e.next_due_date ? ' · Próxima ' + new Date(e.next_due_date + 'T12:00:00').toLocaleDateString('es-ES') : ''}
              </div>
            </div>
            <span>${e.visible_to_customer ? '👤' : '🔒'}</span>
          </div>
          ${e.description ? `<p>${esc(e.description)}</p>` : ''}
          ${e.notes ? `<p class="muted">${esc(e.notes)}</p>` : ''}
          <button class="danger" data-delete-health="${e.id}">Eliminar</button>
        </article>
      `).join('') || '<div class="card muted">Sin eventos de salud.</div>'}

      <h2>📎 Documentos y cuidados</h2>
      <button id="horseDocuments" class="secondary calendar-launch" type="button">
        Abrir documentos y cuidados
      </button>
    `;

    $('#horseDetailBack').onclick = () => openHorses(horseClientId);
    $('#uploadHorsePhoto').onclick = uploadPhoto;
    $('#addHealth').onclick = addHealth;
    $('#horseDocuments').onclick = () =>
      window.openHorseDocuments
        ? window.openHorseDocuments(currentHorseId)
        : toast('No se ha cargado el módulo de documentos.');

    content.querySelectorAll('[data-delete-health]').forEach(
      b => b.onclick = () => deleteHealth(b.dataset.deleteHealth)
    );

    if (photo) renderSignedPhoto(photo);
  }

  async function uploadPhoto() {
    const f = $('#horsePhotoInput').files[0];
    if (!f) return toast('Selecciona una foto.');
    if (f.size > 10 * 1024 * 1024) return toast('Máximo 10 MB.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return toast('Formato no permitido.');

    const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${currentHorseId}/${crypto.randomUUID()}.${ext}`;

    const u = await db.storage.from('horse-files').upload(path, f, { contentType: f.type });
    if (u.error) return toast('No se pudo subir la foto.');

    const m = await db.from('horse_documents').insert({
      horse_id: currentHorseId,
      storage_path: path,
      document_type: 'photo',
      original_name: f.name,
      mime_type: f.type,
      size_bytes: f.size,
      visible_to_customer: true,
      uploaded_by: state.user.id
    }).select().single();

    if (m.error) {
      await db.storage.from('horse-files').remove([path]);
      return toast('No se pudo registrar la foto.');
    }

    await db.from('horses').update({ primary_photo_document_id: m.data.id }).eq('id', currentHorseId);
    toast('Foto actualizada.');
    openHorse(currentHorseId);
  }

  async function renderSignedPhoto(photo) {
    const r = await db.storage.from('horse-files').createSignedUrl(photo.storage_path, 300);
    if (!r.error && $('#horsePhoto')) {
      $('#horsePhoto').innerHTML = `<img src="${r.data.signedUrl}" alt="Foto del caballo" style="width:100%;max-height:320px;object-fit:cover;border-radius:12px">`;
    }
  }

  async function addHealth() {
    const date = $('#healthDate').value;
    if (!date) return toast('Indica la fecha del evento.');

    const { error } = await db.rpc('admin_add_horse_health_event', {
      p_horse_id: currentHorseId,
      p_event_type: $('#healthType').value,
      p_event_date: date,
      p_next_due_date: $('#healthNext').value || null,
      p_professional: $('#healthProfessional').value.trim() || null,
      p_description: $('#healthDescription').value.trim() || null,
      p_notes: $('#healthNotes').value.trim() || null,
      p_visible_to_customer: $('#healthVisible').checked
    });

    if (error) {
      console.error(error);
      return toast('No se pudo añadir el evento.');
    }

    toast('Evento añadido.');
    openHorse(currentHorseId);
  }

  async function deleteHealth(id) {
    if (!confirm('¿Eliminar este evento de salud?')) return;

    const { error } = await db.rpc('admin_delete_horse_health_event', { p_event_id: id });
    if (error) {
      console.error(error);
      return toast('No se pudo eliminar.');
    }

    openHorse(currentHorseId);
  }

  async function endBoarding(horseId) {
    const today = new Date().toISOString().slice(0, 10);
    const date = prompt('Fecha fin de pupilaje (AAAA-MM-DD):', today);
    if (!date) return;
    if (!confirm(`¿Finalizar el pupilaje el ${date}?`)) return;

    const { error } = await db.rpc('admin_end_boarding', {
      p_horse_id: horseId,
      p_ends_on: date
    });

    if (error) {
      console.error(error);
      return toast('No se pudo finalizar el pupilaje.');
    }

    toast('Pupilaje finalizado.');
    openHorses(horseClientId);
  }

  window.reopenHorseDetail = openHorse;
  window.openCustomerHorses = openHorses;
})();

