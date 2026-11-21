const q=(e,s,...a)=>e.DB.prepare(s).bind(...a);
export async function ensureDonationFiles(env,id=null){
 const where=id?'d.id=? AND ':'';const args=id?[id]:[];
 const proofs=(await q(env,"SELECT d.* FROM yg_donations d WHERE "+where+"NOT EXISTS(SELECT 1 FROM yg_donation_files f WHERE f.request_id=d.id AND f.purpose='proof') ORDER BY d.seq LIMIT 3",...args).all()).results;
 const receipts=(await q(env,"SELECT d.*,e.version AS version,e.payload AS payload FROM yg_donation_events e JOIN yg_donations d ON d.id=e.donation_id WHERE "+where+"NOT EXISTS(SELECT 1 FROM yg_donation_files f WHERE f.request_id=d.id AND f.purpose='receipt' AND f.version=e.version) ORDER BY e.created_at,e.version LIMIT 3",...args).all()).results;
 const rows=[...proofs,...receipts];
 for(const r of rows){
  const proof=await q(env,"SELECT id FROM yg_donation_files WHERE request_id=? AND purpose='proof'",r.id).first();
  if(!proof){const obj=await env.MEDIA.get(r.object_key);if(!obj)continue;const bytes=new Uint8Array(await new Response(obj.body).arrayBuffer());const ext={'image/jpeg':'jpeg','image/png':'png','image/webp':'webp','application/pdf':'pdf'}[r.mime];
   await q(env,'INSERT OR IGNORE INTO yg_donation_files(id,request_id,version,purpose,filename,storage_key,mime,size) VALUES(?,?,0,\'proof\',?,?,?,?)',r.id+':proof',r.id,'Bukti_Donasi_'+String(r.seq).padStart(5,'0')+'.'+ext,r.object_key,r.mime,bytes.length).run();}
  if(r.payload&&!await q(env,"SELECT id FROM yg_donation_files WHERE request_id=? AND purpose='receipt' AND version=?",r.id,r.version).first()){
   const {donationPdf}=await import('./donations.mjs');const bytes=await donationPdf({...r,payload:JSON.parse(r.payload)}),key='donations/'+r.id+'/receipt-'+r.version+'-'+crypto.randomUUID()+'.pdf';
   await env.MEDIA.put(key,bytes,{httpMetadata:{contentType:'application/pdf'}});
   try{const inserted=await q(env,'INSERT OR IGNORE INTO yg_donation_files(id,request_id,version,purpose,filename,storage_key,mime,size) VALUES(?,?,?,\'receipt\',?,?,\'application/pdf\',?)',r.id+':receipt:'+r.version,r.id,r.version,'Kuitansi_Donasi_'+String(r.seq).padStart(5,'0')+'_v'+r.version+'.pdf',key,bytes.length).run();if(!inserted.meta.changes)await env.MEDIA.delete(key);}catch(e){await env.MEDIA.delete(key);throw e;}
  }
 }
}
