(() => {
  const STAFF_ROLES = ['staff','admin'];
  let shellApplied = false;

  function isStaffUser(){
    return !!state.profile && STAFF_ROLES.includes(state.profile.role);
  }

  function applyStaffShell(){
    if(!isStaffUser() || shellApplied) return;
    shellApplied = true;

    // El personal entra directamente en Gestión.
    const nav = document.querySelector('.bottom-nav');
    if(nav) nav.classList.add('hidden');

    // Cuando otros scripts hayan registrado el panel, abrimos Gestión.
    const goAdmin = () => {
      if(typeof setView === 'function') setView('admin');
      const title = document.querySelector('#pageTitle');
      if(title) title.textContent = 'Gestión de la Hípica';
    };
    setTimeout(goAdmin, 350);
  }

  // Si por alguna razón un script intenta volver a mostrar la navegación de cliente,
  // la ocultamos de nuevo para roles staff/admin.
  const navObserver = new MutationObserver(() => {
    if(!isStaffUser()) return;
    const nav = document.querySelector('.bottom-nav');
    if(nav && !nav.classList.contains('hidden')) nav.classList.add('hidden');
  });
  navObserver.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});

  const timer=setInterval(()=>{
    if(state?.profile){
      applyStaffShell();
      clearInterval(timer);
    }
  },150);
})();
