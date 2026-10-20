# Tanda tangan Direktur

Akun Direktur membuka `/finance/signature`, mengunggah PNG, dan mengonfirmasi pemakaian untuk invoice serta formulir gaji setelah persetujuan. Endpoint aktivasi memerlukan sesi Direktur, Origin yang benar, konfirmasi eksplisit, dan PNG valid maksimal 2 MB. Gambar tidak masuk repositori atau aset publik. R2 menyimpan berkas privat dengan SHA-256, akun, waktu aktivasi, dan tujuan penggunaan. Conditional PUT mencegah penimpaan, termasuk permintaan bersamaan.

Invoice menerima tanda tangan saat Direktur menerbitkan final setelah pemeriksaan yang sudah berlaku. Form gaji menerima tanda tangan saat Direktur menyetujui setelah review. Draf, preview, pengajuan yang belum disetujui, pengajuan batal, dan akun pemeriksa selain Direktur tidak menerima tanda tangan. HTML cetak dan PDF menggunakan gerbang status yang sama pada server; browser tidak menentukan apakah dokumen ditandatangani.

Tanda tangan hanya berlaku untuk persetujuan setelah waktu aktivasi. PDF final lama, revisi, pembayaran, dan data sumber keuangan tidak ditulis ulang. PDF persetujuan baru diarsipkan menggunakan mekanisme hash yang sudah ada; email gaji melampirkan PDF arsip yang sama. Tidak ada pengiriman email baru yang dipicu oleh aktivasi. Gambar hanya disisipkan pada dokumen privat yang telah disetujui; tidak ada endpoint unduh gambar mentah. Halaman aktivasi hanya menampilkan metadata.

Tes memakai logo publik sebagai gambar pengganti, tanpa menyimpan tanda tangan asli pada fixture. Pengujian mencakup hak akses, Origin, PNG, aktivasi sekali, integritas berkas, status/akun/waktu persetujuan, HTML, embedding PDF, dan hash arsip yang tidak berubah.
