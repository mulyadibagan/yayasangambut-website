ALTER TABLE yg_advance_requests ADD COLUMN legacy_id TEXT;
CREATE UNIQUE INDEX yg_advance_legacy_unique ON yg_advance_requests(legacy_id) WHERE legacy_id IS NOT NULL;
ALTER TABLE yg_advance_files ADD COLUMN pages INTEGER;
CREATE TABLE yg_advance_ocr (
 request_id TEXT NOT NULL REFERENCES yg_advance_requests(id),
 file_id TEXT NOT NULL REFERENCES yg_advance_files(id),page INTEGER NOT NULL CHECK(page>0),
 result TEXT NOT NULL CHECK(json_valid(result)),created_at TEXT NOT NULL,
 PRIMARY KEY(request_id,file_id,page)
);
