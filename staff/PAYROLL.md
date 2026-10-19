# Pengajuan dan pembayaran gaji YG Finance

Halaman `/finance/payroll` tersedia dari menu Keuangan YG. Finance yang ditunjuk (`PAYROLL_FINANCE_EMAIL`) membuat pengajuan dan mencatat pembayaran. Direktur dapat membuat pengajuan, membuka pratinjau form, memeriksa, menyetujui atau mengembalikan pengajuan. Riena juga memiliki akses dasbor Finance sesuai hak akses yang berlaku.

## Alur penggunaan

1. Finance memilih **Pengajuan baru**. Daftar staf aktif dan nominal bulanan berasal dari kebijakan gaji efektif sistem, setelah pembaruan privat diterapkan. Posisi saving ditampilkan sebagai konteks alokasi, bukan nominal gaji yang diminta.
2. Profil penerima/rekening dari Excel referensi mengisi informasi transfer. Data terakhir yang disimpan Finance mengungguli profil awal. Staf yang tidak memiliki profil harus dilengkapi Finance. Nominal historis Excel dan gambar tanda tangan tidak diimpor.
3. Periksa periode, tanggal, pengaju, keperluan, kode anggaran dan rekening. Nomor formulir dibuat otomatis saat menyimpan, atau dapat diisi sesuai penomoran organisasi. Penyesuaian nominal dari kebijakan memerlukan alasan. Simpan draf; lampirkan dokumen pendukung bila perlu.
4. Ajukan kepada Direktur. Rincian terkunci sampai dikembalikan. Direktur menyetujui atau mengembalikan dengan catatan. Tidak ada email otomatis. Persetujuan belum mengurangi kas.
5. **Cetak** membuka Formulir Permintaan Dana dengan rincian, total, terbilang dan jejak persetujuan akun. Ctrl+P untuk cetak/PDF. Contoh lima penerima diuji satu halaman A4; catatan panjang atau realisasi pembayaran dapat menambah halaman.
6. Setelah transfer dilakukan melalui bank, Finance membuka **Realisasi pembayaran**. Isi tanggal dan referensi transfer, nominal per penerima, unggah/pilih bukti, lalu **Simpan pembayaran**. Aplikasi hanya mencatat transfer yang sudah dilakukan. Pembayaran dapat sebagian; tidak dapat melebihi nominal yang disetujui per penerima.
7. Bila transfer sudah ada dalam register bank, **Muat mutasi bank** dan pilih mutasi yang tepat. Tanggal, rekening, referensi dan jumlah harus sesuai. Pembayaran historis yang tidak dapat dicocokkan ditolak agar tidak dihitung ganda.
8. **Laporan pembayaran** (`/finance/payroll/report`) menghubungkan formulir, realisasi dan bukti transfer. Panel yang sama tersedia di ringkasan/rincian keuangan. Saldo mutasi tetap bertanggal sumber; saldo menurut catatan memasukkan pembayaran baru yang belum masuk sumber mutasi. Saat sumber diperbarui, kecocokan bank dan pembayaran per staf diperiksa untuk menghindari pengurangan ulang. Ketidakcocokan ditampilkan untuk rekonsiliasi, dan saldo yang belum pasti tidak ditampilkan sebagai angka final.

## Integritas dan penyimpanan

Migrasi 0022 menambahkan metadata formulir, kategori berkas, dan register `yg_payroll_payments`. Tabel `finance_*`, sumber alokasi dan agenda tidak ditulis oleh API payroll. Mutasi rekening, referensi dan ID pembayaran memiliki perlindungan duplikasi. Versi dan transaksi database menjaga persetujuan/pembayaran dari perubahan bersamaan. Riwayat menyimpan salinan rincian, akun dan waktu.

Berkas pendukung/bukti disimpan privat di R2 dengan awalan `payroll-private/`; akses hanya melalui sesi Finance/Direktur. Maksimal 30 berkas per pengajuan, masing-masing 5 MB, PDF/JPEG/PNG. Penyimpanan ini terpisah dari Drive agenda.

Profil referensi disimpan dengan AES-256-GCM pada `imports/payroll-profiles-v2.enc`, dengan izin pengguna. Kunci `PAYROLL_PROFILE_KEY_V2` berada di GitHub Secrets dan hanya digunakan pada runner deployment yang dilindungi. Hasil dekripsi masuk modul server Worker Finance privat, bukan aset publik. Nominal kebijakan tetap berasal dari sistem.

Deployment membandingkan checksum tabel historis keuangan dan agenda sebelum/sesudah migrasi. Pengujian memakai data sintetis: hak akses, revisi/persetujuan, cetak, pembayaran sebagian/lunas, bukti wajib, batas nominal, duplikasi, retry, serta pencocokan ulang saat sumber bank diperbarui. Tidak membuat pengajuan, persetujuan atau transfer uji di produksi.


## Panduan dan pengajuan oleh Direktur

Panduan ringkas tersedia pada `/finance/payroll/guide` dari tautan **Panduan gaji**. Direktur dapat memilih **Pengajuan baru**, menyimpan draf, mengirim, dan menyetujui pengajuannya sendiri sesuai izin eksplisit pengguna. Konfirmasi menyebut pengajuan sendiri; snapshot audit approval mencatat `self_approved: true` bersama aktor/waktu/versi. Finance dapat memeriksa dan menyunting draf Direktur, tetapi tetap tidak dapat menyetujui. Direktur hanya menyunting draf miliknya sendiri. Semua rincian terkunci setelah diajukan. Pembayaran dan bukti transfer tetap khusus Finance. **Pratinjau form Finance** menyediakan mode baca saja tanpa membuat pengajuan.
