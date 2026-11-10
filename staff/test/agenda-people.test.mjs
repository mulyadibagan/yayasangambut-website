import test from 'node:test';
import assert from 'node:assert/strict';
import {groupAgendasByPerson} from '../public/agenda-people.js';
test('shared agendas appear once for each participant account, never the non-participating coordinator',()=>{
 const people=[{id:'a',name:'Rafi Merbamas'},{id:'b',name:'Rafi Lain'},{id:'c',name:'Koordinator'}];
 const shared={id:'shared',participant_ids:'["a","b","a"]',coordinator:'Koordinator'};
 const solo={id:'solo',participant_ids:'["a"]'};
 const groups=groupAgendasByPerson([shared,solo],people);
 assert.equal(groups.length,2);assert.deepEqual(groups.find(g=>g.id==='a').agendas,[shared,solo]);assert.deepEqual(groups.find(g=>g.id==='b').agendas,[shared]);
 assert.deepEqual(JSON.parse(shared.participant_ids),['a','b','a']);
});
test('unassigned and inactive participants remain visible without adding unrelated records',()=>{
 const records=[{id:'inactive',participant_ids:'["removed"]'},{id:'unassigned',participant_ids:'[]',participants:'Mitra',creator:'a'}];
 const groups=groupAgendasByPerson(records,[{id:'a',name:'Pembuat'}]);
 assert.equal(groups.length,2);assert.equal(groups[0].name,'Anggota tim tidak aktif');assert.equal(groups[1].id,null);assert.deepEqual(groups[1].agendas,[records[1]]);
 assert.deepEqual(groupAgendasByPerson([],[]),[]);
});
