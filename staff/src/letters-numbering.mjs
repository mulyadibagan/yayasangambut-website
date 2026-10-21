import {fail,now} from './core.mjs';
const q=(e,s,...a)=>e.DB.prepare(s).bind(...a);
export async function numberingState(e,year){
 const policy=await q(e,'SELECT * FROM surat_numbering_policy WHERE id=1').first();
 const legacy=await q(e,'SELECT verified FROM surat_settings WHERE id=1').first();
 if(!policy)return {policy:null,enabled:!!legacy?.verified,year,next:null};
 const last=await q(e,'SELECT MAX(n) AS n FROM (SELECT MAX(sequence) AS n FROM surat_annual WHERE number_year=? UNION ALL SELECT MAX(sequence) FROM surat_annual_register WHERE number_year=?)',year,year).first();
 const first=year===policy.first_year?policy.first_number:1;
 return {policy,enabled:year>=policy.first_year,year,next:Math.max(first,(last?.n||0)+1),historicalComplete:!!legacy?.verified};
}
export async function activateNumbering(e,u,b){
 if(b.firstYear!==2026||b.firstNumber!==65||b.annualReset!==true||b.confirmBaseline!==true||typeof b.evidence!=='string'||b.evidence.trim().length<20)fail(400,'Konfirmasi mulai 65 pada 2026 dan kembali ke 1 setiap tahun berikutnya.');
 const first=await q(e,'SELECT * FROM surat_annual WHERE id=?',b.firstLetterId).first();
 const d=first?JSON.parse(first.data):{};
 if(!first||first.number_year!==2026||d.kind!=='SKR'||d.date!=='2026-10-21'||d.institution!=='PT Riau Andalan Pulp and Paper'||first.status==='cancelled')fail(409,'Pilih draft RAPP yang sesuai sebagai surat web pertama.');
 if(await q(e,'SELECT id FROM surat_annual WHERE number_year=2026 AND (sequence=65 OR reserved_sequence=65) AND id!=? UNION ALL SELECT number AS id FROM surat_annual_register WHERE number_year=2026 AND sequence=65',first.id).first())fail(409,'Nomor 65 sudah tercatat atau dicadangkan untuk surat lain.');
 if(await q(e,'SELECT id FROM surat_annual WHERE number IS NOT NULL AND number_year=2026 AND sequence<65').first())fail(409,'Periksa register aktif sebelum menetapkan awal 65.');
 const t=now();await e.DB.batch([q(e,'INSERT INTO surat_numbering_policy VALUES(1,2026,65,1,?,?,?,?)',first.id,b.evidence.trim().slice(0,2000),u.id,t),q(e,'INSERT INTO surat_annual_history VALUES(?,?,?,?,?,?)',crypto.randomUUID(),first.id,u.id,'numbering_baseline_2026_65_annual_reset_1',first.version,t)]);
 return numberingState(e,2026);
}
