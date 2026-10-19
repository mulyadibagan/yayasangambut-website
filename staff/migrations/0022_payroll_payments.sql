-- Additive extension. Historical finance tables and existing approvals are preserved.
ALTER TABLE yg_payroll_requests ADD COLUMN form_meta TEXT NOT NULL DEFAULT '{}';
ALTER TABLE yg_payroll_files ADD COLUMN purpose TEXT NOT NULL DEFAULT 'support';
CREATE UNIQUE INDEX yg_payroll_form_number ON yg_payroll_requests(json_extract(form_meta,'$.number')) WHERE length(json_extract(form_meta,'$.number'))>0;
CREATE TABLE yg_payroll_payments (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES yg_payroll_requests(id),
 paid_date TEXT NOT NULL, source_account TEXT NOT NULL, reference TEXT NOT NULL,
 amount INTEGER NOT NULL CHECK(amount>0), allocations TEXT NOT NULL, proof_ids TEXT NOT NULL,
 bank_entry_id TEXT, notes TEXT NOT NULL DEFAULT '', actor_email TEXT NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(source_account,paid_date,reference)
);
CREATE UNIQUE INDEX yg_payroll_bank_once ON yg_payroll_payments(bank_entry_id) WHERE bank_entry_id IS NOT NULL;
CREATE INDEX yg_payroll_payment_request ON yg_payroll_payments(request_id);
