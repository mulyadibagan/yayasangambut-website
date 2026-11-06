# Rekening staf

Data Gaji Staf menyediakan formulir rekening terpisah dari ketentuan nominal
gaji. Direktur memuat satu nama staf, mengisi bank, nomor, dan nama pemilik,
lalu menyimpan. Nomor disimpan sebagai teks angka sehingga nol di awal tetap
utuh. Data berada pada D1 privat, bukan kode atau konfigurasi repository publik.

API mengikuti izin payroll yang sudah berlaku: Finance/Direktur dapat membaca
satu profil berdasarkan nama; hanya Direktur dapat menyimpan. Origin diperiksa,
isian divalidasi, dan versi optimistis mencegah perubahan saling menimpa.
Setiap perubahan menyimpan snapshot riwayat dalam transaksi yang sama.

Default pengajuan baru memprioritaskan rekening staf terbaru di atas rekening
salinan pengajuan lama dan profil bawaan. Memuat default tidak membuat pengajuan
atau pembayaran. Pengajuan yang sudah tersimpan, arsip, ketentuan gaji, saldo,
dan pencatatan transfer tidak dimutasi oleh perubahan rekening.

Validasi: 287 tes lulus dan Worker dry-run berhasil. Tes mencakup izin, Origin,
normalisasi nomor, konflik versi, riwayat, prioritas default, dan pelestarian
pengajuan lama. Formulir juga diuji simpan/muat ulang di browser lokal dengan
data sintetis. Rekening produksi belum berubah sebelum deployment dan tindakan
simpan eksplisit pada portal.
