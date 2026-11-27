-- Reconcile the existing Dayun advance with its posted bank debit.
-- No cash posting: the bank register already contains the transfer.
WITH matching_debits AS (
  SELECT a.id, json_extract(entry.value, '$.row.description') AS description
  FROM yg_advance_requests a
  JOIN finance_settings s ON s.setting_key = 'bank_statement_updates_v1'
  JOIN json_each(s.setting_value) entry
  WHERE a.id = '23763bf4-7376-4219-87fd-b783fe1858a1'
    AND json_extract(a.payload, '$.project_id') = 'APRIL'
    AND a.status = 'approved' AND a.payment_reference IS NULL
    AND json_extract(entry.value, '$.row.debit') = a.total
    AND json_extract(entry.value, '$.row.credit') = 0
    AND json_extract(entry.value, '$.row.description') LIKE 'CK 699037-UM pendampingan KUPS%Transfer 00699037 %'
    AND EXISTS (SELECT 1 FROM json_each(entry.value,'$.allocations') alloc
                WHERE json_extract(alloc.value,'$.bucket') = 'APRIL'
                  AND json_extract(alloc.value,'$.amount') = -a.total)
)
UPDATE yg_advance_requests
SET status = 'disbursed', paid_date = '2026-11-25',
    payment_reference = '00699037', version = version + 1,
    last_event = 'bank-reconciliation-dayun-00699037',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE id IN (SELECT id FROM matching_debits GROUP BY id HAVING COUNT(*) = 1);

INSERT INTO yg_advance_events(id, request_id, actor_email, action, version, snapshot, created_at)
SELECT last_event, id, 'system', 'disburse', version,
       json_object('amount',total,'date',paid_date,'reference',payment_reference,'source','bank_statement_updates_v1'),
       updated_at
FROM yg_advance_requests
WHERE last_event = 'bank-reconciliation-dayun-00699037'
  AND NOT EXISTS (SELECT 1 FROM yg_advance_events WHERE id = 'bank-reconciliation-dayun-00699037');
