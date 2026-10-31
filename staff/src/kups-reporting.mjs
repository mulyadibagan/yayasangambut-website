// Read-only balances and reports; no synthetic opening or adjustment entries.
export async function balancesAt(env,q,g,group,date,exclude=''){
 const anchor=await q(env,'SELECT * FROM kups_reconciliations WHERE group_id=? AND month<? ORDER BY month DESC LIMIT 1',g,date.slice(0,7)).first();
 const openings=(await q(env,'SELECT * FROM kups_account_openings WHERE group_id=?',g).all()).results;
 const after=anchor?anchor.month+'-31':'';
 const cash=(await q(env,"SELECT account,SUM(CASE WHEN kind='income' THEN amount ELSE -amount END) AS net FROM kups_transactions WHERE group_id=? AND deleted_at IS NULL AND date>? AND date<=? AND id<>? GROUP BY account",g,after,date,exclude).all()).results;
 const moves=(await q(env,'SELECT from_account,to_account,SUM(amount) AS amount FROM kups_transfers WHERE group_id=? AND deleted_at IS NULL AND date>? AND date<=? GROUP BY from_account,to_account',g,after,date).all()).results;
 const accounts=['cash','bank','unassigned'].map(id=>{
  let balance=anchor?(id==='cash'?anchor.cash_amount:id==='bank'?anchor.bank_amount:0):id==='unassigned'?(group.opening_amount===null?null:group.opening_amount-openings.reduce((n,a)=>n+a.amount,0)):openings.find(a=>a.account===id)?.amount??null;
  if(balance!==null){balance+=cash.find(a=>a.account===id)?.net||0;for(const t of moves){if(t.to_account===id)balance+=t.amount;if(t.from_account===id)balance-=t.amount;}}
  return {id,balance};
 });
 return {date,accounts,opening_reconciliation_month:anchor?.month||null};
}

export async function entireReport(env,q,g){
 const rows=(await q(env,'SELECT * FROM kups_transactions WHERE group_id=? AND deleted_at IS NULL ORDER BY date,created_at,id',g).all()).results;
 const transfers=(await q(env,'SELECT * FROM kups_transfers WHERE group_id=? AND deleted_at IS NULL ORDER BY date,created_at,id',g).all()).results;
 const summary={income:0,expense:0};for(const r of rows)summary[r.kind]+=r.amount;
 const documents=(await q(env,'SELECT * FROM kups_documents WHERE group_id=? AND deleted_at IS NULL ORDER BY date,created_at,id',g).all()).results;
 return {rows,transfers,summary,documents};
}
