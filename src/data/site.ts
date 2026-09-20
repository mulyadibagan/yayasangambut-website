export type Lang = 'id' | 'en';

export const routeMap = {
  id: {
    home: '/id/', about: '/id/tentang-kami/', programs: '/id/program/', locations: '/id/lokasi-kerja/',
    impact: '/id/dampak/', stories: '/id/cerita/', publications: '/id/publikasi/', gallery: '/id/galeri/', contact: '/id/hubungi-kami/',
  },
  en: {
    home: '/en/', about: '/en/about/', programs: '/en/programs/', locations: '/en/where-we-work/',
    impact: '/en/impact/', stories: '/en/field-stories/', publications: '/en/publications/', gallery: '/en/gallery/', contact: '/en/contact/',
  },
} as const;

export const pagePairs: Record<string, string> = {
  '/id/': '/en/', '/en/': '/id/', '/id/tentang-kami/': '/en/about/', '/en/about/': '/id/tentang-kami/',
  '/id/program/': '/en/programs/', '/en/programs/': '/id/program/', '/id/lokasi-kerja/': '/en/where-we-work/', '/en/where-we-work/': '/id/lokasi-kerja/',
  '/id/dampak/': '/en/impact/', '/en/impact/': '/id/dampak/', '/id/cerita/': '/en/field-stories/', '/en/field-stories/': '/id/cerita/',
  '/id/publikasi/': '/en/publications/', '/en/publications/': '/id/publikasi/', '/id/galeri/': '/en/gallery/', '/en/gallery/': '/id/galeri/',
  '/id/hubungi-kami/': '/en/contact/', '/en/contact/': '/id/hubungi-kami/', '/id/privacy/': '/en/privacy/', '/en/privacy/': '/id/privacy/',
};

export const copy = {
  id: {
    nav: ['Tentang Kami', 'Program', 'Lokasi Kerja', 'Dampak', 'Cerita Lapangan', 'Publikasi'],
    heroKicker: 'Pengelolaan sumber daya alam berbasis kemitraan', heroTitle: 'Bersama masyarakat menjaga gambut, hutan, dan pesisir Indonesia.',
    heroText: 'Yayasan Gambut mendukung pengelolaan sumber daya alam lahan basah dan ekosistem lainnya melalui kemitraan strategis dengan masyarakat, pemerintah, akademisi, dan sektor swasta.',
    seePrograms: 'Lihat Program', exploreWebgis: 'Jelajahi WebGIS', impactEyebrow: 'Dampak yang dapat ditelusuri', impactTitle: 'Perubahan dimulai dari tapak, lalu direkam sebagai bukti.',
    programEyebrow: 'Program utama', programTitle: 'Satu bentang alam, lima jalur kerja yang saling terhubung.', locationEyebrow: 'Lokasi kerja', locationTitle: 'Berakar di Riau, belajar dari setiap tapak.',
    locationText: 'Kerja yang dipublikasikan mencakup ekosistem gambut, hutan, dan pesisir di sejumlah desa di Riau. Data spasial lengkap tetap tersedia melalui WebGIS.',
    storyEyebrow: 'Cerita terbaru', storyTitle: 'Suara, praktik, dan pembelajaran dari lapangan.', publicationEyebrow: 'Publikasi terbaru', publicationTitle: 'Pengetahuan untuk dipakai bersama.',
    dataTitle: 'Memetakan aksi. Merekam perubahan.', dataText: 'WebGIS Yayasan Gambut adalah ruang khusus untuk data spasial, monitoring, dashboard, dan analisis. Situs ini menautkan ke sana tanpa memuat aplikasi GIS penuh.',
    partners: 'Bekerja melalui kemitraan', partnersText: 'Kolaborasi dibangun bersama komunitas, pemerintah, akademisi, organisasi masyarakat sipil, dan mitra pembangunan.',
    temporary: 'MENUNGGU VERIFIKASI DATA', latest: 'Lihat semua', read: 'Baca cerita', view: 'Lihat publikasi',
  },
  en: {
    nav: ['About', 'Programs', 'Where We Work', 'Impact', 'Field Stories', 'Publications'],
    heroKicker: 'Partnership-based natural resource management', heroTitle: 'Working with communities to protect Indonesia’s peatlands, forests, and coasts.',
    heroText: 'Yayasan Gambut supports the sustainable management of wetlands and other ecosystems through strategic partnerships with communities, government, academia, and the private sector.',
    seePrograms: 'See our programs', exploreWebgis: 'Explore WebGIS', impactEyebrow: 'Traceable impact', impactTitle: 'Change starts in the field, then becomes evidence.',
    programEyebrow: 'Core programs', programTitle: 'One landscape, five connected ways of working.', locationEyebrow: 'Where we work', locationTitle: 'Rooted in Riau, learning from every site.',
    locationText: 'Published work spans peatland, forest, and coastal ecosystems across villages in Riau. Complete spatial data remains available through WebGIS.',
    storyEyebrow: 'Latest stories', storyTitle: 'Voices, practice, and lessons from the field.', publicationEyebrow: 'Latest publications', publicationTitle: 'Knowledge made to be shared.',
    dataTitle: 'Mapping action. Recording change.', dataText: 'Yayasan Gambut WebGIS is the dedicated space for spatial data, monitoring, dashboards, and analysis. This website links there without embedding the full GIS application.',
    partners: 'Working through partnership', partnersText: 'Collaboration brings together communities, government, academia, civil society, and development partners.',
    temporary: 'AWAITING DATA VERIFICATION', latest: 'View all', read: 'Read story', view: 'View publication',
  },
} as const;

