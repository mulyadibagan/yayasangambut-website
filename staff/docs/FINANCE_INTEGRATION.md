# Integrasi UM/PJUM dan cashflow

`src/finance-integration.mjs` adalah model baca bersama untuk `/finance/integration/api`
dan respons daftar `/finance/api/requests`. Akses mengikuti hak dashboard Finance.
Model menggabungkan register Finance dan workflow aplikasi menggunakan ID UM asal;
nomor dokumen yang persis sama dengan nominal sama tidak dihitung dua kali.

## Sumber dan waktu pembaruan

- UM/PJUM dibaca dari D1 pada setiap permintaan. Panel memuat ulang ketika tab
  kembali aktif dan setiap menit. Tahap pemeriksaan dipisahkan dari persetujuan.
- Pengeluaran terakui dari PJUM hanya setelah persetujuan Direktur (`settlement`
  atau `closed`). Draf dan laporan yang masih diperiksa ditampilkan terpisah.
- Cashflow menggunakan snapshot `finance_bank_history_v1` yang dibentuk dari
  `finance-history.json` setelah rekonsiliasi register bank pada deployment Finance.
  Ini bukan koneksi langsung ke bank. Tanggal cakupan mutasi ditampilkan terpisah
  dari waktu pembacaan UM/PJUM.
- Pengembalian mengurangi kewajiban hanya jika referensi, proyek, dan nominal
  cocok dengan satu mutasi bank. Unggahan bukti saja tidak menambah kas.
- Nilai agregat API memakai sen rupiah sebagai integer. Arus kas neto proyek
  tidak disebut saldo tersedia: saldo awal/alokasi opening tidak boleh ditebak.

## Register dan pagu

Trigger native memproyeksikan UM/PJUM ke register dan dokumen Finance, memakai ID
`UM-WORKFLOW-<id>` dan `PJUM-WORKFLOW-<id>`. Proyeksi dapat diulang tanpa menambah
transaksi bank, mengubah versi workflow, atau mengganti event persetujuan.

`stripWorkflowArchive` mengeluarkan kontribusi snapshot workflow native dari
baseline dossier sebelum komitmen live dihitung. UM yang sama tetap mengunci
pagu sekali meski sudah muncul di arsip. Workflow native tidak ditawarkan lagi
sebagai UM arsip yang dapat dihubungkan.

Panel lama yang membaca array saat build digantikan oleh ringkasan live. Export
helper modul lama dipertahankan supaya pemakai lain tidak rusak. Nilai kas dan
alokasi gaji tetap berasal dari sumber bank/rekonsiliasi yang sudah ada.

## Validasi

Tes meliputi UM native dan arsip, seluruh tahap PJUM, ID/nomor ganda, pencocokan
pengembalian, pagu yang sudah masuk dossier, proyeksi dokumen idempotent, akses
Mulyadi/Riena, jumlah per proyek, dan ledger bank yang tidak berubah. Build
production tetap memvalidasi sumber Finance terenkripsi dan kompilasi React.
