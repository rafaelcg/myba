-- Migration: Initial Schema
-- Tag: v1

-- Tickets table (main entity)
CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo',
    assignee TEXT,
    version TEXT,
    priority TEXT DEFAULT 'medium',
    gitlab_issue_id TEXT,
    gitlab_issue_number INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- GitLab integrations (per user)
CREATE TABLE IF NOT EXISTS gitlab_integrations (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    repo_id INTEGER,
    repo_url TEXT,
    repo_name TEXT,
    connected_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Team members
CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets(assignee);
CREATE INDEX IF NOT EXISTS idx_tickets_version ON tickets(version);
CREATE INDEX IF NOT EXISTS idx_tickets_updated ON tickets(updated_at DESC);