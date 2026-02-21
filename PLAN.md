# SprintFlow - MVP Implementation Plan

## Goal
Replace the Excel spreadsheet with a working kanban board that:
- Tracks features, status, assigned-to, planned release version
- Uses AI to generate ticket titles from brief descriptions
- Syncs with GitLab issues
- Is fast and easy for the team to use

---

## Phase 1: Core Infrastructure (MUST HAVE)

### 1. Database Setup
**Why:** Current in-memory storage resets on server restart
**What:** SQLite (simple, file-based) or PostgreSQL
**Tables:**
- `tickets` - id, title, description, status, assignee, version, gitlab_issue_id, created_at, updated_at
- `gitlab_integrations` - user_id, access_token, repo_url, connected_at
- `team_members` - id, name, email, avatar_url

### 2. Backend API Endpoints
**Tickets:**
- `GET /api/tickets` - List all tickets
- `POST /api/tickets` - Create ticket
- `PUT /api/tickets/:id` - Update ticket (status, assignee, etc.)
- `DELETE /api/tickets/:id` - Delete ticket

**GitLab Integration:**
- `POST /api/gitlab/connect` - OAuth connect
- `GET /api/gitlab/repos` - List user's repos
- `POST /api/gitlab/sync/:ticketId` - Sync ticket to GitLab issue

**AI:**
- `POST /api/ai/generate-title` - Generate ticket title from description

### 3. AI Integration
**Provider:** OpenRouter (already set up) or OpenAI
**Function:** Take user input like "users want dark mode" → Generate "Implement dark mode support for dashboard"

---

## Phase 2: GitLab Integration (MUST HAVE)

### OAuth Flow
1. User clicks "Connect GitLab"
2. OAuth to GitLab
3. Store access token
4. Let user select repo
5. When ticket created, optionally create GitLab issue

### Two-Way Sync (Optional for MVP)
- **MVP:** One-way (SprintFlow → GitLab)
- **Later:** Sync status changes back from GitLab

---

## Phase 3: Frontend Features

### Working Kanban Board
- Drag and drop between columns (or click to change status)
- Create ticket with AI title generation
- Assign team members
- Set version/tags
- Click to view full ticket details

### Quick Create
- Keyboard shortcut (Cmd/Ctrl + K)
- Type description → AI suggests title → Create ticket

### Real-time Updates (Optional)
- WebSocket or polling for team collaboration

---

## Phase 4: Polish

- Mobile responsiveness
- Keyboard shortcuts
- Search/filter tickets
- Export to CSV (backup)
- Dark mode

---

## Immediate Next Steps

1. **Set up SQLite database** (5 min)
2. **Create tickets table** (10 min)
3. **Build ticket API endpoints** (30 min)
4. **Connect kanban board to real data** (30 min)
5. **Add AI title generation** (20 min)
6. **GitLab OAuth** (1 hour)

**Total MVP time:** ~2.5 hours to working product

---

## Database Schema

```sql
-- Tickets table
CREATE TABLE tickets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo', -- icebox, todo, progress, review, done
    assignee TEXT,
    version TEXT,
    gitlab_issue_id TEXT,
    gitlab_issue_number INTEGER,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- GitLab integrations
CREATE TABLE gitlab_integrations (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    repo_url TEXT,
    repo_name TEXT,
    connected_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Team members
CREATE TABLE team_members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## File Structure

```
server.js                  # Existing Express server
├── /api/tickets           # CRUD endpoints
├── /api/gitlab            # GitLab integration
├── /api/ai                # AI generation
database.js                # SQLite connection
ai-service.js              # OpenRouter integration
gitlab-service.js          # GitLab API wrapper
```

---

Ready to start with database setup?
