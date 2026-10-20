-- Separate archive delivery state; never changes approved invoices or finance records.
CREATE TABLE yg_invoice_drive (
 invoice_id TEXT PRIMARY KEY REFERENCES yg_invoices(id),
 status TEXT NOT NULL DEFAULT 'pending', root_id TEXT NOT NULL,
 file_id TEXT, web_url TEXT, folder_id TEXT, source_hash TEXT,
 pdf_hash TEXT, size INTEGER, archived_at TEXT, error TEXT,
 retry_at INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
);
CREATE TABLE yg_invoice_drive_lock(id INTEGER PRIMARY KEY CHECK(id=1),owner TEXT,lease_until INTEGER NOT NULL DEFAULT 0);
INSERT INTO yg_invoice_drive_lock(id) VALUES(1);
