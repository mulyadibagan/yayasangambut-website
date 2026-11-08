const months={Jan:1,Feb:2,Mar:3,Apr:4,Mei:5,May:5,Jun:6,Jul:7,Agu:8,Aug:8,Sep:9,Okt:10,Oct:10,Nov:11,Des:12,Dec:12};
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
export function validateStatements(statements=[]){
 if(!Array.isArray(statements))throw Error('Invalid bank statement list');
 for(const item of statements){
  if(!validDate(item.startDate)||!validDate(item.endDate)||item.startDate>item.endDate||typeof item.name!=='string'||!item.name.trim()||!/^https:\/\/drive\.google\.com\/file\/d\/[\w-]+\/view(?:\?[^#]*)?$/.test(item.url))throw Error('Invalid bank statement metadata');
 }
 const sorted=[...statements].sort((a,b)=>a.startDate.localeCompare(b.startDate));
 for(let i=1;i<sorted.length;i++)if(sorted[i].startDate<=sorted[i-1].endDate)throw Error('Overlapping bank statement periods');
 return statements;
}
export function attachStatementSources(bank,statements=[]){
 validateStatements(statements);
 return {...bank,mutations:bank.mutations.map(row=>{
  const match=/^(\d{1,2}) ([A-Za-z]+) (\d{4})(?: |$)/.exec(row.postedAt);
  const date=/^\d{4}-\d{2}-\d{2}(?:[ T]|$)/.test(row.postedAt)?row.postedAt.slice(0,10):match&&months[match[2]]?`${match[3]}-${String(months[match[2]]).padStart(2,'0')}-${match[1].padStart(2,'0')}`:null;
  const statement=validDate(date)&&statements.find(item=>date>=item.startDate&&date<=item.endDate);
  return statement?{...row,statementUrl:statement.url}:row;
 })};
}
