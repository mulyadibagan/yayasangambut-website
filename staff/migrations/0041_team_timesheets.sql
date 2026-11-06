CREATE TABLE team_timesheet_files (
 user_id TEXT PRIMARY KEY REFERENCES users(id), file_id TEXT NOT NULL UNIQUE,
 enabled INTEGER NOT NULL DEFAULT 1, managed_json TEXT NOT NULL DEFAULT '{}',
 last_synced TEXT, last_attempt TEXT, last_error TEXT NOT NULL DEFAULT '',
 lock_until INTEGER NOT NULL DEFAULT 0, configured_by TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE team_timesheet_days (
 user_id TEXT NOT NULL REFERENCES users(id), work_date TEXT NOT NULL, program TEXT NOT NULL,
 hours REAL NOT NULL CHECK(hours>0 AND hours<=24), activity TEXT NOT NULL,
 confirmed_by TEXT NOT NULL REFERENCES users(id), updated_at TEXT NOT NULL,
 PRIMARY KEY(user_id,work_date,program)
);
CREATE TRIGGER timesheet_daily_insert BEFORE INSERT ON team_timesheet_days
WHEN NEW.hours+COALESCE((SELECT SUM(hours) FROM team_timesheet_days WHERE user_id=NEW.user_id AND work_date=NEW.work_date AND program!=NEW.program),0)>24
BEGIN SELECT RAISE(ABORT,'Total jam aktual melebihi 24 jam'); END;
CREATE TRIGGER timesheet_daily_update BEFORE UPDATE ON team_timesheet_days
WHEN NEW.hours+COALESCE((SELECT SUM(hours) FROM team_timesheet_days WHERE user_id=NEW.user_id AND work_date=NEW.work_date AND program!=NEW.program),0)>24
BEGIN SELECT RAISE(ABORT,'Total jam aktual melebihi 24 jam'); END;
