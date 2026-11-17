// Project native application requests into the existing Finance register so
// its detail/document routes resolve the same IDs as the live summary.
export const nativeAdvanceArchiveTriggers=[
`CREATE TRIGGER IF NOT EXISTS yg_project_native_advance
AFTER UPDATE OF status ON yg_advance_requests
WHEN NEW.legacy_id IS NULL AND NEW.status IN ('disbursed','pjum_draft','pjum_returned','pjum_submitted','pjum_checked','settlement','closed')
BEGIN
 INSERT INTO finance_requests(id,type,code,title,project,submitter,submitted_at,amount,balance,status,notes,advance_amount,document_number,document_url)
 VALUES('UM-WORKFLOW-'||NEW.id,'UM','',json_extract(NEW.payload,'$.activity'),COALESCE(json_extract(NEW.payload,'$.project_id'),json_extract(NEW.payload,'$.project')),NEW.creator_name,NEW.created_at,NEW.total,0,'Dicairkan','',NEW.total,'UM-'||substr(NEW.created_at,1,4)||'-'||printf('%05d',NEW.seq),'/finance/advances?id='||NEW.id)
 ON CONFLICT(id) DO UPDATE SET title=excluded.title,project=excluded.project,amount=excluded.amount,advance_amount=excluded.advance_amount,status='Dicairkan';
 INSERT INTO finance_requests(id,type,code,title,project,submitter,submitted_at,amount,balance,status,notes,parent_um_id,advance_amount,actual_amount,document_number,document_url)
 SELECT 'PJUM-WORKFLOW-'||NEW.id,'PJUM','',json_extract(NEW.payload,'$.activity'),COALESCE(json_extract(NEW.payload,'$.project_id'),json_extract(NEW.payload,'$.project')),NEW.creator_name,json_extract(NEW.report,'$.report_date'),NEW.actual,NEW.total-NEW.actual,
 CASE WHEN NEW.status IN ('closed','settlement') THEN 'Disetujui' WHEN NEW.status='pjum_checked' THEN 'Menunggu Persetujuan' WHEN NEW.status='pjum_submitted' THEN 'Dilaporkan ke Riena' WHEN NEW.status='pjum_returned' THEN 'Perlu Revisi' ELSE 'Draf' END,
 '', 'UM-WORKFLOW-'||NEW.id,NEW.total,NEW.actual,json_extract(NEW.report,'$.report_number'),'/finance/advances?id='||NEW.id
 WHERE NEW.report IS NOT NULL
 ON CONFLICT(id) DO UPDATE SET title=excluded.title,project=excluded.project,submitted_at=excluded.submitted_at,amount=excluded.amount,balance=excluded.balance,status=excluded.status,actual_amount=excluded.actual_amount,document_number=excluded.document_number;
 INSERT OR IGNORE INTO finance_files(id,request_id,object_key,filename,mime_type,size_bytes,uploaded_by,created_at,evidence_kind,document_role,notes)
 SELECT 'ADVANCE-FILE-'||f.id,CASE WHEN f.purpose IN ('um','payment') THEN 'UM-WORKFLOW-'||NEW.id ELSE 'PJUM-WORKFLOW-'||NEW.id END,
 f.storage_key,f.filename,f.mime,f.size,f.actor_email,f.created_at,
 CASE WHEN f.purpose='settlement' THEN 'Bukti pengembalian sisa UM' WHEN f.purpose='payment' THEN 'Bukti pencairan UM' ELSE 'Dokumen UM/PJUM' END,
 CASE WHEN f.mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' THEN 'source_document' ELSE 'supporting_evidence' END,d.web_url
 FROM yg_advance_files f LEFT JOIN yg_advance_drive d ON d.file_id=f.id AND d.status='archived'
 WHERE f.request_id=NEW.id AND (f.purpose IN ('um','payment') OR f.id IN (SELECT json_extract(value,'$.file_id') FROM json_each(NEW.report,'$.items')) OR f.id=(SELECT id FROM yg_advance_files WHERE request_id=NEW.id AND purpose='pjum' AND mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ORDER BY created_at DESC,id DESC LIMIT 1) OR (f.purpose='settlement' AND NEW.total<>NEW.actual)) AND EXISTS(SELECT 1 FROM finance_requests WHERE id=CASE WHEN f.purpose IN ('um','payment') THEN 'UM-WORKFLOW-'||NEW.id ELSE 'PJUM-WORKFLOW-'||NEW.id END);
 INSERT OR IGNORE INTO finance_evidence_registry(id,request_id,source_message_id,file_id,filename,evidence_role,drive_url,content_type,size_bytes,archive_status)
 SELECT f.id,a.request_id,NULL,d.drive_id,f.filename,
 CASE WHEN f.purpose='settlement' THEN 'RETURN_TRANSFER' WHEN f.mime='application/pdf' AND f.purpose='pjum' THEN 'RECEIPT' ELSE 'SOURCE_DOCUMENT' END,
 d.web_url,f.mime,f.size,'archived'
 FROM yg_advance_files f JOIN yg_advance_drive d ON d.file_id=f.id AND d.status='archived'
 JOIN finance_files a ON a.id='ADVANCE-FILE-'||f.id WHERE f.request_id=NEW.id;
 UPDATE finance_requests SET
 document_url=(SELECT d.web_url FROM yg_advance_files f JOIN yg_advance_drive d ON d.file_id=f.id AND d.status='archived' WHERE f.request_id=NEW.id AND f.purpose='pjum' AND f.mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ORDER BY f.created_at DESC,f.id DESC LIMIT 1),
 document_name=(SELECT f.filename FROM yg_advance_files f JOIN yg_advance_drive d ON d.file_id=f.id AND d.status='archived' WHERE f.request_id=NEW.id AND f.purpose='pjum' AND f.mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ORDER BY f.created_at DESC,f.id DESC LIMIT 1)
 WHERE id='PJUM-WORKFLOW-'||NEW.id AND EXISTS(SELECT 1 FROM yg_advance_files f JOIN yg_advance_drive d ON d.file_id=f.id AND d.status='archived' WHERE f.request_id=NEW.id AND f.purpose='pjum' AND f.mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
END`,
`CREATE TRIGGER IF NOT EXISTS yg_complete_native_advance_drive
AFTER UPDATE OF status ON yg_advance_drive
WHEN NEW.status='archived'
BEGIN
 UPDATE yg_advance_requests SET status=status WHERE id=NEW.request_id AND legacy_id IS NULL;
 UPDATE finance_files SET notes=NEW.web_url WHERE id='ADVANCE-FILE-'||NEW.file_id;
END`
];
