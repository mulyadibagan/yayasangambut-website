-- New application workflow; historical Finance records remain untouched.
CREATE TABLE yg_advance_requests (
 seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL UNIQUE,
 creator TEXT NOT NULL REFERENCES users(id),creator_email TEXT NOT NULL,creator_name TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'draft',payload TEXT NOT NULL CHECK(json_valid(payload)),
 total INTEGER NOT NULL CHECK(total>0),report TEXT CHECK(report IS NULL OR json_valid(report)),
 actual INTEGER,paid_date TEXT,payment_reference TEXT,settlement_reference TEXT,
 note TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 1,last_event TEXT NOT NULL,
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX yg_advance_payment_reference ON yg_advance_requests(payment_reference) WHERE payment_reference IS NOT NULL;
CREATE UNIQUE INDEX yg_advance_settlement_reference ON yg_advance_requests(settlement_reference) WHERE settlement_reference IS NOT NULL;
CREATE INDEX yg_advance_owner ON yg_advance_requests(creator,created_at);
CREATE TABLE yg_advance_events (
 id TEXT PRIMARY KEY,request_id TEXT NOT NULL REFERENCES yg_advance_requests(id),
 actor_email TEXT NOT NULL,action TEXT NOT NULL,version INTEGER NOT NULL,
 snapshot TEXT NOT NULL CHECK(json_valid(snapshot)),created_at TEXT NOT NULL,
 UNIQUE(request_id,version)
);
CREATE TABLE yg_advance_files (
 id TEXT PRIMARY KEY,request_id TEXT NOT NULL REFERENCES yg_advance_requests(id),
 purpose TEXT NOT NULL CHECK(purpose IN ('um','pjum','payment','settlement')),
 filename TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,storage_key TEXT NOT NULL UNIQUE,
 actor_email TEXT NOT NULL,created_at TEXT NOT NULL
);
