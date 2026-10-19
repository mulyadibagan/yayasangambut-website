import test from 'node:test';
import assert from 'node:assert/strict';
import {agendaDisplayStatus} from '../public/agendas.js';
test('agenda follows WIB calendar dates, including today, multi-day events and midnight',()=>{
 const a={status:'scheduled',start_at:'2026-10-17T08:00',end_at:'2026-10-17T12:00'};
 for(const time of ['2026-10-16T17:00:00Z','2026-10-17T16:59:59Z'])assert.equal(agendaDisplayStatus(a,Date.parse(time)),'ongoing');
 assert.equal(agendaDisplayStatus(a,Date.parse('2026-10-17T17:00:00Z')),'done');
 assert.equal(agendaDisplayStatus({...a,status:'ongoing'},Date.parse('2026-10-16T16:59:59Z')),'scheduled');
 assert.equal(agendaDisplayStatus({...a,start_at:'2026-10-16T08:00',end_at:'2026-10-18T17:00'},Date.parse('2026-10-17T10:00Z')),'ongoing');
 assert.equal(agendaDisplayStatus({...a,status:'cancelled'},Date.parse('2026-10-17T10:00Z')),'cancelled');
});
