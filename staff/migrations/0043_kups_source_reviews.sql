-- Private source archive. These observations never post to the cash ledger.
CREATE TABLE kups_source_reviews (
 group_id TEXT PRIMARY KEY REFERENCES kups_groups(id),
 snapshot TEXT NOT NULL,
 version INTEGER NOT NULL,
 updated_by TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
