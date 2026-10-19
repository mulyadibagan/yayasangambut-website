# Aktivasi melalui GitHub Actions

## Arsip lampiran agenda di Google Drive

Migrasi `0020_agenda_drive.sql` menambahkan koneksi Drive dan referensi berkas pada tabel lampiran, tanpa mengubah isi agenda. `AGENDA_DRIVE_ROOT_ID` menunjuk tujuan yang dipilih pemilik YG: `1LM8jrwmbfRdYz1rfWJae67DaReOLiTFz`. Setelah mengganti tujuan, Direktur perlu menghubungkan Google Drive kembali; referensi lampiran yang sudah ada tetap dipertahankan.

Setelah deployment, Direktur membuka detail salah satu agenda dan memilih **Hubungkan Google Drive**. Gunakan akun Direktur yang sama dengan akun staf. Koneksi OAuth terpisah dari Kalender/Tasks, memakai callback Google yang sudah ada, PKCE, nonce, dan token penyegaran terenkripsi. Google Drive API harus aktif pada project OAuth. Scope `drive` diperlukan untuk memeriksa dan menulis ke folder organisasi yang sudah ada tanpa Google Picker; layar koneksi menjelaskan izin tersebut. Backend membatasi operasi penyimpanan ke subfolder arsip yang dicatat, tidak menerima folder tujuan dari permintaan unggah, dan tidak mengubah izin berbagi.

Callback memverifikasi akses tujuan, membuat/menggunakan subfolder **Lampiran Agenda YG**, lalu mengaktifkan unggahan Drive bagi pembuat agenda dan Direktur. Dokumen mewarisi izin Shared Drive; hak akses Drive dapat mencakup anggota selain peserta agenda. Tautan pada detail agenda tetap memerlukan akses agenda sebelum mengarahkan ke pratinjau Drive; setelah itu Google memeriksa akses akun Drive.

Sebelum koneksi diberikan, unduhan lama tetap berfungsi dan unggahan baru meminta koneksi Drive (tidak diam-diam kembali menyimpan ke R2). Tombol **Salin lampiran lama ke Google Drive** memindahkan referensi untuk lampiran event tersebut setelah ukuran dan checksum salinan lolos pemeriksaan. Salinan R2 tetap disimpan untuk pemulihan. Mengulangi penyalinan tidak menggandakan berkas yang sudah terhubung; lease per lampiran melindungi proses bersamaan. Melepaskan lampiran Drive dari agenda hanya menghapus referensi agenda, bukan dokumen arsip Drive.

Verifikasi penerimaan setelah persetujuan OAuth: unggah PDF kecil, buka pratinjau menggunakan akun peserta yang memiliki akses Drive, salin lampiran lama, lalu periksa bahwa judul/jadwal/peserta agenda tetap sama. Pengujian unit menggunakan Google API tiruan; keberhasilan unit dan deployment bukan bukti bahwa pemilik sudah memberikan izin Drive.

Status: workflow disiapkan di PR; belum dijalankan di Cloudflare. Token Cloudflare saja belum mengaktifkan login Google, publikasi, atau Analytics.

## Akses Cloudflare

Buat custom API token bernama `YG Staff GitHub Actions` melalui My Profile → API Tokens. Batasi Account Resources ke akun YG, dan Zone Resources ke `yayasangambut.org`.

Izin untuk jalur deployment ini:

- Account → Workers Scripts → Edit (atau Workers Editor untuk Worker `yg-staff` jika pembatasan resource tersedia).
- Account → Account Settings → Read.
- Account → D1 → Edit (migrasi database).
- Account → Workers R2 Storage → Read (verifikasi bucket yang sudah dibuat).
- Zone → Zone → Read.
- Zone → Workers Routes → Edit (custom domain staf).

