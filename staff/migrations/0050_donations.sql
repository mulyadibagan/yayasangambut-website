CREATE TABLE yg_donations (
 id TEXT PRIMARY KEY, seq INTEGER NOT NULL UNIQUE, file_hash TEXT NOT NULL UNIQUE,
 object_key TEXT NOT NULL, mime TEXT NOT NULL, extracted TEXT NOT NULL,
 payload TEXT, transfer_key TEXT UNIQUE, version INTEGER NOT NULL DEFAULT 0, creator_email TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE yg_donation_events (
 id TEXT PRIMARY KEY, donation_id TEXT NOT NULL REFERENCES yg_donations(id),
 version INTEGER NOT NULL, actor_email TEXT NOT NULL, payload TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(donation_id,version)
);
