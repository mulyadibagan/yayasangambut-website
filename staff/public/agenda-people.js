// Group only records already returned by the authorized agenda scope and filters.
// Use account IDs: people with similar names must remain separate.
export function groupAgendasByPerson(agendas,people){
 const names=new Map(people.map(p=>[p.id,p.name])),groups=new Map();
 for(const agenda of agendas){
  const ids=[...new Set(JSON.parse(agenda.participant_ids||'[]'))];
  for(const id of ids.length?ids:[null]){
   if(!groups.has(id))groups.set(id,{id,name:id===null?'Belum ada peserta tim':names.get(id)||'Anggota tim tidak aktif',agendas:[]});
   groups.get(id).agendas.push(agenda);
  }
 }
 return [...groups.values()].sort((a,b)=>a.id===null?1:b.id===null?-1:a.name.localeCompare(b.name,'id')||String(a.id).localeCompare(String(b.id)));
}
