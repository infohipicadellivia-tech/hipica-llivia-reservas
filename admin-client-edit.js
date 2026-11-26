(() => {
  let clientId=null;

  async function openEditor(id){
    clientId=id;
    const r=await db.from('customers').select('id,full_name,phone,email,notes').eq('id',id).single();
    if(r.error){console.error(r.error);return toast('No se pudo cargar el cliente.');}
    const c=r.data;
    content.innerHTML=`<button id="editClientBack" class="ghost">← Volver al cliente</button><h2>✏️ Editar datos</h2>
      <section class="card">
        <label>Nombre y apellidos *<input id="ecName" value="${esc(c.full_name||'')}"></label>
        <label>Teléfono *<input id="ecPhone" type="tel" value="${esc(c.phone||'')}"></label>
        <label>Email<input id="ecEmail" type="email" value="${esc(c.email||'')}"></label>
        <label>Observaciones<textarea id="ecNotes" rows="4">${esc(c.notes||'')}</textarea></label>
        <div class="notice">Este email es el email de contacto para avisos. No cambia el email con el que el cliente inicia sesión.</div>
        <button id="ecSave" class="primary" type="button">Guardar cambios</button>
      </section>`;
    $('#editClientBack').onclick=()=>window.openClientFromPreferences?window.openClientFromPreferences(id):setView('admin');
    $('#ecSave').onclick=save;
  }

  async function save(){
    const name=$('#ecName').value.trim(),phone=$('#ecPhone').value.trim(),email=$('#ecEmail').value.trim()||null,notes=$('#ecNotes').value.trim()||null;
    if(!name)return toast('Indica el nombre del cliente.');
    if(phone.replace(/\D/g,'').length<9)return toast('Indica un teléfono válido.');
    const btn=$('#ecSave');btn.disabled=true;btn.textContent='Guardando…';
    const {error}=await db.rpc('admin_update_customer',{p_client_id:clientId,p_full_name:name,p_phone:phone,p_email:email,p_notes:notes});
    btn.disabled=false;btn.textContent='Guardar cambios';
    if(error){console.error(error);const m=error.message||'';return toast(m.includes('INVALID_EMAIL')?'El email no es válido.':'No se pudieron guardar los datos.');}
    toast('Datos del cliente actualizados.');
    if(window.openAdminClients){await window.openAdminClients();}
    if(window.openClientFromPreferences)window.openClientFromPreferences(clientId);
  }

  window.openAdminCustomerEditor=openEditor;
})();
