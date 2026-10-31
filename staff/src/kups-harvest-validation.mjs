import {fail} from './core.mjs';
export function validateHarvestSale(d) {
 if(!d.source_ref.startsWith('DAYUN-SALE:'))return;
 if(!/^DAYUN-SALE:[A-Z0-9][A-Z0-9._/-]{2,79}$/.test(d.source_ref)||d.kind!=='income'||d.category!=='Penjualan nanas'||d.unit!=='buah'||!Number.isSafeInteger(d.quantity)||d.quantity<=0||!Number.isSafeInteger(d.unit_price)||d.unit_price<=0||d.quantity*d.unit_price!==d.total_amount||!d.counterparty)fail(400,'Periksa nomor nota unik, pembeli, jumlah buah, dan harga penjualan nanas.');
 if(!/^DAYUN-HARVEST:\d{4}-\d{2}-\d{2}:(bagus|rijek)$/.test(d.activity)||d.activity.slice(14,24)>d.date)fail(400,'Pilih tanggal panen sebelum atau sama dengan tanggal penjualan.');
}
export function validateHarvestPayment(d,p) {
 if(d.source_ref?.startsWith('DAYUN-SALE:')&&!/^DAYUN-PAY:[A-Z0-9][A-Z0-9._/-]{2,79}$/.test(p.source_ref))fail(400,'Isi nomor bukti pembayaran yang unik.');
}
