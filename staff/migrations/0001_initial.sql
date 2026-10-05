CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('staff','editor','admin')), disabled INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, last_login TEXT NOT NULL);
CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
CREATE TABLE oauth_states (id TEXT PRIMARY KEY, nonce TEXT NOT NULL, verifier TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE posts (id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, language TEXT NOT NULL CHECK(language IN ('id','en')), summary TEXT NOT NULL, category TEXT NOT NULL, author TEXT NOT NULL, body TEXT NOT NULL, cover TEXT NOT NULL DEFAULT '', image_alt TEXT NOT NULL DEFAULT '', image_credit TEXT NOT NULL DEFAULT '', status TEXT NOT NULL CHECK(status IN ('draft','review','publishing','published')), version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, published_at TEXT, publishing_started_at TEXT, github_sha TEXT, content_sha TEXT, publish_error TEXT, review_note TEXT NOT NULL DEFAULT '');
CREATE TABLE media (id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id), filename TEXT NOT NULL, type TEXT NOT NULL, size INTEGER NOT NULL, public INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE audit (id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX sessions_expiry ON sessions(expires);
CREATE INDEX posts_owner ON posts(owner,updated_at);
CREATE INDEX media_owner ON media(owner,created_at);
