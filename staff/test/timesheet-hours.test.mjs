import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticAgendaHours,collectTimesheetSources,patchTimesheet,openTimesheet} from '../src/timesheet-workbook.mjs';
import {englishTimesheetText} from '../src/timesheets.mjs';
import {zipSync,strToU8} from 'fflate';
const agenda=(id,program,start,end)=>({id,program,title:'Field work',start_at:start,end_at:end,status:'scheduled'});
test('overlap is counted once across programs and repeated agendas',()=>{
 const sources=collectTimesheetSources([], [agenda('a','APRIL','2026-11-01T08:00','2026-11-01T12:00'),agenda('b','JPIK','2026-11-01T10:00','2026-11-01T14:00'),agenda('c','APRIL','2026-11-01T08:00','2026-11-01T12:00')]);
 assert.deepEqual(automaticAgendaHours(sources),[{program:'APRIL',hours:3},{program:'JPIK',hours:3}]);
});
test('untimed agendas share an eight-hour daily allowance with timed work',()=>{
 const sources=collectTimesheetSources([], [agenda('a','APRIL','2026-11-01','2026-11-01'),agenda('b','JPIK','2026-11-01','2026-11-01')]);
 assert.deepEqual(automaticAgendaHours(sources),[{program:'APRIL',hours:4},{program:'JPIK',hours:4}]);
 sources.push(...collectTimesheetSources([], [agenda('c','APRIL','2026-11-01T08:00','2026-11-01T12:00')]));
 assert.deepEqual(automaticAgendaHours(sources),[{program:'APRIL',hours:6},{program:'JPIK',hours:2}]);
});
test('overnight agenda splits at midnight; cancellation supplies no hours',()=>{
 const sources=collectTimesheetSources([], [agenda('a','JPIK','2026-11-01T22:00','2026-11-02T02:00'),{...agenda('b','JPIK','2026-11-01','2026-11-01'),status:'cancelled'}]);
 assert.equal(sources.length,2);for(const date of ['2026-11-01','2026-11-02'])assert.equal(automaticAgendaHours(sources.filter(s=>s.date===date))[0].hours,2);
});
test('English activity translation preserves source mapping and caches retries; unavailable AI blocks writes',async()=>{
 const store=new Map();let calls=0;const env={MEDIA:{async get(k){return store.has(k)?{text:async()=>store.get(k)}:null;},async put(k,v){store.set(k,v);}},AI:{async run(){calls++;return {response:{translations:[{id:'s0',text:'Forest monitoring training'}]}};}}};
 const sources=[{id:'agenda:a',title:'[Planned] Pelatihan pemantauan hutan',program:'JPIK',date:'2026-11-01'}];
 const english=await englishTimesheetText(env,sources,[]);assert.equal(english.sources[0].title,'[Planned] Forest monitoring training');assert.equal(english.sources[0].program,'JPIK');await englishTimesheetText(env,sources,[]);assert.equal(calls,1);
 await assert.rejects(englishTimesheetText({},sources,[]),/Inggris/);
});
