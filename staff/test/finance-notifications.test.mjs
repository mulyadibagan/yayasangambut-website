import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {financeNotifications} from '../src/finance-notifications.mjs';
const director={role:'admin',email:'mulyadi@yayasangambut.org'};
test('only Director sees pending checked reports, including earlier reviews, with the latest review once',async()=>{
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE yg_advance_requests(id TEXT,seq INTEGER,legacy_id TEXT,created_at TEXT,payload TEXT,creator_name TEXT,total INTEGER,note TEXT,status TEXT);
 CREATE TABLE yg_advance_events(request_id TEXT,action TEXT,version INTEGER,actor_email TEXT,created_at TEXT);`);
 db.prepare('INSERT INTO yg_advance_requests VALUES(?,?,?,?,?,?,?,?,?)').run('legacy',1,'old','2026-11-01','{"legacy":{"number":"10/YG_ARC3/10/2026"}}','Reporter',55200000,'Sudah sesuai.','pjum_checked');
 db.prepare('INSERT INTO yg_advance_requests VALUES(?,?,?,?,?,?,?,?,?)').run('new',23,null,'2026-11-01','{}','Reporter',100,'','pjum_checked');
 db.prepare('INSERT INTO yg_advance_requests VALUES(?,?,?,?,?,?,?,?,?)').run('draft',24,null,'2026-11-01','{}','Reporter',100,'','pjum_draft');
 for(const [id,version,at] of [['legacy',2,'2026-11-16'],['legacy',5,'2026-11-17'],['new',2,'2026-11-16'],['draft',2,'2026-11-16']]){
  db.prepare('INSERT INTO yg_advance_events VALUES(?,?,?,?,?)').run(id,'report_check',version,'finance@yayasangambut.org',at);
 }
 let calls=0;
 const env={DB:{prepare(sql){calls++;return {async all(){return {results:db.prepare(sql).all()};}};}}};
 for(const user of [null,{role:'staff',email:director.email},{role:'admin',email:'other@yayasangambut.org'},{...director,disabled:1}]){
  assert.deepEqual(await financeNotifications(env,user),[]);
 }
 assert.equal(calls,0);
 const rows=await financeNotifications(env,director);
 assert.equal(rows.length,2);assert.equal(rows[0].number,'10/YG_ARC3/10/2026');assert.equal(rows[0].checkedAt,'2026-11-17');
 assert.equal(rows[0].note,'Sudah sesuai.');assert.equal(rows[1].number,'UM-2026-00023');
 assert.equal(rows[0].href,'/finance/advances?id=legacy&view=review');
 db.prepare("UPDATE yg_advance_requests SET status='closed' WHERE id='legacy'").run();
 assert.deepEqual((await financeNotifications(env,director)).map(row=>row.id),['new']);
 db.close();
});

test('Finance receives saved recent donations with direct links; drafts and older records stay out',async()=>{
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE yg_donations(id TEXT,seq INTEGER,payload TEXT,updated_at TEXT)");
 const insert=db.prepare('INSERT INTO yg_donations VALUES(?,?,?,?)');
 insert.run('saved',1,JSON.stringify({donor:'Donor',amount:1000000}),new Date().toISOString().slice(0,19).replace('T',' '));
 insert.run('draft',2,null,new Date().toISOString());
 insert.run('old',3,JSON.stringify({donor:'Old',amount:100}), '2020-01-01');
 const env={DB:{prepare(sql){return {async all(){return {results:db.prepare(sql).all()};}};}}};
 const finance={email:'rienaprasiddha@yayasangambut.org',role:'staff'};
 const rows=await financeNotifications(env,finance);
 assert.equal(rows.length,1);assert.equal(rows[0].kind,'donation');
 assert.equal(rows[0].total,1000000);assert.equal(rows[0].href,'/finance/donations?id=saved');
 assert.deepEqual(await financeNotifications(env,{...finance,disabled:true}),[]);
 db.close();
});
