// Compact only the salary summary; retain every original value and expression.
export function compactSalaryTable(source){
 if(source.includes('yg-salary-compact')||!source.includes('Hak gaji proyek'))return source;
 let matched=0;
 const result=source.replace(/<table\b[^>]*>[\s\S]*?<\/table>/g,table=>{
  if(!table.includes('Hak gaji proyek')||!table.includes('Total alokasi'))return table;
  matched++;
  const headerSection=table.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/)?.[1]||'';
  const headers=[...headerSection.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)].map(m=>m[1]);
  if(headers.length!==11)throw Error('Salary summary header schema changed');
  const keep=[0,2,6,7,8,9,10],extra=[1,3,4,5];
  table=table.replace(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/g,(row,attrs,body)=>{
   const cells=[...body.matchAll(/<(th|td)\b([^>]*)>([\s\S]*?)<\/\1>/g)];
   if(cells.length!==11)throw Error('Salary summary row schema changed');
   const header=cells.every(c=>c[1]==='th');
   return '<tr'+attrs+'>'+keep.map(i=>{
    const c=cells[i];let content=c[3];
    if(i===0&&!header)content+='<details className="yg-salary-allocation"><summary>Rincian alokasi</summary><dl>'+extra.map(j=>'<div><dt>'+headers[j]+'</dt><dd>'+cells[j][3]+'</dd></div>').join('')+'</dl></details>';
    return '<'+c[1]+c[2]+' data-label="'+headers[i].replace(/<[^>]*>/g,'')+'">'+content+'</'+c[1]+'>';
   }).join('')+'</tr>';
  });
  return table.replace(/<table\b([^>]*)>/,'<table$1 data-salary-summary="yg-salary-compact">');
 });
 if(matched!==1)throw Error('Salary summary table missing or ambiguous');
 return result;
}
