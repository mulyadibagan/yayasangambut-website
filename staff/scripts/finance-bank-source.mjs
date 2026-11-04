export function bankSourceHref(row){
 const params=new URLSearchParams({reference:row.reference,date:row.postedAt??row.date,credit:String(row.credit??row.amount)});
 return '/finance/bank-source?'+params;
}
export function bankSourceRow(rows,params){
 const matches=rows.filter(row=>row.reference===params.reference&&row.postedAt===params.date&&String(row.credit)===params.credit);
 return matches.length===1?matches[0]:null;
}
