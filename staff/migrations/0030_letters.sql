-- Deliberately no counter activation or inferred historical register.
CREATE TABLE IF NOT EXISTS surat_settings(id INTEGER PRIMARY KEY CHECK(id=1), verified INTEGER NOT NULL DEFAULT 0, evidence TEXT, verified_by TEXT, verified_at TEXT);
INSERT OR IGNORE INTO surat_settings(id) VALUES(1);
CREATE TABLE IF NOT EXISTS surat(
 id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id), data TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','approved','issued','cancelled')),
 sequence INTEGER UNIQUE CHECK(sequence>0), number TEXT UNIQUE,
 reserved_sequence INTEGER UNIQUE CHECK(reserved_sequence>0),
 version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 approved_by TEXT, issued_at TEXT, docx_key TEXT, pdf_key TEXT,
 CHECK((sequence IS NULL AND number IS NULL) OR (sequence IS NOT NULL AND number IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS surat_history(id TEXT PRIMARY KEY, surat_id TEXT NOT NULL REFERENCES surat(id), actor TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL, version INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS surat_register(sequence INTEGER PRIMARY KEY CHECK(sequence>0), number TEXT NOT NULL UNIQUE, data TEXT NOT NULL, source TEXT NOT NULL, imported_by TEXT NOT NULL REFERENCES users(id), imported_at TEXT NOT NULL);
-- References are evidence, not proof of a complete register or issuance.
CREATE TABLE IF NOT EXISTS surat_references(sequence INTEGER PRIMARY KEY, number TEXT NOT NULL UNIQUE, date TEXT NOT NULL, subject TEXT NOT NULL, state TEXT NOT NULL);
INSERT OR IGNORE INTO surat_references VALUES(64,'64/YG/SPT/X/2026','2026-10-12','Surat Tugas Riandra Hamdani dan Ainul Azizah — Ekonomi Sekuler Evolve Desa Temiang','reference');
INSERT OR IGNORE INTO surat_references VALUES(65,'65/YG/SKR/X/2026','2026-10-21','Surat Keterangan Rekening Bank — PT Riau Andalan Pulp and Paper','approved_reference');
CREATE TRIGGER IF NOT EXISTS surat_immutable BEFORE UPDATE ON surat WHEN OLD.number IS NOT NULL AND (NEW.data != OLD.data OR NEW.number IS NOT OLD.number OR NEW.sequence IS NOT OLD.sequence OR NEW.docx_key IS NOT OLD.docx_key OR NEW.pdf_key IS NOT OLD.pdf_key) BEGIN SELECT RAISE(ABORT,'Final letter is immutable'); END;
CREATE TRIGGER IF NOT EXISTS surat_no_delete BEFORE DELETE ON surat BEGIN SELECT RAISE(ABORT,'Letters must be cancelled, never deleted'); END;
