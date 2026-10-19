const cents=n=>{if(!Number.isFinite(n))throw Error('Invalid advance amount');return Math.round(n*100);};
// Recovered means an explicitly posted recovery, not revenue or a closing surplus.
export function advanceBreakdown(ledger,allocations=[]){
 const projects=ledger.projects.map(p=>({kind:'Proyek',id:p.key,label:p.key,outstanding:Math.max(0,-cents(p.balance)),recovered:0,evidence:[]}));
 const staff=ledger.staff.map(s=>({kind:'Gaji',id:s.name,label:s.name,outstanding:Math.max(0,-cents(s.position)),recovered:0,evidence:[]}));
 const seen=new Set();
 for(const movement of ledger.projectAdvanceMovements||[]){
  if(seen.has(movement.id))throw Error('Duplicate project advance movement');seen.add(movement.id);
  const row=projects.find(p=>p.id===movement.project);
  const entry=ledger.entries.find(e=>e.index===movement.bankIndex);
  const allocation=entry?.allocations.filter(a=>a.bucket===movement.project)||[];
  const expected=Math.max(0,Math.max(0,-cents(movement.before))-Math.max(0,-cents(movement.after)));
  if(!row||!entry||entry.reference!==movement.reference||entry.date!==movement.date||allocation.length!==1||cents(movement.after)-cents(movement.before)!==cents(allocation[0].amount)||cents(movement.recovered)!==expected)throw Error('Project advance recovery does not match bank allocation');
  row.recovered+=expected;
  if(expected)row.evidence.push(`${movement.date} · ref ${movement.reference}: penerimaan proyek memulihkan talangan ${new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR'}).format(expected/100)} terlebih dahulu; hanya kelebihannya menjadi dana proyek tersedia.`);
 }
 for(const t of ledger.transfers){
  if(t.to!=='YG'||!/pemulih|memulih|pengembalian talangan/i.test(t.reason))continue;
  let row=projects.find(p=>p.id===t.from);
  if(t.from==='STAFF'){
   const matches=staff.filter(s=>new RegExp('\\b'+s.label.split(' ')[0]+'\\b','i').test(t.reason));
   if(matches.length!==1)throw Error('Advance recovery needs an explicit staff attribution');
   row=matches[0];
  }
  if(row){row.recovered+=cents(t.value);row.evidence.push(t.reason);}
 }
 // Reconstruct only the verified reclassifications; existing salary journal
 // recovery transfers above must not be replayed from every salary row.
 const positions=new Map(ledger.staff.map(s=>[s.name,cents(s.position)]));
 for(const update of [...allocations].reverse())for(const r of [...update.rows].reverse())positions.set(r.staff,positions.get(r.staff)-cents(r.claimAmount)+cents(r.paidAmount));
 for(const update of allocations){
  let attributed=0;
  for(const r of update.rows){
   const before=positions.get(r.staff),after=before+cents(r.claimAmount)-cents(r.paidAmount);
   const recovered=Math.max(0,Math.max(0,-before)-Math.max(0,-after));
   positions.set(r.staff,after);
   if(recovered){const row=staff.find(s=>s.id===r.staff);row.recovered+=recovered;row.evidence.push(`${update.date}: ${update.note}`);attributed+=recovered;}
  }
  const expected=update.allocations.filter(a=>a.bucket==='YG'&&a.amount>0).reduce((sum,a)=>sum+cents(a.amount),0);
  if(attributed!==expected)throw Error('Advance recovery does not match verified general allocation');
 }
 const rows=[...projects,...staff].map(r=>({...r,used:(r.outstanding+r.recovered)/100,recovered:r.recovered/100,outstanding:r.outstanding/100}));
 const totals=rows.reduce((t,r)=>({used:t.used+cents(r.used),recovered:t.recovered+cents(r.recovered),outstanding:t.outstanding+cents(r.outstanding)}),{used:0,recovered:0,outstanding:0});
 return {rows,totals:Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,v/100]))};
}

