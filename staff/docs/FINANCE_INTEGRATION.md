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
- Selisih rekonsiliasi tahun historis tetap ditampilkan sebagai catatan, tanpa
  mengubah angka sumber. Selisih periode bank terakhir menghalangi penerbitan.
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

## Rekap pasangan UM–PJUM

Rekap menggantikan komponen monitor UM yang sudah ada, bukan menambah panel di
layout seluruh Finance. Ringkasan utama dan arus kas tidak menerima blok tambahan.
Satu baris memuat satu UM dicairkan dengan daftar PJUM tertaut, nominal laporan,
status persetujuan, pengembalian terverifikasi, serta sisa pertanggungjawaban.
Filter tahun/proyek/status/pencarian menghitung total dari baris yang sama.

`reported` = realisasi disetujui + laporan terkirim yang masih diperiksa;
`unaccounted` = maksimum nol dari UM - reported - pengembalian terverifikasi.
`outstanding` tetap kewajiban formal sebelum persetujuan dan berbeda dari sisa
pelaporan. Draf/revisi tidak dimasukkan ke reported. Tidak ada jurnal bank baru.
PJUM historis tanpa parent hanya dipasangkan jika nomor UM resmi, proyek, dan
nilai UM sama dengan tepat satu UM; dokumen ambigu tetap perlu rekonsiliasi.
