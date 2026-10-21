CREATE TABLE team_sizes (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 size TEXT NOT NULL CHECK(size IN ('XS','S','M','L','XL','XXL','3XL','4XL','5XL')),
 version INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL,
 updated_by TEXT NOT NULL
);
CREATE UNIQUE INDEX team_sizes_name ON team_sizes(name COLLATE NOCASE);
