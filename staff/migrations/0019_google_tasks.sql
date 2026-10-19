ALTER TABLE calendar_oauth_states ADD COLUMN requested_tasks INTEGER NOT NULL DEFAULT 0;
ALTER TABLE calendar_connections ADD COLUMN tasks_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE calendar_connections ADD COLUMN tasklist_id TEXT NOT NULL DEFAULT '';
ALTER TABLE calendar_connections ADD COLUMN tasks_last_synced TEXT;
ALTER TABLE calendar_connections ADD COLUMN tasks_error TEXT NOT NULL DEFAULT '';
CREATE TABLE google_task_links (
 user_id TEXT NOT NULL REFERENCES users(id), source_id TEXT NOT NULL,
 task_id TEXT NOT NULL, content_hash TEXT NOT NULL DEFAULT '',
 PRIMARY KEY(user_id,source_id)
);
