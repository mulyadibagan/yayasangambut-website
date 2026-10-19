CREATE TABLE team_agendas (
 id TEXT PRIMARY KEY, creator TEXT NOT NULL REFERENCES users(id),
 title TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('field','meeting','event','travel','other')),
 program TEXT NOT NULL DEFAULT '',location TEXT NOT NULL DEFAULT '',coordinator TEXT NOT NULL DEFAULT '',
 start_at TEXT NOT NULL,end_at TEXT NOT NULL,
 participant_ids TEXT NOT NULL CHECK(json_valid(participant_ids)),participants TEXT NOT NULL DEFAULT '',
 description TEXT NOT NULL DEFAULT '',results TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','ongoing','done','cancelled')),
 version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL
);
CREATE INDEX team_agendas_dates ON team_agendas(start_at,end_at);
INSERT INTO team_agendas(id,creator,title,kind,program,location,coordinator,start_at,end_at,participant_ids,participants,description,status,created_at,updated_at)
SELECT 'dayun-20261012-14',id,'Koordinasi dan Pemetaan Agroforestri Dayun','field','Agroforestri Dayun · APRIL','Dayun, Kabupaten Siak; perjalanan kembali ke Pekanbaru','Mulyadi','2026-10-12T00:00','2026-10-14T23:59',
 (SELECT json_group_array(id) FROM users WHERE email='mulyadi@yayasangambut.org' OR name LIKE 'Rasid%' OR name LIKE 'Zamharir%' OR name LIKE 'Rafi%'),
 'Mulyadi, Rasid, Zamharir, Rafi Merbamas',
 '12 Oktober — Dayun: pertemuan dengan APRIL, NPM, dan KUPS untuk membahas CBA dan SOP.
13 Oktober — Dayun: pemetaan area agroforestri bersama Rasid, Mulyadi, Zamharir, dan Rafi Merbamas serta penyusunan CBA.
14 Oktober — perjalanan Dayun–Pekanbaru, koordinasi dengan Balai Perhutanan Sosial dan APRIL, serta penyampaian hasil analisis CBA.',
 'ongoing','2026-10-14T12:29:02Z','2026-10-14T12:29:02Z' FROM users WHERE email='mulyadi@yayasangambut.org';
