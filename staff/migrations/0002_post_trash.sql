ALTER TABLE posts ADD COLUMN deleted_at TEXT;
ALTER TABLE posts ADD COLUMN publish_action TEXT NOT NULL DEFAULT 'publish';
