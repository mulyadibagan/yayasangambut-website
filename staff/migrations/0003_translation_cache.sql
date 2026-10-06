CREATE TABLE translation_cache (
  post_id TEXT NOT NULL REFERENCES posts(id),
  source_hash TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(post_id, source_hash)
);
