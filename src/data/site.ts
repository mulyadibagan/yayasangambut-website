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
  '/id/hubungi-kami/': '/en/contact/', '/en/contact/': '/id/hubungi-kami/',
  '/id/privacy/': '/en/privacy/', '/en/privacy/': '/id/privacy/',
  '/id/program/agroforestri-penghidupan/': '/en/programs/agroforestry-livelihoods/', '/en/programs/agroforestry-livelihoods/': '/id/program/agroforestri-penghidupan/',
  '/id/program/data-riset-gis/': '/en/programs/data-research-gis/', '/en/programs/data-research-gis/': '/id/program/data-riset-gis/',
  '/id/program/gambut-ketahanan-kebakaran/': '/en/programs/peatlands-fire-resilience/', '/en/programs/peatlands-fire-resilience/': '/id/program/gambut-ketahanan-kebakaran/',
  '/id/program/mangrove-pesisir/': '/en/programs/mangroves-coasts/', '/en/programs/mangroves-coasts/': '/id/program/mangrove-pesisir/',
  '/id/program/perhutanan-sosial/': '/en/programs/social-forestry/', '/en/programs/social-forestry/': '/id/program/perhutanan-sosial/',
};

export const copy = {
  id: {
    nav: ['Tentang Kami', 'Program', 'Lokasi Kerja', 'Dampak', 'Cerita Lapangan', 'Publikasi'],
    heroKicker: 'Pengelolaan sumber daya alam berbasis kemitraan', heroTitle: 'Bersama masyarakat menjaga gambut, hutan, dan pesisir Indonesia.',
    heroText: 'Yayasan Gambut mendukung pengelolaan sumber daya alam lahan basah dan ekosistem lainnya melalui kemitraan strategis dengan masyarakat, pemerintah, akademisi, dan sektor swasta.',
    seePrograms: 'Lihat Program', exploreWebgis: 'Jelajahi WebGIS', impactEyebrow: 'Arsip yang dapat ditelusuri', impactTitle: 'Pengetahuan lapangan, terbuka untuk dipelajari.',
    programEyebrow: 'Program utama', programTitle: 'Satu bentang alam, lima jalur kerja yang saling terhubung.', locationEyebrow: 'Lokasi kerja', locationTitle: 'Berakar di Riau, belajar dari setiap tapak.',
    locationText: 'Kerja yang dipublikasikan mencakup ekosistem gambut, hutan, dan pesisir di sejumlah desa di Riau. Data spasial lengkap tetap tersedia melalui WebGIS.',
    storyEyebrow: 'Cerita terbaru', storyTitle: 'Suara, praktik, dan pembelajaran dari lapangan.', publicationEyebrow: 'Publikasi terbaru', publicationTitle: 'Pengetahuan untuk dipakai bersama.',
    dataTitle: 'Memetakan aksi. Merekam perubahan.', dataText: 'WebGIS Yayasan Gambut adalah ruang khusus untuk data spasial, monitoring, dashboard, dan analisis. Situs ini menautkan ke sana tanpa memuat aplikasi GIS penuh.',
    partners: 'Bekerja melalui kemitraan', partnersText: 'Kolaborasi dibangun bersama komunitas, pemerintah, akademisi, organisasi masyarakat sipil, dan mitra pembangunan.',
    temporary: 'SNAPSHOT ARSIP PUBLIK', latest: 'Lihat semua', read: 'Baca cerita', view: 'Lihat publikasi',
  },
  en: {
    nav: ['About', 'Programs', 'Where We Work', 'Impact', 'Field Stories', 'Publications'],
    heroKicker: 'Partnership-based natural resource management', heroTitle: 'Working with communities to protect Indonesia’s peatlands, forests, and coasts.',
    heroText: 'Yayasan Gambut supports the sustainable management of wetlands and other ecosystems through strategic partnerships with communities, government, academia, and the private sector.',
    seePrograms: 'See our programs', exploreWebgis: 'Explore WebGIS', impactEyebrow: 'Traceable archive', impactTitle: 'Field knowledge, open for learning.',
    programEyebrow: 'Core programs', programTitle: 'One landscape, five connected ways of working.', locationEyebrow: 'Where we work', locationTitle: 'Rooted in Riau, learning from every site.',
    locationText: 'Published work spans peatland, forest, and coastal ecosystems across villages in Riau. Complete spatial data remains available through WebGIS.',
    storyEyebrow: 'Latest stories', storyTitle: 'Voices, practice, and lessons from the field.', publicationEyebrow: 'Latest publications', publicationTitle: 'Knowledge made to be shared.',
    dataTitle: 'Mapping action. Recording change.', dataText: 'Yayasan Gambut WebGIS is the dedicated space for spatial data, monitoring, dashboards, and analysis. This website links there without embedding the full GIS application.',
    partners: 'Working through partnership', partnersText: 'Collaboration brings together communities, government, academia, civil society, and development partners.',
    temporary: 'PUBLIC ARCHIVE SNAPSHOT', latest: 'View all', read: 'Read story', view: 'View publication',
  },
} as const;

