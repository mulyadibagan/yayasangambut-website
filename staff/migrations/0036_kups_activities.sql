CREATE TABLE kups_activities (
 id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES kups_groups(id),
 event_date TEXT NOT NULL, payload TEXT NOT NULL, source_ref TEXT NOT NULL DEFAULT '',
 created_by TEXT NOT NULL, updated_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX kups_activities_group_date ON kups_activities(group_id,event_date);
CREATE UNIQUE INDEX kups_activity_source ON kups_activities(group_id,source_ref) WHERE source_ref!='';
CREATE TABLE kups_activity_audit (
 id TEXT PRIMARY KEY, group_id TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL,
 target TEXT NOT NULL, snapshot TEXT NOT NULL, created_at TEXT NOT NULL
);
INSERT INTO kups_activities(id,group_id,event_date,payload,source_ref,created_by,updated_by,created_at,updated_at) VALUES('dayun-panen-20261027','dayun-rimba-sejahtera','2026-10-27','{"title":"Panen nanas 27 Oktober 2026","date":"2026-10-27","time":"","kind":"Panen","location":"Blok A: A8–A14 · Blok B: B6–B8","notes":"Dokumentasi panen tersedia. Nama peserta yang hadir belum tercatat; absensi menunggu konfirmasi pengurus.","result":"Panen 267 buah: 209 terjual, 2 dinikmati bersama, 56 reject. Laporan panen: dayun.html#panen-nanas-20261027.","participants":[]}','harvest:2026-10-27','initial-import','initial-import',strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now'));
INSERT INTO kups_activities(id,group_id,event_date,payload,source_ref,created_by,updated_by,created_at,updated_at) VALUES('dayun-sensus-20261031','dayun-rimba-sejahtera','2026-10-31','{"title":"Penghitungan nanas rusak akibat beruk","date":"2026-10-31","time":"07:00","kind":"Sensus tanaman","location":"Blok B dan C · gawangan belakang","notes":"Agenda Sabtu, berangkat pukul 07.00 WIB. Rencana 11 peserta; nama dan kehadiran diisi pengurus pada halaman absensi.","result":"","participants":[]}','agenda:sensus-beruk-2026-10-31','initial-import','initial-import',strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now'));

