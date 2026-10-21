-- Alternate renditions preserve the immutable issued document and its original Drive links.
CREATE TABLE surat_layout_archives(
 surat_id TEXT PRIMARY KEY REFERENCES surat_annual(id),
 layout TEXT NOT NULL CHECK(layout='formal-v2'),
 docx_key TEXT NOT NULL, pdf_key TEXT NOT NULL,
 created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TABLE surat_layout_drive(
 surat_id TEXT NOT NULL REFERENCES surat_layout_archives(surat_id),
 format TEXT NOT NULL CHECK(format IN ('docx','pdf')),
 file_id TEXT NOT NULL UNIQUE, web_url TEXT, archived_at TEXT,
 PRIMARY KEY(surat_id,format)
);
