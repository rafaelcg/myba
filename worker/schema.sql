-- SprintFlow Database Schema

-- Tickets table (main entity)
CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    project_key TEXT DEFAULT 'local',
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo', -- icebox, todo, progress, review, done
    assignee TEXT,
    version TEXT,
    priority TEXT DEFAULT 'medium', -- low, medium, high
    gitlab_issue_id TEXT,
    gitlab_issue_number INTEGER,
    generated_content TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- GitLab integrations (per user)
CREATE TABLE IF NOT EXISTS gitlab_integrations (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    access_token_expires_at DATETIME,
    repo_id INTEGER,
    repo_url TEXT,
    repo_name TEXT,
    repo_path TEXT,
    repo_web_url TEXT,
    connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME
);

-- GitLab OAuth states for one-time callback validation
CREATE TABLE IF NOT EXISTS gitlab_oauth_states (
    state TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Team members
CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Project-specific custom fields
CREATE TABLE IF NOT EXISTS project_fields (
    id TEXT PRIMARY KEY,
    project_key TEXT NOT NULL,
    user_id TEXT,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- text, select, boolean, number, date
    options_json TEXT,
    show_on_board INTEGER DEFAULT 0,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Values for custom fields keyed by ticket + field
CREATE TABLE IF NOT EXISTS ticket_field_values (
    ticket_id TEXT NOT NULL,
    field_id TEXT NOT NULL,
    value_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ticket_id, field_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets(assignee);
CREATE INDEX IF NOT EXISTS idx_tickets_version ON tickets(version);
CREATE INDEX IF NOT EXISTS idx_tickets_updated ON tickets(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_user_project_updated ON tickets(user_id, project_key, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_gitlab_oauth_states_expires_at ON gitlab_oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_project_fields_scope_order ON project_fields(project_key, user_id, order_index);
CREATE INDEX IF NOT EXISTS idx_ticket_field_values_field ON ticket_field_values(field_id);
