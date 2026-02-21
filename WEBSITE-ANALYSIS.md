# MyBA Website Analysis (Revamp Audit)

Generated on: **February 18, 2026**
Scope: **Static code + docs audit** of `/Users/rafael/Projects/myba` (no build run).

---

## 1) Executive Snapshot

MyBA is a React + Vite frontend with a Node/Express API for AI ticket generation, Clerk auth, Stripe payments, anonymous token sessions, and an admin dashboard.

Current state is functional but has high technical debt concentration in:
- Monolithic UI and backend files (`HomePage.tsx`, `server.js`)
- Mixed generations of architecture/docs (older router/config references still present)
- Security/business-logic gaps in key API flows

### Size Profile
- Frontend source files (`src/`): **33 files**
- Frontend TypeScript lines (`src/**/*.ts(x)`): **~6,778 LOC**
- Backend API (`server.js`): **1,818 LOC**
- Largest files:
  - `src/components/HomePage.tsx` (**1,411 LOC**)
  - `src/components/TokenManager.tsx` (**767 LOC**)
  - `server.js` (**1,818 LOC**)

---

## 2) Product Purpose (What This Site Does)

Core user promise: turn rough product/dev requests into backlog-ready tickets.

Main user-facing capabilities:
- Paste a prompt
- Generate AI ticket output (story/criteria/priority style content)
- Copy generated ticket
- Use token-based consumption model
- Buy token packs via Stripe
- Sign in/sign up via Clerk
- Admin users can open internal dashboard for users/metrics/system data

---

## 3) Tech Stack (Code-Verified)

### Frontend
- React 18 + TypeScript + Vite 5
- Clerk React SDK
- PostHog analytics
- Chart.js + react-chartjs-2 (admin charts)

### Backend
- Express
- Stripe SDK
- Clerk backend token verification (`@clerk/backend`)
- `svix` webhook verification for Clerk webhooks
- `helmet`, `cors`, `express-rate-limit`, `express-validator`
- Winston logging

### Build/Runtime
- `vite.config.ts` uses base path `/myba/` and outputs to `dist/public`
- Frontend dev script: `vite --port 3000`
- Backend script: `node server.js`
- Combined start script via `concurrently`

---

## 4) Frontend Architecture

### Entry + Routing Model
- `src/main.tsx` renders either:
  - `HomePage`
  - `UserProfilePage` when path equals `/user-profile` (with `/myba/` handling in prod)
- No active router implementation in source despite README claiming TanStack Router.

### Main App Container
`HomePage.tsx` is the primary orchestration layer for:
- auth state
- token state (authenticated + anonymous)
- payment URL callback handling
- generation workflow
- analytics calls
- admin visibility checks
- legacy/new UI switching (`?legacy=1`)

### UI Surfaces
- **New landing composition** (default): `NavBar`, `Hero`, `PromptForm`, `FeatureCards`, `Footer`
- **Legacy interface** remains in same file and is still live behind `?legacy=1`
- Modals: `TokenManager`, `AdminDashboard`

### Design/System Reality
- Mostly inline style objects
- Very limited centralized design tokens
- Repeated gradients and button patterns across components
- No global CSS architecture/design system layer

### Notable Frontend Modules
- `TokenManager.tsx`: purchase flow UI, plan loading, checkout initiation
- `AdminDashboard.tsx` + `admin/*`: user list, metrics, system health
- `anonymousTokens.ts`: fingerprint-based anonymous sessions + local fallback
- `backendService.ts`: API base URL and generate-ticket integration
- `analytics.ts`: PostHog events + identify hooks

---

## 5) Backend Architecture (Express)

`server.js` contains all middleware, auth, storage, webhooks, AI, admin, and payments in one file.

### In-Memory Stores
- `userTokens` (`Map`) for user token state/cache
- `anonymousSessions` (`Map`) for anonymous sessions
- IP/fingerprint maps for anonymous abuse prevention
- `suspiciousActivity` (`Map`) for rate-limit violation tracking

### External Persistence
- Signed-in user token source of truth is partially mirrored in Stripe customer metadata
- No database in use