export const impact = [
  { value: '—', id: 'Hektare bentang alam didampingi', en: 'Hectares of landscape supported' },
  { value: '—', id: 'Kelompok masyarakat bermitra', en: 'Community groups partnering' },
  { value: '—', id: 'Desa dalam jangkauan program', en: 'Villages reached by programs' },
  { value: '—', id: 'Dataset publik terhubung', en: 'Public datasets connected' },
];

export const organisation = {
  email: 'official@yayasangambut.org',
  headOffice: 'Taman Puri Bintaro PB.11 Nomor 16, Bintaro Sektor 9, RT 002 RW 009, Kelurahan Sawah Baru, Kecamatan Ciputat, Kota Tangerang Selatan 15413',
  pekanbaruOffice: 'Jalan Gulama No. 8 RT 01 RW 09, Kelurahan Tangkerang Barat, Kecamatan Marpoyan Damai, Kota Pekanbaru 28282',
  facebook: 'https://www.facebook.com/YayasanGambut', linkedin: 'https://www.linkedin.com/company/yayasangambut/', instagram: 'https://www.instagram.com/yayasangambut/', youtube: 'https://www.youtube.com/@YayasanGambut',
};

export const legacyProjects = [
  { year: 2020, title: 'Sustainable Peatland Management in Buffer Village GSK and Support Integrated Peat Farmers in Penampi PHUs Bengkalis Island' },
  { year: 2020, title: 'Peatland Restoration through Agroforestry in Sepahat Village, Bandar Laksamana District, Bengkalis' },
  { year: 2020, title: 'Technical Team Review of ASEAN Peatland Management Strategy' },
  { year: 2021, title: 'Restoration of Degraded Peatlands and Zero Burning Agriculture in Bengkalis District' },
] as const;

export const legacyServices = {
  id: [
    { title: 'Koordinasi', body: 'Membangun koordinasi bersama mitra strategis, termasuk pemerintah nasional, pemerintah daerah, dan pemerintah tingkat desa.' },
    { title: 'Program Hutan dan Pesisir', body: 'Berfokus pada perlindungan dan rehabilitasi hutan dan pesisir melalui kolaborasi dengan masyarakat sekitar hutan, pemerintah, akademisi, dan sektor swasta.' },
    { title: 'Program Pengelolaan Gambut', body: 'Berfokus pada perlindungan dan rehabilitasi kawasan gambut melalui kolaborasi dengan masyarakat sekitar hutan, pemerintah, akademisi, dan sektor swasta.' },
    { title: 'Peningkatan Kapasitas Masyarakat', body: 'Memfasilitasi masyarakat dan kelompok masyarakat dengan ilmu dan pengetahuan untuk mengelola sumber daya alam setempat dengan tetap memperhatikan unsur ekologi.' },
  ],
  en: [
    { title: 'Coordination', body: 'Building coordination with strategic partners, including national, regional, and village governments.' },
    { title: 'Forest and Coastal Program', body: 'Protecting and rehabilitating forests and coasts through collaboration with forest communities, government, academia, and the private sector.' },
    { title: 'Peatland Management Program', body: 'Protecting and rehabilitating peatland areas through collaboration with forest communities, government, academia, and the private sector.' },
    { title: 'Community Capacity Building', body: 'Supporting communities and community groups with knowledge for managing local natural resources while respecting ecological considerations.' },
  ],
} as const;

