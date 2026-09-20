export type Lang = 'id' | 'en';

export const routeMap = {
  id: { home: '/id/', about: '/id/tentang-kami/', programs: '/id/program/', locations: '/id/lokasi-kerja/', impact: '/id/dampak/', stories: '/id/cerita/', publications: '/id/publikasi/', contact: '/id/hubungi-kami/' },
  en: { home: '/en/', about: '/en/about/', programs: '/en/programs/', locations: '/en/where-we-work/', impact: '/en/impact/', stories: '/en/field-stories/', publications: '/en/publications/', contact: '/en/contact/' }
} as const;

export const pagePairs: Record<string, string> = {
  '/id/': '/en/', '/en/': '/id/', '/id/tentang-kami/': '/en/about/', '/en/about/': '/id/tentang-kami/',
  '/id/program/': '/en/programs/', '/en/programs/': '/id/program/', '/id/lokasi-kerja/': '/en/where-we-work/', '/en/where-we-work/': '/id/lokasi-kerja/',
  '/id/dampak/': '/en/impact/', '/en/impact/': '/id/dampak/', '/id/cerita/': '/en/field-stories/', '/en/field-stories/': '/id/cerita/',
  '/id/publikasi/': '/en/publications/', '/en/publications/': '/id/publikasi/', '/id/hubungi-kami/': '/en/contact/', '/en/contact/': '/id/hubungi-kami/',
};

export const copy = {
  id: {
    nav: ['Tentang Kami', 'Program', 'Lokasi Kerja', 'Dampak', 'Cerita Lapangan', 'Publikasi'], heroKicker: 'Aksi bentang alam dari Riau untuk Indonesia',
    heroTitle: 'Bersama masyarakat menjaga gambut, hutan, dan pesisir Indonesia.', heroText: 'Yayasan Gambut bekerja bersama masyarakat, pemerintah, akademisi, dan mitra untuk menghubungkan aksi lapangan dengan data—agar pemulihan bentang alam menghasilkan perubahan yang bertahan.',
    seePrograms: 'Lihat Program', exploreWebgis: 'Jelajahi WebGIS', impactEyebrow: 'Dampak yang dapat ditelusuri', impactTitle: 'Perubahan dimulai dari tapak, lalu direkam sebagai bukti.',
    programEyebrow: 'Program utama', programTitle: 'Satu bentang alam, lima jalur kerja yang saling terhubung.', locationEyebrow: 'Lokasi kerja', locationTitle: 'Berakar di Riau, belajar dari setiap tapak.',
    locationText: 'Fokus awal kami mencakup ekosistem gambut, hutan, dan pesisir di Riau. Visual ini ringan; data spasial lengkap tetap tersedia melalui WebGIS.', storyEyebrow: 'Cerita terbaru', storyTitle: 'Suara, praktik, dan pembelajaran dari lapangan.',
    publicationEyebrow: 'Publikasi terbaru', publicationTitle: 'Pengetahuan untuk dipakai bersama.', dataTitle: 'Memetakan aksi. Merekam perubahan.', dataText: 'WebGIS Yayasan Gambut adalah ruang khusus untuk data spasial, monitoring, dashboard, dan analisis. Situs ini menautkan ke sana tanpa memuat aplikasi GIS penuh.',
    partners: 'Bekerja melalui kemitraan', partnersText: 'Kolaborasi dibangun bersama komunitas, pemerintah, akademisi, organisasi masyarakat sipil, dan mitra pembangunan.', temporary: 'DATA SEMENTARA', latest: 'Lihat semua', read: 'Baca cerita', view: 'Lihat publikasi',
  },
  en: {
    nav: ['About', 'Programs', 'Where We Work', 'Impact', 'Field Stories', 'Publications'], heroKicker: 'Landscape action from Riau for Indonesia',
    heroTitle: 'Working with communities to protect Indonesia’s peatlands, forests, and coasts.', heroText: 'Yayasan Gambut works with communities, government, academics, and partners to connect field action with data—so landscape recovery leads to lasting change.',
    seePrograms: 'See our programs', exploreWebgis: 'Explore WebGIS', impactEyebrow: 'Traceable impact', impactTitle: 'Change starts in the field, then becomes evidence.',
    programEyebrow: 'Core programs', programTitle: 'One landscape, five connected ways of working.', locationEyebrow: 'Where we work', locationTitle: 'Rooted in Riau, learning from every site.',
    locationText: 'Our initial focus spans peatland, forest, and coastal ecosystems in Riau. This visual stays lightweight; complete spatial data remains in WebGIS.', storyEyebrow: 'Latest stories', storyTitle: 'Voices, practice, and lessons from the field.',
    publicationEyebrow: 'Latest publications', publicationTitle: 'Knowledge made to be shared.', dataTitle: 'Mapping action. Recording change.', dataText: 'Yayasan Gambut WebGIS is the dedicated space for spatial data, monitoring, dashboards, and analysis. This website links there without embedding the full GIS application.',
    partners: 'Working through partnership', partnersText: 'Collaboration brings together communities, government, academia, civil society, and development partners.', temporary: 'TEMPORARY DATA', latest: 'View all', read: 'Read story', view: 'View publication',
  },
} as const;

