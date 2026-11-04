import {canonicalBankStatement2026 as bank} from '../finance-ledger-2026';
import {bankSourceRow} from '../finance-bank-source.js';
import {receiptStatement} from '../finance-review-display.js';
import documents from '../finance-document-links.json';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string>>}){
 const row=bankSourceRow(bank.mutations,await searchParams);
 const money=(value:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR'}).format(value);
 if(!row)return <main><h1>Mutasi tidak ditemukan secara unik</h1><a href="/finance">Kembali ke Finance</a></main>;
 const proof=receiptStatement(row,documents.receipts);
 return <main style={{maxWidth:900,margin:'32px auto',padding:24}}><a href="/finance">← Finance</a><p>SUMBER MUTASI · REGISTER FINANCE 2026</p><h1>{row.description}</h1><p>Mutasi yang sudah diperbarui pengguna di Finance. Halaman ini membaca register transaksi yang sama dengan saldo rekening dan penerimaan proyek.</p><dl><dt>Tanggal</dt><dd>{row.postedAt}</dd><dt>Referensi bank</dt><dd>{row.reference}</dd><dt>Dana masuk</dt><dd>{money(row.credit)}</dd><dt>Dana keluar</dt><dd>{money(row.debit)}</dd><dt>Saldo berjalan setelah transaksi</dt><dd>{money(row.balance)}</dd></dl>{proof&&<p><a href={proof} target="_blank" rel="noreferrer">{row.statementUrl===proof?'Rekening koran':'Bukti transfer pendukung'} ↗</a></p>}<p>Saldo rekening posisi terakhir: <b>{money(bank.closingBalance)}</b> · {bank.mutations.length} transaksi. Tidak ada transaksi atau perubahan saldo dibuat oleh halaman ini.</p></main>;
}
