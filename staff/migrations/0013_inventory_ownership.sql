ALTER TABLE inventory_assets ADD COLUMN ownership TEXT NOT NULL DEFAULT 'yg' CHECK(ownership IN ('yg','personal'));
ALTER TABLE inventory_assets ADD COLUMN owner_name TEXT NOT NULL DEFAULT 'Yayasan Gambut';
ALTER TABLE inventory_assets ADD COLUMN funding_source TEXT NOT NULL DEFAULT '';
ALTER TABLE inventory_assets ADD COLUMN acquired_year INTEGER;
ALTER TABLE inventory_photos ADD COLUMN kind TEXT NOT NULL DEFAULT 'photo' CHECK(kind IN ('photo','receipt'));
UPDATE inventory_assets SET acquired_year=CAST(substr(acquired_date,1,4) AS INTEGER) WHERE acquired_date<>'';