export const organisation = {
  email: 'official@yayasangambut.org',
  headOffice: 'Taman Puri Bintaro PB.11 Nomor 16, Bintaro Sektor 9, RT 002 RW 009, Kelurahan Sawah Baru, Kecamatan Ciputat, Kota Tangerang Selatan 15413',
  pekanbaruOffice: 'Jalan Gulama No. 8 RT 01 RW 09, Kelurahan Tangkerang Barat, Kecamatan Marpoyan Damai, Kota Pekanbaru 28282',
  facebook: 'https://www.facebook.com/YayasanGambut', linkedin: 'https://www.linkedin.com/company/yayasangambut/', instagram: 'https://www.instagram.com/yayasangambut/', youtube: 'https://www.youtube.com/@YayasanGambut',
};

export const legacyProjects = [
  { year: 2020, id: 'Pengelolaan gambut berkelanjutan di desa penyangga GSK dan dukungan bagi petani gambut terpadu di KHG Pulau Bengkalis', en: 'Sustainable Peatland Management in Buffer Village GSK and Support Integrated Peat Farmers in Penampi PHUs Bengkalis Island' },
  { year: 2020, id: 'Restorasi lahan gambut melalui agroforestri di Desa Sepahat, Kecamatan Bandar Laksamana, Bengkalis', en: 'Peatland Restoration through Agroforestry in Sepahat Village, Bandar Laksamana District, Bengkalis' },
  { year: 2020, id: 'Tim teknis kajian Strategi Pengelolaan Gambut ASEAN', en: 'Technical Team Review of ASEAN Peatland Management Strategy' },
  { year: 2021, id: 'Restorasi lahan gambut terdegradasi dan pertanian tanpa bakar di Kabupaten Bengkalis', en: 'Restoration of Degraded Peatlands and Zero Burning Agriculture in Bengkalis District' },
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
    'tentang-kami': { title: 'Tentang Yayasan Gambut', intro: 'Kami adalah orang-orang yang peduli pada keberlanjutan pengelolaan sumber daya alam.', sections: [
      ['Profil', 'Yayasan Gambut mendukung pengelolaan sumber daya alam lahan basah dan ekosistem lain secara berkelanjutan melalui kemitraan strategis dengan para pemangku kepentingan dan masyarakat lokal.'],
      ['Visi', 'Mendukung pengelolaan sumber daya alam lahan basah dan ekosistem lain yang berkelanjutan melalui kemitraan strategis dengan berbagai pemangku kepentingan dan masyarakat lokal.'],
      ['Misi 01', 'Mempromosikan pengelolaan terpadu keanekaragaman hayati dan sumber daya air alam dengan fokus pada keterlibatan masyarakat dan konservasi keanekaragaman hayati.'],
      ['Misi 02', 'Mempromosikan perlindungan dan pemanfaatan berkelanjutan ekosistem, termasuk hutan dan lahan basah, dengan fokus pada pengelolaan terpadu untuk keanekaragaman hayati dan perubahan iklim.'],
      ['Misi 03', 'Meningkatkan kesadaran, pemahaman, kapasitas, dan kemitraan antara berbagai organisasi dan sektor untuk mengatasi masalah lingkungan.'],
      ['Pendekatan', 'Transformasi pengetahuan melalui program berkelanjutan; pengembangan panduan pencegahan kerusakan dan kebakaran lahan; analisis dampak perubahan iklim; serta penerapan teknologi dan informasi di tingkat tapak.'],
      ['Legalitas', 'Akta Notaris Nomor 11 tanggal 24 April 2019 oleh Notaris Nunik Rudiawati, S.H., M.Kn., dengan Keputusan Menteri Hukum dan Hak Asasi Manusia Republik Indonesia Nomor AHU-0004650.AH.01.04.Tahun 2019 tentang pengesahan pendirian badan hukum Yayasan Gambut.'],
      ['Kemitraan', 'Kami berkolaborasi dengan masyarakat di sekitar hutan, pemerintah, akademisi, dan sektor swasta untuk menghubungkan upaya restorasi kawasan terdegradasi di wilayah hutan dan hutan rawa gambut.'],
    ]},
    'lokasi-kerja': { title: 'Lokasi Kerja', intro: 'Kerja yang dipublikasikan berakar di Riau—menghubungkan gambut, hutan, pesisir, dan ruang hidup masyarakat.', sections: [
      ['Kabupaten Bengkalis', 'Cerita lapangan mencakup Desa Buruk Bakul, Penampi, Temiang, Sepahat, dan lokasi lain dalam pemulihan mangrove, agroforestri kopi, pertanian tanpa bakar, serta penguatan kelompok.'],
      ['Lanskap Giam Siak Kecil–Bukit Batu', 'Pembelajaran mencakup pengelolaan gambut, paludikultur, pencegahan kebakaran, pemetaan, dan penghidupan berkelanjutan.'],
      ['Kabupaten Rokan Hilir', 'Arsip memuat praktik dan potensi lokal di Panipahan Laut, Labuhan Tangga Hilir, dan wilayah lain, termasuk mangrove, nipah, pertanian gambut, dan sistem peringatan kebakaran.'],
      ['Data spasial', 'Situs resmi menyajikan konteks manusia dan program. Peta, monitoring, analisis, dan dataset rinci tetap dikelola di WebGIS Yayasan Gambut.'],
    ]},
    dampak: { title: 'Dampak', intro: 'Kami menyajikan capaian dari artikel dan laporan resmi sambil menyiapkan indikator lintas program yang dapat diverifikasi.', sections: [
      ['Bukti yang tersedia', 'Arsip publik memuat laporan tahunan, panduan, cerita kegiatan, dokumentasi foto, dan pembelajaran lapangan sejak 2020. Semua dapat ditelusuri melalui halaman Cerita, Publikasi, dan Galeri.'],
      ['Indikator organisasi', 'Angka agregat lintas tahun belum ditampilkan sebagai statistik utama sampai definisi, periode, sumber, dan tanggal pembaruannya diverifikasi.'],
      ['Dari kegiatan ke perubahan', 'Pelaporan membedakan keluaran kegiatan, perubahan praktik, dan dampak bentang alam agar capaian tidak disederhanakan.'],
    ]},
    'hubungi-kami': { title: 'Hubungi Kami', intro: 'Mari membicarakan kolaborasi, riset, publikasi, atau pertanyaan tentang kerja Yayasan Gambut.', sections: [
      ['Kantor Pekanbaru', organisation.pekanbaruOffice], ['Kantor Pusat', organisation.headOffice], ['Email', organisation.email],
      ['Kolaborasi', 'Sertakan nama organisasi, lokasi, tujuan, dan kebutuhan kolaborasi agar tim kami dapat menindaklanjuti dengan tepat.'],
    ]},
  },
  en: {
    about: { title: 'About Yayasan Gambut', intro: 'We are people who care about the sustainable management of natural resources.', sections: [
      ['Profile', 'Yayasan Gambut supports the sustainable management of wetlands and other ecosystems through strategic partnerships with stakeholders and local communities.'],
      ['Vision', 'To support the sustainable management of wetlands and other ecosystems through strategic partnerships with stakeholders and local communities.'],
      ['Mission 01', 'Promote integrated management of biodiversity and natural water resources, with an emphasis on community participation and biodiversity conservation.'],
      ['Mission 02', 'Promote the protection and sustainable use of ecosystems, including forests and wetlands, through integrated management for biodiversity and climate change.'],
      ['Mission 03', 'Build awareness, understanding, capacity, and partnerships across organisations and sectors to address environmental challenges.'],
      ['Approach', 'Transforming knowledge through sustainable programs; developing guidance to prevent land damage and fire; analysing climate impacts; and applying technology and information at site level.'],
      ['Legal status', 'Notarial Deed No. 11 dated 24 April 2019, prepared by Notary Nunik Rudiawati, S.H., M.Kn., and Ministry of Law and Human Rights Decision No. AHU-0004650.AH.01.04.Tahun 2019 approving the establishment of Yayasan Gambut as a legal entity.'],
      ['Partnerships', 'We collaborate with forest communities, government, academia, and the private sector to connect restoration efforts across degraded forest and peat-swamp forest areas.'],
    ]},
    'where-we-work': { title: 'Where We Work', intro: 'Published work is rooted in Riau—connecting peatlands, forests, coasts, and community living spaces.', sections: [
      ['Bengkalis Regency', 'Field stories include Buruk Bakul, Penampi, Temiang, Sepahat, and other villages working on mangrove restoration, coffee agroforestry, zero-burning agriculture, and community capacity.'],
      ['Giam Siak Kecil–Bukit Batu landscape', 'Published learning covers peatland management, paludiculture, fire prevention, mapping, and sustainable livelihoods.'],
      ['Rokan Hilir Regency', 'The archive includes local practice and potential in Panipahan Laut, Labuhan Tangga Hilir, and surrounding areas, including mangroves, nipa palm, peatland farming, and fire-warning systems.'],
      ['Spatial data', 'The official website provides the human and program context. Detailed maps, monitoring, analysis, and datasets remain in Yayasan Gambut WebGIS.'],
    ]},
    impact: { title: 'Impact', intro: 'We present evidence from official articles and reports while preparing verifiable indicators across programs.', sections: [
      ['Available evidence', 'The public archive contains annual reports, guides, activity stories, photo documentation, and field learning since 2020. These are available through Stories, Publications, and Gallery.'],
      ['Organisation-wide indicators', 'Cross-year aggregate figures are not shown as headline statistics until their definition, period, source, and update date have been verified.'],
      ['From activities to change', 'Reporting distinguishes activity outputs, changes in practice, and landscape impact so achievements are not oversimplified.'],
    ]},
    contact: { title: 'Contact Us', intro: 'Let’s discuss collaboration, research, publications, or questions about Yayasan Gambut’s work.', sections: [
      ['Pekanbaru Office', organisation.pekanbaruOffice], ['Head Office', organisation.headOffice], ['Email', organisation.email],
      ['Collaboration', 'Please include your organisation, location, purpose, and collaboration needs so our team can follow up appropriately.'],
    ]},
  },
} as const;
