(() => {
  const isCustomer=()=>state.profile?.role==='customer';
  const sexLabel={mare:'Yegua',stallion:'Caballo',gelding:'Castrado',unknown:'Sin especificar'};
  const healthLabel={vaccine:'Vacuna',deworming:'Desparasitación',farrier:'Herrador',dentist:'Dentista',veterinary:'Veterinario',medication:'Medicación',other:'Otro'};
  const docLabel={photo:'Foto',passport:'Pasaporte',vaccine:'Vacunación',veterinary_report:'Informe veterinario',insurance:'Seguro',authorization:'Autorización',other:'Otro'};
  let horses=[];

  async function install(){
    if(!isCustomer()||document.querySelector('[data-view="my-horse"]'))return;
    const r=await db.from('my_horses').select('*').order('name');
    if(r.error){console.error(r.error);return;}
    horses=r.data||[];
    if(!horses.length)return;
    const nav=document.querySelector('.bottom-nav');if(!nav)return;
    const b=document.createElement('button');b.type='button';b.dataset.view='my-horse';b.innerHTML='🐴<span>Mi caballo</span>';b.onclick=()=>setView('my-horse');
    const profile=nav.querySelector('[data-view="profile"]');profile?nav.insertBefore(b,profile):nav.appendChild(b);
    nav.style.gridTemplateColumns=`repeat(${nav.querySelectorAll('button').length},1fr)`;
  }

  async function renderMyHorse(){
    content.innerHTML='<div class="card muted">Cargando…</div>';
    const r=await db.from('my_horses').select('*').order('name');if(r.error)return toast('No se pudo cargar Mi caballo.');horses=r.data||[];
    if(!horses.length){content.innerHTML='<div class="card muted">No tienes ningún caballo asociado.</div>';return;}
    if(horses.length===1)return renderHorse(horses[0]);
    content.innerHTML=`<h2>🐴 Mis caballos</h2>${horses.map(h=>`<button class="service-card" data-my-horse="${h.horse_id}"><h3>${esc(h.name)}</h3><div class="muted">${sexLabel[h.sex]||h.sex}${h.breed?' · '+esc(h.breed):''}${h.coat?' · '+esc(h.coat):''}</div></button>`).join('')}`;
    content.querySelectorAll('[data-my-horse]').forEach(b=>b.onclick=()=>renderHorse(horses.find(h=>h.horse_id===b.dataset.myHorse)));
  }

  async function renderHorse(h){
    const [health,docs]=await Promise.all([
      db.from('my_horse_health').select('*').eq('horse_id',h.horse_id).order('event_date',{ascending:false}),
      db.from('my_horse_documents').select('*').eq('horse_id',h.horse_id).order('created_at',{ascending:false})
    ]);
    if(health.error||docs.error){console.error(health.error||docs.error);return toast('No se pudo cargar la ficha del caballo.');}
    const allDocs=docs.data||[],photo=allDocs.find(x=>x.id===h.primary_photo_document_id)||allDocs.find(x=>x.document_type==='photo'),files=allDocs.filter(x=>x.document_type!=='photo');
    const age=h.birth_date?Math.max(0,new Date().getFullYear()-new Date(h.birth_date+'T12:00:00').getFullYear()):(h.approximate_birth_year?new Date().getFullYear()-h.approximate_birth_year:null);
    content.innerHTML=`${horses.length>1?'<button id="myHorseBack" class="ghost">← Mis caballos</button>':''}<h2>🐴 ${esc(h.name)}</h2>
      <section class="card"><div id="myHorsePhoto">${photo?'<div class="muted">Cargando foto…</div>':'<div class="muted">Sin foto disponible</div>'}</div><div class="calendar-details">${age!==null?`Edad aprox. ${age} años · `:''}${sexLabel[h.sex]||h.sex}${h.breed?' · '+esc(h.breed):''}${h.coat?' · '+esc(h.coat):''}</div>${h.boarding_status==='active'?`<p><strong>Pupilaje activo</strong>${h.boarding_starts_on?' desde '+new Date(h.boarding_starts_on+'T12:00:00').toLocaleDateString('es-ES'):''}${h.boarding_type?' · '+esc(h.boarding_type):''}</p>`:''}</section>
      <h2>🩺 Salud</h2>${(health.data||[]).map(e=>`<article class="card"><strong>${healthLabel[e.event_type]||e.event_type}</strong><div class="muted">${new Date(e.event_date+'T12:00:00').toLocaleDateString('es-ES')}${e.next_due_date?' · Próxima '+new Date(e.next_due_date+'T12:00:00').toLocaleDateString('es-ES'):''}</div>${e.description?`<p>${esc(e.description)}</p>`:''}${e.notes?`<p class="muted">${esc(e.notes)}</p>`:''}</article>`).join('')||'<div class="card muted">No hay información de salud compartida.</div>'}
      <h2>📎 Documentos</h2>${files.map(x=>`<article class="card row"><div><strong>${esc(x.original_name)}</strong><div class="muted">${docLabel[x.document_type]||x.document_type}</div></div><button class="secondary" data-my-doc="${x.id}">Ver</button></article>`).join('')||'<div class="card muted">No hay documentos compartidos.</div>'}`;
    if($('#myHorseBack'))$('#myHorseBack').onclick=renderMyHorse;
    content.querySelectorAll('[data-my-doc]').forEach(b=>b.onclick=()=>openDocument(files.find(x=>x.id===b.dataset.myDoc)));
    if(photo)renderPhoto(photo);
  }

  async function renderPhoto(doc){const r=await db.storage.from('horse-files').createSignedUrl(doc.storage_path,300);if(!r.error&&$('#myHorsePhoto'))$('#myHorsePhoto').innerHTML=`<img src="${r.data.signedUrl}" alt="Foto del caballo" style="width:100%;max-height:360px;object-fit:cover;border-radius:12px">`}
  async function openDocument(doc){if(!doc)return;const r=await db.storage.from('horse-files').createSignedUrl(doc.storage_path,300);if(r.error)return toast('No se pudo abrir el documento.');window.open(r.data.signedUrl,'_blank','noopener')}

  const oldSetView=setView;
  setView=function(v){if(v==='my-horse'&&isCustomer()){state.view='my-horse';document.querySelectorAll('.bottom-nav button').forEach(x=>x.classList.toggle('active',x.dataset.view==='my-horse'));$('#pageTitle').textContent='Mi caballo';renderMyHorse();return;}return oldSetView(v)};
  const timer=setInterval(()=>{if(state?.profile){install();clearInterval(timer)}},180);
})();