### Security Middleware
- Helmet with CSP/HSTS
- CORS allowlist from env
- General + per-route rate-limiters
- Clerk JWT verification middleware for user/admin-protected routes

---

## 6) API Endpoint Inventory

### Public/Unprotected (or effectively public)
- `POST /api/webhook/stripe`
- `POST /api/webhook/clerk`
- `POST /api/anonymous-session`
- `POST /api/anonymous-session/consume`
- `GET /api/anonymous-status`
- `POST /api/generate-ticket`
- `POST /api/transfer-anonymous-tokens`
- `POST /api/create-checkout-session`
- `GET /api/plans`
- `GET /api/health`

### Authenticated User (Clerk token)
- `GET /api/user-tokens/:userId`
- `POST /api/user-tokens/:userId/consume`

### Admin (Clerk token + allowlist)
- `GET /api/security/status`
- `POST /api/security/clear-violations`
- `GET /api/admin/users`
- `GET /api/admin/users/:userId`
- `POST /api/admin/users/:userId/tokens`
- `GET /api/admin/metrics`
- `GET /api/admin/webhooks`
- `GET /api/admin/activity`

---

## 7) Core Business Flows

### Anonymous Flow
1. Fingerprint generated client-side
2. Backend creates/reuses anonymous session (3 free tokens)
3. Token consumption through anonymous consume endpoint
4. Client may store fallback session in localStorage when server unavailable

### Authenticated Flow
1. Clerk sign-in
2. Frontend fetches `user-tokens/:userId`
3. Generate action consumes token first, then calls AI generation endpoint
4. Token manager allows checkout

### Payment Flow
1. Frontend requests `/api/create-checkout-session`
2. Stripe checkout URL returned
3. Stripe webhook updates Stripe metadata and in-memory cache
4. Frontend reads success query params and refreshes token balance

### Anonymous-to-Auth Transfer
1. Frontend posts `sessionId`, `userId`, `remainingTokens`
2. Backend updates Stripe metadata or local token map
3. Anonymous session removed

---

## 8) Integrations

### Clerk
- Frontend auth UI + profile
- Backend token verification for user/admin routes
- Clerk webhook (`user.created`) creates user token baseline + Stripe customer when available

### Stripe
- Checkout session creation
- Webhook handling for successful purchases
- Token balance and purchase metadata stored in customer metadata

### AI Provider
- `OPENAI_API_KEY` determines target provider:
  - `sk-or-...` => OpenRouter endpoint
  - `sk-...` => OpenAI endpoint
- Current model selection:
  - OpenRouter: `openai/gpt-oss-20b`
  - OpenAI: `gpt-3.5-turbo`

### PostHog
- Manual event capture for page/session/token/purchase/sign-up/error lifecycle

---

## 9) Environment Variables Found in `.env`

