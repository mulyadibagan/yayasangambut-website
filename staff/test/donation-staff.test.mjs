import test from 'node:test';
import assert from 'node:assert/strict';
import {donationStaffList} from '../src/donation-staff.mjs';
import {donationInput} from '../src/donations.mjs';
test('donation options and server validation follow effective payroll staff, including new staff',()=>{
 const terms=[{name:'Rafi Merbamas',effective_month:'2026-11'},{name:'Raja Alpian',effective_month:'2026-11'},{name:'Rafi Merbamas',effective_month:'2026-11'},{name:'Staf berikutnya',effective_month:'2026-12'}];
 const people=donationStaffList(terms,'2026-11');assert.equal(people.length,7);
 assert.deepEqual(people.filter(s=>['Rafi Merbamas','Raja Alpian'].includes(s.id)).map(s=>s.name),['Rafi Merbamas','Raja Alpian']);
 const input={amount:100,date:'2026-11-21',donor:'Donor uji',allocations:[{kind:'salary',staff:'Rafi Merbamas',amount:60},{kind:'salary',staff:'Raja Alpian',amount:40}]};
 assert.equal(donationInput(input,people.map(s=>s.id)).allocations.length,2);
 assert.throws(()=>donationInput({...input,allocations:[{kind:'salary',staff:'Nama tidak terdaftar',amount:100}]},people.map(s=>s.id)),/Peruntukan/);
 assert.equal(donationStaffList(terms,'2026-12').length,8);
 assert.equal(donationStaffList(terms,'2026-10').length,5);
});
