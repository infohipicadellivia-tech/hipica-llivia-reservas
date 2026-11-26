// Patch independiente para crear clientes sin reserva desde admin-clients.js
// Requiere que admin_create_customer() ya exista en Supabase.
(() => {
  const isStaff=()=>state.profile&&['staff','admin'].includes(state.profile.role);

  function installNewCustomerButton(){
    const check=()=>{
      if(!isStaff())return;
      const heading=[...content.querySelectorAll('h2')].find(x=>x.textContent.trim()==='Clientes y bonos');
      if(!heading||document.querySelector('#newStandaloneCustomer'))return;
      const b=document.createElement('button');
      b.id='newStandaloneCustomer';b.type='button';b.className='primary calendar-launch';b.textContent='＋ Nuevo cliente';
      b.onclick=renderNewCustomer;
      heading.insertAdjacentElement('afterend',b);
    };
    new MutationObserver(check).observe(content,{childList:true,subtree:true});check();
  }

  function renderNewCustomer(){
    content.innerHTML=`<button id="newCustomerBack" class="ghost">← Clientes</button><h2>Nuevo cliente</h2>
      <section class="card"><label>Nombre y apellidos *<input id="ncName"></label><label>Teléfono *<input id="ncPhone" type="tel"></label><label>Email opcional<input id="ncEmail" type="email"></label><label>Observaciones<textarea id="ncNotes" rows="3"></textarea></label><button id="ncCreate" class="primary" type="button">Crear cliente</button></section>`;
    $('#newCustomerBack').onclick=()=>window.openAdminClients?window.openAdminClients():setView('admin');
    $('#ncCreate').onclick=createCustomer;
  }

  async function createCustomer(){
    const name=$('#ncName').value.trim(),phone=$('#ncPhone').value.trim(),email=$('#ncEmail').value.trim()||null,notes=$('#ncNotes').value.trim()||null;
    if(!name||!phone)return toast('Nombre y teléfono son obligatorios.');
    if(phone.replace(/\D/g,'').length<9)return toast('Indica un teléfono válido.');
    const btn=$('#ncCreate');btn.disabled=true;btn.textContent='Creando…';
    const {data,error}=await db.rpc('admin_create_customer',{p_full_name:name,p_phone:phone,p_email:email,p_notes:notes});
    btn.disabled=false;btn.textContent='Crear cliente';
    if(error){console.error(error);const m=error.message||'';return toast(m.includes('INVALID_EMAIL')?'El email no es válido.':'No se pudo crear el cliente.');}
    toast('Cliente creado.');
    const c=Array.isArray(data)?data[0]:data;
    if(window.openAdminClients){await window.openAdminClients();if(c?.id&&window.openAdminClient)window.openAdminClient(c.id);}else setView('admin');
  }

  const timer=setInterval(()=>{if(state?.profile){installNewCustomerButton();clearInterval(timer)}},250);
})();