export const pageContent = {
  id: {
    'tentang-kami': { title: 'Tentang Yayasan Gambut', intro: 'Yayasan Gambut bekerja bersama masyarakat untuk melindungi dan memulihkan gambut, mangrove, hutan, serta bentang alam produktif melalui aksi lapangan, penguatan kapasitas, riset, dan teknologi geospasial.', sections: [
      ['Profil', 'Yayasan Gambut adalah organisasi nirlaba Indonesia yang berdiri pada 2019. Dari kantor pusat di Tangerang Selatan dan kantor operasional di Pekanbaru, kami menjalankan program mangrove dan pesisir, gambut dan ketahanan kebakaran, perhutanan sosial, agroforestri dan penghidupan, serta data, riset, dan GIS dengan fokus utama di Riau.'],
      ['Visi', 'Terwujudnya gambut, mangrove, hutan, dan ekosistem terkait yang sehat serta tangguh melalui pengelolaan sumber daya alam yang berkelanjutan bersama masyarakat.'],
      ['Misi 01', 'Melindungi dan memulihkan gambut, mangrove, hutan, dan lahan basah melalui aksi berbasis tapak serta partisipasi masyarakat.'],
      ['Misi 02', 'Memperkuat kapasitas, kelembagaan, dan penghidupan masyarakat untuk mengelola sumber daya alam secara berkelanjutan.'],
      ['Misi 03', 'Menghasilkan dan membagikan pengetahuan, data lapangan, riset, dan informasi geospasial untuk mendukung keputusan, kemitraan, dan akuntabilitas.'],
      ['Pendekatan', 'Kerja kami dimulai dari kebutuhan di tingkat tapak. Bersama masyarakat dan mitra, kami merancang aksi, menggabungkan pengetahuan lokal dengan riset dan data geospasial, memantau hasil, lalu membagikan pembelajaran untuk memperkuat kerja berikutnya.'],
      ['Legalitas', 'Yayasan Gambut merupakan badan hukum yayasan Indonesia yang didirikan berdasarkan Akta Notaris Nomor 11 tanggal 24 April 2019, dibuat di hadapan Nunik Rudiawati, S.H., M.Kn., dan disahkan melalui Keputusan Menteri Hukum dan Hak Asasi Manusia Republik Indonesia Nomor AHU-0004650.AH.01.04.Tahun 2019.'],
      ['Kemitraan', 'Kami bekerja bersama kelompok masyarakat, pemerintah, perguruan tinggi, organisasi masyarakat sipil, dan sektor swasta. Kemitraan ini menyatukan pengetahuan lokal, keahlian teknis, data, dan sumber daya untuk mendukung pemulihan ekosistem serta penghidupan berkelanjutan.'],
    ]},
    'lokasi-kerja': { title: 'Lokasi Kerja', intro: 'Kerja yang dipublikasikan berakar di Riau—menghubungkan gambut, hutan, pesisir, dan ruang hidup masyarakat.', sections: [
      ['Kabupaten Bengkalis', 'Cerita lapangan mencakup Desa Buruk Bakul, Penampi, Temiang, Sepahat, dan lokasi lain dalam pemulihan mangrove, agroforestri kopi, pertanian tanpa bakar, serta penguatan kelompok.'],
      ['Lanskap Giam Siak Kecil–Bukit Batu', 'Pembelajaran mencakup pengelolaan gambut, paludikultur, pencegahan kebakaran, pemetaan, dan penghidupan berkelanjutan.'],
      ['Kabupaten Rokan Hilir', 'Arsip memuat praktik dan potensi lokal di Panipahan Laut, Labuhan Tangga Hilir, dan wilayah lain, termasuk mangrove, nipah, pertanian gambut, dan sistem peringatan kebakaran.'],
      ['Data spasial', 'Situs resmi menyajikan konteks manusia dan program. Peta, monitoring, analisis, dan dataset rinci tetap dikelola di WebGIS Yayasan Gambut.'],
    ]},
    dampak: { title: 'Dampak', intro: 'Kami menyajikan capaian dari artikel dan laporan resmi sambil menyiapkan indikator lintas program yang dapat diverifikasi.', sections: [
      ['Bukti yang tersedia', 'Arsip publik memuat laporan tahunan, panduan, cerita kegiatan, dokumentasi foto, dan pembelajaran lapangan sejak 2021. Semua dapat ditelusuri melalui halaman Cerita, Publikasi, dan Galeri.'],
      ['Indikator organisasi', 'Angka agregat lintas tahun belum ditampilkan sebagai statistik utama sampai definisi, periode, sumber, dan tanggal pembaruannya diverifikasi.'],
      ['Dari kegiatan ke perubahan', 'Pelaporan membedakan keluaran kegiatan, perubahan praktik, dan dampak bentang alam agar capaian tidak disederhanakan.'],
    ]},
    'hubungi-kami': { title: 'Hubungi Kami', intro: 'Mari membicarakan kolaborasi, riset, publikasi, atau pertanyaan tentang kerja Yayasan Gambut.', sections: [
      ['Kantor Pekanbaru', organisation.pekanbaruOffice], ['Kantor Pusat', organisation.headOffice], ['Email', organisation.email],
      ['Kolaborasi', 'Sertakan nama organisasi, lokasi, tujuan, dan kebutuhan kolaborasi agar tim kami dapat menindaklanjuti dengan tepat.'],
    ]},
  },
  en: {
    about: { title: 'About Yayasan Gambut', intro: 'Yayasan Gambut works with communities to protect and restore peatlands, mangroves, forests, and productive landscapes through field action, capacity strengthening, research, and geospatial technology.', sections: [
      ['Profile', 'Yayasan Gambut is an Indonesian nonprofit established in 2019. From our head office in South Tangerang and operational office in Pekanbaru, we focus primarily on Riau through programs covering mangroves and coasts, peatlands and fire resilience, social forestry, agroforestry and livelihoods, and data, research, and GIS.'],
      ['Vision', 'A future in which peatlands, mangroves, forests, and connected ecosystems are healthy and resilient through sustainable natural resource management undertaken with local communities.'],
      ['Mission 01', 'Protect and restore peatlands, mangroves, forests, and wetlands through site-based action and community participation.'],
      ['Mission 02', 'Strengthen community capacity, institutions, and livelihoods for the sustainable management of natural resources.'],
      ['Mission 03', 'Generate and share knowledge, field data, research, and geospatial information to support decision-making, partnerships, and accountability.'],
      ['Approach', 'Our work starts with site-level needs. Together with communities and partners, we design action, combine local knowledge with research and geospatial data, monitor results, and share lessons to strengthen future work.'],
      ['Legal status', 'Yayasan Gambut is an Indonesian foundation with legal-entity status under Notarial Deed No. 11 dated 24 April 2019, drawn up before Nunik Rudiawati, S.H., M.Kn., and Ministry of Law and Human Rights Decision No. AHU-0004650.AH.01.04.Tahun 2019.'],
      ['Partnerships', 'We work with community groups, government, universities, civil-society organisations, and the private sector. These partnerships bring together local knowledge, technical expertise, data, and resources to support ecosystem recovery and sustainable livelihoods.'],
    ]},
    'where-we-work': { title: 'Where We Work', intro: 'Published work is rooted in Riau—connecting peatlands, forests, coasts, and community living spaces.', sections: [
      ['Bengkalis Regency', 'Field stories include Buruk Bakul, Penampi, Temiang, Sepahat, and other villages working on mangrove restoration, coffee agroforestry, zero-burning agriculture, and community capacity.'],
      ['Giam Siak Kecil–Bukit Batu landscape', 'Published learning covers peatland management, paludiculture, fire prevention, mapping, and sustainable livelihoods.'],
      ['Rokan Hilir Regency', 'The archive includes local practice and potential in Panipahan Laut, Labuhan Tangga Hilir, and surrounding areas, including mangroves, nipa palm, peatland farming, and fire-warning systems.'],
      ['Spatial data', 'The official website provides the human and program context. Detailed maps, monitoring, analysis, and datasets remain in Yayasan Gambut WebGIS.'],
    ]},
    impact: { title: 'Impact', intro: 'We present evidence from official articles and reports while preparing verifiable indicators across programs.', sections: [
      ['Available evidence', 'The public archive contains annual reports, guides, activity stories, photo documentation, and field learning since 2021. These are available through Stories, Publications, and Gallery.'],
      ['Organisation-wide indicators', 'Cross-year aggregate figures are not shown as headline statistics until their definition, period, source, and update date have been verified.'],
      ['From activities to change', 'Reporting distinguishes activity outputs, changes in practice, and landscape impact so achievements are not oversimplified.'],
    ]},
    contact: { title: 'Contact Us', intro: 'Let’s discuss collaboration, research, publications, or questions about Yayasan Gambut’s work.', sections: [
      ['Pekanbaru Office', organisation.pekanbaruOffice], ['Head Office', organisation.headOffice], ['Email', organisation.email],
      ['Collaboration', 'Please include your organisation, location, purpose, and collaboration needs so our team can follow up appropriately.'],
    ]},
  },
} as const;
