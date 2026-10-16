ALTER TABLE inventory_photos ADD COLUMN import_key TEXT;
CREATE UNIQUE INDEX inventory_photo_import_key ON inventory_photos(import_key) WHERE import_key IS NOT NULL;
