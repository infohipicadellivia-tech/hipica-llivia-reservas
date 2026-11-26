(() => {
  const isStaff=()=>state.profile&&['staff','admin'].includes(state.profile.role);

  async function addButtons(){
    if(!isStaff())return;
    const slots=[...content.querySelectorAll('.calendar-slot')];
    for(const slot of slots){
      if(slot.querySelector('[data-calendar-booking]'))continue;
      const close=slot.querySelector('[data-slot-close],[data-slot-open]');
      const time=close?.dataset.time||slot.querySelector('.calendar-slot-time')?.textContent?.trim();
      const date=close?.dataset.date;
      const name=slot.querySelector('.calendar-entry > div:nth-child(2) .row strong')?.textContent?.trim();
      if(!date||!time||!name||slot.classList.contains('calendar-closed'))continue;
      const actions=slot.querySelector('.calendar-slot-actions:last-of-type');
      if(!actions)continue;
      const b=document.createElement('button');
      b.type='button';b.className='secondary';b.dataset.calendarBooking='1';
      b.textContent=slot.classList.contains('calendar-booked')?'＋ Añadir reserva':'＋ Crear reserva';
      b.onclick=async()=>{
        b.disabled=true;b.textContent='Abriendo…';
        const r=await db.from('services').select('id,name,duration_minutes,service_durations(duration_minutes)').eq('active',true).eq('name',name).limit(1);
        b.disabled=false;
        if(r.error||!r.data?.length){console.error(r.error);b.textContent='＋ Crear reserva';return toast('No se encontró la actividad de esta franja.');}
        const s=r.data[0];
        const durations=(s.service_durations||[]).map(x=>Number(x.duration_minutes)).sort((a,b)=>a-b);
        window.openAdminPhoneBooking?.({serviceId:s.id,serviceName:s.name,date,time,duration:durations[0]||s.duration_minutes||60,calendarMode:'today'});
      };
      actions.prepend(b);
    }
  }

  const observer=new MutationObserver(()=>setTimeout(addButtons,0));
  observer.observe(content,{childList:true,subtree:true});
  const timer=setInterval(()=>{if(state?.profile){addButtons();clearInterval(timer);}},250);
})();
