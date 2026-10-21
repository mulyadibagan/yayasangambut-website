import {fail,now} from './core.mjs';

export async function saveClosingReconciliation(req,env,url,{u,g,group,requireAdmin,body,q,json}){
  requireAdmin(u);
  const b=await body(req),month=url.searchParams.get('month');
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month||'')||b.month!==month)fail(400,'Pilih bulan rekonsiliasi yang sesuai.');
  if(group.opening_amount===null||!group.start_date||month<group.start_date.slice(0,7))fail(400,'Pilih bulan setelah awal pembukuan.');
  for(const key of ['cash_amount','bank_amount'])if(!Number.isSafeInteger(b[key])||b[key]<0||b[key]>1e12)fail(400,'Isi saldo kas dan rekening dalam rupiah bulat, minimal nol.');
  if(!Number.isSafeInteger(b.version)||b.version<0)fail(400,'Versi rekonsiliasi tidak valid.');
  if(typeof b.note!=='string'||b.note.trim().length>500)fail(400,'Catatan maksimal 500 karakter.');
  const before=await q(env,'SELECT * FROM kups_reconciliations WHERE group_id=? AND month=?',g,month).first();
  const stamp=now();
  // Store a closing-balance observation, never a cash transaction or an opening.
  // Compute the book snapshot in the write statement, including only active cash
  // entries through this month. Version guards protect concurrent corrections.
  const write=q(env,`INSERT INTO kups_reconciliations(group_id,month,cash_amount,bank_amount,book_amount,note,version,updated_by,updated_at)
    SELECT ?,?,?,?,?+COALESCE((SELECT SUM(CASE WHEN kind='income' THEN amount ELSE -amount END) FROM kups_transactions WHERE group_id=? AND deleted_at IS NULL AND substr(date,1,7)<=?),0),?,1,?,?
    WHERE ?=0 OR EXISTS(SELECT 1 FROM kups_reconciliations WHERE group_id=? AND month=? AND version=?)
    ON CONFLICT(group_id,month) DO UPDATE SET cash_amount=excluded.cash_amount,bank_amount=excluded.bank_amount,book_amount=excluded.book_amount,note=excluded.note,version=kups_reconciliations.version+1,updated_by=excluded.updated_by,updated_at=excluded.updated_at
    WHERE kups_reconciliations.version=?`,g,month,b.cash_amount,b.bank_amount,group.opening_amount,g,month,b.note.trim(),u.email,stamp,b.version,g,month,b.version,b.version);
  const audit=q(env,'INSERT INTO kups_audit SELECT ?,?,?,?,?,?,? WHERE changes()>0',crypto.randomUUID(),g,u.email,'closing-reconciliation',month,JSON.stringify({before,after:{...b,note:b.note.trim()}}),stamp);
  const results=await env.DB.batch([write,audit]);
  if(!results[0].meta.changes)fail(409,'Rekonsiliasi berubah. Muat ulang sebelum menyimpan.');
  return json({ok:true});
}
