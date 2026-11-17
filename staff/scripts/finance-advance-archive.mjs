// The bank ledger stays authoritative for cash. These projections link completed
// legacy PJUM reports and their existing files to the main Finance archive.
export const advanceArchiveTriggers=[
`CREATE TRIGGER IF NOT EXISTS yg_archive_completed_legacy_pjum
AFTER UPDATE OF status ON yg_advance_requests
WHEN NEW.status='closed' AND NEW.report IS NOT NULL AND NEW.legacy_id IS NOT NULL
BEGIN
 UPDATE finance_requests SET type='UM',title=json_extract(NEW.payload,'$.activity'),status='Dicairkan'
 WHERE id=NEW.legacy_id AND amount=NEW.total;
 INSERT INTO finance_requests(id,type,code,title,project,submitter,submitted_at,amount,balance,status,notes,parent_um_id,advance_amount,actual_amount,document_number,document_url,document_name,archive_folder_url)
 SELECT 'PJUM-WORKFLOW-'||NEW.id,'PJUM',
  COALESCE((SELECT group_concat(DISTINCT json_extract(value,'$.activity_code')) FROM json_each(NEW.report,'$.items')),''),
  replace(json_extract(NEW.payload,'$.activity'),'Pengajuan UM ',''),f.project,NEW.creator_name,
  json_extract(NEW.report,'$.report_date'),NEW.actual,NEW.total-NEW.actual,'Disetujui',
  'Laporan pertanggungjawaban memuat '||json_array_length(json_extract(NEW.report,'$.items'))||' kuitansi.',
  NEW.legacy_id,NEW.total,NEW.actual,COALESCE(json_extract(NEW.report,'$.report_number'),json_extract(NEW.payload,'$.legacy.number')),
  d.web_url,x.filename,CASE WHEN d.root_id IS NOT NULL THEN 'https://drive.google.com/drive/folders/'||d.root_id ELSE NULL END
 FROM finance_requests f
 LEFT JOIN yg_advance_files x ON x.id=(SELECT id FROM yg_advance_files WHERE request_id=NEW.id AND purpose='pjum' AND mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ORDER BY created_at DESC,id DESC LIMIT 1)
 LEFT JOIN yg_advance_drive d ON d.file_id=x.id AND d.status='archived'
 WHERE f.id=NEW.legacy_id AND f.amount=NEW.total
 ON CONFLICT(id) DO UPDATE SET code=excluded.code,title=excluded.title,project=excluded.project,
 submitter=excluded.submitter,submitted_at=excluded.submitted_at,amount=excluded.amount,balance=excluded.balance,
 status=excluded.status,notes=excluded.notes,parent_um_id=excluded.parent_um_id,advance_amount=excluded.advance_amount,
 actual_amount=excluded.actual_amount,document_number=excluded.document_number,document_url=excluded.document_url,
 document_name=excluded.document_name,archive_folder_url=excluded.archive_folder_url,updated_at=CURRENT_TIMESTAMP;
 INSERT OR IGNORE INTO finance_files(id,request_id,object_key,filename,mime_type,size_bytes,uploaded_by,created_at,evidence_kind,document_role,notes)
 SELECT 'ADVANCE-FILE-'||f.id,'PJUM-WORKFLOW-'||NEW.id,f.storage_key,f.filename,f.mime,f.size,f.actor_email,f.created_at,
  CASE WHEN f.purpose='settlement' THEN 'Bukti pengembalian sisa UM' WHEN f.mime='application/pdf' THEN 'Kuitansi / invoice / bon' ELSE 'Laporan Excel PJUM' END,
  CASE WHEN f.mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' THEN 'source_document' ELSE 'supporting_evidence' END,d.web_url
 FROM yg_advance_files f LEFT JOIN yg_advance_drive d ON d.file_id=f.id AND d.status='archived'
 WHERE f.request_id=NEW.id AND EXISTS(SELECT 1 FROM finance_requests WHERE id='PJUM-WORKFLOW-'||NEW.id)
 AND (f.id IN (SELECT json_extract(value,'$.file_id') FROM json_each(NEW.report,'$.items'))
  OR f.id=(SELECT id FROM yg_advance_files WHERE request_id=NEW.id AND purpose='pjum' AND mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ORDER BY created_at DESC,id DESC LIMIT 1)
  OR (f.purpose='settlement' AND NEW.total<>NEW.actual));
 INSERT OR IGNORE INTO finance_evidence_registry(id,request_id,source_message_id,file_id,filename,evidence_role,drive_url,content_type,size_bytes,archive_status)
 SELECT f.id,'PJUM-WORKFLOW-'||NEW.id,NULL,d.drive_id,f.filename,
  CASE WHEN f.purpose='settlement' THEN 'RETURN_TRANSFER' WHEN f.mime='application/pdf' THEN 'RECEIPT' ELSE 'SOURCE_DOCUMENT' END,
  d.web_url,f.mime,f.size,'archived'
 FROM yg_advance_files f JOIN yg_advance_drive d ON d.file_id=f.id AND d.status='archived'
 JOIN finance_files a ON a.id='ADVANCE-FILE-'||f.id
 WHERE f.request_id=NEW.id AND a.request_id='PJUM-WORKFLOW-'||NEW.id;
 INSERT INTO finance_audit(request_id,action,actor,actor_email)
 SELECT 'PJUM-WORKFLOW-'||NEW.id,'Integrasi PJUM selesai: '||NEW.last_event,'Sistem YG Finance',''
 WHERE EXISTS(SELECT 1 FROM finance_requests WHERE id='PJUM-WORKFLOW-'||NEW.id)
 AND NOT EXISTS(SELECT 1 FROM finance_audit WHERE request_id='PJUM-WORKFLOW-'||NEW.id AND action='Integrasi PJUM selesai: '||NEW.last_event);
END`,
`CREATE TRIGGER IF NOT EXISTS yg_preserve_completed_advance_source
AFTER UPDATE OF type,title,status ON finance_requests
WHEN EXISTS(SELECT 1 FROM yg_advance_requests r WHERE r.legacy_id=NEW.id AND r.status='closed' AND r.total=NEW.amount
 AND (NEW.type<>'UM' OR NEW.title<>json_extract(r.payload,'$.activity') OR NEW.status<>'Dicairkan'))
BEGIN
 UPDATE finance_requests SET type='UM',title=(SELECT json_extract(payload,'$.activity') FROM yg_advance_requests WHERE legacy_id=NEW.id AND status='closed'),status='Dicairkan'
 WHERE id=NEW.id;
END`,
`CREATE TRIGGER IF NOT EXISTS yg_complete_pjum_drive_links
AFTER UPDATE OF status ON yg_advance_drive
WHEN NEW.status='archived'
BEGIN
 UPDATE yg_advance_requests SET status=status WHERE id=NEW.request_id AND status='closed' AND legacy_id IS NOT NULL;
END`
];

export async function installAdvanceArchive(query){
 const required=['yg_advance_requests','yg_advance_files','yg_advance_drive','finance_requests','finance_files','finance_evidence_registry','finance_audit'];
 const tables=await query("SELECT name FROM sqlite_master WHERE type='table'");
 const names=new Set(tables[0].results.map(row=>row.name));
 if(required.some(name=>!names.has(name)))return;
 for(const sql of advanceArchiveTriggers)await query(sql);
 // Replay the projection from previously approved reports, retaining their
 // workflow event IDs and versions. Trigger statements run atomically per row.
 await query("UPDATE yg_advance_requests SET status=status WHERE status='closed' AND legacy_id IS NOT NULL");
}
