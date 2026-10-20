import {fail} from './core.mjs';
export const invoiceSeed={number:'10/YG-RAPP/26',date:'2026-10-20',customer:'PT Riau Andalan Pulp and Paper',customer_code:'RAPP',customer_address:'',contract_ref:'',contract_amount:498000000,percentage:40,description:'Tagihan pembayaran termin kontrak PT Riau Andalan Pulp and Paper.',tax_status:'unknown',tax_mode:'unknown',vat:0,withholding:0,tax_note:'',npwp:'',organization_address:'',organization_contact:'',bank:'',account:'',account_name:'Yayasan Gambut',notes:'',design_reviewed:false,number_reviewed:false};
const txt=(b,k,n,required=false)=>{if(typeof b[k]!=='string')fail(400,'Kolom '+k+' harus berupa teks.');const s=b[k].trim();if(s.length>n||required&&!s)fail(400,'Lengkapi kolom '+k+' (maksimal '+n+' karakter).');return s;};
const amount=(b,k,max=1e12)=>{if(!Number.isSafeInteger(b[k])||b[k]<0||b[k]>max)fail(400,'Nominal '+k+' harus berupa rupiah bulat yang valid.');return b[k];};
export function invoiceInput(b){
 if(!b||typeof b!=='object'||Array.isArray(b))fail(400,'Data invoice tidak valid.');
 const d={};for(const [k,n,required] of [['date',10,true],['customer',200,true],['customer_code',16,true],['customer_address',1000],['contract_ref',200],['description',5000,true],['tax_note',1500],['npwp',40],['organization_address',700],['organization_contact',300],['bank',160],['account',80],['account_name',160],['notes',2000]])d[k]=txt(b,k,n,required);
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(d.date)||!Number.isFinite(Date.parse(d.date+'T12:00:00Z'))||new Date(d.date+'T12:00:00Z').toISOString().slice(0,10)!==d.date)fail(400,'Tanggal invoice tidak valid.');
 d.customer_code=d.customer_code.toUpperCase();if(!/^[A-Z0-9]{2,16}$/.test(d.customer_code))fail(400,'Kode pelanggan harus 2–16 huruf/angka.');
 d.contract_amount=amount(b,'contract_amount');if(!d.contract_amount)fail(400,'Isi nilai kontrak.');
 if(typeof b.percentage!=='number'||!Number.isFinite(b.percentage)||b.percentage<=0||b.percentage>100||Math.round(b.percentage*100)!==b.percentage*100)fail(400,'Persentase termin harus lebih dari 0 sampai 100, maksimal dua desimal.');
 d.percentage=b.percentage;const raw=d.contract_amount*Math.round(d.percentage*100);if(!Number.isSafeInteger(raw)||raw%10000)fail(400,'Nilai termin harus menghasilkan rupiah bulat.');
 const base=raw/10000;d.tax_status=b.tax_status;d.tax_mode=b.tax_mode;
 if(!['unknown','non_pkp','pkp'].includes(d.tax_status)||!['unknown','no_vat','included','added'].includes(d.tax_mode))fail(400,'Pilihan perpajakan tidak valid.');
 d.vat=amount(b,'vat');d.withholding=amount(b,'withholding');
 if(d.tax_mode==='unknown'&&(d.vat||d.withholding))fail(400,'Tentukan perlakuan pajak sebelum memasukkan nominal pajak.');
 if(d.tax_mode==='no_vat'&&d.vat||d.tax_mode==='included'&&d.vat>base)fail(400,'Nominal PPN tidak sesuai perlakuan pajak.');
 const total=base+(d.tax_mode==='added'?d.vat:0)-d.withholding;if(total<=0)fail(400,'Jumlah tagihan setelah potongan harus positif.');
 d.design_reviewed=b.design_reviewed===true;d.number_reviewed=b.number_reviewed===true;
 return {data:d,amount:base,total,year:Number(d.date.slice(0,4))};
}
export function invoiceNumber(value,year){
 const m=/^0*([1-9]\d{0,5})\/YG-([A-Z0-9]{2,16})\/(\d{2})$/.exec(String(value||'').trim().toUpperCase());
 if(!m||Number(m[3])!==year%100)fail(400,'Nomor harus mengikuti urutan/tahun, misalnya 10/YG-RAPP/26.');
 return {seq:Number(m[1]),code:m[2],number:Number(m[1])+'/YG-'+m[2]+'/'+m[3]};
}
export function invoiceChecks(r,files=[]){
 const d=r.data,issues=[];
 if(!d.number_reviewed)issues.push('Cocokkan nomor dengan arsip invoice sebelum penerbitan final.');
 if(!r.number||!r.seq)issues.push('Nomor invoice belum dialokasikan.');
 if(!d.customer_address)issues.push('Lengkapi alamat pelanggan.');
 if(!d.contract_ref||!files.some(f=>f.purpose==='contract'))issues.push('Lengkapi referensi dan lampiran kontrak/PO.');
 if(d.tax_status==='unknown'||d.tax_mode==='unknown'||!d.tax_note||!files.some(f=>f.purpose==='tax'))issues.push('Konfirmasi status/perlakuan pajak, catatan pemeriksaan, dan dokumen perpajakan.');
 if(d.tax_status==='non_pkp'&&(d.tax_mode!=='no_vat'||d.vat))issues.push('Status non-PKP belum sesuai dengan pilihan PPN.');
 if(d.tax_status==='pkp'&&(!['included','added'].includes(d.tax_mode)||!/^\d{15,16}$/.test(d.npwp.replace(/[^0-9]/g,''))))issues.push('Lengkapi NPWP dan perlakuan PPN untuk status PKP.');
 if(!d.organization_address||!d.organization_contact)issues.push('Lengkapi alamat dan kontak pada kop YG.');
 if(!d.bank||!d.account||!d.account_name)issues.push('Lengkapi bank, nomor rekening, dan nama pemilik rekening.');
 if(!d.design_reviewed)issues.push('Tinjau desain cetak terhadap invoice referensi.');
 return issues;
}
