-- Independent outgoing documents; never writes finance_* or bank registers.
CREATE TABLE yg_invoice_sequences(year INTEGER PRIMARY KEY,last_no INTEGER NOT NULL);
-- User requested 10/YG-RAPP/26; GEC 009/YG-GEC/26 is the prior reference.
-- Earlier numbers remain reserved, even though historical invoices are not imported.
INSERT INTO yg_invoice_sequences VALUES(2026,9);
CREATE TABLE yg_invoices(
 id TEXT PRIMARY KEY,year INTEGER NOT NULL,seq INTEGER NOT NULL,number TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','issued','cancelled')),
 data TEXT NOT NULL,amount INTEGER NOT NULL,total INTEGER NOT NULL,version INTEGER NOT NULL DEFAULT 1,
 creation_hash TEXT NOT NULL,creator TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 last_event TEXT NOT NULL,issued_at TEXT,issued_by TEXT,pdf_key TEXT,pdf_hash TEXT,
 UNIQUE(year,seq)
);
CREATE TRIGGER yg_invoice_number_order BEFORE INSERT ON yg_invoices BEGIN
 SELECT CASE WHEN NEW.seq != COALESCE((SELECT last_no FROM yg_invoice_sequences WHERE year=NEW.year),0)+1
 THEN RAISE(ABORT,'invoice_sequence') END;
END;
CREATE TRIGGER yg_invoice_number_advance AFTER INSERT ON yg_invoices BEGIN
 INSERT INTO yg_invoice_sequences(year,last_no) VALUES(NEW.year,NEW.seq)
 ON CONFLICT(year) DO UPDATE SET last_no=NEW.seq;
END;
CREATE TRIGGER yg_invoice_number_immutable BEFORE UPDATE OF year,seq,number ON yg_invoices BEGIN
 SELECT RAISE(ABORT,'invoice_number_immutable');
END;
CREATE TABLE yg_invoice_events(id TEXT PRIMARY KEY,invoice_id TEXT NOT NULL REFERENCES yg_invoices(id),actor TEXT NOT NULL,action TEXT NOT NULL,version INTEGER NOT NULL,snapshot TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE yg_invoice_files(id TEXT PRIMARY KEY,invoice_id TEXT NOT NULL REFERENCES yg_invoices(id),purpose TEXT NOT NULL,filename TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,actor TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX yg_invoice_events_request ON yg_invoice_events(invoice_id,version);
CREATE INDEX yg_invoice_files_request ON yg_invoice_files(invoice_id);
