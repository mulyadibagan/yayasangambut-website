-- Explicit Director corrections preserve all original rows, files, links and rendition metadata.
CREATE TABLE surat_number_corrections(
 id TEXT PRIMARY KEY,batch_id TEXT NOT NULL,surat_id TEXT NOT NULL REFERENCES surat_annual(id),
 old_version INTEGER NOT NULL,old_number TEXT,snapshot TEXT NOT NULL CHECK(json_valid(snapshot)),
 new_sequence INTEGER,new_number TEXT,new_docx_key TEXT,new_pdf_key TEXT,
 reason TEXT NOT NULL,actor TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,
 completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)),
 UNIQUE(surat_id,old_version)
);
CREATE TRIGGER surat_number_correction_tail BEFORE INSERT ON surat_number_corrections
 WHEN NEW.new_number IS NOT NULL AND (
 EXISTS(SELECT 1 FROM surat_annual r WHERE r.number_year=json_extract(NEW.snapshot,'$.row.number_year')
 AND r.id!=NEW.surat_id AND (r.sequence>=NEW.new_sequence OR r.reserved_sequence>=NEW.new_sequence)
 AND (r.status!='cancelled' OR r.sequence>json_extract(NEW.snapshot,'$.row.sequence') OR r.reserved_sequence>json_extract(NEW.snapshot,'$.row.sequence')))
 OR EXISTS(SELECT 1 FROM surat_annual_register h WHERE h.number_year=json_extract(NEW.snapshot,'$.row.number_year') AND h.sequence>=NEW.new_sequence))
 BEGIN SELECT RAISE(ABORT,'Number correction conflicts with current register'); END;
CREATE TRIGGER surat_number_correction_no_delete BEFORE DELETE ON surat_number_corrections
 BEGIN SELECT RAISE(ABORT,'Number correction history is immutable'); END;
CREATE TRIGGER surat_number_correction_complete BEFORE UPDATE ON surat_number_corrections
 WHEN OLD.completed!=0 OR NEW.completed!=1 OR NEW.id IS NOT OLD.id OR NEW.batch_id IS NOT OLD.batch_id OR NEW.surat_id IS NOT OLD.surat_id OR NEW.old_version IS NOT OLD.old_version OR NEW.old_number IS NOT OLD.old_number OR NEW.snapshot IS NOT OLD.snapshot OR NEW.new_sequence IS NOT OLD.new_sequence OR NEW.new_number IS NOT OLD.new_number OR NEW.new_docx_key IS NOT OLD.new_docx_key OR NEW.new_pdf_key IS NOT OLD.new_pdf_key OR NEW.reason IS NOT OLD.reason OR NEW.actor IS NOT OLD.actor OR NEW.created_at IS NOT OLD.created_at OR NOT EXISTS(
 SELECT 1 FROM surat_annual r WHERE r.id=OLD.surat_id AND r.version=OLD.old_version+1
 AND r.number IS OLD.new_number AND r.sequence IS OLD.new_sequence
 AND r.docx_key IS OLD.new_docx_key AND r.pdf_key IS OLD.new_pdf_key AND r.reserved_sequence IS NULL
 ) BEGIN SELECT RAISE(ABORT,'Incomplete or stale number correction'); END;
DROP TRIGGER surat_annual_immutable;
CREATE TRIGGER surat_annual_immutable BEFORE UPDATE ON surat_annual
 WHEN OLD.number IS NOT NULL AND (NEW.data!=OLD.data OR NEW.number_year!=OLD.number_year
 OR NEW.number IS NOT OLD.number OR NEW.sequence IS NOT OLD.sequence
 OR NEW.docx_key IS NOT OLD.docx_key OR NEW.pdf_key IS NOT OLD.pdf_key)
 AND NOT EXISTS(SELECT 1 FROM surat_number_corrections c
 WHERE c.surat_id=OLD.id AND c.old_version=OLD.version AND c.old_number IS OLD.number AND c.completed=0
 AND NEW.number IS c.new_number AND NEW.sequence IS c.new_sequence
 AND NEW.docx_key IS c.new_docx_key AND NEW.pdf_key IS c.new_pdf_key
 AND NEW.data=OLD.data AND NEW.number_year=OLD.number_year AND NEW.status=OLD.status
 AND NEW.owner=OLD.owner AND NEW.approved_by IS OLD.approved_by AND NEW.issued_at IS OLD.issued_at
 AND NEW.version=OLD.version+1 AND NEW.reserved_sequence IS NULL)
 BEGIN SELECT RAISE(ABORT,'Final letter is immutable'); END;
