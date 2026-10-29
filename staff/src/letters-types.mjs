// Internal letter codes; existing codes retain their meaning and numbering format.
export const letterTypes=Object.freeze([
 {code:'SPT',label:'Surat Tugas'},
 {code:'SKR',label:'Surat Keterangan'},
 {code:'UND',label:'Undangan'},
 {code:'SK',label:'Surat Keputusan'},
 {code:'PMH',label:'Surat Permohonan'},
 {code:'PBT',label:'Surat Pemberitahuan'},
 {code:'PNG',label:'Surat Pengantar'},
 {code:'KUA',label:'Surat Kuasa'},
 {code:'REK',label:'Surat Rekomendasi'},
 {code:'PNY',label:'Surat Pernyataan'},
 {code:'PKS',label:'Perjanjian Kerja Sama'},
 {code:'BAST',label:'Berita Acara Serah Terima'},
 {code:'UM',label:'Surat Umum'}
]);
export const isLetterKind=code=>letterTypes.some(type=>type.code===code);
