import {PDFDocument} from 'pdf-lib';
import {fail,imageType,now} from './core.mjs';
import {financeOwner} from './finance-access.mjs';
const key='document-private/director-signature-v1.png';
const hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
export function signatureEligible(r){return !r.preview&&!r.cancelled_at&&((r.status==='issued'&&!!r.issued_at&&r.issued_by==='mulyadi@yayasangambut.org')||(r.status==='approved'&&!!r.reviewed_at&&r.reviewer_email==='mulyadi@yayasangambut.org'));}
export async function documentSignature(env,r){
 if(!signatureEligible(r))return null;
 const object=await env.MEDIA?.get(key);if(!object)return null;
 const m=object.customMetadata||{},at=r.status==='issued'?r.issued_at:r.reviewed_at;
 if(!m.activated_at||!m.sha256||m.activated_by!=='mulyadi@yayasangambut.org')fail(503,'Metadata tanda tangan tidak valid.');
 const approvedTime=new Date(at).getTime(),activatedTime=new Date(m.activated_at).getTime();if(!Number.isFinite(approvedTime)||!Number.isFinite(activatedTime))fail(503,'Waktu tanda tangan tidak valid.');
 if(approvedTime<activatedTime)return null;
 const bytes=new Uint8Array(await object.arrayBuffer());if(await hash(bytes)!==m.sha256)fail(503,'Pemeriksaan tanda tangan gagal.');return bytes;
}
export function signatureDataUrl(bytes){if(!bytes)return '';let s='';for(const b of bytes)s+=String.fromCharCode(b);return 'data:image/png;base64,'+btoa(s);}
export async function signatureRoute(req,env,u,readLimited){
 if(!financeOwner(u))fail(403,'Tanda tangan hanya dikelola akun Direktur.');
 const api=new URL(req.url).pathname==='/finance/signature/api';
 if(!api&&req.method==='GET')return new Response(`<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tanda tangan Direktur · YG Finance</title><link rel="stylesheet" href="/payroll.css"><script type="module" src="/document-signature.js"></script><body class="payroll-page"><main style="max-width:760px;margin:40px auto;padding:24px"><a href="/finance">← YG Finance</a><h1>Tanda tangan Direktur</h1><p>Untuk invoice final dan form gaji setelah Anda menyetujui. Gambar disimpan privat; draf dan arsip PDF lama tetap utuh.</p><p id="signature-status" role="status">Memuat status…</p><form id="signature-form" hidden><label>Pilih PNG tanda tangan transparan (maksimal 5 MB)<input id="signature-file" type="file" accept="image/png" required></label><p><label><input id="signature-confirm" type="checkbox" required> Saya mengizinkan tanda tangan Mulyadi pada invoice dan form gaji yang saya setujui setelah aktivasi.</label></p><button type="submit">Aktifkan tanda tangan privat</button></form><p>Tanda tangan yang aktif tidak dapat ditimpa melalui halaman ini. Nama akun, waktu aktivasi, dan sidik berkas dicatat.</p></main></body></html>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store'}});
 if(!api)fail(404,'Halaman tidak ditemukan.');
 if(!env.MEDIA)fail(503,'Penyimpanan privat belum tersedia.');
 const old=await env.MEDIA.get(key);
 if(req.method==='GET')return Response.json({active:!!old,...(old?old.customMetadata:{})},{headers:{'Cache-Control':'private, no-store'}});
 if(req.method!=='POST')fail(405,'Metode tidak didukung.');
 if(req.headers.get('Origin')!==env.APP_ORIGIN)fail(403,'Permintaan harus berasal dari website YG.');
 if(old)fail(409,'Tanda tangan sudah aktif dan tidak dapat ditimpa.');
 if(req.headers.get('X-Confirm-Signature')!=='invoice-payroll-after-approval')fail(400,'Konfirmasi penggunaan tanda tangan diperlukan.');
 const bytes=await readLimited(req,5*1024*1024);if(imageType(bytes)!=='image/png')fail(400,'Gunakan gambar PNG.');
 try{const doc=await PDFDocument.create(),image=await doc.embedPng(bytes);if(image.width<50||image.height<20||image.width>4096||image.height>4096)fail(400,'Ukuran gambar tidak sesuai.');}catch(e){if(e.status)throw e;fail(400,'Gambar PNG tidak dapat dibaca.');}
 const metadata={activated_at:now(),activated_by:u.email.toLowerCase(),sha256:await hash(bytes),usage:'invoice-payroll-after-approval'};
 const saved=await env.MEDIA.put(key,bytes,{onlyIf:new Headers({'If-None-Match':'*'}),httpMetadata:{contentType:'image/png',cacheControl:'private, no-store'},customMetadata:metadata});
 if(!saved)fail(409,'Tanda tangan telah diaktifkan oleh permintaan lain. Muat ulang.');
 return Response.json({active:true,...metadata},{status:201,headers:{'Cache-Control':'private, no-store'}});
}
