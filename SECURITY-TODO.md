# Security Hardening Checklist

This document tracks concrete security actions for MyBA, with urgency levels and crisp next steps.

## Legend
- Critical: do now (risk of abuse/data exposure)
- High: next (meaningful risk or compliance gap)
- Medium: important (reduce attack surface/privacy risk)
- Low: nice-to-have (defense-in-depth/ops polish)

## Summary Table

| Item | Action | Urgency | Status |
|---|---|---|---|
| Protect token endpoints with server-side auth | Enforce authenticated, subject-matched access to `GET/POST /api/user-tokens/:userId` | Critical | Done |
| Reject unsigned webhooks | Require signature verification for Stripe and Clerk; never process unsigned events | Critical | Done (Stripe requires secret; Clerk verified via Svix) |
| Remove `'unsafe-inline'` from CSP scripts | Tighten `helmet` CSP: drop inline scripts | High | Done |
| Rebuild frontend to remove hardcoded HTTP API | Rebuild and deploy assets; use same-origin or `VITE_API_BASE_URL` over HTTPS | High | Pending |
| Replace admin API key-in-browser model | Use server-verified session/roles (Clerk) for admin endpoints | High | Pending |
| Rotate secrets if exposed | Rotate `INTERNAL_API_KEY`, Stripe keys; audit usage | High | Pending |
| TLS everywhere + HSTS | Ensure HTTPS for site and API; keep HSTS | High | Ongoing |
| Analytics privacy & consent | Gate identification; minimize PII to PostHog | Medium | Pending |
| Fingerprinting consent/notice | Add user notice/consent for anonymous canvas fingerprint | Medium | Pending |
| CORS hardening | Set strict `CORS_ORIGINS` in prod; no wildcard | Medium | Pending |
| Permissions-Policy & other headers | Disable unused features (geolocation, camera, etc.) | Medium | Pending |
| Reduce request body limit if possible | Lower `express.json({ limit: '10mb' })` | Low | Pending |
| Hide framework fingerprint | `app.disable('x-powered-by')` | Low | Done |
| Avoid logging PII | Review logs, mask/remove sensitive fields | Medium | Pending |
| CI checks for auth/headers | Add basic security tests in CI | Low | Pending |
| Pen-test smoke checklist | Run quick manual tests post-deploy | Low | Pending |

---

## Detailed Tasks

### Critical
- Protect token endpoints with server-side auth
  - Enforce authenticated access with server-side verification (Clerk middleware or JWT verification).
  - Ensure the authenticated subject matches `:userId` (or drop `:userId` and read from token).
  - Endpoints: `GET /api/user-tokens/:userId`, `POST /api/user-tokens/:userId/consume` (in `server.js`).

- Reject unsigned webhooks
  - Stripe: if `STRIPE_WEBHOOK_SECRET` is missing, return 400 and do not process. Always verify signature when present.
  - Clerk: add `CLERK_WEBHOOK_SECRET` and verify `svix` signature; reject if missing/invalid. Do not accept raw JSON without verification.

### High
- Tighten CSP (Helmet)
  - Remove `'unsafe-inline'` from `scriptSrc` in `helmet({ contentSecurityPolicy })`.
  - Keep `'unsafe-inline'` in `styleSrc` only if necessary; consider moving inline styles to CSS or using nonces/hashes to drop it later.

- Rebuild frontend assets to remove hardcoded HTTP API
  - Current built asset references `http://152.42.141.162/myba/api`.
  - Rebuild to use dynamic `API_BASE_URL` (same-origin or `VITE_API_BASE_URL`) and deploy over HTTPS.

- Replace admin API key-in-browser model
  - Do not pass a long-lived admin key from the browser.
  - Protect admin endpoints with server-side session/role checks (Clerk roles/claims) and short-lived server-issued tokens if needed.

- Rotate secrets if potentially exposed
  - Rotate `INTERNAL_API_KEY`, Stripe secret/webhook keys, and any other secrets used when HTTP was in place.
  - Update environment, restart services, and verify.

- TLS everywhere + HSTS
  - Ensure the site and API are only accessible via HTTPS.
  - Keep HSTS enabled as configured in Helmet.

### Medium
- Analytics privacy & consent
  - Gate `identifyUser` calls behind explicit consent; avoid sending email/name unless essential.
  - Consider disabling session recording and reducing autocapture; avoid PII in event props.

- Fingerprinting consent/notice
  - Provide clear notice (and consent where required) for canvas fingerprint use in `anonymousTokens`.
  - Consider alternative anti-abuse measures (IP + rate limit) to reduce invasiveness.

- CORS hardening
  - Set `CORS_ORIGINS` to exact prod origins; do not allow wildcards.
  - Keep `credentials: true` only if needed; ensure allowed headers are minimal.

- Permissions-Policy & other headers
  - Use Helmet to set `Permissions-Policy` disabling features you don’t use (camera, microphone, geolocation, etc.).
  - Consider `Referrer-Policy: strict-origin-when-cross-origin`.

- Avoid logging PII
  - Review Winston logs; do not log emails, raw prompts, or full IPs. Truncate/anonymize where possible.

### Low
- Reduce request body limit if possible
  - Lower `express.json({ limit: '10mb' })` to something closer to real usage.

- Hide framework fingerprint
  - Add `app.disable('x-powered-by')` early in server setup.

- CI checks for auth/headers
  - Add basic automated tests that verify protected endpoints reject unauthenticated requests and required headers (CSP, HSTS) are present.

- Pen-test smoke checklist
  - Quick pass after deploy: CORS, CSP in place, webhook signatures enforced, admin endpoints locked down, HTTP->HTTPS redirect works, no unsigned webhook processing.

---

## Notes
- Helmet is already present with CSP and HSTS; we are tightening policies.
- Anonymous sessions and admin dashboard currently rely on browser-visible mechanisms; moving authorization decisions to the server is the goal.
- Frontend analytics and fingerprinting may have consent implications depending on your jurisdiction; plan accordingly.
