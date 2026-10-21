-- Keep each approved layout and its Drive links independently; preserve all legacy tables.
CREATE TABLE surat_renditions(
 surat_id TEXT NOT NULL REFERENCES surat_annual(id), layout TEXT NOT NULL,
 docx_key TEXT NOT NULL, pdf_key TEXT NOT NULL,
 created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL,
 PRIMARY KEY(surat_id,layout)
);
INSERT INTO surat_renditions SELECT * FROM surat_layout_archives;
CREATE TABLE surat_rendition_drive(
 surat_id TEXT NOT NULL, layout TEXT NOT NULL,
 format TEXT NOT NULL CHECK(format IN ('docx','pdf')),
 file_id TEXT NOT NULL UNIQUE, web_url TEXT, archived_at TEXT,
 PRIMARY KEY(surat_id,layout,format),
 FOREIGN KEY(surat_id,layout) REFERENCES surat_renditions(surat_id,layout)
);
INSERT INTO surat_rendition_drive
 SELECT d.surat_id,l.layout,d.format,d.file_id,d.web_url,d.archived_at
 FROM surat_layout_drive d JOIN surat_layout_archives l ON l.surat_id=d.surat_id;
