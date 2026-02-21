-- Migration: GitLab integration hardening
-- Tag: v2

ALTER TABLE gitlab_integrations ADD COLUMN access_token_expires_at DATETIME;
ALTER TABLE gitlab_integrations ADD COLUMN updated_at DATETIME;
ALTER TABLE gitlab_integrations ADD COLUMN repo_path TEXT;
ALTER TABLE gitlab_integrations ADD COLUMN repo_web_url TEXT;

CREATE TABLE IF NOT EXISTS gitlab_oauth_states (
    state TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gitlab_oauth_states_expires_at ON gitlab_oauth_states(expires_at);
