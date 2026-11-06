CREATE TABLE yg_payroll_staff_bank (
 staff_key TEXT PRIMARY KEY, name TEXT NOT NULL, bank TEXT NOT NULL,
 account TEXT NOT NULL, account_name TEXT NOT NULL,
 version INTEGER NOT NULL, actor TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE yg_payroll_staff_bank_history (
 id TEXT PRIMARY KEY, staff_key TEXT NOT NULL, version INTEGER NOT NULL,
 snapshot TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(staff_key,version)
);
