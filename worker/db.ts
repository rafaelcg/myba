import { Env } from './index';

// Initialize database with schema
export async function initializeDatabase(env: Env): Promise<void> {
  try {
    try {
      await env.DB.prepare('SELECT 1 FROM tickets LIMIT 1').first();
    } catch {
      console.log('Initializing database...');
    }

    // Create tables and indexes.
    const statements = [
      `CREATE TABLE IF NOT EXISTS tickets (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        project_key TEXT DEFAULT 'local',
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'todo',
        assignee TEXT,
        version TEXT,
        priority TEXT DEFAULT 'medium',
        gitlab_issue_id TEXT,
        gitlab_issue_number INTEGER,
        generated_content TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS gitlab_integrations (
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
      )`,
      `CREATE TABLE IF NOT EXISTS gitlab_oauth_states (
        state TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS team_members (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        avatar_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS project_fields (
        id TEXT PRIMARY KEY,
        project_key TEXT NOT NULL,
        user_id TEXT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        options_json TEXT,
        show_on_board INTEGER DEFAULT 0,
        order_index INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS ticket_field_values (
        ticket_id TEXT NOT NULL,
        field_id TEXT NOT NULL,
        value_text TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (ticket_id, field_id)
      )`,
      `CREATE TABLE IF NOT EXISTS "user" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "email" TEXT NOT NULL UNIQUE,
        "emailVerified" INTEGER NOT NULL,
        "image" TEXT,
        "createdAt" TEXT NOT NULL,
        "updatedAt" TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS "session" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "expiresAt" TEXT NOT NULL,
        "token" TEXT NOT NULL UNIQUE,
        "createdAt" TEXT NOT NULL,
        "updatedAt" TEXT NOT NULL,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "userId" TEXT NOT NULL REFERENCES "user" ("id")
      )`,
      `CREATE TABLE IF NOT EXISTS "account" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "accountId" TEXT NOT NULL,
        "providerId" TEXT NOT NULL,
        "userId" TEXT NOT NULL REFERENCES "user" ("id"),
        "accessToken" TEXT,
        "refreshToken" TEXT,
        "idToken" TEXT,
        "accessTokenExpiresAt" TEXT,
        "refreshTokenExpiresAt" TEXT,
        "scope" TEXT,
        "password" TEXT,
        "createdAt" TEXT NOT NULL,
        "updatedAt" TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS "verification" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "identifier" TEXT NOT NULL,
        "value" TEXT NOT NULL,
        "expiresAt" TEXT NOT NULL,
        "createdAt" TEXT NOT NULL,
        "updatedAt" TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)`,
      `CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets(assignee)`,
      `CREATE INDEX IF NOT EXISTS idx_tickets_version ON tickets(version)`,
      `CREATE INDEX IF NOT EXISTS idx_tickets_updated ON tickets(updated_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_gitlab_oauth_states_expires_at ON gitlab_oauth_states(expires_at)`,
      `CREATE INDEX IF NOT EXISTS idx_ticket_field_values_field ON ticket_field_values(field_id)`
    ];

    for (const sql of statements) {
      await env.DB.prepare(sql).run();
    }

    // Ensure columns exist for deployments that were initialized before this schema version.
    const alterStatements = [
      `ALTER TABLE gitlab_integrations ADD COLUMN access_token_expires_at DATETIME`,
      `ALTER TABLE gitlab_integrations ADD COLUMN updated_at DATETIME`,
      `ALTER TABLE gitlab_integrations ADD COLUMN repo_path TEXT`,
      `ALTER TABLE gitlab_integrations ADD COLUMN repo_web_url TEXT`,
      `ALTER TABLE tickets ADD COLUMN user_id TEXT`,
      `ALTER TABLE tickets ADD COLUMN project_key TEXT DEFAULT 'local'`,
      `ALTER TABLE tickets ADD COLUMN generated_content TEXT`,
      `ALTER TABLE tickets ADD COLUMN notes TEXT`,
      `ALTER TABLE project_fields ADD COLUMN user_id TEXT`,
    ];

    for (const sql of alterStatements) {
      try {
        await env.DB.prepare(sql).run();
      } catch (error) {
        const message = String((error as Error)?.message || error);
        if (!message.includes('duplicate column name')) {
          throw error;
        }
      }
    }

    // Create this index only after legacy tables have been upgraded with scoped columns.
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_tickets_user_project_updated
      ON tickets(user_id, project_key, updated_at DESC)
    `).run();

    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_project_fields_scope_order
      ON project_fields(project_key, user_id, order_index)
    `).run();

    await env.DB.prepare(`
      UPDATE tickets
      SET project_key = 'local'
      WHERE project_key IS NULL
    `).run();

    await env.DB.prepare(`
      UPDATE tickets
      SET notes = description
      WHERE notes IS NULL AND description IS NOT NULL
    `).run();
  } catch (error) {
    console.error('Database initialization error:', error);
    // Don't throw - let the app continue even if init fails
  }
}
