import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';
import {openTimesheet,patchTimesheet,collectTimesheetSources,programColumn,automaticAgendaHours} from '../src/timesheet-workbook.mjs';
import {actualInput,timesheetFileId,timesheetApi} from '../src/timesheets.mjs';
import {sealToken} from '../src/google-calendar.mjs';
import {createHash} from 'node:crypto';
const cell=(r,v)=>`<c r="${r}" t="inlineStr"><is><t>${v}</t></is></c>`;
function fixture(){return zipSync({
 'xl/workbook.xml':strToU8('<workbook><sheets><sheet name="Person 2026" r:id="rId1"/></sheets><calcPr/></workbook>'),
 'xl/_rels/workbook.xml.rels':strToU8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'),
 'xl/worksheets/sheet1.xml':strToU8('<worksheet><sheetData><row r="6"><c r="C6"><f>SUM(C10:C11)/8</f><v>0</v></c><c r="D6"><v>0</v></c></row><row r="7">'+cell('A7','Tanggal')+cell('B7','Kegiatan')+cell('O7','Total Work')+'</row><row r="8">'+cell('C8','APRIL-DAYUN')+cell('D8','JPIK')+'</row><row r="10"><c r="A10"><v>46327</v></c>'+cell('B10','')+'<c r="C10" s="2"/><c r="D10"/><c r="O10"><f>SUM(C10:N10)</f><v>0</v></c></row><row r="11"><c r="A11"><v>46328</v></c>'+cell('B11','')+'<c r="C11"/><c r="D11"/><c r="O11"><v>0</v></c></row></sheetData></worksheet>'),
 'xl/vbaProject.bin':new Uint8Array([1,2,3,4]),'xl/styles.xml':strToU8('<styleSheet/>'),'customXml/item1.xml':strToU8('<original/>')
});}
test('automatic agenda hours populate elapsed dates, keep future hours planned, and yield to actual corrections',()=>{
 const sources=collectTimesheetSources([], [{id:'a',title:'Training',program:'JPIK',start_at:'2026-11-01T08:00',end_at:'2026-11-01T16:00',status:'scheduled'},{id:'b',title:'Meeting',program:'JPIK',start_at:'2026-11-02',end_at:'2026-11-02',status:'scheduled'}]);
 const first=patchTimesheet(fixture(),sources,[],{},'2026-11-01'),sheet=openTimesheet(first.bytes).sheets[0];
 assert.equal(sheet.cells.get('D10').value,'8');assert.equal(sheet.cells.get('D11').value,'');assert.match(sheet.cells.get('B11').value,/Planned hours.*8 hours/);
 assert.equal(patchTimesheet(first.bytes,sources,[],first.managed,'2026-11-01').changes,0);
 const next=patchTimesheet(first.bytes,sources,[],first.managed,'2026-11-02');assert.equal(openTimesheet(next.bytes).sheets[0].cells.get('D11').value,'8');
 const corrected=patchTimesheet(next.bytes,sources,[{work_date:'2026-11-01',program:'JPIK',hours:3,activity:'Corrected work'}],next.managed,'2026-11-02');assert.equal(openTimesheet(corrected.bytes).sheets[0].cells.get('D10').value,'3');
 const cancelled=patchTimesheet(next.bytes,[],[],next.managed,'2026-11-02');assert.equal(openTimesheet(cancelled.bytes).sheets[0].cells.get('D10').value,'0');
});
test('plans populate activity only, preserve macros, formulas, styling and unrelated parts; retries do not duplicate',()=>{
 const original=fixture(),sources=collectTimesheetSources([{id:'t1',title:'Prepare',due_date:'2026-11-01',program:'APRIL',status:'todo'}],[{id:'a1',title:'Meeting',start_at:'2026-11-02T08:00',end_at:'2026-11-02T17:00',status:'scheduled',program:'Other'},{id:'a2',title:'Cancelled',start_at:'2026-11-01T08:00',end_at:'2026-11-01T17:00',status:'cancelled'}]);
 const first=patchTimesheet(original,sources,[]),book=openTimesheet(first.bytes),files=unzipSync(first.bytes),before=unzipSync(original);
 assert.match(book.sheets[0].cells.get('B11').value,/\[Agenda\] Meeting/);assert.equal(book.sheets[0].cells.get('C11').value,'');assert.deepEqual(first.unresolved,[]);assert.equal(book.sheets[0].columns.Other,'E');assert.equal(book.sheets[0].cells.get('E11').value,'9');
 for(const name of ['xl/vbaProject.bin','xl/styles.xml','customXml/item1.xml'])assert.deepEqual(files[name],before[name]);
 assert.match(strFromU8(files['xl/worksheets/sheet1.xml']),/<f>SUM\(C10:N10\)<\/f>/);assert.match(strFromU8(files['xl/workbook.xml']),/fullCalcOnLoad="1"/);
 assert.equal(patchTimesheet(first.bytes,sources,[],first.managed).changes,0);
 assert.equal(programColumn('Agroforestri Dayun · APRIL',book.sheets[0].columns),'APRIL-DAYUN');assert.equal(programColumn('Unknown',book.sheets[0].columns),null);
});
test('confirmed actuals update program and totals once and manual edits are protected',()=>{
 const original=fixture(),actual=[{work_date:'2026-11-02',program:'JPIK',hours:4,activity:'Actual work'}],first=patchTimesheet(original,[],actual),s=openTimesheet(first.bytes).sheets[0];
 assert.equal(s.cells.get('D11').value,'4');assert.equal(s.cells.get('O11').value,'4');assert.equal(s.cells.get('D6').value,'0.5');assert.equal(patchTimesheet(first.bytes,[],actual,first.managed).changes,0);
 const files=unzipSync(first.bytes);files[s.path]=strToU8(strFromU8(files[s.path]).replace('Actual work','Manual edit'));
 assert.throws(()=>patchTimesheet(zipSync(files),[],actual,first.managed),/berubah manual/);
 assert.throws(()=>patchTimesheet(original,[],[{...actual[0],program:'Unknown'}]),/Program aktual/);
 assert.throws(()=>patchTimesheet(original,[],[{...actual[0],work_date:'2026-10-01'}]),/Tanggal aktual/);
});
test('actual input rejects fabricated future hours and parses exact Drive destination',()=>{
 assert.equal(timesheetFileId('https://drive.google.com/file/d/abcdefghijklmnop/view'),'abcdefghijklmnop');assert.throws(()=>timesheetFileId('https://evil.test/abcdefghijklmnop'));
 assert.throws(()=>actualInput({work_date:'2099-01-01',hours:8,program:'JPIK',activity:'Future',confirmed:true}));
 assert.throws(()=>actualInput({work_date:'2026-01-01',hours:8,program:'JPIK',activity:'Work',confirmed:false}));
 assert.equal(actualInput({work_date:'2026-01-01',hours:1.1,program:'JPIK',activity:'Work',confirmed:true}).hours,1.1);
});
function setup(){const db=new DatabaseSync(':memory:');for(const name of ['0001_initial.sql','0005_webgis_sso.sql','0010_team_tasks.sql','0011_team_agendas.sql','0015_agenda_custom_kind.sql','0016_agenda_trash.sql','0041_team_timesheets.sql'])db.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
 const DB={prepare(sql){let args=[];return{bind(...a){args=a;return this;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return{results:db.prepare(sql).all(...args)};},async run(){const r=db.prepare(sql).run(...args);return{meta:{changes:Number(r.changes)}};}};}};
 for(const id of ['director','one','two'])db.prepare('INSERT INTO users VALUES(?,?,?,?,0,?,?)').run(id,id+'@example.test',id,id==='director'?'admin':'staff','2026','2026');
 return {db,env:{DB,ADMIN_EMAIL:'director@example.test',GOOGLE_WORKSPACE_DOMAIN:'example.test'},one:{id:'one',email:'one@example.test',role:'staff'}};
}
test('timesheet access is scoped to staff identity; only director configures destinations',async()=>{
 const {env,one}=setup(),call=(path,method='GET',input={})=>timesheetApi(new Request('https://staff.test'+path,{method}),env,new URL('https://staff.test'+path),one,{payload:async()=>input});
 const result=await (await call('/api/timesheets')).json();assert.equal(result.staff.length,1);assert.equal(result.staff[0].id,'one');
 await assert.rejects(call('/api/timesheets?staff=two'),e=>e.status===403);await assert.rejects(call('/api/timesheets/connect','POST',{url:'abcdefghijklmnop'}),e=>e.status===403);
});
test('database prevents duplicate daily program entries and concurrent excess hours',()=>{
 const {db}=setup();const add=db.prepare('INSERT INTO team_timesheet_days VALUES(?,?,?,?,?,?,?)');add.run('one','2026-11-01','APRIL-DAYUN',16,'Work','one','now');add.run('one','2026-11-01','JPIK',8,'Work','one','now');
 assert.throws(()=>add.run('one','2026-11-01','Other',1,'Work','one','now'),/24 jam/);assert.throws(()=>add.run('one','2026-11-01','JPIK',8,'Work','one','now'),/UNIQUE/);
 assert.throws(()=>db.prepare('UPDATE team_timesheet_days SET hours=9 WHERE program=?').run('JPIK'),/24 jam/);
});
for(const driveVersion of ['v3','v2'])test('connected Drive sync backs up original bytes, uses conditional writes, verifies checksum and is retry-safe '+driveVersion,async t=>{
 const {env,db}=setup();env.GOOGLE_CLIENT_SECRET='test-secret';env.AGENDA_DRIVE_ROOT_ID='root-folder-123456';
 db.exec('CREATE TABLE agenda_drive_connection(id INTEGER PRIMARY KEY,user_id TEXT,email TEXT,refresh_token TEXT,root_id TEXT,folder_id TEXT,status TEXT,updated_at TEXT)');
 db.prepare('INSERT INTO agenda_drive_connection VALUES(1,?,?,?,?,?,?,?)').run('director','director@example.test',await sealToken(env,'agenda-drive:director','refresh'),env.AGENDA_DRIVE_ROOT_ID,'archive-folder','connected','now');
 db.prepare('INSERT INTO team_tasks(id,creator,assigned_by,title,description,program,location,assignees,due_date,priority,status,mutation_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('t1','director','director','Task','Notes','APRIL','Place','["one"]','2026-11-01','normal','todo','m1','now','now');
 let file=fixture(),writes=0,backup;const originalFetch=globalThis.fetch;t.after(()=>{globalThis.fetch=originalFetch;});const hash=b=>createHash('md5').update(b).digest('hex');
 env.AI={async run(model,input){const {segments}=JSON.parse(input.messages[1].content);return {response:{translations:segments}};}};
 env.MEDIA={async put(key,bytes){if(key.includes('/backups/'))backup={key,bytes};}};
 globalThis.fetch=async (input,init={})=>{
  const url=String(input);if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'access'});
  if(url.includes('/files/archive-folder?'))return Response.json({mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true},parents:[env.AGENDA_DRIVE_ROOT_ID]});
  if(url.includes('/upload/drive/'+driveVersion+'/files/abcdefghijklmnop')){assert.equal(init.method,driveVersion==='v2'?'PUT':'PATCH');assert.equal(init.headers['If-Match'],'"version"');assert.ok(backup);writes++;file=init.body;return Response.json({id:'abcdefghijklmnop',md5Checksum:hash(file)});}
  if(url.includes('/files/abcdefghijklmnop?alt=media'))return new Response(file);
  if(url.includes('/drive/v2/files/abcdefghijklmnop?'))return Response.json({etag:'"version"',md5Checksum:hash(file),version:String(writes)});
  if(url.includes('/files/abcdefghijklmnop?'))return Response.json({id:'abcdefghijklmnop',name:'Person.xlsm',mimeType:'application/vnd.ms-excel.sheet.macroEnabled.12',size:file.length,md5Checksum:hash(file),version:String(writes),capabilities:{canEdit:true}},{headers:driveVersion==='v3'?{etag:'"version"'}:{}});
  throw Error('Unexpected network request');
 };
 const actor={id:'director',email:'director@example.test',role:'admin'},url=new URL('https://staff.test/api/timesheets/connect?staff=one');
 const result=await(await timesheetApi(new Request(url,{method:'POST'}),env,url,actor,{payload:async()=>({url:'abcdefghijklmnop'})})).json();
 assert.equal(writes,1);assert.equal(result.changedCells,1);assert.deepEqual(backup.bytes,fixture());assert.equal(openTimesheet(file).sheets[0].cells.get('C10').value,'');
 const retry=new URL('https://staff.test/api/timesheets/sync?staff=one');await timesheetApi(new Request(retry,{method:'POST'}),env,retry,actor,{payload:async()=>({})});assert.equal(writes,1);
 assert.equal(db.prepare('SELECT last_error FROM team_timesheet_files').get().last_error,'');
});
