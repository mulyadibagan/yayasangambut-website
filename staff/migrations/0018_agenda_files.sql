CREATE TABLE agenda_files (
 id TEXT PRIMARY KEY,
 agenda_id TEXT NOT NULL REFERENCES team_agendas(id),
 actor TEXT NOT NULL REFERENCES users(id),
 filename TEXT NOT NULL,
 type TEXT NOT NULL,
 size INTEGER NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX agenda_files_agenda ON agenda_files(agenda_id,created_at);
