// Finance source and historical data are encrypted at rest in this public repository.
// Decrypt only on the protected production runner; never copy into public website assets.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createDecipheriv,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {applyPrivateBankUpdates} from './finance-bank-updates.mjs';
const root=resolve('finance-runtime');
const key=Buffer.from(process.env.PRIVATE_FINANCE_ARCHIVE_KEY||'','hex');
if(key.length!==32)throw Error('PRIVATE_FINANCE_ARCHIVE_KEY is not configured.');
const data=await readFile('imports/finance-private.enc');
const decipher=createDecipheriv('aes-256-gcm',key,data.subarray(0,12));decipher.setAuthTag(data.subarray(12,28));
const archive=Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]);
await mkdir(root,{recursive:true,mode:0o700});
const extracted=spawnSync('tar',['-xzf','-','-C',root],{input:archive});
if(extracted.status!==0)throw Error('Cannot extract private finance archive.');
function run(cmd,args,cwd=root){const r=spawnSync(cmd,args,{cwd,stdio:'inherit',env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'}});if(r.status!==0)throw Error('Finance preparation failed: '+cmd);}
run('npm',['ci','--ignore-scripts']);
const account=process.env.CLOUDFLARE_ACCOUNT_ID,database=process.env.STAFF_D1_DATABASE_ID;
if(!/^[a-f0-9]{32}$/i.test(account||'')||!/^[-a-f0-9]{36}$/i.test(database||''))throw Error('Invalid account or database configuration.');
const base=`https://api.cloudflare.com/client/v4/accounts/${account}`;
async function cf(path,init={}){const r=await fetch(base+path,{...init,headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,...init.headers}});const body=await r.json();if(!r.ok||!body.success)throw Error('Finance Cloudflare operation failed ('+r.status+'): '+JSON.stringify(body.errors));return body.result;}
const db=await cf('/d1/database/'+database);if(db.name!=='yg-staff')throw Error('Wrong finance database.');
const query=async(sql,params=[])=>cf(`/d1/database/${database}/query`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sql,params})});
await query('CREATE TABLE IF NOT EXISTS yg_finance_migrations (id TEXT PRIMARY KEY, source_hash TEXT NOT NULL, completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
const snapshot=await readFile(root+'/private/database.json');
const tables=JSON.parse(snapshot),digest=createHash('sha256').update(snapshot).digest('hex');
const old=await query('SELECT source_hash FROM yg_finance_migrations WHERE id=?',['finance-2026-10-15']);
if(!old[0].results.length){
 const numeric=new Set(['amount','balance','advance_amount','actual_amount','size_bytes','line_item_no','email_ts','confidence']);
 const primary={finance_settings:'setting_key',finance_email_links:'source_message_id',finance_email_candidates:'message_id'};
 for(const [table,{columns,rows}] of Object.entries(tables)){
  if(!/^finance_[a-z_]+$/.test(table)||columns.some(c=>!/^[_a-z]+$/.test(c)))throw Error('Invalid migration identifier.');
  const key=primary[table]||'id';
  const definitions=columns.map(c=>`"${c}" ${c===key?(['finance_audit','finance_notifications'].includes(table)?'INTEGER PRIMARY KEY AUTOINCREMENT':'TEXT PRIMARY KEY'):numeric.has(c)?'REAL':['created_at','updated_at'].includes(c)?'TEXT DEFAULT CURRENT_TIMESTAMP':'TEXT'}`);
  await query(`CREATE TABLE IF NOT EXISTS "${table}" (${definitions.join(',')})`);
  const current=await query(`SELECT * FROM "${table}"`);
  const normalized=row=>JSON.stringify(columns.map(c=>row[c]??null));
  const existing=new Set(current[0].results.map(normalized));
  for(const row of rows)if(!existing.has(normalized(row)))await query(`INSERT OR IGNORE INTO "${table}" (${columns.map(c=>'"'+c+'"').join(',')}) VALUES (${columns.map(()=>'?').join(',')})`,columns.map(c=>row[c]??null));
  const count=await query(`SELECT COUNT(*) AS count FROM "${table}"`);
  if(Number(count[0].results[0].count)!==rows.length)throw Error('Finance row count mismatch: '+table);
  const verified=await query(`SELECT * FROM "${table}"`),verifiedRows=new Set(verified[0].results.map(normalized));
  if(rows.some(row=>!verifiedRows.has(normalized(row))))throw Error('Finance values mismatch: '+table);
 }
 await query('CREATE UNIQUE INDEX IF NOT EXISTS finance_evidence_source_file_unique ON finance_evidence_registry(source_message_id,file_id)');
 await query('CREATE UNIQUE INDEX IF NOT EXISTS finance_ocr_file_unique ON finance_ocr_results(file_id)');
 console.log('Finance database tables verified; uploaded files will be verified through the private Worker binding.');
}else if(old[0].results[0].source_hash!==digest)throw Error('Finance archive snapshot changed; review migration before proceeding.');
const bankUpdates=await query('SELECT setting_value FROM finance_settings WHERE setting_key=?',['bank_statement_updates_v1']);
if(bankUpdates[0].results.length){
 let updates;try{updates=JSON.parse(bankUpdates[0].results[0].setting_value);}catch{throw Error('Invalid private bank update configuration.');}
 await applyPrivateBankUpdates(root,updates);
}
run('npm',['run','build']);
const checked=spawnSync('node',['migration-test.mjs'],{cwd:root,stdio:'inherit',env:{...process.env,FINANCE_PRIVATE_DATA:root+'/private'}});
if(checked.status!==0)throw Error('Private finance integration checks failed.');
const migrationFiles=[];
await mkdir(root+'/dist/client/_migration/uploads',{recursive:true});
for(const [index,file] of tables.finance_files.rows.entries()){
 const bytes=await readFile(root+'/private/uploads/'+file.id);
 if(bytes.length!==file.size_bytes)throw Error('Finance upload size mismatch.');
 await copyFile(root+'/private/uploads/'+file.id,root+'/dist/client/_migration/uploads/'+index);
 migrationFiles.push({key:file.object_key,size:file.size_bytes,mime:file.mime_type,path:'/_migration/uploads/'+index,sha:createHash('sha256').update(bytes).digest('hex')});
}
await query("CREATE TABLE IF NOT EXISTS yg_finance_upload_events (id TEXT PRIMARY KEY, result TEXT, detail TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)");
await query('CREATE TABLE IF NOT EXISTS yg_finance_upload_migrations (id TEXT PRIMARY KEY, source_hash TEXT NOT NULL, file_count INTEGER NOT NULL, completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
const bootstrap=`import app from './index.js';
const files=${JSON.stringify(migrationFiles)};
const migrationId='finance-2026-10-15';const sourceHash='${digest}';
async function verify(bytes,expected){const hash=await crypto.subtle.digest('SHA-256',bytes);const hex=Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');if(hex!==expected)throw Error('Finance attachment checksum mismatch');}
async function initialize(env){
 const old=await env.DB.prepare('SELECT source_hash FROM yg_finance_upload_migrations WHERE id=?').bind(migrationId).first();
 if(old){if(old.source_hash!==sourceHash)throw Error('Finance migration source changed');return;}
 for(const file of files){
  const stored=await env.BUCKET.get(file.key);
  if(stored){if(stored.size!==file.size)throw Error('Finance attachment already exists with a different size');await verify(await stored.arrayBuffer(),file.sha);continue;}
  const response=await env.ASSETS.fetch(new Request('https://finance.internal'+file.path));if(!response.ok)throw Error('Finance migration asset missing');
  const bytes=await response.arrayBuffer();if(bytes.byteLength!==file.size)throw Error('Finance attachment size mismatch');await verify(bytes,file.sha);
  await env.BUCKET.put(file.key,bytes,{httpMetadata:{contentType:file.mime}});
  const saved=await env.BUCKET.get(file.key);if(!saved||saved.size!==file.size)throw Error('Finance attachment write incomplete');await verify(await saved.arrayBuffer(),file.sha);
 }
 await env.DB.prepare('INSERT INTO yg_finance_upload_migrations(id,source_hash,file_count) VALUES(?,?,?)').bind(migrationId,sourceHash,files.length).run();
 console.log('Private finance attachment migration verified.');
}
async function scheduled(_event,env,ctx){
 ctx.waitUntil((async()=>{
  await env.DB.prepare("INSERT OR REPLACE INTO yg_finance_upload_events(id,result,detail) VALUES(?,'running','')").bind(migrationId).run();
  try{await initialize(env);await env.DB.prepare("UPDATE yg_finance_upload_events SET result='complete',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(migrationId).run();}
  catch(error){await env.DB.prepare("UPDATE yg_finance_upload_events SET result='failed',detail=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(String(error.message),migrationId).run();throw error;}
 })());
}
async function financeFetch(req,env,ctx){
 const url=new URL(req.url);
 if(url.pathname!=='/finance/api/email-intake'||url.searchParams.get('scan')!=='1')return app.fetch(req,env,ctx);
 // Email scans can outlive the post-response waitUntil window. Keep this
 // authenticated request open until the scan has persisted its final status.
 const pending=[];
 const scanContext=new Proxy(ctx,{get(target,key){
  if(key==='waitUntil')return task=>{pending.push(Promise.resolve(task).then(()=>true,()=>false));};
  const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
 }});
 const response=await app.fetch(req,env,scanContext);
 let failed=false;
 for(let offset=0;offset<pending.length;){
  const batch=pending.slice(offset);offset=pending.length;
  if((await Promise.all(batch)).some(ok=>!ok))failed=true;
 }
 if(failed){console.error('Finance email scan failed before completion.');return Response.json({error:'Finance email scan failed.'},{status:502});}
 return response;
}
export default {fetch:financeFetch,scheduled};
`;
await writeFile(root+'/dist/server/finance-bootstrap.js',bootstrap);
run('node',['--check','dist/server/finance-bootstrap.js']);
const built=JSON.parse(await readFile(root+'/dist/server/wrangler.json','utf8'));
Object.assign(built,{name:'yg-finance',main:'finance-bootstrap.js',account_id:account,workers_dev:false,preview_urls:false,routes:[],d1_databases:[{binding:'DB',database_name:'yg-staff',database_id:database}],r2_buckets:[{binding:'BUCKET',bucket_name:'yg-staff-media'}]});
if(built.assets){built.assets.run_worker_first=true;built.assets.binding='ASSETS';}
await writeFile(root+'/dist/server/wrangler.json',JSON.stringify(built));
run('./node_modules/.bin/wrangler',['deploy','--config','dist/server/wrangler.json']);
const schedulePath='/workers/scripts/yg-finance/schedules';
await query("INSERT OR REPLACE INTO yg_finance_upload_events(id,result,detail) VALUES(?,'waiting','')",['finance-2026-10-15']);
await cf(schedulePath,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify([{cron:'* * * * *'}])});
try{
 let verified=false;
 for(let attempt=0;attempt<210;attempt++){
  const result=await query('SELECT source_hash,file_count FROM yg_finance_upload_migrations WHERE id=?',['finance-2026-10-15']);
  if(result[0].results.length){const row=result[0].results[0];if(row.source_hash!==digest||Number(row.file_count)!==migrationFiles.length)throw Error('Finance upload migration verification failed.');verified=true;break;}
  const event=await query('SELECT result,detail FROM yg_finance_upload_events WHERE id=?',['finance-2026-10-15']);
  if(event[0].results[0]?.result==='failed')throw Error('Finance attachment initialization failed: '+event[0].results[0].detail);
  if(attempt%12===0)console.log('Waiting for private finance migration trigger; state: '+(event[0].results[0]?.result||'waiting'));
  await new Promise(resolve=>setTimeout(resolve,5000));
 }
 if(!verified)throw Error('Private finance upload migration has not completed.');
 await query('INSERT OR IGNORE INTO yg_finance_migrations(id,source_hash) VALUES(?,?)',['finance-2026-10-15',digest]);
 console.log('Finance migration complete: all table counts and uploaded file SHA256 checks verified.');
}finally{await cf(schedulePath,{method:'PUT',headers:{'Content-Type':'application/json'},body:'[]'});}
console.log('Private finance service deployed; staff session remains the only entry.');
