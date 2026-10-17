import test from 'node:test';
import assert from 'node:assert/strict';
import {agendaDisplayStatus} from '../public/agendas.js';
test('past agenda automatically completes at its WIB end time',()=>{
 const a={status:'ongoing',end_at:'2026-10-17T12:00'};
 assert.equal(agendaDisplayStatus(a,Date.parse('2026-10-17T04:59:59Z')),'ongoing');
 assert.equal(agendaDisplayStatus(a,Date.parse('2026-10-17T05:00:01Z')),'done');
 assert.equal(agendaDisplayStatus({...a,status:'scheduled'},Date.parse('2026-10-18T00:00Z')),'done');
 for(const status of ['done','cancelled'])assert.equal(agendaDisplayStatus({...a,status},Date.parse('2026-10-18T00:00Z')),status);
});
