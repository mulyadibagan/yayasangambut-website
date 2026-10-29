CREATE TABLE kups_cba_plans(group_id TEXT PRIMARY KEY REFERENCES kups_groups(id),payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,updated_by TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE kups_cba_costs(id TEXT PRIMARY KEY,group_id TEXT NOT NULL REFERENCES kups_groups(id),date TEXT NOT NULL,category TEXT NOT NULL,description TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>0),activity_ref TEXT NOT NULL DEFAULT '',created_by TEXT NOT NULL,created_at TEXT NOT NULL,deleted_at TEXT);
CREATE INDEX kups_cba_costs_group_date ON kups_cba_costs(group_id,date);
