CREATE TABLE agenda_minutes (
 agenda_id TEXT PRIMARY KEY REFERENCES team_agendas(id),
 body TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','final')),
 version INTEGER NOT NULL DEFAULT 0, revision_id TEXT NOT NULL DEFAULT '',
 updated_by TEXT NOT NULL REFERENCES users(id), updated_at TEXT NOT NULL
);
CREATE TABLE agenda_minutes_history (
 id TEXT PRIMARY KEY, agenda_id TEXT NOT NULL REFERENCES team_agendas(id),
 body TEXT NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL,
 actor TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL,
 UNIQUE(agenda_id,version)
);
