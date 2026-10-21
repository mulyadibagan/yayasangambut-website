# Administrasi Surat YG

Modul `/surat` memakai sesi Workspace, D1 `DB`, dan R2 privat `MEDIA` milik Worker staf. Migrasi tambahan `0030_letters.sql` tidak menghapus tabel/data. Navigasi ditampilkan berdasarkan `/api/me`; semua API, unduhan, serta penerbitan tetap memeriksa otorisasi server.

## Akun dan alur

- Mulyadi (`mulyadi@yayasangambut.org`, peran admin): seluruh surat, persetujuan, penerbitan, pembatalan, register, Drive.
- Riena (`rienaprasiddha@yayasangambut.org`), Zamharir (`zamharier@yayasangambut.org`), Raja Alpian (`rajaalpian@yayasangambut.org`): draft milik sendiri, edit, unduh draft, ajukan. Ejaan email mengikuti konfigurasi Staff YG yang sudah ada.
- Akun lain ditolak, termasuk admin lain. Pengguna dinonaktifkan kehilangan akses melalui pemeriksaan sesi yang sudah ada.

Draft → menunggu persetujuan → disetujui → terbit. Nomor dialokasikan di dalam transaksi D1 batch, melalui SQL dan batasan UNIQUE global. Draft tidak mengambil nomor. Versi mencegah penimpaan perubahan. Final tidak dapat diubah; revisi membuat draft baru dengan hubungan ke dokumen asal dalam riwayat. Pembatalan mempertahankan nomor dan dokumen final.

Nomor dialokasikan dahulu; jika unggahan arsip gagal, status masih disetujui dan nomor tetap dicadangkan. Muat ulang lalu Terbitkan lagi untuk melanjutkan nomor yang sama. Status Terbit hanya tersimpan setelah Word dan PDF berhasil diunggah. R2 berada di prefix `surat/`, tanpa endpoint publik. Unduhan final memakai arsip, bukan hasil generasi ulang.

## Aktivasi register dan nomor 65

Penomoran sengaja nonaktif pada instalasi awal. Tabel `surat_references` hanya menyimpan dua referensi yang diberikan; bukan register lengkap atau bukti nomor 65 sudah terbit. Tidak ada counter yang langsung dipasang ke 65/66.

Direktur mengimpor JSON seluruh register global sejak nomor 1, termasuk pembatalan, dengan kolom `sequence`, `number`, `date`, `subject`, `status` (`issued` atau `cancelled`). Kolom tambahan seperti `kind`, `institution`, `recipient`, `signer` dipertahankan. Cantumkan sumber/bukti pemeriksaan. Impor merupakan transaksi, menolak nomor yang sudah terdaftar/dicadangkan. Impor berikutnya membatalkan status verifikasi sampai diperiksa lagi. Tidak ada fungsi hapus/menimpa register.

Verifikasi memerlukan rentang lengkap, referensi 64 yang sesuai, dan referensi 65 yang sesuai jika sudah masuk register. Penomoran global tidak direset bulanan/tahunan. Jika register organisasi ternyata memakai seri tahunan, jangan aktifkan sampai aturan dan register dikonfirmasi; implementasi ini mengikuti instruksi global tanpa reset.

Jika 65 sudah terbit, impor sebagai `65/YG/SKR/X/2026`; sistem menolak reservasi ulang dan memakai nomor maksimum berikutnya. Jika 65 baru disetujui, Direktur harus memeriksa dokumen asli, menyetujui draft SKR bertanggal 2026-10-21 dengan tujuan PT Riau Andalan Pulp and Paper, lalu memilih reservasi khusus RAPP. Nomor umum masih terkunci sampai 65 terbit atau tercatat pada register. Setelah itu nomor berikutnya 66 jika tidak ada nomor lebih tinggi.

Dokumen awal `Surat_Keterangan_Rekening_RAPP_65_YG_SKR_X_2026.docx` dan register lengkap belum ditemukan saat implementasi. Pengguna kemudian memberikan `Surat_Keterangan_Rekening_RAPP_Kop_Resmi_Revisi.docx` sebagai acuan kop. Dokumen referensi tersebut masih menampilkan placeholder nomor; tidak dianggap sebagai bukti penerbitan nomor 65. Contoh pengujian menggunakan data rekening dari instruksi pengguna; bukan pengganti isi dokumen sumber dan tidak dimigrasikan menjadi surat terbit. Jangan menyatakan nomor 65 telah diterbitkan hanya karena tabel referensi tersedia.

## Dokumen dan arsip

Ekspor Word adalah OOXML `.docx` dengan header A4, isi dapat diedit. PDF A4 dihasilkan dengan pdf-lib; register adalah OOXML `.xlsx` dengan nilai string, tanpa eksekusi formula. Catatan internal tidak masuk Word/PDF. Kop `public/brand/surat-letterhead.png` memakai gambar asli 2172 × 724 yang diekstrak tanpa perubahan dari header `Surat_Keterangan_Rekening_RAPP_Kop_Resmi_Revisi.docx` yang diberikan pengguna. Word memakai anchor halaman dan ukuran yang sama dengan referensi; PDF dan pratinjau mengikuti geometri tersebut. Tidak ada gambar ulang logo atau tangkapan layar invoice. Header organisasi boleh publik, dokumen dan data rekening tidak masuk aset publik.

Direktur dapat menyalin kedua arsip final ke Drive melalui tombol Arsipkan Word dan PDF ke Drive. Menggunakan grant `driveAccess` yang sudah ada dan folder `SURAT_DRIVE_ROOT_ID`, atau root invoice `INVOICE_DRIVE_ROOT_ID` yang sudah disetujui. Root harus sama dengan koneksi Drive. ID file disimpan sebelum unggah, percobaan ulang memeriksa checksum, ukuran, tipe dan parent, tidak menimpa file berbeda, serta tidak mengubah sharing. Kegagalan Drive tidak menghilangkan arsip R2. Tidak ada email atau scope OAuth baru. Integrasi Drive tetap membutuhkan pengujian live dengan koneksi Direktur.

## Validasi dan deployment

Jalankan `npm test` dan Worker dry-run, lalu workflow `Deploy staff dashboard` yang sudah ada pada main. Workflow menjalankan migrasi D1 sebelum deploy. Tidak diperlukan secret baru.

Uji surat meliputi empat akun, akun lain/admin lain, anonim/nonaktif/lintas origin, isolasi pemilik, otorisasi persetujuan, draft tanpa nomor, register belum lengkap, referensi, nomor 65 sekali, kelanjutan 66, penerbitan bersamaan, kegagalan R2 dan retry, arsip/final immutable, revisi/pembatalan, versi basi, PDF satu halaman A4, Excel, serta validasi input. Ini pengujian lokal SQLite dengan transaksi batch serial seperti D1; bukan pembuktian login sebagai empat pengguna di produksi.

DOCX contoh berhasil dibuka dan diekspor melalui Microsoft Word terpasang, satu halaman A4, lalu PDF dirasterisasi dan diperiksa. Renderer `render_docx.py` tidak dapat digunakan karena LibreOffice tidak terpasang; pemeriksaan Word digunakan sebagai pengganti. Isi surat RAPP sebenarnya tetap perlu diperiksa dari sumber asli.

Sesudah deploy: periksa `/surat` dan API tanpa sesi ditolak, migrasi tercatat, lalu lakukan penerimaan dengan akun Workspace sah. Jangan meniru identitas staf atau menyalin cookie produksi ke pengujian. Jangan mengaktifkan register tanpa bukti lengkap.
