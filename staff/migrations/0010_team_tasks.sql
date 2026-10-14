CREATE TABLE team_tasks (
 id TEXT PRIMARY KEY,
 creator TEXT NOT NULL REFERENCES users(id),
 assigned_by TEXT NOT NULL REFERENCES users(id),
 title TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 program TEXT NOT NULL DEFAULT '',
 location TEXT NOT NULL DEFAULT '',
 assignees TEXT NOT NULL CHECK(json_valid(assignees)),
 due_date TEXT NOT NULL,
 priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high')),
 status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','doing','review','done')),
 archived INTEGER NOT NULL DEFAULT 0,
 version INTEGER NOT NULL DEFAULT 1,
 mutation_id TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX team_tasks_due ON team_tasks(archived,status,due_date);
CREATE TABLE task_updates (
 id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES team_tasks(id),
 actor TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL,
 body TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX task_updates_task ON task_updates(task_id,created_at);
CREATE TABLE task_files (
 id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES team_tasks(id),
 actor TEXT NOT NULL REFERENCES users(id), filename TEXT NOT NULL,
 type TEXT NOT NULL, size INTEGER NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX task_files_task ON task_files(task_id,created_at);
