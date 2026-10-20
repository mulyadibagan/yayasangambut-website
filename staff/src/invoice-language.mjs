import {terbilang} from './payroll-print.mjs';
const englishWords=n=>{
 const small=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'],tens=['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
 if(n<20)return small[n];if(n<100)return tens[Math.floor(n/10)]+(n%10?'-'+small[n%10]:'');
 for(const [v,w] of [[1e12,'trillion'],[1e9,'billion'],[1e6,'million'],[1000,'thousand'],[100,'hundred']])if(n>=v)return englishWords(Math.floor(n/v))+' '+w+(n%v?' '+englishWords(n%v):'');
};
export function invoiceLanguage(d){const en=d.language==='en',locale=en?'en-GB':'id-ID';return {
 code:en?'en':'id',en,locale,money:n=>new Intl.NumberFormat(en?'en-GB':'id-ID',{maximumFractionDigits:0}).format(n),
 date:value=>new Date(value+'T12:00:00+07:00').toLocaleDateString(locale,{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jakarta'}),
 words:n=>en?englishWords(n)+' Indonesian rupiah.':terbilang(n).replace(/\s+/g,' ').trim()+' rupiah.',
 draft:en?'DRAFT - NOT ISSUED':'DRAFT - BELUM DITERBITKAN',to:en?'Bill to:':'Kepada:',dateLabel:en?'DATE: ':'TANGGAL: ',contract:en?'Contract / PO: ':'Kontrak / PO: ',remarks:en?'REMARKS':'URAIAN',continued:en?' (continued)':' (lanjutan)',
 installment:(p,a)=>en?`${p}% instalment of the total contract value of IDR ${new Intl.NumberFormat('en-GB').format(a)}.`:`Termin ${p}% dari kontrak Rp${new Intl.NumberFormat('id-ID').format(a)}.`,
 payment:en?'Please make payment to:':'Pembayaran kepada:',vatAdded:en?'VAT added':'PPN ditambahkan',vatIncluded:en?'VAT included in instalment amount':'PPN termasuk dalam nilai termin',withholding:en?'Withholding tax':'Potongan pajak',wordsLabel:en?'Amount in words: ':'Terbilang: ',closing:en?'Yours faithfully,':'Hormat kami,',director:en?'Director':'Direktur',issued:en?'Issued through the Director account on ':'Diterbitkan melalui akun Direktur pada ',
 draftNote:en?'Draft for review. Not issued, sent or marked as paid.':'Draf untuk pemeriksaan. Belum diterbitkan, dikirim, atau dinyatakan dibayar.',back:en?'Back to invoice':'Kembali ke invoice',print:en?'Print / save PDF':'Cetak / simpan PDF',download:en?'Download A4 PDF':'Unduh PDF A4',signature:en?'Mulyadi signature':'Tanda tangan Mulyadi',missingAccount:en?'Payment account details have not been completed.':'Rekening tujuan belum dilengkapi.'
 };}
