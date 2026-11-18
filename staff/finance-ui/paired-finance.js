// Amounts in this read model are integer cents, as returned by Finance API.
export const recordYear=r=>String(r.date||r.submittedAt||r.submitted_at||'').match(/20\d{2}/)?.[0]||'';
export function pairedFinanceView(data,{year='',project='',status='',search=''}={}){
 const needle=search.toLocaleLowerCase('id-ID');
 const all=(data?.projects||[]).flatMap(p=>p.requests.map(r=>({...r,projectId:p.id}))).filter(r=>r.paid&&r.amount>0);
 const rows=all.filter(r=>(!year||recordYear(r)===String(year))&&(!project||r.projectId===project)&&(!needle||[r.number,r.title,r.submitter,...(r.reports||[]).map(p=>p.number)].join(' ').toLocaleLowerCase('id-ID').includes(needle))&&(!status||status==='missing'&&!r.reports?.length||status==='review'&&r.underReview>0||status==='complete'&&r.outstanding===0&&r.approved>0));
 const totals=rows.reduce((n,r)=>{for(const k of ['amount','reported','approved','underReview','draft','refund','unaccounted'])n[k]+=r[k]||0;return n;},{amount:0,reported:0,approved:0,underReview:0,draft:0,refund:0,unaccounted:0});
 return {rows,totals,years:[...new Set(all.map(recordYear).filter(Boolean))].sort().reverse(),projects:[...new Set(all.map(r=>r.projectId))].sort()};
}
