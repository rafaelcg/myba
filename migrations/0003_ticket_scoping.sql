-- Migration: Ticket scoping by user and project
-- Tag: v3

ALTER TABLE tickets ADD COLUMN user_id TEXT;
ALTER TABLE tickets ADD COLUMN project_key TEXT DEFAULT 'local';

UPDATE tickets
SET project_key = 'local'
WHERE project_key IS NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_user_project_updated
ON tickets(user_id, project_key, updated_at DESC);
