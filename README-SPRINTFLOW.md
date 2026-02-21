# SprintFlow

AI-powered ticket management for teams that move fast.

## Features

- **Kanban Board** - Visual workflow (Icebox → To Do → In Progress → Review → Done)
- **AI Title Generation** - Type a description, get a professional ticket title
- **GitLab Integration** - Sync tickets to GitLab issues
- **Team Collaboration** - Assign tickets, track versions

## Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Secrets

Copy the example and fill in your secrets:

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` with your actual keys:
- `OPENROUTER_API_KEY` - From openrouter.ai
- `GITLAB_CLIENT_ID` - From GitLab OAuth app
- `GITLAB_CLIENT_SECRET` - From GitLab OAuth app
- `GITLAB_TOKEN_ENCRYPTION_KEY` - Base64-encoded 32-byte key for token encryption
- `GITLAB_WEBHOOK_SECRET` - Shared secret for GitLab webhook validation
- `CLERK_SECRET_KEY` - From clerk.dev (optional for local dev)
- `APP_BASE_URL` - Frontend URL for OAuth redirects (e.g. `http://localhost:3000`)

When a repository is selected in-app, SprintFlow will attempt to auto-create a GitLab project webhook for issue events (`/api/gitlab/webhook`). This usually requires Maintainer access on the project.

### 3. Run Locally

```bash
npm run dev
```

This starts:
- Frontend: http://localhost:3000
- Worker API: http://localhost:8787

### 4. First Time Database Setup

The database is SQLite (local file) for development. It will auto-initialize on first run.

## Deployment to Cloudflare

### 1. Login to Wrangler

```bash
npx wrangler login
```

### 2. Create D1 Database

```bash
npx wrangler d1 create sprintflow-db
```

Copy the database ID into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "sprintflow-db"
database_id = "your-database-id-here"
```

### 3. Run Migrations

```bash
npx wrangler d1 migrations apply sprintflow-db
```

### 4. Set Secrets

```bash
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put GITLAB_CLIENT_ID
npx wrangler secret put GITLAB_CLIENT_SECRET
npx wrangler secret put GITLAB_TOKEN_ENCRYPTION_KEY
npx wrangler secret put GITLAB_WEBHOOK_SECRET
npx wrangler secret put CLERK_SECRET_KEY
```

### 5. Deploy

```bash
npm run worker:deploy
```

### 6. Deploy Frontend (Cloudflare Pages)

```bash
npm run build
npx wrangler pages deploy dist
```

## Project Structure

```
/
├── src/
│   ├── main.tsx              # React entry with Router
│   ├── pages/
│   │   ├── LandingPage.tsx   # Marketing landing
│   │   └── AppPage.tsx       # Kanban board app
│   └── utils/
│       └── api.ts            # API client
├── worker/                   # Cloudflare Worker backend
│   ├── index.ts              # Worker entry
│   ├── router.ts             # Simple router
│   ├── routes/
│   │   ├── tickets.ts        # Ticket CRUD
│   │   ├── ai.ts             # AI generation
│   │   └── gitlab.ts         # GitLab OAuth
│   └── migrations/           # D1 migrations
├── wrangler.toml             # Cloudflare config
└── package.json
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/tickets` | List all tickets |
| POST | `/api/tickets` | Create ticket |
| GET | `/api/tickets/:id` | Get ticket |
| PUT | `/api/tickets/:id` | Update ticket |
| DELETE | `/api/tickets/:id` | Delete ticket |
| POST | `/api/ai/generate-title` | AI title generation |
| GET | `/api/gitlab/auth-url` | GitLab OAuth URL |
| GET | `/api/gitlab/callback` | OAuth callback |
| GET | `/api/gitlab/integration` | Current integration status |
| GET | `/api/gitlab/repos` | List repos |
| POST | `/api/gitlab/webhook` | Receive GitLab issue webhooks |
| PUT | `/api/gitlab/repo` | Save selected repo |
| POST | `/api/gitlab/sync/:id` | Sync to GitLab issue |

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **AI**: OpenRouter (GPT)
- **Auth**: Clerk (optional)
- **Hosting**: Cloudflare Pages + Workers

## License

MIT
