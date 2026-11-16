import {createHash} from 'node:crypto';
import {driveAccess,google,validFolder,drivePreviewUrl} from './agenda-drive.mjs';
const q=(e,s,...a)=>e.DB.prepare(s).bind(...a);
const now=()=>new Date().toISOString();
export async function advanceDriveStatus(env,id){
 if(!env.FINANCE_DRIVE_FOLDER_ID)return {enabled:false,files:[]};
 const files=(await q(env,'SELECT file_id,status,web_url,error FROM yg_advance_drive WHERE request_id=?',id).all()).results;
 return {enabled:true,files};
}
export function verifyAdvanceArchive(meta,file,row,hash,root){
 if(meta.trashed||meta.mimeType!==file.mime||Number(meta.size)!==file.size||meta.md5Checksum!==hash||!meta.parents?.includes(root)||meta.appProperties?.ygAdvanceFile!==file.id||meta.appProperties?.ygAdvanceRequest!==file.request_id)throw Error('Arsip Drive berbeda; dokumen yang ada tidak ditimpa.');
 return drivePreviewUrl(meta.webViewLink);
}
export async function archiveAdvanceFile(env,file,deps={}){
 const root=env.FINANCE_DRIVE_FOLDER_ID;if(!root)return {enabled:false};
 const at=now();await q(env,"INSERT INTO yg_advance_drive(file_id,request_id,root_id,updated_at) VALUES(?,?,?,?) ON CONFLICT(file_id) DO NOTHING",file.id,file.request_id,root,at).run();
 const owner=crypto.randomUUID(),lease=Date.now()+120000;
 const claim=await q(env,'UPDATE yg_advance_drive SET lease_owner=?,lease_until=? WHERE file_id=? AND lease_until<? RETURNING *',owner,lease,file.id,Date.now()).first();if(!claim)return {pending:true};
 try{
 if(claim.root_id!==root)throw Error('Tujuan arsip berubah; periksa arsip lama.');
 const {access,root:connectedRoot}=await (deps.driveAccess||driveAccess)(env);
 await (deps.validFolder||validFolder)(access,root,connectedRoot);
 const call=(path,options)=>(deps.google||google)(access,path,options);
 const object=await env.MEDIA.get(file.storage_key);if(!object)throw Error('Berkas sumber belum tersedia.');
 const bytes=new Uint8Array(await (object.arrayBuffer?object.arrayBuffer():new Response(object.body).arrayBuffer()));
 if(bytes.length!==file.size)throw Error('Ukuran sumber tidak sesuai.');
 const hash=createHash('md5').update(bytes).digest('hex');
 let driveId=claim.drive_id;
 if(!driveId){const generated=await call('/drive/v3/files/generateIds?count=1&space=drive&type=files');driveId=generated.ids?.[0];if(!driveId)throw Error('ID arsip Drive belum tersedia.');await q(env,'UPDATE yg_advance_drive SET drive_id=? WHERE file_id=? AND lease_owner=?',driveId,file.id,owner).run();}
 const metadataPath='/drive/v3/files/'+encodeURIComponent(driveId)+'?supportsAllDrives=true&fields=id,mimeType,size,md5Checksum,parents,trashed,appProperties,webViewLink';
 // A reserved ID is persisted before upload. Retry inspects that same ID first.
 const get=async()=>{
 const response=await (deps.fetch||fetch)('https://www.googleapis.com'+metadataPath,{headers:{Authorization:'Bearer '+access}});
 if(response.status===404)return null;if(!response.ok)throw Error('Arsip Drive belum dapat diperiksa.');return response.json();
 };
 let meta=await get();
 if(!meta){
 const boundary='yg-pjum-'+crypto.randomUUID(),metadata={id:driveId,name:file.purpose+'-'+file.request_id.slice(0,8)+'-'+file.filename,mimeType:file.mime,parents:[root],appProperties:{ygAdvanceFile:file.id,ygAdvanceRequest:file.request_id,ygAdvancePurpose:file.purpose}};
 const body=new Blob(['--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(metadata)+'\r\n--'+boundary+'\r\nContent-Type: '+file.mime+'\r\n\r\n',bytes,'\r\n--'+boundary+'--\r\n']);
 await call('/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body});
 meta=await get();if(!meta)throw Error('Arsip Drive belum terkonfirmasi.');
 }
 const url=verifyAdvanceArchive(meta,file,claim,hash,root);
 await q(env,"UPDATE yg_advance_drive SET status='archived',web_url=?,error=NULL,retry_at=0,updated_at=? WHERE file_id=? AND lease_owner=?",url,now(),file.id,owner).run();
 return {status:'archived',url};
 }catch(error){
 if(deps.onError)deps.onError(error);
 await q(env,"UPDATE yg_advance_drive SET status='error',error=?,retry_at=?,updated_at=? WHERE file_id=? AND lease_owner=?",'Arsip Drive belum berhasil. Dokumen unggahan tetap aman; coba sinkronisasi kembali.',Date.now()+300000,now(),file.id,owner).run();
 return {status:'error'};
 }finally{await q(env,'UPDATE yg_advance_drive SET lease_owner=NULL,lease_until=0 WHERE file_id=? AND lease_owner=?',file.id,owner).run();}
}
export async function syncAdvanceDrive(env,requestId=null){
 if(!env.FINANCE_DRIVE_FOLDER_ID)return;
 const files=(await q(env,"SELECT f.* FROM yg_advance_files f LEFT JOIN yg_advance_drive d ON d.file_id=f.id WHERE (d.file_id IS NULL OR (d.status!='archived' AND d.retry_at<=?))"+(requestId?' AND f.request_id=?':'')+' ORDER BY f.created_at LIMIT 3',Date.now(),...(requestId?[requestId]:[])).all()).results;
 for(const file of files)await archiveAdvanceFile(env,file);
}
