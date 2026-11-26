(() => {
  let horseClientId=null;
  const isStaff=()=>state.profile&&['staff','admin'].includes(state.profile.role);
  const sexLabel={mare:'Yegua',stallion:'Caballo',gelding:'Castrado',unknown:'Sin especificar'};

  async function openHorses(clientId){
    if(!isStaff())return;horseClientId=clientId;
    const [c,h]=await Promise.all([
      db.from('customers').select('id,full_name').eq('id',clientId).single(),
      db.from('horse_admin_summary').select('*').eq('client_id',clientId).order('name')
    ]);
    if(c.error||h.error){console.error(c.error||h.error);return toast('No se pudieron cargar los caballos.');}
    content.innerHTML=`<button id="horseBack" class="ghost">← Volver al cliente</button><h2>🐴 Caballos · ${esc(c.data.full_name)}</h2>
      <button id="addHorse" class="primary calendar-launch">＋ Añadir caballo</button>
      ${(h.data||[]).map(x=>`<article class="card"><div class="row"><div><h3>${esc(x.name)}</h3><div class="muted">${sexLabel[x.sex]||x.sex}${x.breed?' · '+esc(x.breed):''}${x.coat?' · '+esc(x.coat):''}</div></div><span class="status ${x.boarding_status==='active'?'confirmed':'completed'}">${x.boarding_status==='active'?'Pupilaje activo':x.boarding_status||'Sin pupilaje'}</span></div>${x.boarding_status==='active'?`<div class="calendar-details">Desde ${new Date(x.boarding_starts_on+'T12:00:00').toLocaleDateString('es-ES')}${x.boarding_type?' · '+esc(x.boarding_type):''}${x.monthly_price!=null?' · '+Number(x.monthly_price)+' €/mes':''}</div><button class="ghost" data-end-horse="${x.horse_id}">Finalizar pupilaje</button>`:''}</article>`).join('')||'<div class="card muted">Este cliente todavía no tiene caballos registrados.</div>'}`;
    $('#horseBack').onclick=()=>window.openClientFromPreferences?window.openClientFromPreferences(clientId):setView('admin');
    $('#addHorse').onclick=renderNewHorse;
    content.querySelectorAll('[data-end-horse]').forEach(b=>b.onclick=()=>endBoarding(b.dataset.endHorse));
  }

  function renderNewHorse(){
    content.innerHTML=`<button id="newHorseBack" class="ghost">← Caballos</button><h2>Nuevo caballo</h2>
      <label>Nombre *<input id="hName"></label><div class="grid"><label>Fecha de nacimiento<input id="hBirth" type="date"></label><label>O año aproximado<input id="hYear" type="number" min="1980" max="2100"></label></div>
      <label>Sexo<select id="hSex"><option value="unknown">Sin especificar</option><option value="mare">Yegua</option><option value="stallion">Caballo</option><option value="gelding">Castrado</option></select></label>
      <label>Raza<input id="hBreed"></label><label>Capa<input id="hCoat"></label><label>Microchip<input id="hChip"></label><label>Pasaporte<input id="hPassport"></label><label>Observaciones<textarea id="hNotes" rows="3"></textarea></label>
      <h3>Pupilaje</h3><label>Fecha de inicio<input id="hBoardStart" type="date"></label><label>Tipo de pupilaje<input id="hBoardType" placeholder="Ej. Pupilaje completo"></label><label>Precio mensual (€)<input id="hPrice" type="number" min="0" step="0.01"></label>
      <button id="hCreate" class="primary">Crear caballo</button>`;
    $('#newHorseBack').onclick=()=>openHorses(horseClientId);$('#hCreate').onclick=createHorse;
  }

  async function createHorse(){
    const name=$('#hName').value.trim(),birth=$('#hBirth').value||null,year=$('#hYear').value?Number($('#hYear').value):null;
    if(!name)return toast('Indica el nombre del caballo.');if(birth&&year)return toast('Indica fecha de nacimiento o año aproximado, no ambos.');
    const btn=$('#hCreate');btn.disabled=true;btn.textContent='Creando…';
    const {error}=await db.rpc('admin_create_horse',{p_client_id:horseClientId,p_name:name,p_birth_date:birth,p_approximate_birth_year:year,p_sex:$('#hSex').value,p_breed:$('#hBreed').value.trim()||null,p_coat:$('#hCoat').value.trim()||null,p_microchip_number:$('#hChip').value.trim()||null,p_passport_number:$('#hPassport').value.trim()||null,p_general_notes:$('#hNotes').value.trim()||null,p_boarding_starts_on:$('#hBoardStart').value||null,p_boarding_type:$('#hBoardType').value.trim()||null,p_monthly_price:$('#hPrice').value?Number($('#hPrice').value):null});
    btn.disabled=false;btn.textContent='Crear caballo';if (error) {
  console.error('ERROR CREAR CABALLO:', error);

  alert(
    'No se pudo crear el caballo.\n\n' +
    'Código: ' + (error.code || 'sin código') + '\n' +
    'Mensaje: ' + (error.message || 'sin mensaje') + '\n' +
    'Detalle: ' + (error.details || 'sin detalle') + '\n' +
    'Hint: ' + (error.hint || 'sin hint')
  );

  return;
}toast('Caballo creado.');openHorses(horseClientId);
  }

  async function endBoarding(horseId){const today=new Date().toISOString().slice(0,10);const date=prompt('Fecha fin de pupilaje (AAAA-MM-DD):',today);if(!date)return;if(!confirm(`¿Finalizar el pupilaje el ${date}?`))return;const {error}=await db.rpc('admin_end_boarding',{p_horse_id:horseId,p_ends_on:date});if(error){console.error(error);return toast('No se pudo finalizar el pupilaje.');}toast('Pupilaje finalizado.');openHorses(horseClientId)}

  window.openCustomerHorses=openHorses;
})();
