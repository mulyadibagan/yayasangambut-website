Arsip Drive invoice memakai INVOICE_DRIVE_ROOT_ID dan koneksi OAuth Drive Direktur yang sudah ada. Setelah penerbitan, PDF cetak bertanda tangan disalin ke YG Finance/Invoice/Tahun/Kode pelanggan. Kegagalan tidak membatalkan persetujuan; dicoba ulang tiap lima menit dan melalui tombol invoice. Status pengiriman terpisah pada yg_invoice_drive; lease serial dan ID Drive yang dicadangkan mencegah unggahan ganda saat retry. Hash PDF, MD5 Drive, metadata invoice, dan turunan folder diverifikasi. Tidak mengubah izin folder atau arsip asli.

PDF tanpa TTD menyediakan ruang kosong 74 pt (sekitar 2,6 cm) sebelum nama penanda tangan untuk tanda tangan pena. Rendition tanpa TTD memakai print-v3 agar cache lama tidak digunakan; arsip asli dan rendition bertanda tangan tetap utuh.

Versi cetak print-v2 merapatkan tabel agar invoice RAPP beserta TTD muat satu A4 dan menghapus label FINAL serta waktu penerbitan dari dokumen. Untuk invoice yang sudah terbit, pilihan cetak memakai rendition privat terpisah berdasarkan snapshot terkunci, dengan hash sumber; PDF arsip asli tetap tersedia dan tidak ditimpa.

Lampiran invoice menerima Word .doc (OLE) dan .docx (paket Word), selain PDF/gambar, maksimal 5 MB. Format diperiksa di server; unduhan privat menggunakan Content-Disposition attachment. Tidak ada konversi atau eksekusi isi Word.

Nomor kontrak/PO bersifat opsional. Lampiran dengan jenis Kontrak / PO tetap diperlukan sebelum final, termasuk ketika nomor kontrak belum tersedia. Tidak mengubah draf atau arsip final yang sudah tersimpan.

Pemeriksaan perpajakan dan dokumen pajak tidak lagi menjadi syarat penerbitan sesuai permintaan Direktur. Nilai pajak lama tetap dipertahankan; PDF final lama tidak diubah.

# Invoice keluar YG Finance

Direktur dapat memilih Dengan TTD / Tanpa TTD sebelum final. Pratinjau HTML dan PDF bertanda tangan mengambil gambar privat hanya setelah pemeriksaan akun Direktur di server, selalu menyertakan watermark PRATINJAU, dan tidak mengubah status/revisi invoice. Finance tetap hanya melihat pratinjau tanpa TTD. Pilihan yang dipakai menerbitkan final disimpan dalam data dan snapshot persetujuan; server mencocokkan pilihan TTD dengan konfirmasi review. Tombol penerbitan menjelaskan kekurangan secara aktif dan checklist mengarah ke kolom terkait.

Untuk persetujuan invoice baru, PDF arsip asli tetap disimpan. Jika tanda tangan aktif, versi tanpa gambar tanda tangan juga dibuat pada saat persetujuan, dengan hash sendiri dan tautan hash ke dokumen asli. Pratinjau invoice final menyediakan pilihan unduh/cetak dengan atau tanpa gambar tanda tangan. Pilihan cetak tidak mengubah persetujuan, nomor, atau transaksi. Draf selalu tanpa tanda tangan; permintaan memaksakan tanda tangan pada draf ditolak. Arsip lama tanpa metadata varian hanya menyediakan PDF asli dan tidak dirender ulang.

Bahasa invoice dipilih sebelum final: `id` (Bahasa Indonesia, juga untuk record lama tanpa bahasa) atau `en` (English). Bahasa tersimpan pada snapshot draf, mengatur label cetak, tanggal, angka IDR, terbilang, instruksi pembayaran, dan penutup. Uraian dan catatan diisi sesuai bahasa pilihan; hanya uraian baku RAPP yang dapat beralih otomatis di formulir. Bahasa tidak membuat register atau urutan nomor terpisah. Invoice final tetap terkunci dan menggunakan PDF arsip aslinya.

Invoice baru memakai alamat kop Pekanbaru dan kontak organisasi sebagai isian awal. Template cetak memakai kop putih dengan logo di kiri, alamat yang membungkus sesuai lebar, dan aksen garis oranye/hijau. Data invoice tersimpan tetap menjadi sumber kop masing-masing dokumen. Jalur cetak invoice final mengarah ke PDF arsip yang diverifikasi hash; template terbaru tidak merender ulang dokumen final.

Rekening standar invoice disimpan privat melalui `/finance/invoices/bank-settings` oleh Direktur, terpisah dari kode publik. Seed invoice baru membaca pengaturan tersebut; invoice yang sudah tersimpan tidak diubah otomatis. Nama rekening, bank, alamat bank, SWIFT, dan nomor rekening dicetak sebagai baris tersendiri pada instruksi pembayaran. Perubahan draf tetap melalui penyimpanan berversi dan riwayat yang sudah ada.

Direktur dan Finance yang ditunjuk membuka `/finance/invoices` melalui menu Invoice di YG Finance. Simpan draf untuk mengalokasikan nomor, buka pratinjau cetak A4, gunakan Cetak / simpan PDF atau Unduh PDF A4. Data tagihan berada pada tabel `yg_invoice_*`; tidak membuat mutasi, penerimaan, piutang terposting, email, atau status pembayaran pada sumber keuangan historis.

Nomor bersifat satu urutan tahunan lintas pelanggan. Sesuai permintaan nomor `10/YG-RAPP/26` dan referensi GEC `009/YG-GEC/26`, migrasi mencadangkan nomor 1–9 tahun 2026 sebagai rentang historis. Nomor baru dialokasikan atomik saat penyimpanan draf pertama; unik pada pasangan tahun/urutan dan nomor yang dinormalisasi. Pembatalan draf mempertahankan nomor dan audit. Pemakaian nomor historis harus dicocokkan kembali oleh Finance sebelum final. Tahun berikutnya dimulai dari 1. Tidak mengimpor atau mengubah invoice historis.

Penerbitan final oleh Direktur memerlukan alamat pelanggan, kontrak/PO beserta lampiran, identitas kop, rekening tujuan, serta konfirmasi pemeriksaan nomor dan desain. Nominal PPN/potongan diisi Finance; aplikasi tidak menentukan tarif atau status PKP secara otomatis. Pemeriksaan ini berdasarkan isian/dokumen internal, bukan koneksi ke layanan DJP. Draf RAPP membiarkan perpajakan belum terkonfirmasi.

PDF final diarsipkan privat di R2 dengan SHA-256 dan tidak berubah setelah diterbitkan. Draf dapat disunting; final terkunci. Lampiran privat maksimal 20 berkas, masing-masing 5 MB, PDF/JPEG/PNG/WebP. Akun, waktu, versi, dan snapshot perubahan tersimpan. Uji mencakup akses, CSRF, urutan bersamaan, duplikasi, retry, revisi stale, dokumen wajib, final terkunci, cetak A4, sanitasi, kegagalan arsip, serta integritas data historis.

Desain mengacu pada lembar terbaru 09/YG-GEC/26 dalam workbook referensi yang diberikan: pelanggan di kiri, nomor/tanggal di kanan, tabel REF–REMARKS–TOTAL (IDR), dan instruksi pembayaran di dalam remarks. Kop memakai aksen oranye yang dibuat dengan kode, logo YG yang sudah publik, dan teks organisasi dari data invoice. Nilai, rekening, dan tanda tangan contoh tidak diimpor otomatis. Dokumen referensi privat dan tanda tangan gambar tidak dimasukkan sebagai aset publik.
