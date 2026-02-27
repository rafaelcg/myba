# AGENTS.md

## Cursor Cloud specific instructions

### Overview

SprintFlow / MyBA is an AI-powered Kanban board and ticket generator. The architecture is:

- **Frontend**: React 18 + TypeScript + Vite (port 3000)
- **Backend**: Cloudflare Worker via Wrangler with local SQLite/D1 (port 8787)

Both start concurrently with `npm run dev`.

### Dev environment

- **Node.js**: v22+ (pre-installed)
- **Package manager**: npm (lockfile: `package-lock.json`)
- **Secrets template**: `.dev.vars.example` → copy to `.dev.vars` for worker secrets
- **Frontend env**: Create `.env` with `VITE_CLERK_PUBLISHABLE_KEY=pk_test_...` for frontend rendering

### Running services

```bash
npm run dev          # Starts Vite (port 3000) + Wrangler Worker (port 8787) concurrently
npm run frontend:dev # Vite only
npm run worker:dev   # Worker only
```

### Key caveats

- The frontend **will not render** without `VITE_CLERK_PUBLISHABLE_KEY` set in a `.env` file at the project root. The `ClerkProvider` fallback wraps children in a plain `<div>`, but `useUser()` from `@clerk/clerk-react` (used in `LandingPage`, `AppPage`, `AuthButton`) throws without the actual Clerk context.
- The Worker API endpoints (except `/api/health`) require a valid Clerk Bearer token in the `Authorization` header. Without `CLERK_SECRET_KEY` in `.dev.vars`, authenticated endpoints return 401/500.
- The database auto-initializes as local SQLite on first request via Wrangler — no manual migration step is needed for local dev.
- There are no automated tests or lint scripts configured in `package.json`.

### Build & type checking

```bash
npx tsc --noEmit     # TypeScript type check
npm run build        # Vite production build (outputs to dist/public/)
```

### API health check

```bash
curl http://localhost:8787/api/health
# Returns: {"status":"ok","env":"production"}
```
