(() => {
  const isStaff=()=>state.profile&&['staff','admin'].includes(state.profile.role);
  const levelLabels={none:'Sin experiencia',beginner:'Iniciación',intermediate:'Intermedio',advanced:'Avanzado'};

  async function loadSessionPreview(serviceId,startIso,newParticipants,newLevels=[]){
    const start=new Date(startIso);
    const from=new Date(start.getTime()-60000).toISOString();
    const to=new Date(start.getTime()+60000).toISOString();
    const [serviceRes,slotsRes]=await Promise.all([
      db.from('services').select('recommended_capacity,name').eq('id',serviceId).single(),
      db.from('time_slots').select('id,service_id,starts_at').eq('service_id',serviceId).gte('starts_at',from).lte('starts_at',to).order('created_at',{ascending:false}).limit(1)
    ]);
    if(serviceRes.error)throw serviceRes.error;
    const slot=slotsRes.data?.[0];
    let members=[];
    if(slot){
      const m=await db.from('group_session_members').select('*').eq('time_slot_id',slot.id);
      if(m.error)throw m.error;
      members=m.data||[];
    }
    const current=members.reduce((sum,m)=>sum+Number(m.participant_count||0),0);
    const capacity=Number(serviceRes.data.recommended_capacity||6);
    const existingLevels=[...new Set(members.flatMap(m=>(m.rider_levels||'').split(',').map(x=>x.trim()).filter(Boolean)))];
    const incomingLevels=[...new Set((newLevels||[]).filter(Boolean))];
    const allLevels=[...new Set([...existingLevels,...incomingLevels])];
    return {serviceName:serviceRes.data.name,capacity,current,total:current+Number(newParticipants||0),members,existingLevels,incomingLevels,allLevels};
  }

  function memberLines(members){
    return members.length?members.map(m=>`${m.client_name} · ${m.participant_count} persona(s) · ${(m.rider_levels||'nivel sin informar').split(',').map(x=>levelLabels[x.trim()]||x.trim()).join(' / ')} · ${m.status}`).join('\n'):'Nadie apuntado todavía.';
  }

  window.checkAdminCapacityBeforeCreate=async function(serviceId,startIso,newParticipants,newLevels=[]){
    if(!isStaff())return {allow:true};
    try{
      const x=await loadSessionPreview(serviceId,startIso,newParticipants,newLevels);
      const over=x.total>x.capacity;
      const mixed=x.allLevels.length>1;
      let message=`${x.serviceName}\n\nOcupación actual: ${x.current}/${x.capacity}\nNueva reserva: ${newParticipants} persona(s)\nResultado: ${x.total}/${x.capacity}\n\nYa apuntados:\n${memberLines(x.members)}`;
      if(mixed)message+=`\n\n⚠️ Niveles diferentes en el grupo: ${x.allLevels.map(v=>levelLabels[v]||v).join(' / ')}`;
      if(over)message+=`\n\n⚠️ Se supera el aforo recomendado en ${x.total-x.capacity} persona(s).`;
      message+=`\n\n¿Crear la reserva igualmente?`;
      return {allow:confirm(message),warning:over||mixed,data:x};
    }catch(error){
      console.error(error);
      alert('No se pudo comprobar el aforo y los niveles. La reserva no se creará hasta poder validar la sesión.');
      return {allow:false,error};
    }
  };
})();
