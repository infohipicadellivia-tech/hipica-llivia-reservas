(() => {
  let horseId=null;
  const labels={passport:'Pasaporte',vaccine:'Vacunación',veterinary_report:'Informe veterinario',insurance:'Seguro',authorization:'Autorización',other:'Otro'};
  const isStaff=()=>state.profile&&['staff','admin'].includes(state.profile.role);

  async function openHorseDocuments(id){
    if(!isStaff())return;horseId=id;
    const [h,d]=await Promise.all([
      db.from('horses').select('id,name,care_and_feeding_notes').eq('id',id).single(),
      db.from('horse_documents').select('*').eq('horse_id',id).neq('document_type','photo').order('created_at',{ascending:false})
    ]);
    if(h.error||d.error){console.error(h.error||d.error);return toast('No se pudieron cargar los documentos.');}
    content.innerHTML=`<button id="horseDocsBack" class="ghost">← Volver al caballo</button><h2>📎 Documentos · ${esc(h.data.name)}</h2>
      <section class="card"><h3>🌾 Observaciones de cuidados y alimentación</h3><textarea id="horseCareNotes" rows="5" placeholder="Pienso, heno, suplementos, medicación habitual, ejercicio, restricciones…">${esc(h.data.care_and_feeding_notes||'')}</textarea><button id="saveHorseCare" class="secondary">Guardar observaciones</button></section>
      <section class="card"><h3>Subir documento</h3><label>Tipo<select id="horseDocType">${Object.entries(labels).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label><label>Archivo<input id="horseDocFile" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"></label><label>Nota opcional<input id="horseDocNote"></label><label><input id="horseDocVisible" type="checkbox" style="width:auto"> Visible para propietario</label><button id="uploadHorseDoc" class="primary">Subir documento</button></section>
      <h3>Documentos</h3>${(d.data||[]).map(x=>`<article class="card"><div class="row"><div><strong>${esc(x.original_name)}</strong><div class="muted">${labels[x.document_type]||x.document_type} · ${(Number(x.size_bytes)/1024/1024).toFixed(2)} MB · ${new Date(x.created_at).toLocaleDateString('es-ES')}</div></div><span>${x.visible_to_customer?'👤':'🔒'}</span></div>${x.notes?`<p>${esc(x.notes)}</p>`:''}<div class="admin-actions"><button class="secondary" data-hdoc-view="${x.id}">Ver</button><button class="danger" data-hdoc-delete="${x.id}">Eliminar</button></div></article>`).join('')||'<div class="card muted">Sin documentos.</div>'}`;
    $('#horseDocsBack').onclick=()=>window.reopenHorseDetail?window.reopenHorseDetail(id):toast('No se pudo volver a la ficha.');
    $('#saveHorseCare').onclick=saveCare;
    $('#uploadHorseDoc').onclick=upload;
    content.querySelectorAll('[data-hdoc-view]').forEach(b=>b.onclick=()=>viewDoc(b.dataset.hdocView,d.data));
    content.querySelectorAll('[data-hdoc-delete]').forEach(b=>b.onclick=()=>deleteDoc(b.dataset.hdocDelete,d.data));
  }
  async function saveCare(){const {error}=await db.rpc('admin_update_horse_care_notes',{p_horse_id:horseId,p_notes:$('#horseCareNotes').value.trim()||null});if(error){console.error(error);return toast('No se pudieron guardar las observaciones.');}toast('Observaciones guardadas.');}
  async function upload(){const f=$('#horseDocFile').files[0];if(!f)return toast('Selecciona un archivo.');if(f.size>10*1024*1024)return toast('Máximo 10 MB.');if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(f.type))return toast('Formato no permitido.');const ext=(f.name.split('.').pop()||'file').toLowerCase(),path=`${horseId}/${crypto.randomUUID()}.${ext}`;const u=await db.storage.from('horse-files').upload(path,f,{contentType:f.type});if(u.error){console.error(u.error);return toast('No se pudo subir el documento.');}const m=await db.from('horse_documents').insert({horse_id:horseId,storage_path:path,document_type:$('#horseDocType').value,original_name:f.name,mime_type:f.type,size_bytes:f.size,notes:$('#horseDocNote').value.trim()||null,visible_to_customer:$('#horseDocVisible').checked,uploaded_by:state.user.id});if(m.error){await db.storage.from('horse-files').remove([path]);console.error(m.error);return toast('No se pudo registrar el documento.');}toast('Documento subido.');openHorseDocuments(horseId)}
  async function viewDoc(id,rows){const x=rows.find(r=>r.id===id);if(!x)return;const r=await db.storage.from('horse-files').createSignedUrl(x.storage_path,300);if(r.error)return toast('No se pudo abrir el documento.');window.open(r.data.signedUrl,'_blank','noopener')}
  async function deleteDoc(id,rows){const x=rows.find(r=>r.id===id);if(!x||!confirm(`¿Eliminar ${x.original_name}?`))return;const r=await db.storage.from('horse-files').remove([x.storage_path]);if(r.error)return toast('No se pudo eliminar el archivo.');const d=await db.from('horse_documents').delete().eq('id',id);if(d.error)return toast('No se pudo eliminar el registro.');toast('Documento eliminado.');openHorseDocuments(horseId)}
  window.openHorseDocuments=openHorseDocuments;
})();
