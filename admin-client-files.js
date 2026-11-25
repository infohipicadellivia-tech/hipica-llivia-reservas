(() => {
  let fileClient=null;
  const isStaff=()=>state.profile&&['staff','admin'].includes(state.profile.role);
  async function openFiles(clientId){
    if(!isStaff())return;fileClient=clientId;
    const c=await db.from('customers').select('id,full_name').eq('id',clientId).single();
    const r=await db.from('customer_files').select('*').eq('client_id',clientId).order('created_at',{ascending:false});
    if(c.error||r.error)return toast('No se pudieron cargar los archivos.');
    content.innerHTML=`<button id="filesBack" class="ghost">← Volver al cliente</button><h2>Archivos · ${esc(c.data.full_name)}</h2>
    <div class="notice">Archivos internos de la Hípica. El cliente no puede verlos.</div>
    <section class="card"><label>Tipo<select id="fileKind"><option value="photo">Foto</option><option value="document">Documento</option><option value="other">Otro</option></select></label><label>Archivo<input id="fileInput" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"></label><label>Nota opcional<input id="fileNote"></label><button id="fileUpload" class="primary">Subir archivo</button></section>
    <div class="grid">${(r.data||[]).map(f=>`<article class="card"><h3>${esc(f.original_name)}</h3><div class="muted">${esc(f.file_kind)} · ${(f.size_bytes/1024/1024).toFixed(2)} MB · ${new Date(f.created_at).toLocaleDateString('es-ES')}</div>${f.notes?`<p>${esc(f.notes)}</p>`:''}<div class="admin-actions"><button class="secondary" data-file-view="${f.id}">Ver</button><button class="danger" data-file-delete="${f.id}">Eliminar</button></div></article>`).join('')||'<div class="card muted">Sin archivos.</div>'}</div>`;
    $('#filesBack').onclick=()=>window.openClientFromPreferences?window.openClientFromPreferences(clientId):setView('admin');
    $('#fileUpload').onclick=upload;
    content.querySelectorAll('[data-file-view]').forEach(b=>b.onclick=()=>viewFile(b.dataset.fileView,r.data));
    content.querySelectorAll('[data-file-delete]').forEach(b=>b.onclick=()=>deleteFile(b.dataset.fileDelete,r.data));
  }
  async function upload(){const f=$('#fileInput').files[0];if(!f)return toast('Selecciona un archivo.');if(f.size>10*1024*1024)return toast('Máximo 10 MB.');const allowed=['image/jpeg','image/png','image/webp','application/pdf'];if(!allowed.includes(f.type))return toast('Formato no permitido.');const ext=(f.name.split('.').pop()||'file').toLowerCase();const path=`${fileClient}/${crypto.randomUUID()}.${ext}`;const u=await db.storage.from('customer-files').upload(path,f,{contentType:f.type,upsert:false});if(u.error){console.error(u.error);return toast('No se pudo subir el archivo.');}const m=await db.from('customer_files').insert({client_id:fileClient,storage_path:path,original_name:f.name,file_kind:$('#fileKind').value,mime_type:f.type,size_bytes:f.size,notes:$('#fileNote').value.trim()||null,uploaded_by:state.user.id});if(m.error){await db.storage.from('customer-files').remove([path]);console.error(m.error);return toast('No se pudo registrar el archivo.');}toast('Archivo subido.');openFiles(fileClient)}
  async function viewFile(id,rows){const f=rows.find(x=>x.id===id);if(!f)return;const r=await db.storage.from('customer-files').createSignedUrl(f.storage_path,300);if(r.error)return toast('No se pudo abrir.');window.open(r.data.signedUrl,'_blank','noopener')}
  async function deleteFile(id,rows){const f=rows.find(x=>x.id===id);if(!f||!confirm(`¿Eliminar ${f.original_name}?`))return;const r=await db.storage.from('customer-files').remove([f.storage_path]);if(r.error)return toast('No se pudo eliminar el archivo.');await db.from('customer_files').delete().eq('id',id);toast('Archivo eliminado.');openFiles(fileClient)}
  window.openCustomerFiles=openFiles;
})();
