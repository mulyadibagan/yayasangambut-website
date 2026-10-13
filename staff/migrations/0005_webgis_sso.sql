CREATE TABLE webgis_access(email TEXT PRIMARY KEY,scope TEXT NOT NULL CHECK(scope IN ('webgis-staff','kups-finance')),disabled INTEGER NOT NULL DEFAULT 0);
CREATE TABLE webgis_codes(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),challenge TEXT NOT NULL,state TEXT NOT NULL,scope TEXT NOT NULL,role TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE webgis_sessions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),scope TEXT NOT NULL,role TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE INDEX webgis_session_expiry ON webgis_sessions(expires);
