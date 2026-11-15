export function aprilCash(rows,year){
 const names=new Set(['april','aprilgroup','aprildayun','agroforestridayun','dayunapril']);
 const selected=rows.filter(r=>names.has(String(r.project||'').toLowerCase().replace(/[^a-z0-9]/g,''))&&(!year||r.year===year));
 return {incoming:selected.reduce((n,r)=>n+r.credit,0),outgoing:selected.reduce((n,r)=>n+r.debit,0),rows:selected};
}
