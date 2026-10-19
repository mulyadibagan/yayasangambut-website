# Pengajuan gaji bulanan YG Finance

Halaman: `/finance/payroll`, tersedia dari menu Keuangan YG dan tautan Pengajuan gaji bulanan di YG Finance.

Staf Finance yang ditunjuk adalah `rienaprasiddha@yayasangambut.org`, dikonfigurasi melalui `PAYROLL_FINANCE_EMAIL`. Akun harus masuk melalui Google Workspace YG dan tidak dinonaktifkan. Akses ini khusus pengajuan gaji; tidak membuka modul atau API keuangan lama. Persetujuan tetap khusus akun administrator Mulyadi sebagaimana aturan Finance yang sudah ada.

## Alur

1. Finance memilih Pengajuan baru, periode, penerima, sumber dana, gaji pokok, tambahan dan potongan. Bank/rekening opsional. Semua nominal adalah rupiah bulat; gaji bersih dihitung ulang di server.
2. Simpan draf, lalu tambahkan dokumen pendukung jika diperlukan (PDF/JPEG/PNG, maksimal 5 MB, maksimal 10 berkas). Berkas disimpan secara privat, terpisah dari arsip agenda, dan hanya dibaca melalui sesi Finance/Direktur yang sah.
3. Ajukan ke Direktur. Rincian serta lampiran terkunci. Tidak ada pengiriman email otomatis; pengajuan muncul pada halaman tinjauan Direktur.
4. Direktur menyetujui atau mengembalikan dengan catatan wajib. Finance dapat memperbaiki pengajuan yang dikembalikan lalu mengirim ulang.
5. Pengajuan disetujui bersifat terkunci. Persetujuan belum merupakan pencatatan pembayaran; tidak menambah transaksi, mengubah saldo, atau mengubah laporan gaji historis. Pembayaran tetap menggunakan proses keuangan yang sudah ada.

Satu bulan hanya boleh memiliki satu pengajuan berstatus diajukan/disetujui. Beberapa draf dapat disiapkan, tetapi pengiriman ganda ditolak oleh indeks unik database. Perubahan memakai pemeriksaan versi; tab lama wajib dimuat ulang. Riwayat mencatat akun, waktu, aksi, versi dan salinan data saat perubahan/persetujuan. Tampilan menyediakan cetak.

## Pemisahan data dan validasi

Migrasi `0021_payroll_requests.sql` hanya membuat tabel `yg_payroll_requests`, `yg_payroll_events`, dan `yg_payroll_files`; tidak menyentuh tabel historis `finance_*` atau agenda. Objek lampiran memakai awalan `payroll-private/`. API tidak menulis ke buku besar lama.

Deployment membandingkan checksum isi semua tabel `finance_*` serta agenda sebelum/sesudah migrasi. Jika berbeda, deployment berhenti; perubahan bersamaan oleh pengguna juga dapat memicu pemeriksaan ini. Isi keuangan tidak dicetak ke log.

Validasi lokal mencakup sesi/hak akses, CSRF, nominal dan jumlah bersih, pengajuan ganda, versi kedaluwarsa, penguncian data, akses lampiran privat, revisi/persetujuan, dan keutuhan data lama. Browser diuji dengan data contoh terpisah, bukan pengajuan produksi. Penerimaan langsung oleh akun Riena dan Mulyadi dilakukan setelah login masing-masing.
