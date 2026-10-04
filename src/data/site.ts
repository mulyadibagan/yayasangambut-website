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
  '/id/mitra/': '/en/partners/', '/en/partners/': '/id/mitra/',
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
    seePrograms: 'Jelajahi Program', exploreWebgis: 'Buka YG GeoPortal', impactEyebrow: 'Dampak berbasis bukti', impactTitle: 'Aksi lapangan yang dapat ditelusuri.',
    programEyebrow: 'Program utama', programTitle: 'Satu bentang alam, lima jalur kerja yang saling terhubung.', locationEyebrow: 'Lokasi kerja', locationTitle: 'Berakar di Riau, belajar dari setiap tapak.',
    locationText: 'Kerja yang dipublikasikan mencakup ekosistem gambut, hutan, dan pesisir di sejumlah desa di Riau. Data spasial lengkap tetap tersedia melalui YG GeoPortal.',
    storyEyebrow: 'Cerita terbaru', storyTitle: 'Suara, praktik, dan pembelajaran dari lapangan.', publicationEyebrow: 'Publikasi terbaru', publicationTitle: 'Pengetahuan untuk dipakai bersama.',
    dataTitle: 'Memetakan aksi. Merekam perubahan.', dataText: 'YG GeoPortal adalah ruang khusus untuk data spasial, pemantauan, dasbor, dan analisis. Situs ini menautkan ke sana tanpa memuat aplikasi GIS penuh.',
    partners: 'Bekerja melalui kemitraan', partnersText: 'Kolaborasi dibangun bersama komunitas, pemerintah, akademisi, organisasi masyarakat sipil, dan mitra pembangunan.',
    temporary: 'DATA PUBLIK · 28 SEP 2026', latest: 'Lihat semua', read: 'Baca cerita', view: 'Lihat publikasi',
  },
  en: {
    nav: ['About', 'Programs', 'Where We Work', 'Impact', 'Field Stories', 'Publications'],
    heroKicker: 'Partnership-based natural resource management', heroTitle: 'Working with communities to protect Indonesia’s peatlands, forests, and coasts.',
    heroText: 'Yayasan Gambut supports the sustainable management of wetlands and other ecosystems through strategic partnerships with communities, government, academia, and the private sector.',
    seePrograms: 'Explore programs', exploreWebgis: 'Open YG GeoPortal', impactEyebrow: 'Evidence-led impact', impactTitle: 'Field action you can trace.',
    programEyebrow: 'Core programs', programTitle: 'One landscape, five connected ways of working.', locationEyebrow: 'Where we work', locationTitle: 'Rooted in Riau, learning from every site.',
    locationText: 'Published work spans peatland, forest, and coastal ecosystems across villages in Riau. Complete spatial data remains available through the YG GeoPortal.',
    storyEyebrow: 'Latest stories', storyTitle: 'Voices, practice, and lessons from the field.', publicationEyebrow: 'Latest publications', publicationTitle: 'Knowledge made to be shared.',
    dataTitle: 'Mapping action. Recording change.', dataText: 'The YG GeoPortal is the dedicated space for spatial data, monitoring, dashboards, and analysis. This website links there without embedding the full GIS application.',
    partners: 'Working through partnership', partnersText: 'Collaboration brings together communities, government, academia, civil society, and development partners.',
    temporary: 'PUBLIC DATA · 28 SEP 2026', latest: 'View all', read: 'Read story', view: 'View publication',
  },
} as const;

