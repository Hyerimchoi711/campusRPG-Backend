PRAGMA foreign_keys = ON;

ALTER TABLE users ADD COLUMN kakao_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uk_users_kakao_id ON users(kakao_id);
