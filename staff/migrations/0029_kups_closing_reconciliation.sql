CREATE TABLE kups_reconciliations (
  group_id TEXT NOT NULL REFERENCES kups_groups(id),
  month TEXT NOT NULL,
  cash_amount INTEGER NOT NULL CHECK(cash_amount>=0 AND cash_amount<=1000000000000),
  bank_amount INTEGER NOT NULL CHECK(bank_amount>=0 AND bank_amount<=1000000000000),
  book_amount REAL NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(group_id,month)
);
