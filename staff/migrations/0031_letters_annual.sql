-- Preserve every legacy row as a read-only migration snapshot. No tables/data are dropped.
CREATE TABLE surat_annual(
 id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id), data TEXT NOT NULL,
 number_year INTEGER NOT NULL CHECK(number_year BETWEEN 1900 AND 9999),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','approved','issued','cancelled')),
 sequence INTEGER CHECK(sequence>0), number TEXT UNIQUE,
 reserved_sequence INTEGER CHECK(reserved_sequence>0),
 version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 approved_by TEXT, issued_at TEXT, docx_key TEXT, pdf_key TEXT,
 UNIQUE(number_year,sequence), UNIQUE(number_year,reserved_sequence),
 CHECK((sequence IS NULL AND number IS NULL) OR (sequence IS NOT NULL AND number IS NOT NULL))
);
INSERT INTO surat_annual SELECT id,owner,data,CAST(substr(json_extract(data,'$.date'),1,4) AS INTEGER),status,sequence,number,reserved_sequence,version,created_at,updated_at,approved_by,issued_at,docx_key,pdf_key FROM surat;
CREATE TABLE surat_annual_history(id TEXT PRIMARY KEY,surat_id TEXT NOT NULL REFERENCES surat_annual(id),actor TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,version INTEGER NOT NULL,created_at TEXT NOT NULL);
INSERT INTO surat_annual_history SELECT * FROM surat_history;
CREATE TABLE surat_annual_register(number_year INTEGER NOT NULL,sequence INTEGER NOT NULL CHECK(sequence>0),number TEXT NOT NULL UNIQUE,data TEXT NOT NULL,source TEXT NOT NULL,imported_by TEXT NOT NULL REFERENCES users(id),imported_at TEXT NOT NULL,PRIMARY KEY(number_year,sequence));
INSERT INTO surat_annual_register SELECT CAST(substr(number,-4) AS INTEGER),sequence,number,data,source,imported_by,imported_at FROM surat_register;
CREATE TABLE surat_annual_drive(surat_id TEXT NOT NULL REFERENCES surat_annual(id),format TEXT NOT NULL CHECK(format IN ('docx','pdf')),file_id TEXT NOT NULL UNIQUE,web_url TEXT,archived_at TEXT,PRIMARY KEY(surat_id,format));
INSERT INTO surat_annual_drive SELECT * FROM surat_drive;
CREATE TABLE surat_numbering_policy(id INTEGER PRIMARY KEY CHECK(id=1),first_year INTEGER NOT NULL CHECK(first_year=2026),first_number INTEGER NOT NULL CHECK(first_number=65),annual_reset INTEGER NOT NULL CHECK(annual_reset=1),first_letter_id TEXT NOT NULL REFERENCES surat_annual(id),evidence TEXT NOT NULL,activated_by TEXT NOT NULL REFERENCES users(id),activated_at TEXT NOT NULL);
CREATE TRIGGER surat_annual_immutable BEFORE UPDATE ON surat_annual WHEN OLD.number IS NOT NULL AND (NEW.data!=OLD.data OR NEW.number_year!=OLD.number_year OR NEW.number IS NOT OLD.number OR NEW.sequence IS NOT OLD.sequence OR NEW.docx_key IS NOT OLD.docx_key OR NEW.pdf_key IS NOT OLD.pdf_key) BEGIN SELECT RAISE(ABORT,'Final letter is immutable'); END;
CREATE TRIGGER surat_annual_no_delete BEFORE DELETE ON surat_annual BEGIN SELECT RAISE(ABORT,'Letters must be cancelled, never deleted'); END;
CREATE TRIGGER surat_annual_register_collision BEFORE INSERT ON surat_annual_register WHEN EXISTS(SELECT 1 FROM surat_annual WHERE number_year=NEW.number_year AND (sequence=NEW.sequence OR number=NEW.number OR reserved_sequence=NEW.sequence)) BEGIN SELECT RAISE(ABORT,'Register number already reserved or issued'); END;
CREATE TRIGGER surat_annual_number_collision BEFORE UPDATE OF sequence ON surat_annual WHEN NEW.sequence IS NOT NULL AND EXISTS(SELECT 1 FROM surat_annual_register WHERE number_year=NEW.number_year AND (sequence=NEW.sequence OR number=NEW.number)) BEGIN SELECT RAISE(ABORT,'Register number already issued'); END;
CREATE TRIGGER surat_annual_reservation_collision BEFORE UPDATE OF reserved_sequence ON surat_annual WHEN NEW.reserved_sequence IS NOT NULL AND EXISTS(SELECT 1 FROM surat_annual_register WHERE number_year=NEW.number_year AND sequence=NEW.reserved_sequence) BEGIN SELECT RAISE(ABORT,'Register number already issued'); END;
CREATE TRIGGER surat_legacy_no_update BEFORE UPDATE ON surat BEGIN SELECT RAISE(ABORT,'Use annual letter register'); END;
CREATE TRIGGER surat_legacy_no_insert BEFORE INSERT ON surat BEGIN SELECT RAISE(ABORT,'Use annual letter register'); END;
CREATE TRIGGER surat_history_legacy_no_insert BEFORE INSERT ON surat_history BEGIN SELECT RAISE(ABORT,'Use annual letter history'); END;
CREATE TRIGGER surat_register_legacy_no_insert BEFORE INSERT ON surat_register BEGIN SELECT RAISE(ABORT,'Use annual historical register'); END;