- `ADMIN_USER_IDS`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `CORS_ORIGINS`
- `INTERNAL_API_KEY`
- `NODE_ENV`
- `OPENAI_API_KEY`
- `PORT`
- `PUBLIC_BASE_URL`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `VITE_API_BASE_URL`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_PUBLIC_POSTHOG_HOST`
- `VITE_PUBLIC_POSTHOG_KEY`

---

## 10) Repo + Documentation Drift (Important for Revamp)

### Stale/Conflicting Docs
- `README.md` references TanStack Router + `src/routes/*`, but current app routes manually in `main.tsx`.
- Historical docs mention old token plans/counts and older auth models.

### Stale/Unused Code Paths
- `src/components/SettingsModal.tsx` exists but is not used.
- `src/utils/aiService.ts` and parts of legacy config path appear unused in active flow.
- `config/plans.js` appears unused by runtime code.
- `app.config.ts` (TanStack Start config) appears stale relative to current Vite app.
- `authLimit` limiter is defined in backend but not applied to endpoints.

### Script/Operational Mismatch
- `package.json` has `deploy` script calling `./deploy.sh`, but `deploy.sh` is missing in repository.

---

## 11) Security + Reliability Findings

### Critical
1. **AI generation endpoint is effectively public**
- `POST /api/generate-ticket` does not enforce token ownership or authenticated consumption server-side.
- Client-side token checks can be bypassed with direct API calls.

2. **Checkout pricing trusts client-provided first-purchase flag**
- `/api/create-checkout-session` uses `userContext.isFirstPurchase` from request body for discount pricing.
- This can be manipulated by clients.

3. **Anonymous transfer endpoint not authenticated**
- `/api/transfer-anonymous-tokens` accepts `userId` + `sessionId` without auth check.
- Transfer logic relies on input trust and session availability.

### High
4. **Rate-limit handler has response path commented out**
- Custom rate-limit handler logs violation but does not send 429 response body.
- Can produce hanging/undefined behavior on limited requests.

5. **Single-file backend concentration risk**
- `server.js` mixes webhook logic, business rules, admin/reporting, and integrations in one file.
- High change-risk and hard testability.

6. **No database; partial in-memory state**
- Operational state lost on restart except what can be reconstructed from Stripe metadata.
- Analytics/admin views depend on warm runtime state.

---

## 12) Revamp Constraints + Opportunities

### Current Strengths to Preserve
- Clear core value proposition
- Working token funnel (anonymous -> auth -> paid)
- Clerk + Stripe integration already present
- Existing admin visibility layer

### Major Revamp Targets
1. **Architecture split**
- Break `HomePage.tsx` into feature modules/hooks/state slices
- Split backend into route/service/repository modules

2. **Token/entitlement hardening**
- Enforce server-side entitlement checks in AI generation endpoint
- Validate purchase eligibility server-side
- Require auth where account mutation occurs

3. **Design system pass**
- Replace repeated inline styles with tokenized system (CSS variables + component primitives)
- Standardize spacing/typography/button patterns across legacy/new surfaces

4. **Data persistence strategy**
- Move operational state from maps to durable store (DB)
- Keep Stripe as payment system, not primary app datastore

5. **Docs and scripts cleanup**
- Align README/deployment docs with real architecture
- Remove stale files or mark archived
- Restore/replace missing deploy script path

---

## 13) Suggested Revamp Phasing

### Phase 0 (Stabilization, pre-redesign)
- Fix critical API trust/auth gaps
- Fix rate-limit response behavior
- Freeze/retire legacy `?legacy=1` path decision

### Phase 1 (Structural refactor)
- Extract backend modules
- Extract frontend feature boundaries (generation, billing, auth, admin)
- Add tests around token/purchase/auth workflows

### Phase 2 (Visual revamp)
- Introduce design tokens and shared UI primitives
- Rebuild landing + generation result experience on new system
- Unify admin styling language with product UI

### Phase 3 (Platform hardening)
- Durable persistence for users/tokens/activity
- Observability and alerting improvements
- Documentation/runbook normalization

---

## 14) File Map (High-Value Files)

Frontend:
- `src/main.tsx`
- `src/components/HomePage.tsx`
- `src/components/TokenManager.tsx`
- `src/components/AdminDashboard.tsx`
- `src/components/admin/UserList.tsx`
- `src/components/admin/Analytics.tsx`
- `src/components/admin/SystemHealth.tsx`
- `src/components/landing/*`
- `src/utils/backendService.ts`
- `src/utils/anonymousTokens.ts`
- `src/utils/analytics.ts`

Backend:
- `server.js`
- `config/plans.js` (present but likely unused)

Ops/Config:
- `package.json`
- `vite.config.ts`
- `myba-api.service`
- `.env` (local)

Docs:
- `CURRENT-STATE.md`
- `CURRENT-STATE-2025-01-07.md`
- `LANDING-REFRESH-PLAN.md`
- `DEPLOYMENT-GUIDE.md`
- `SECURITY-TODO.md`

---

## 15) Bottom Line

You have a working product with real integrations and clear business intent, but the codebase is carrying architectural drift and several high-impact trust/security issues that should be addressed before a full visual revamp.

If you want, next step can be a concrete **revamp execution plan by week** (including exact file-level migration order and low-risk rollout strategy).
