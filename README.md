# Yayasan Gambut — Official Website

Repository mandiri untuk website resmi `yayasangambut.org`. Proyek ini tidak memuat, menyalin, atau mengubah aplikasi maupun dataset WebGIS di `webgisyg.id`.

## Teknologi dan prinsip

- Astro static-first, bilingual `/id/` dan `/en/`
- Konten terpisah dari layout melalui Astro Content Collections
- Output statis di `dist/`, siap untuk Cloudflare Pages
- Tidak ada database atau credential di browser
- Integrasi WebGIS di masa depan hanya melalui endpoint API/JSON publik
- Media besar direncanakan berada di Cloudflare R2, bukan Git

## Instalasi dan development lokal

Persyaratan: Node.js 22.12 atau lebih baru.

```bash
npm install
npm run dev
```

Astro akan menampilkan URL lokal, biasanya `http://localhost:4321`. Build produksi:

```bash
npm run build
npm run preview
```

Output siap deploy berada di `dist/`.

## Deploy ke Cloudflare Pages

Buat Pages project baru dan hubungkan repository ini. Gunakan konfigurasi:

- Framework preset: `Astro`
- Build command: `npm run build`
- Build output directory: `dist`
- Node.js: `22`
- Production branch: pilih setelah alur review disepakati

Gunakan subdomain staging Cloudflare Pages terlebih dahulu. Jangan arahkan `yayasangambut.org` sampai konten, legalitas, analytics, formulir, performa, dan keamanan selesai direview.

## Struktur utama

```text
src/
├── components/        komponen UI reusable
├── content/           artikel, program, publikasi, lokasi, tim, mitra
│   ├── articles/{id,en}/
│   ├── programs/{id,en}/
│   ├── publications/{id,en}/
│   ├── locations/{id,en}/
│   ├── team/{id,en}/
│   └── partners/{id,en}/
├── data/              copy antarmuka dan data sementara
├── layouts/           layout halaman dan metadata SEO
├── pages/             routing statis ID/EN, sitemap, robots
└── styles/            design tokens dan gaya global
```

Schema semua collection ada di `src/content.config.ts`. Nilai `status` yang didukung: `draft`, `review`, dan `published`.

## Menambah artikel

Salin salah satu file di `src/content/articles/id/` atau `en/`, lalu isi:

- `title`, `slug`, `date`, `author`, `summary`, `category`
- `featuredImage`, `imageAlt`, `imageCredit`, `imageSource`, `gallery`
- `language`, `status`, `featured`

Gunakan `draft` saat menulis, `review` saat siap diperiksa, dan `published` setelah disetujui editor.

## Menambah publikasi

Salin contoh di `src/content/publications/{id,en}/`, lalu isi `title`, `slug`, `year`, `category`, `summary`, `cover`, `fileUrl`, `language`, `status`, dan `featured`. PDF besar jangan disimpan di repository; gunakan URL R2 pada `fileUrl`.

## Menambah anggota tim

Salin contoh di `src/content/team/{id,en}/`. Pilih `group` persis dari:

- `Governance`
- `Management & Program Team`
- `Technical Advisors`

Isi `name`, `position`, `photo`, `bio`, `order`, `language`, dan `status`. Foto resolusi tinggi sebaiknya berada di R2.

## Environment variables

Salin `.env.example` menjadi `.env` untuk development lokal. Variabel berawalan `PUBLIC_` akan terlihat di browser dan tidak boleh berisi secret.

- `PUBLIC_MEDIA_BASE_URL`: origin publik bucket/custom domain R2
- `PUBLIC_WEBGIS_API_URL`: endpoint API publik, read-only, dari WebGIS

Secret untuk proses build atau integrasi server di masa depan harus dibuat sebagai encrypted environment variable di Cloudflare, tanpa prefix `PUBLIC_`.

## Rencana integrasi R2

1. Buat satu bucket khusus aset website resmi, terpisah dari storage/data WebGIS.
2. Gunakan custom domain media dan aktifkan cache publik.
3. Simpan foto, video, dan PDF final di R2; repository hanya menyimpan URL dan metadata.
4. Siapkan transformasi gambar WebP/AVIF dan ukuran responsif di pipeline media.
5. Migrasikan URL contoh foto eksternal setelah Yayasan Gambut menyediakan aset berizin.

## Rencana CMS

Content Collections sudah memisahkan data dari layout. Tahap berikutnya dapat menambahkan Git-based CMS atau admin panel yang menulis frontmatter tanpa mewajibkan kontributor memakai Git CLI. Alur target:

`Contributor → Draft → Editor Review → Editor/Admin Publish`

Hak akses, audit trail, preview draft, dan workflow persetujuan perlu ditentukan sebelum CMS dipilih.

## Integrasi WebGIS

Website resmi hanya boleh mengambil ringkasan yang memang dinyatakan publik, misalnya statistik dampak dan daftar lokasi agregat. Jangan menyalin database, orthomosaic, shapefile, GeoTIFF, atau data drone. Kegagalan endpoint harus mempertahankan halaman yang dapat dibaca dengan status data yang jelas.

## Checklist sebelum domain production

- Verifikasi profil, visi-misi, legalitas, alamat, kontak, tim, dan mitra
- Ganti seluruh statistik placeholder dengan data bersumber dan bertanggal
- Ganti contoh artikel/publikasi dan foto eksternal dengan konten resmi berizin
- Finalisasi privacy policy, analytics consent, serta endpoint formulir kontak
- Uji aksesibilitas, broken links, Core Web Vitals, dan social previews
- Deploy dan review di staging Cloudflare Pages
- Baru setelah persetujuan akhir, arahkan DNS `yayasangambut.org`
