import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {agendaTimeFields,composeAgendaTime,bindAgendaTime} from '../public/agenda-time.js';
import {agendaInput} from '../src/agendas.mjs';

test('agenda controls expose 00 through 23 without a locale-dependent time picker',()=>{
 const {document}=parseHTML(agendaTimeFields('start_at','Mulai','mulai'));
 const hours=[...document.querySelectorAll('[name=start_at_hour] option')].map(o=>o.getAttribute('value')).filter(Boolean);
 assert.deepEqual(hours,Array.from({length:24},(_,i)=>String(i).padStart(2,'0')));
 assert.equal(document.querySelectorAll('[name=start_at_minute] option').length,61);
 assert.equal(document.querySelector('[name=start_at]').type,'hidden');assert(!document.querySelector('[type="datetime-local"]'));
});

test('24-hour selection preserves local WIB API values at midnight and 23:59',()=>{
 for(const [hour,minute] of [['00','00'],['08','00'],['12','30'],['17','00'],['23','59']]){
  const value=composeAgendaTime('2026-11-10',hour,minute);assert.equal(value,`2026-11-10T${hour}:${minute}`);
  const input=agendaInput({title:'Uji jam',kind:'meeting',start_at:value,end_at:value,status:'scheduled'});assert.equal(input.start_at,value);
 }
 for(const [h,m] of [['24','00'],['12','60'],['','00'],['8','00'],['11 PM','00']])assert.equal(composeAgendaTime('2026-11-10',h,m),'');
});

test('reopening an existing agenda resets split controls and propagates read-only state',()=>{
 const controls=Object.fromEntries(['start_at','start_at_date','start_at_hour','start_at_minute'].map(name=>{const control=new EventTarget();control.value='';control.disabled=false;return [name,control];}));
 const refresh=bindAgendaTime({querySelector:selector=>controls[selector.match(/name="([^"]+)"/)[1]]},'start_at');
 controls.start_at.value='2026-11-01T14:00';refresh();assert.equal(controls.start_at_hour.value,'14');assert.equal(controls.start_at_date.value,'2026-11-01');
 controls.start_at_hour.value='23';controls.start_at_minute.value='59';controls.start_at_minute.dispatchEvent(new Event('change'));assert.equal(controls.start_at.value,'2026-11-01T23:59');
 controls.start_at.disabled=true;refresh();assert.equal(controls.start_at_hour.disabled,true);assert.equal(controls.start_at_date.disabled,true);
 controls.start_at.value='';controls.start_at.disabled=false;refresh();assert.equal(controls.start_at_hour.value,'');assert.equal(controls.start_at_minute.value,'');assert.equal(controls.start_at_hour.disabled,false);
});
