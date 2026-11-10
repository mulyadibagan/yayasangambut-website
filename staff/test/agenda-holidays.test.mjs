import test from 'node:test';
import assert from 'node:assert/strict';
import {holidaysForMonth,holidayPanel} from '../public/agenda-holidays.js';
test('official holiday schedules cover 17 days in 2026 and 18 in 2027 without duplicate dates',()=>{
 for(const [year,count] of [['2026',17],['2027',18]]){
  const days=Array.from({length:12},(_,i)=>holidaysForMonth(`${year}-${String(i+1).padStart(2,'0')}`)).flat();
  assert.equal(days.length,count);assert.equal(new Set(days.map(h=>h.date)).size,count);
 }
 assert.deepEqual(holidaysForMonth('2026-11'),[]);
 assert.equal(holidaysForMonth('2026-12')[0].date,'2026-12-25');
 assert.deepEqual(holidaysForMonth('2027-03').map(h=>h.date),['2027-03-08','2027-03-10','2027-03-11','2027-03-26','2027-03-28']);
 assert.equal(holidaysForMonth('2028-01'),null);assert.equal(holidaysForMonth('2026-13'),null);
});
test('holiday display distinguishes unsupported years and formats dates day first',()=>{
 assert.match(holidayPanel('2026-12',s=>s),/25\/12\/2026/);
 assert.match(holidayPanel('2028-01',s=>s),/belum tersedia/);
 assert.match(holidayPanel('2026-11',s=>s),/Tidak ada hari libur/);
});
