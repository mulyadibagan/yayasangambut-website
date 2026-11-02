-- Funding corrections preserve the original salary term and their own audit history.
CREATE TABLE IF NOT EXISTS yg_payroll_staff_funding_amendments(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 term_id TEXT NOT NULL REFERENCES yg_payroll_staff_terms(id),
 funding_source TEXT NOT NULL CHECK(length(trim(funding_source)) BETWEEN 1 AND 200),
 reason TEXT NOT NULL CHECK(length(trim(reason))>0),
 actor TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS yg_payroll_staff_funding_term ON yg_payroll_staff_funding_amendments(term_id,id);
CREATE TRIGGER IF NOT EXISTS yg_payroll_staff_funding_immutable BEFORE UPDATE ON yg_payroll_staff_funding_amendments BEGIN SELECT RAISE(ABORT,'Funding amendments retain their original record'); END;
CREATE TRIGGER IF NOT EXISTS yg_payroll_staff_funding_no_delete BEFORE DELETE ON yg_payroll_staff_funding_amendments BEGIN SELECT RAISE(ABORT,'Funding amendments retain their history'); END;