Izin D1 dapat mencakup database lain pada akun jika antarmuka tidak menyediakan pembatasan per resource. Script memverifikasi nama `yg-staff` sebelum migrasi, tetapi itu bukan pengganti pembatasan izin token. Jangan gunakan Global API Key. Pilih masa berlaku token sesuai periode penggunaan dan rotasi sebelum kedaluwarsa.

Simpan di repository `mulyadibagan/yayasangambut-website` → Settings → Secrets and variables → Actions:

| Jenis | Nama | Isi |
| --- | --- | --- |
| Secret | CLOUDFLARE_API_TOKEN | Token deployment |
| Secret | CLOUDFLARE_ACCOUNT_ID | Account ID YG |
| Variable | STAFF_D1_DATABASE_ID | UUID database khusus yg-staff |

Jangan kirim nilai token di chat. Secret yang telah tersimpan tidak perlu dan tidak boleh dibaca kembali.

## Resource dan integrasi sebelum menjalankan workflow

1. Buat database D1 `yg-staff` dan bucket R2 privat `yg-staff-media` di akun yang sama. Jangan aktifkan public bucket URL. Jika pembuatan resource memerlukan persetujuan biaya/ketentuan, pemilik akun menyelesaikannya.
2. Pastikan zone `yayasangambut.org` aktif di Cloudflare dan `staff.yayasangambut.org` belum digunakan layanan lain.
3. Selesaikan OAuth internal Workspace, GitHub App terbatas repository ini, dan service account Analytics Viewer sesuai README.
4. Simpan secret `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `STAFF_GITHUB_APP_ID`, `STAFF_GITHUB_APP_PRIVATE_KEY`, `STAFF_GITHUB_INSTALLATION_ID`, `GA_SERVICE_ACCOUNT_EMAIL`, `GA_SERVICE_ACCOUNT_KEY`. Prefix STAFF pada tiga secret GitHub dipetakan ke nama runtime tanpa prefix.
5. Buat environment GitHub `staff-production`; batasi deployment ke main dan tetapkan reviewer pemilik akun bila tersedia.
6. Setelah review dan merge PR, Actions → Deploy staff dashboard → Run workflow pada main. Workflow hanya manual, tidak dijalankan pada PR atau push.

Workflow menjalankan tes dan dry-run, memvalidasi konfigurasi, memeriksa nama resource, menerapkan migrasi D1, menerbitkan Worker, lalu memasang secret. Deployment dan pengisian secret bukan transaksi atomik: bila langkah akhir gagal, login pertama tetap tertutup; periksa log sebelum mengulang. Pada deployment berikutnya secret lama tetap berlaku sampai penggantian berhasil.

Verifikasi live tetap wajib: login admin/editor/staf, penolakan domain lain, unggah foto privat, simpan/review/publikasi artikel, status GitHub Pages, serta data Analytics. Tambahkan link login publik setelah verifikasi lulus.

Referensi resmi: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/ dan https://developers.cloudflare.com/fundamentals/api/reference/permissions/

## Pemulihan talangan gaji pada Finance privat

Mutasi baru dana pengganti gaji masuk melalui `bank_statement_updates_v1` dengan bucket `STAFF_PENDING`. Setelah bukti dan staf penerima terverifikasi, tambahkan atribusi pada `finance_reconciliation_v1.staffAllocations`, memakai identitas mutasi yang sama dan `savingId` unik untuk setiap baris staf. Untuk penerimaan gaji gunakan `SALARY_CONFIRMED`; donasi tetap `DONATION_CONFIRMED`. Jangan mengakui ulang hak gaji yang sudah ada di sumber saving; cocokkan identitas bukti dan baris sumber terlebih dahulu.

Untuk alokasi baru, hilangkan properti `allocations`: rekonsiliasi menghitung pembagian otomatis. Posisi minus staf dipulihkan ke `YG` lebih dahulu, lalu kelebihannya ke `STAFF`. Atribusi staf dan jumlah harus cocok dengan mutasi; penerimaan yang belum memiliki atribusi tetap pending, bukan pelunasan otomatis kepada staf sembarang. Alokasi eksplisit lama tetap divalidasi terhadap hasil perhitungan yang sama.

Deploy Finance membaca konfigurasi privat tersebut dan memperbarui saving staf, saving umum, dan rincian talangan dari satu jurnal. Tidak ada transaksi bank atau transfer kedua. Identitas alokasi awal dipertahankan agar pemrosesan ulang mutasi sesudah rekonsiliasi tidak menggandakan saldo. Ini bukan koneksi otomatis ke bank; hanya mutasi yang sudah diposting dan diverifikasi yang diperhitungkan. Jangan memasukkan data keuangan atau kredensial privat ke repository publik.

## Pengembalian sisa UM pada Finance privat

Posting pengembalian terverifikasi satu kali melalui `bank_statement_updates_v1` ke bucket proyek asal. Alokasi proyek otomatis memulihkan talangan proyek sebelum menghasilkan dana proyek tersedia. Jangan membuat transfer YG kedua atau menjadikan saldo PJUM sebagai penerimaan bank baru.

Tambahkan `umReturns` pada `finance_reconciliation_v1`: setiap tautan berisi `index`, `reference`, `date` sesuai mutasi, `project` (bucket proyek), `umId`, `pjumId`, `amount`, dan `evidenceUrl` Drive/Docs. UM dan PJUM harus sudah tercatat, PJUM terhubung ke UM tersebut, dan proyek keduanya cocok dengan alokasi bank. Untuk pengembalian bertahap, simpan seluruh tautan sebelumnya bersama tautan baru: jumlah dihitung dari daftar lengkap, bukan ditambahkan ke angka bank tersimpan. Satu mutasi yang dibagi untuk beberapa PJUM harus teralokasi penuh tanpa melebihi nilai kredit atau sisa laporan.

Deployment memvalidasi tautan dan memperbarui metadata pengembalian, register, monitor UM/PJUM, serta rincian talangan dari mutasi yang sama. Pengembalian belum cocok bank tidak melunasi sisa UM. Pelunasan nominal tidak otomatis menyetujui PJUM atau memverifikasi pengiriman laporan/buktinya. Data dan tautan privat tetap hanya di konfigurasi privat.

## Pratinjau website

Tombol Pratinjau website membuka tab privat menggunakan header, footer, dan CSS hasil build website publik. Isi formulir dikirim ke endpoint staf yang memerlukan sesi, disanitasi, lalu dirender tanpa menyimpan atau menerbitkan artikel. Draf tidak dimasukkan ke URL, penyimpanan browser, atau Analytics. Foto tetap mengikuti izin media staf.

Workflow deployment membangun website dan menjalankan `node staff/scripts/build-preview.mjs` sebelum menerbitkan Worker. Untuk pengembangan lokal, jalankan `npm run build` di root repository lalu script tersebut. Template dan CSS hasil build di `staff/public/website-preview` dan `staff/public/_astro` tidak disimpan ke Git. Builder menghentikan proses bila struktur artikel publik yang dibutuhkan tidak ditemukan.

## Perbaikan dan Sampah

Klik judul/Perbaiki tulisan pada daftar Tulisan, simpan revisi, lalu Terbitkan perbaikan untuk memperbarui website. Daftar memeriksa hasil build tulisan yang masih berstatus diproses; tombol Periksa status tersedia di editor.

Hapus ke sampah bersifat dapat dipulihkan. Draf disembunyikan dari daftar aktif; artikel yang pernah diterbitkan lebih dahulu diubah menjadi draft di repository dan baru masuk Sampah setelah build website berhasil. Foto tidak dihapus karena mungkin dipakai artikel lain. Filter Sampah menyediakan Pulihkan draf; pemulihan tidak otomatis menerbitkan artikel. Izin tetap pemilik tulisan atau editor/admin. Migrasi 0002 menambahkan deleted_at dan publish_action tanpa menghapus data.
