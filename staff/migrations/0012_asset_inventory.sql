CREATE TABLE inventory_assets (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL, category TEXT NOT NULL DEFAULT '', acquired_date TEXT NOT NULL DEFAULT '',
 purchase_price REAL, location TEXT NOT NULL DEFAULT '', custodian TEXT NOT NULL DEFAULT '',
 condition TEXT NOT NULL DEFAULT 'Perlu verifikasi', serial_number TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '', source_key TEXT UNIQUE, source_note TEXT NOT NULL DEFAULT '',
 archived INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1,
 created_by TEXT NOT NULL, updated_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE inventory_photos (
 id TEXT PRIMARY KEY, asset_id INTEGER NOT NULL REFERENCES inventory_assets(id),
 object_key TEXT NOT NULL UNIQUE, type TEXT NOT NULL, size INTEGER NOT NULL,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE inventory_history (
 id TEXT PRIMARY KEY, asset_id INTEGER NOT NULL REFERENCES inventory_assets(id),
 actor TEXT NOT NULL, action TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX inventory_photos_asset ON inventory_photos(asset_id,created_at);
CREATE INDEX inventory_history_asset ON inventory_history(asset_id,created_at);
