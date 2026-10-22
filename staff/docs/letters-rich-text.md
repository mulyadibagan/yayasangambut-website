# Isi surat berformat

`bodyFormat: rich-v1` menyimpan `bodyDoc` versi 1, bukan HTML. Model bersama di
`public/letter-content.js` membatasi paragraf, daftar, tabel, perataan, indentasi,
jarak paragraf, dan tanda tebal/miring/garis bawah. Server membangun ulang model
dengan allowlist dan menurunkan `body` untuk pencarian/kompatibilitas. HTML hasil
paste hanya dibaca dalam DOM inert, dikonversi ke model, lalu dirender dengan
escaping. Atribut, tautan, gambar, skrip, dan CSS bebas tidak disimpan.

Tanpa penanda format, isi lama selalu dianggap teks literal. Ekspor surat lama
non-PNY tetap memakai renderer sebelumnya. Klien lama tidak boleh mengganti
draft rich text menjadi plain text. Surat bernomor/terbit tetap tidak dapat
disunting; perubahan ini tidak menjalankan regenerasi atau penimpaan arsip.

Jenis PNY yang sudah ada digunakan kembali. Template Non-PKP tersedia melalui
GET terautentikasi dan tidak menyimpan draft, mengalokasikan nomor, atau
menerbitkan surat. Redaksi diambil dari `SURAT PERNYATAAN NON PKP.docx`; hash
sumber dicatat pada template. Referensi perpajakan dipertahankan sebagaimana
sumber dan bukan hasil peninjauan substansi hukum/perpajakan.

## Verifikasi

- 251 pengujian Node lulus, termasuk roundtrip model, legacy literal, sanitasi,
  paste Word, template read-only, penomoran, imutabilitas terbit, DOCX, dan PDF.
- Worker dry-run berhasil.
- Chrome lokal: simpan/buka ulang sama, toolbar, undo/redo, paste Word berbahaya,
  dan operasi tabel diperiksa. Viewport tablet 820 x 1180 dan desktop diperiksa;
  belum diuji pada perangkat tablet fisik atau Safari.
- Contoh Non-PKP dirender satu halaman di Word dan PDF. Contoh panjang tiga
  halaman dan contoh seluruh format diperiksa secara visual. Word dirender
  melalui Microsoft Word karena LibreOffice tidak tersedia pada runtime.
- Pengujian browser memakai server/database lokal; tidak menerbitkan surat
  produksi atau mengubah arsip RAPP 65.

Aturan tanda tangan tetap: Word untuk tanda tangan/stempel basah; PDF draft
tanpa tanda tangan; PDF terbit memakai aset privat sesuai alur yang sudah ada.

## Versi arsip pernyataan

Jenis PNY memakai versi format `statement-v1`. Tombol pembaruan format hanya
membuat rendition tambahan lewat penulisan R2 create-only. Data asli, nomor,
versi persetujuan, waktu terbit, serta kunci objek final pada `surat_annual`
tidak diubah. Arsip Drive setiap layout memakai ID berbeda; tautan versi lama
tetap ditampilkan. Pengulangan pembaruan mengembalikan versi yang sudah ada.

Untuk PNY plain text, proyeksi presentasi membentuk tabel identitas tiga kolom
dan daftar bernomor, mengatur jarak paragraf, serta mengapit judul/nomor dan
penutup sesuai format pernyataan. Pemeriksaan kesamaan teks mengabaikan hanya
spasi/tab/baris; perubahan redaksi ditolak. `renditionData` hanya proyeksi untuk
pratinjau, sedangkan `data` tetap sumber asli. Rich text yang sudah disunting
pengguna dipertahankan. Format RAPP/SKR tetap `formal-v3`.

253 tes lulus termasuk pembaruan rendition, idempotensi, izin Direktur,
pelestarian sumber/arsip lama, dan tidak adanya alokasi atau penerbitan ulang.
