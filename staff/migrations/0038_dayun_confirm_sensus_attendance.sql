-- Attendance confirmed explicitly by the user on 31 October 2026.
-- Preserve participant IDs, emails and notes. Refuse to overwrite a changed roster/version.
WITH confirmed AS (
 SELECT *,json_set(payload,
  '$.participants',json((SELECT json_group_array(json_set(value,'$.status','present')) FROM json_each(payload,'$.participants'))),
  '$.notes','Sebelas peserta telah dikonfirmasi hadir oleh pengurus pada 31 Oktober 2026. Laporan dan dokumentasi tersedia pada Perkembangan Lapangan.'
 ) AS confirmed_payload
 FROM kups_activities
 WHERE id='dayun-sensus-20261031' AND group_id='dayun-rimba-sejahtera' AND version=2
 AND json_array_length(payload,'$.participants')=11
 AND (SELECT count(DISTINCT json_extract(value,'$.name')) FROM json_each(payload,'$.participants'))=11
 AND NOT EXISTS (SELECT 1 FROM json_each(payload,'$.participants')
  WHERE json_extract(value,'$.name') NOT IN ('Yurmayenti','Devi','Nilawati','Yelni','Tuti','Mariati','Umi Kalsum','Hasnaf','Kartini','Ono','Siti')
  OR json_extract(value,'$.status')!='planned')
)
INSERT INTO kups_activity_audit(id,group_id,actor,action,target,snapshot,created_at)
SELECT 'dayun-sensus-20261031-confirm-attendance',group_id,'user-confirmation','confirm-attendance',id,
 json_object('before',json(payload),'after',json(confirmed_payload),'basis','Pengguna mengonfirmasi seluruh 11 peserta hadir pada 31 Oktober 2026.'),
 strftime('%Y-%m-%dT%H:%M:%SZ','now') FROM confirmed WHERE true
ON CONFLICT(id) DO NOTHING;

UPDATE kups_activities SET
 payload=json_extract((SELECT snapshot FROM kups_activity_audit WHERE id='dayun-sensus-20261031-confirm-attendance'),'$.after'),
 updated_by='user-confirmation',updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now'),version=version+1
WHERE id='dayun-sensus-20261031' AND group_id='dayun-rimba-sejahtera' AND version=2
AND payload=json_extract((SELECT snapshot FROM kups_activity_audit WHERE id='dayun-sensus-20261031-confirm-attendance'),'$.before');
