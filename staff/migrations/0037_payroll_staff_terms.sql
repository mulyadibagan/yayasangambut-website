-- Private salary terms are separate from funding receipts, allocations and payments.
CREATE TABLE yg_payroll_staff_terms(
 id TEXT PRIMARY KEY,staff_key TEXT NOT NULL,name TEXT NOT NULL,
 monthly_salary INTEGER NOT NULL CHECK(monthly_salary>0 AND monthly_salary<=10000000000),
 effective_month TEXT NOT NULL CHECK(length(effective_month)=7),funding_source TEXT NOT NULL,
 notes TEXT NOT NULL DEFAULT '',actor TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,
 UNIQUE(staff_key,effective_month)
);
CREATE TRIGGER yg_payroll_staff_terms_immutable BEFORE UPDATE ON yg_payroll_staff_terms BEGIN SELECT RAISE(ABORT,'Salary terms retain their original record'); END;
CREATE TRIGGER yg_payroll_staff_terms_no_delete BEFORE DELETE ON yg_payroll_staff_terms BEGIN SELECT RAISE(ABORT,'Salary terms retain their history'); END;
