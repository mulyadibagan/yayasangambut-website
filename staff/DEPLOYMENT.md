# Aktivasi melalui GitHub Actions

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

## Pratinjau website

Tombol Pratinjau website membuka tab privat menggunakan header, footer, dan CSS hasil build website publik. Isi formulir dikirim ke endpoint staf yang memerlukan sesi, disanitasi, lalu dirender tanpa menyimpan atau menerbitkan artikel. Draf tidak dimasukkan ke URL, penyimpanan browser, atau Analytics. Foto tetap mengikuti izin media staf.

Workflow deployment membangun website dan menjalankan `node staff/scripts/build-preview.mjs` sebelum menerbitkan Worker. Untuk pengembangan lokal, jalankan `npm run build` di root repository lalu script tersebut. Template dan CSS hasil build di `staff/public/website-preview` dan `staff/public/_astro` tidak disimpan ke Git. Builder menghentikan proses bila struktur artikel publik yang dibutuhkan tidak ditemukan.