export const organisation = {
  email: 'official@yayasangambut.org',
  foundingAddress: 'Taman Puri Bintaro PB.11 Nomor 16, Bintaro Sektor 9, RT 002 RW 009, Kelurahan Sawah Baru, Kecamatan Ciputat, Kota Tangerang Selatan 15413',
  headOffice: 'Jalan Gulama No. 8, RT 01/RW 09, Kelurahan Tangkerang Barat, Kecamatan Marpoyan Damai, Kota Pekanbaru, Riau 28282',
  pekanbaruOffice: 'Jalan Gulama No. 8 RT 01 RW 09, Kelurahan Tangkerang Barat, Kecamatan Marpoyan Damai, Kota Pekanbaru 28282',
  facebook: 'https://www.facebook.com/YayasanGambut', linkedin: 'https://www.linkedin.com/company/yayasangambut/', instagram: 'https://www.instagram.com/yayasangambut/', youtube: 'https://www.youtube.com/@YayasanGambut',
};

export const impactSnapshot = {
  reviewedAt: '28 September 2026',
  sourceGeneratedAt: '28 September 2026, 10.44 WIB',
  id: [
    { value: '173', label: 'objek program terpetakan', note: 'Objek dalam snapshot basis data publik YG GeoPortal.', href: 'https://webgisyg.id/webgis.html' },
    { value: '77', label: 'laporan lapangan terpublikasi', note: 'Laporan kegiatan dan pemantauan yang tersedia dalam snapshot publik.', href: 'https://webgisyg.id/monitoring.html' },
    { value: '40', label: 'taksa atau jenis terdokumentasi', note: 'Baseline biodiversitas mangrove: 29 flora dan 11 fauna atau biota.', href: 'https://webgisyg.id/biodiversity.html' },
  ],
  en: [
    { value: '173', label: 'mapped program objects', note: 'Objects in the YG GeoPortal public database snapshot.', href: 'https://webgisyg.id/webgis.html' },
    { value: '77', label: 'published field reports', note: 'Activity and monitoring reports available in the public snapshot.', href: 'https://webgisyg.id/monitoring.html' },
    { value: '40', label: 'documented taxa or species', note: 'Mangrove biodiversity baseline: 29 flora and 11 fauna or biota.', href: 'https://webgisyg.id/biodiversity.html' },
  ],
} as const;

export const legacyProjects = [
  { year: 2020, id: 'Pengelolaan gambut berkelanjutan di desa penyangga Giam Siak Kecil dan dukungan bagi petani gambut terpadu di KHG Pulau Bengkalis', en: 'Sustainable peatland management in Giam Siak Kecil buffer villages and support for integrated peatland farming in the Bengkalis Island Peat Hydrological Unit' },
  { year: 2020, id: 'Restorasi lahan gambut melalui agroforestri di Desa Sepahat, Kecamatan Bandar Laksamana, Kabupaten Bengkalis', en: 'Peatland restoration through agroforestry in Sepahat Village, Bandar Laksamana District, Bengkalis Regency' },
  { year: 2020, id: 'Tim teknis kajian Strategi Pengelolaan Gambut ASEAN', en: 'Technical review team for the ASEAN Peatland Management Strategy' },
  { year: 2021, id: 'Restorasi lahan gambut terdegradasi dan pertanian tanpa bakar di Kabupaten Bengkalis', en: 'Restoration of degraded peatlands and zero-burning agriculture in Bengkalis Regency' },
] as const;

export const programApproaches = {
  id: [
    { title: 'Berbasis masyarakat', body: 'Program dirancang dan dijalankan bersama kelompok masyarakat dan pengelola setempat agar menjawab kebutuhan, hak, dan kondisi di tingkat tapak.' },
    { title: 'Sesuai kondisi tapak', body: 'Setiap tindakan mempertimbangkan kondisi ekologis, sosial, tata kelola, risiko, dan penghidupan pada masing-masing lokasi.' },
    { title: 'Berbasis data dan pembelajaran', body: 'Data lapangan, riset, dan informasi geospasial digunakan untuk merencanakan tindakan, memantau hasil, dan memperbaiki pendekatan.' },
    { title: 'Kolaboratif dan akuntabel', body: 'Kami bekerja bersama pemerintah, perguruan tinggi, organisasi masyarakat sipil, dan sektor swasta dengan pembagian peran dan informasi yang jelas.' },
  ],
  en: [
    { title: 'Community-based', body: 'Programs are designed and implemented with community groups and local managers so that they respond to local needs, rights, and site conditions.' },
    { title: 'Site-specific', body: 'Each action considers the ecological, social, governance, risk, and livelihood context of the location.' },
    { title: 'Informed by evidence and learning', body: 'Field data, research, and geospatial information guide planning, results monitoring, and continuous improvement.' },
    { title: 'Collaborative and accountable', body: 'We work with government, universities, civil-society organisations, and the private sector, with clear roles and appropriate information sharing.' },
  ],
} as const;

