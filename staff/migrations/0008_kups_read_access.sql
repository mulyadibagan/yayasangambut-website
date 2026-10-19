-- Requested access: Alfred may read Dayun finance. Preserve stronger existing roles.
INSERT INTO kups_members(group_id,email,role,disabled)
VALUES('dayun-rimba-sejahtera','alfrednobel951@gmail.com','viewer',0)
ON CONFLICT(group_id,email) DO NOTHING;
INSERT INTO webgis_access(email,scope,disabled)
VALUES('alfrednobel951@gmail.com','kups-finance',0)
ON CONFLICT(email) DO NOTHING;
INSERT INTO kups_audit(id,group_id,actor,action,target,snapshot,created_at)
VALUES('migration-0008-alfred-viewer','dayun-rimba-sejahtera','migration:0008','access-policy','alfrednobel951@gmail.com','{"requested_role":"viewer","preserve_existing_access":true}',strftime('%Y-%m-%dT%H:%M:%SZ','now'))
ON CONFLICT(id) DO NOTHING;
