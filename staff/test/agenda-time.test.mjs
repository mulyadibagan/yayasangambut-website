import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {agendaTimeFields,composeAgendaTime,bindAgendaTime,parseAgendaDate} from '../public/agenda-time.js';
import {agendaInput} from '../src/agendas.mjs';

test('day-first dates preserve unambiguous dates and reject invalid calendar dates',()=>{
 for(const [shown,iso] of [['10/11/2026','2026-11-10'],['01/02/2026','2026-02-01'],['29/02/2028','2028-02-29']])assert.equal(parseAgendaDate(shown),iso);
 for(const value of ['11/10/26','2026-11-10','31/04/2026','29/02/2026','29/02/2100','00/11/2026','10/13/2026','10/11/0000'])assert.equal(parseAgendaDate(value),'');
});

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
 controls.start_at.value='2026-11-01T14:00';refresh();assert.equal(controls.start_at_hour.value,'14');assert.equal(controls.start_at_date.value,'01/11/2026');
 controls.start_at_hour.value='23';controls.start_at_minute.value='59';controls.start_at_minute.dispatchEvent(new Event('change'));assert.equal(controls.start_at.value,'2026-11-01T23:59');
 controls.start_at_date.value='10/11/2026';controls.start_at_date.dispatchEvent(new Event('input'));assert.equal(controls.start_at.value,'2026-11-10T23:59');refresh();assert.equal(controls.start_at_date.value,'10/11/2026');
 controls.start_at.disabled=true;refresh();assert.equal(controls.start_at_hour.disabled,true);assert.equal(controls.start_at_date.disabled,true);
 controls.start_at.value='';controls.start_at.disabled=false;refresh();assert.equal(controls.start_at_hour.value,'');assert.equal(controls.start_at_minute.value,'');assert.equal(controls.start_at_hour.disabled,false);
});

test('calendar selection and manual entry stay in sync without changing WIB hours',()=>{
 const names=['start_at','start_at_date','start_at_hour','start_at_minute','start_at_picker'];
 const controls=Object.fromEntries(names.map(name=>{const control=new EventTarget();control.value='';control.disabled=false;return [name,control];}));
 const refresh=bindAgendaTime({querySelector:selector=>controls[selector.match(/name="([^"]+)"/)[1]]},'start_at');
 controls.start_at.value='2026-11-02T08:30';refresh();
 assert.equal(controls.start_at_picker.value,'2026-11-02');
 controls.start_at_picker.value='2026-12-17';controls.start_at_picker.dispatchEvent(new Event('change'));
 assert.equal(controls.start_at_date.value,'17/12/2026');assert.equal(controls.start_at.value,'2026-12-17T08:30');
 controls.start_at_date.value='29/02/2028';controls.start_at_date.dispatchEvent(new Event('input'));
 assert.equal(controls.start_at_picker.value,'2028-02-29');
 let opened=0;controls.start_at_picker.showPicker=()=>opened++;controls.start_at_date.dispatchEvent(new Event('click'));assert.equal(opened,1);
 controls.start_at.disabled=true;refresh();assert.equal(controls.start_at_picker.disabled,true);
 controls.start_at_date.dispatchEvent(new Event('click'));assert.equal(opened,1);
 controls.start_at.value='';controls.start_at.disabled=false;refresh();assert.equal(controls.start_at_picker.value,'');
 const {document}=parseHTML(agendaTimeFields('end_at','Selesai','selesai'));
 assert.equal(document.querySelector('[name=end_at_picker]').getAttribute('aria-label'),'Pilih tanggal selesai');
});
