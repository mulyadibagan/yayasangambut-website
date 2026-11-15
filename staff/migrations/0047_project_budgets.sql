CREATE TABLE yg_project_budgets (
 project_id TEXT PRIMARY KEY,
 version INTEGER NOT NULL,
 payload TEXT NOT NULL,
 updated_by TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE yg_project_budget_history (
 project_id TEXT NOT NULL,
 version INTEGER NOT NULL,
 payload TEXT NOT NULL,
 actor TEXT NOT NULL,
 created_at TEXT NOT NULL,
 PRIMARY KEY(project_id,version)
);