export const pageContent = {
  id: {
    'tentang-kami': { title: 'Tentang Yayasan Gambut', intro: 'Yayasan Gambut bekerja bersama masyarakat untuk melindungi dan memulihkan gambut, mangrove, hutan, serta bentang alam produktif melalui aksi lapangan, penguatan kapasitas, riset, dan teknologi geospasial.', sections: [
      ['Profil', 'Yayasan Gambut adalah organisasi nirlaba Indonesia yang didirikan pada 24 April 2019 dan berkedudukan di Kota Tangerang Selatan. Dari kantor pusat di Pekanbaru, kami menjalankan program mangrove dan pesisir, gambut dan ketahanan kebakaran, perhutanan sosial, agroforestri dan penghidupan, serta data, riset, dan GIS dengan fokus utama di Riau.'],
      ['Visi', 'Mendukung Pengelolaan Sumber Daya Alam Lahan Basah dan Ekosistem Lain yang Berkelanjutan melalui kemitraan strategis dengan berbagai stakeholder dan masyarakat lokal.'],
      ['Misi 01', 'Mempromosikan pengelolaan terpadu keanekaragaman hayati dan sumber daya air alam dengan fokus pada keterlibatan masyarakat dan konservasi keanekaragaman hayati;'],
      ['Misi 02', 'Mempromosikan perlindungan dan pemanfaatan berkelanjutan dari ekosistem termasuk hutan dan lahan basah dengan fokus pada manajemen terpadu untuk keanekaragaman hayati dan perubahan iklim; dan'],
      ['Misi 03', 'Meningkatkan kesadaran, pemahaman dan kapasitas serta kemitraan antara berbagai organisasi dan sektor untuk mengatasi masalah lingkungan.'],
      ['Pendekatan', 'Kerja kami dimulai dari kebutuhan di tingkat tapak. Bersama masyarakat dan mitra, kami merancang aksi, menggabungkan pengetahuan lokal dengan riset dan data geospasial, memantau hasil, lalu membagikan pembelajaran untuk memperkuat kerja berikutnya.'],
      ['Legalitas', 'Yayasan Gambut merupakan badan hukum yayasan Indonesia yang didirikan berdasarkan Akta Notaris Nomor 11 tanggal 24 April 2019, dibuat di hadapan Nunik Rudiawati, S.H., M.Kn., dan disahkan melalui Keputusan Menteri Hukum dan Hak Asasi Manusia Republik Indonesia Nomor AHU-0006450.AH.01.04.Tahun 2019 tanggal 25 April 2019.'],
      ['Kemitraan', 'Kami bekerja bersama kelompok masyarakat, pemerintah, perguruan tinggi, organisasi masyarakat sipil, dan sektor swasta. Kemitraan ini menyatukan pengetahuan lokal, keahlian teknis, data, dan sumber daya untuk mendukung pemulihan ekosistem serta penghidupan berkelanjutan.'],
    ]},
    'lokasi-kerja': { title: 'Lokasi Kerja', intro: 'Kerja Yayasan Gambut berfokus di Provinsi Riau, dari pesisir dan mangrove hingga gambut, perhutanan sosial, agroforestri, dan penghidupan masyarakat.', sections: [
      ['Kabupaten Bengkalis', 'Buruk Bakul, Kelapa Pati, Sepahat, Temiang, dan Penampi menghubungkan pemulihan mangrove, perlindungan pesisir, pengelolaan gambut, ketahanan kebakaran, serta agroforestri berbasis masyarakat.'],
      ['Kabupaten Siak', 'Tanjung Kuras dan Dayun menjadi lokasi kerja untuk mangrove dan pesisir, pemulihan gambut, perhutanan sosial, agroforestri, penguatan kelompok, dan pemantauan berbasis data.'],
      ['Kabupaten Rokan Hilir', 'Kerja dan pembelajaran yang dipublikasikan mencakup Siarang Arang, Teluk Piyai Pesisir, Panipahan Laut, serta Labuhan Tangga, dengan perhatian pada mangrove, gambut, ketahanan kebakaran, dan penghidupan lokal.'],
      ['Kabupaten Kampar', 'Hutan Adat Ghimbo Pomuan menjadi salah satu lokasi penanaman kopi agroforestri, yang menghubungkan pemulihan ekosistem, penguatan kelembagaan lokal, dan penghidupan.'],
      ['Cakupan yang terus diperbarui', 'Daftar ini menampilkan lokasi terpilih yang telah dipublikasikan, bukan seluruh jangkauan kerja Yayasan Gambut. Peta, objek program, pemantauan, dan informasi spasial terbaru tersedia melalui YG GeoPortal.'],
    ]},
    dampak: { title: 'Dampak', intro: 'Kami membuka bukti yang dapat ditelusuri—dari objek program dan laporan lapangan hingga perubahan ekosistem yang dipantau dari waktu ke waktu.', sections: [
      ['Keluaran terverifikasi', 'Penanaman, pelatihan, infrastruktur restorasi, dan objek program dicatat bersama lokasi, waktu, serta dokumentasi yang tersedia. Angka pada halaman ini adalah snapshot bukti publik, bukan akumulasi seluruh kerja Yayasan Gambut.'],
      ['Perubahan yang dipantau', 'Laporan lapangan dan pemantauan berkala membantu menilai perkembangan vegetasi, kondisi hidrologi, risiko kebakaran, pesisir, serta praktik pengelolaan masyarakat.'],
      ['Dampak bentang alam', 'Pemulihan ekosistem dan penghidupan yang tangguh memerlukan waktu. Karena itu, kami membedakan keluaran kegiatan, perubahan jangka menengah, dan dampak ekologis jangka panjang.'],
      ['Batas penggunaan data', 'Cakupan dan frekuensi pembaruan berbeda menurut program. Setiap angka harus dibaca bersama definisi, periode, lokasi, dan sumbernya; data model atau analisis satelit tetap memerlukan verifikasi lapangan.'],
    ]},
    'hubungi-kami': { title: 'Hubungi Kami', intro: 'Mari membicarakan kolaborasi, riset, publikasi, atau pertanyaan tentang kerja Yayasan Gambut.', sections: [
      ['Kantor Pusat — Pekanbaru', organisation.headOffice], ['Email', organisation.email],
      ['Kolaborasi', 'Sertakan nama organisasi, lokasi, tujuan, dan kebutuhan kolaborasi agar tim kami dapat menindaklanjuti dengan tepat.'],
    ]},
  },
  en: {
    about: { title: 'About Yayasan Gambut', intro: 'Yayasan Gambut works with communities to protect and restore peatlands, mangroves, forests, and productive landscapes through field action, capacity strengthening, research, and geospatial technology.', sections: [
      ['Profile', 'Yayasan Gambut is an Indonesian nonprofit established on 24 April 2019 and domiciled in South Tangerang. From our head office in Pekanbaru, we focus primarily on Riau through programs covering mangroves and coasts, peatlands and fire resilience, social forestry, agroforestry and livelihoods, and data, research, and GIS.'],
      ['Vision', 'To support the sustainable management of natural resources in wetlands and other ecosystems through strategic partnerships with diverse stakeholders and local communities.'],
      ['Mission 01', 'To promote the integrated management of biodiversity and natural water resources, with a focus on community involvement and biodiversity conservation;'],
      ['Mission 02', 'To promote the protection and sustainable use of ecosystems, including forests and wetlands, with a focus on integrated management for biodiversity and climate change; and'],
      ['Mission 03', 'To enhance awareness, understanding and capacity, as well as partnerships among diverse organisations and sectors, to address environmental issues.'],
      ['Approach', 'Our work starts with site-level needs. Together with communities and partners, we design action, combine local knowledge with research and geospatial data, monitor results, and share lessons to strengthen future work.'],
      ['Legal status', 'Yayasan Gambut is an Indonesian foundation with legal-entity status under Notarial Deed No. 11 dated 24 April 2019, drawn up before Nunik Rudiawati, S.H., M.Kn., and Ministry of Law and Human Rights Decision No. AHU-0006450.AH.01.04.Tahun 2019 dated 25 April 2019.'],
      ['Partnerships', 'We work with community groups, government, universities, civil-society organisations, and the private sector. These partnerships bring together local knowledge, technical expertise, data, and resources to support ecosystem recovery and sustainable livelihoods.'],
    ]},
    'where-we-work': { title: 'Where We Work', intro: 'Yayasan Gambut focuses its work in Riau Province, from coasts and mangroves to peatlands, social forestry, agroforestry, and community livelihoods.', sections: [
      ['Bengkalis Regency', 'Buruk Bakul, Kelapa Pati, Sepahat, Temiang, and Penampi connect community-based mangrove recovery, coastal protection, peatland management, fire resilience, and agroforestry.'],
      ['Siak Regency', 'Tanjung Kuras and Dayun are locations for work on mangroves and coasts, peatland recovery, social forestry, agroforestry, group strengthening, and evidence-based monitoring.'],
      ['Rokan Hilir Regency', 'Published work and learning include Siarang Arang, Teluk Piyai Pesisir, Panipahan Laut, and Labuhan Tangga, with attention to mangroves, peatlands, fire resilience, and local livelihoods.'],
      ['Kampar Regency', 'Ghimbo Pomuan Customary Forest is one location for coffee agroforestry planting that connects ecosystem recovery, stronger local institutions, and livelihoods.'],
      ['An evolving footprint', 'This is a selection of published locations, not the full extent of Yayasan Gambut’s work. Current program objects, monitoring, maps, and spatial information are available through the YG GeoPortal.'],
    ]},
    impact: { title: 'Impact', intro: 'We make evidence traceable—from program objects and field reports to ecosystem change monitored over time.', sections: [
      ['Verified outputs', 'Planting, training, restoration infrastructure, and program objects are recorded with the available location, date, and documentation. Figures on this page are a snapshot of public evidence, not a cumulative total of all Yayasan Gambut work.'],
      ['Change monitored over time', 'Field reports and periodic monitoring help assess vegetation, hydrology, fire risk, coastal conditions, and community management practices.'],
      ['Landscape impact', 'Ecosystem recovery and resilient livelihoods take time. We therefore distinguish activity outputs, medium-term change, and long-term ecological impact.'],
      ['Data-use limits', 'Coverage and update frequency vary by program. Each figure should be read with its definition, period, location, and source; modelled or satellite-derived analysis still requires field verification.'],
    ]},
    contact: { title: 'Contact Us', intro: 'Let’s discuss collaboration, research, publications, or questions about Yayasan Gambut’s work.', sections: [
      ['Head Office — Pekanbaru', organisation.headOffice], ['Email', organisation.email],
      ['Collaboration', 'Please include your organisation, location, purpose, and collaboration needs so our team can follow up appropriately.'],
    ]},
  },
} as const;
