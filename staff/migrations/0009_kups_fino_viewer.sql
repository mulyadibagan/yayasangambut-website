-- Read-only Dayun finance access requested for the HKm chair.
INSERT INTO kups_members(group_id,email,role,disabled)
VALUES('dayun-rimba-sejahtera','finopoirot@gmail.com','viewer',0)
ON CONFLICT(group_id,email) DO NOTHING;
INSERT INTO webgis_access(email,scope,disabled)
VALUES('finopoirot@gmail.com','kups-finance',0)
ON CONFLICT(email) DO NOTHING;
INSERT INTO kups_audit(id,group_id,actor,action,target,snapshot,created_at)
VALUES('migration-0009-fino-viewer','dayun-rimba-sejahtera','migration:0009','access-policy','finopoirot@gmail.com','{"requested_role":"viewer","preserve_existing_access":true}',strftime('%Y-%m-%dT%H:%M:%SZ','now'))
ON CONFLICT(id) DO NOTHING;
