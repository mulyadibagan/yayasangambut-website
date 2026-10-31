-- One confirmed attendee, per the user's instruction: "yur saja".
INSERT INTO kups_activities(id,group_id,event_date,payload,source_ref,created_by,updated_by,created_at,updated_at)
SELECT 'dayun-panen-20261030','dayun-rimba-sejahtera','2026-10-30','{"title":"Panen nanas di Blok B dan C","date":"2026-10-30","time":"","kind":"Panen","location":"B9–B13, C1–C5, dan C7","notes":"Yurmayenti (Yur) hadir mengikuti panen, sesuai konfirmasi pengurus.","result":"Laporan dan catatan panen tersedia di Perkembangan Lapangan: dayun.html#panen-nanas-20261030.","participants":[{"id":"panen-20261030-yurmayenti","name":"Yurmayenti","email":"","status":"present","note":""}]}','harvest:2026-10-30','user-confirmation','user-confirmation',strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now')
WHERE NOT EXISTS(SELECT 1 FROM kups_activities WHERE id='dayun-panen-20261030' OR (group_id='dayun-rimba-sejahtera' AND source_ref='harvest:2026-10-30'));

INSERT INTO kups_activity_audit(id,group_id,actor,action,target,snapshot,created_at)
SELECT 'dayun-panen-20261030-confirm-attendance',group_id,'user-confirmation','confirm-attendance',id,json_object('after',json(payload),'basis','Pengguna mengonfirmasi hanya Yur (Yurmayenti) hadir.'),strftime('%Y-%m-%dT%H:%M:%SZ','now')
FROM kups_activities WHERE id='dayun-panen-20261030' AND created_by='user-confirmation'
ON CONFLICT(id) DO NOTHING;