export const impact = [
  { value: '—', id: 'Hektare bentang alam didampingi', en: 'Hectares of landscape supported' }, { value: '—', id: 'Kelompok masyarakat bermitra', en: 'Community groups partnering' },
  { value: '—', id: 'Desa dalam jangkauan program', en: 'Villages reached by programs' }, { value: '—', id: 'Dataset publik terhubung', en: 'Public datasets connected' },
];

export const pageContent = {
  id: {
    'tentang-kami': { title: 'Tentang Yayasan Gambut', intro: 'Kami bekerja di titik temu antara pengetahuan masyarakat, praktik lapangan, kebijakan, dan data.', sections: [
      ['Profil', 'Yayasan Gambut adalah organisasi yang mendukung pengelolaan bentang alam berkelanjutan dengan menempatkan masyarakat sebagai mitra utama.'], ['Visi & Misi', 'Visi dan misi final akan ditambahkan setelah proses verifikasi internal. Struktur halaman ini siap memuat arah organisasi, prinsip kerja, dan hasil yang dituju.'],
      ['Legalitas', 'Nomor akta, keputusan kementerian, dan informasi legal lain akan ditampilkan setelah dokumen organisasi diverifikasi.'], ['Tim', 'Profil Governance, Management & Program Team, dan Technical Advisors dikelola sebagai content collection terpisah.'],
      ['Mitra', 'Mitra ditampilkan berdasarkan peran dan kolaborasi, bukan sebagai pengelompokan program berdasarkan donor.'] ]},
    'lokasi-kerja': { title: 'Lokasi Kerja', intro: 'Fokus awal berada di Riau—menghubungkan ekosistem gambut, hutan, pesisir, dan ruang hidup masyarakat.', sections: [['Riau', 'Entri lokasi menyimpan koordinat, ringkasan, status publikasi, dan bahasa. Data spasial rinci tetap dikelola di WebGIS.'], ['Prinsip penyajian', 'Website resmi menampilkan konteks manusia dan program; WebGIS menangani peta, monitoring, analisis, dan dataset.']] },
    'dampak': { title: 'Dampak', intro: 'Kami menyiapkan kerangka pelaporan yang jujur, mudah ditelusuri, dan dapat dihubungkan ke data publik.', sections: [['Indikator yang dapat diverifikasi', 'Angka dampak belum dipublikasikan pada versi awal. Setiap statistik akan menyertakan periode, definisi, sumber, dan tanggal pembaruan.'], ['Dari kegiatan ke perubahan', 'Pelaporan akan membedakan keluaran kegiatan, perubahan praktik, dan dampak bentang alam agar capaian tidak disederhanakan.']] },
    'hubungi-kami': { title: 'Hubungi Kami', intro: 'Mari membicarakan kolaborasi, riset, publikasi, atau pertanyaan tentang kerja kami.', sections: [['Kontak organisasi', 'Alamat kantor dan kanal kontak resmi sedang diverifikasi sebelum peluncuran.'], ['Kolaborasi', 'Untuk sementara, simpan kebutuhan kolaborasi beserta organisasi, lokasi, dan tujuan agar tim dapat menindaklanjuti setelah kanal resmi aktif.']] },
  },
  en: {
    'about': { title: 'About Yayasan Gambut', intro: 'We work where community knowledge, field practice, policy, and data meet.', sections: [['Profile', 'Yayasan Gambut supports sustainable landscape management with communities as primary partners.'], ['Vision & Mission', 'Final vision and mission copy will be added after internal verification. This page is ready for the organisation’s direction, principles, and intended outcomes.'], ['Legal status', 'Deed, ministry decision, and other legal information will be published after organisational documents are verified.'], ['Team', 'Governance, Management & Program Team, and Technical Advisors are managed in a separate content collection.'], ['Partners', 'Partners are presented by role and collaboration, not used to organise programs around donors.']]},
    'where-we-work': { title: 'Where We Work', intro: 'Our initial focus is Riau—connecting peatlands, forests, coasts, and community living spaces.', sections: [['Riau', 'Location entries store coordinates, a summary, publication status, and language. Detailed spatial data remains in WebGIS.'], ['Presentation principle', 'The official website gives human and program context; WebGIS handles mapping, monitoring, analysis, and datasets.']] },
    'impact': { title: 'Impact', intro: 'We are preparing an honest, traceable reporting framework that can connect to public data.', sections: [['Verifiable indicators', 'Impact figures are not yet published in this first version. Each statistic will include a period, definition, source, and update date.'], ['From activities to change', 'Reporting will distinguish activity outputs, practice changes, and landscape impact so achievements are not oversimplified.']] },
    'contact': { title: 'Contact Us', intro: 'Let’s discuss collaboration, research, publications, or questions about our work.', sections: [['Organisation contact', 'The office address and official contact channels are being verified before launch.'], ['Collaboration', 'For now, prepare your organisation, location, goal, and collaboration needs so our team can follow up once the official channel is active.']] },
  }
} as const;
