// Verified against Kemenko PMK's published SKB lists. Update explicitly each year.
export const holidaySources={
 '2026':'https://www2.kemenkopmk.go.id/pemerintah-tetapkan-17-hari-libur-nasional-dan-8-hari-cuti-bersama-tahun-2026',
 '2027':'https://www.kemenkopmk.go.id/node/6444'
};
const schedules={
 '2026':[
 ['01-01','Tahun Baru 2026 Masehi'],['01-16','Isra Mikraj Nabi Muhammad SAW'],['02-17','Tahun Baru Imlek 2577 Kongzili'],['03-19','Hari Suci Nyepi (Tahun Baru Saka 1948)'],['03-21','Idul Fitri 1447 H'],['03-22','Idul Fitri 1447 H'],['04-03','Wafat Yesus Kristus'],['04-05','Kebangkitan Yesus Kristus (Paskah)'],['05-01','Hari Buruh Internasional'],['05-14','Kenaikan Yesus Kristus'],['05-27','Idul Adha 1447 H'],['05-31','Hari Raya Waisak 2570 BE'],['06-01','Hari Lahir Pancasila'],['06-16','Tahun Baru Islam 1448 H'],['08-17','Proklamasi Kemerdekaan'],['08-25','Maulid Nabi Muhammad SAW'],['12-25','Kelahiran Yesus Kristus']
 ],
 '2027':[
 ['01-01','Tahun Baru 2027 Masehi'],['01-05','Isra Mikraj Nabi Muhammad SAW 1448 H'],['02-06','Tahun Baru Imlek 2578 Kongzili'],['03-08','Hari Suci Nyepi (Tahun Baru Saka 1949)'],['03-10','Idul Fitri 1448 H'],['03-11','Idul Fitri 1448 H'],['03-26','Wafat Yesus Kristus'],['03-28','Kebangkitan Yesus Kristus (Paskah)'],['05-01','Hari Buruh Internasional'],['05-06','Kenaikan Yesus Kristus'],['05-17','Idul Adha 1448 H'],['05-20','Hari Raya Waisak 2571 BE'],['06-01','Hari Lahir Pancasila'],['06-06','Tahun Baru Islam 1449 H'],['08-15','Maulid Nabi Muhammad SAW'],['08-17','Proklamasi Kemerdekaan'],['12-25','Kelahiran Yesus Kristus'],['12-26','Isra Mikraj Nabi Muhammad SAW 1449 H']
 ]
};
export function holidaysForMonth(month){
 if(!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month))return null;
 const year=month.slice(0,4);return schedules[year]?.filter(([day])=>day.startsWith(month.slice(5)+'-')).map(([day,name])=>({date:year+'-'+day,name}))??null;
}
export function holidayPanel(month,esc){
 const holidays=holidaysForMonth(month),source=holidaySources[month.slice(0,4)];
 return `<aside class="agenda-holiday-summary" aria-label="Hari libur nasional Indonesia"><strong>Hari libur nasional Indonesia</strong>${holidays===null?'<p>Data hari libur untuk tahun ini belum tersedia.</p>':holidays.length?'<ul>'+holidays.map(h=>`<li><time datetime="${h.date}">${h.date.split('-').reverse().join('/')}</time> — ${esc(h.name)}</li>`).join('')+'</ul>':'<p>Tidak ada hari libur nasional pada bulan ini.</p>'}${source?`<small>Sumber: <a href="${source}" target="_blank" rel="noopener noreferrer">SKB pemerintah ${month.slice(0,4)}</a>. Cuti bersama belum ditampilkan.</small>`:''}</aside>`;
}
