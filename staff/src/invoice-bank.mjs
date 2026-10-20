import {fail,now} from './core.mjs';
import {financeOwner} from './finance-access.mjs';
const key='invoice-private/settings/bank-v1.json',fields={account_name:160,bank:160,bank_address:300,swift:16,account:80};
export async function invoiceBankDefaults(env){const obj=await env.MEDIA?.get(key);return obj?JSON.parse(new TextDecoder().decode(await obj.arrayBuffer())).data:{};}
export function invoiceBankLines(d){return [d.account_name||'Yayasan Gambut',d.bank,d.bank_address,d.swift?'Swift code: '+d.swift:'',d.account?'A/c No: '+d.account+' (IDR)': (d.language==='en'?'Payment account details have not been completed.':'Rekening tujuan belum dilengkapi.')].filter(Boolean);}
export async function invoiceBankRoute(req,env,u,payload){
 if(!financeOwner(u))fail(403,'Rekening standar invoice diatur oleh Direktur.');
 const api=new URL(req.url).pathname.endsWith('/api');
 if(!api&&req.method==='GET')return new Response(`<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rekening invoice · YG Finance</title><link rel="stylesheet" href="/payroll.css"><script type="module" src="/invoice-bank.js"></script><body class="payroll-page"><main style="max-width:760px;margin:40px auto;padding:24px"><a href="/finance/invoices">← Invoice</a><h1>Rekening standar invoice</h1><p>Isian otomatis untuk invoice baru. Invoice yang sudah tersimpan tidak diubah.</p><p id="bank-status" role="status">Memuat…</p><form id="bank-form" hidden>${Object.keys(fields).map(k=>'<label>'+({account_name:'Nama pemilik rekening',bank:'Bank',bank_address:'Alamat bank',swift:'Kode SWIFT',account:'Nomor rekening'})[k]+'<input name="'+k+'" maxlength="'+fields[k]+'" required></label>').join('')}<button>Simpan rekening standar</button></form></main></body></html>`,{headers:{'Content-Type':'text/html; charset=utf-8'}});
 if(!api)fail(404,'Halaman tidak ditemukan.');
 if(req.method==='GET')return Response.json({data:await invoiceBankDefaults(env)});
 if(req.method!=='POST')fail(405,'Metode tidak didukung.');
 if(req.headers.get('Origin')!==env.APP_ORIGIN)fail(403,'Permintaan harus berasal dari website YG.');
 if(!env.MEDIA)fail(503,'Penyimpanan privat belum tersedia.');
 const b=await payload(req),data={};for(const [k,n] of Object.entries(fields)){if(typeof b[k]!=='string'||!b[k].trim()||b[k].length>n)fail(400,'Lengkapi rincian rekening.');data[k]=b[k].trim();}
 if(!/^\d{6,40}$/.test(data.account)||!/^([A-Z0-9]{8}|[A-Z0-9]{11})$/.test(data.swift))fail(400,'Nomor rekening atau kode SWIFT tidak valid.');
 const saved=await env.MEDIA.put(key,JSON.stringify({data,actor:u.email,created_at:now()}),{onlyIf:new Headers({'If-None-Match':'*'}),httpMetadata:{contentType:'application/json',cacheControl:'private, no-store'}});if(!saved)fail(409,'Rekening standar sudah tersimpan. Data lama tidak ditimpa.');
 return Response.json({data},{status:201});
}
