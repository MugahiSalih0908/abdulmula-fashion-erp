# Abdulmula Fashion ERP — Claude Code Project Instructions

Before making changes, read `docs/PROJECT_HANDOFF_2026-11-21.md` completely.

## Mission

Complete Abdulmula Fashion ERP as a secure, reliable, mobile-first, offline-capable PWA/POS for the wholesale clothing business in Konyo-Konyo Market, Juba, South Sudan. Preserve existing POS behavior, financial correctness, auditability, and offline sales.

## Working rules

1. Work only in the repository opened in VS Code. Confirm `pwd`, `git branch --show-current`, `git status -sb`, and recent commits before acting.
2. The current working branch at handoff is `security/auth-session-hardening-2026-11-21`. It is local-only and currently clean. Do not assume it is on GitHub.
3. The dependency-remediation branch and PR #27 are separate. PR #27 is a draft and has passed its GitHub checks, but it is not merged. Do not merge, close, retarget, or deploy it without explicit user approval.
4. Start with read-only repository inspection and a written implementation plan. Make small, reviewable changes. Do not rewrite large files blindly.
5. Never read, print, copy, commit, upload, or ask the user to paste `.env`, secrets, passwords, MongoDB URIs, JWT secrets, API keys, cookies, access tokens, or refresh tokens. Redact sensitive values from logs and screenshots.
6. Never run destructive database commands (`dropDatabase`, `drop`, `deleteMany`, bulk cleanup, destructive migrations), clear browser IndexedDB, delete pending offline sales, reset Git history, `git push --force`, or change production data without an explicit, informed user approval and a verified backup/recovery plan.
7. Never change Render/Vercel production settings, deploy, merge a PR, switch production `MONGO_URI`, or change Atlas privileges without explicit user approval. Do not use production credentials locally.
8. Do not run `npm audit fix --force`. Preserve the currently tested dependency versions and Workbox override unless a reviewed compatibility plan justifies a change.
9. Keep authentication and offline POS compatible. Existing unsynchronized sales must remain recoverable through authentication migration, account changes, logout, and database cutover.
10. Do not weaken tests, skip failing tests, remove security checks to make CI green, or call a local test result a production verification.
11. Use PowerShell-compatible commands for Windows. Give the user commands in small, clearly separated steps and explain what each does.
12. Before commits, show `git diff --check`, relevant tests, build, audit results, and `git diff --stat`. Do not push or create PRs unless asked.
13. When finishing a task, report exact files changed, tests run and outcomes, unresolved risks, branch/commit state, and the next safe action.

## Project layout and stack

- `backend/`: Node.js, Express 4, MongoDB Atlas/Mongoose 8, JWT, bcryptjs, Helmet, CORS, rate limiting, audit logs.
- `frontend/`: React 18, Vite 6 on the dependency branch, React Router 7 on the dependency branch, Tailwind, Zustand, TanStack Query, Axios, Dexie, Workbox/PWA.
- Frontend tests: `node --test` with the repository's existing test files; the previously targeted suite had 93 passing tests.
- Frontend build: `npm run build` from `frontend/`.
- Backend tests: `npm test` from `backend/`.

## Immediate priority

Read the handoff document and inspect the current code locally. First produce a precise, file-by-file plan for secure refresh-cookie sessions, hashed refresh-token storage, rotation/reuse detection, logout/revocation, CSRF, invite auto-login, staff revocation, token bootstrap on page reload, and safe offline POS behavior. Do not start coding until the user reviews the plan and the unresolved offline-session policy.

## Required security posture

- Refresh credentials must never be exposed to JavaScript or stored in localStorage/IndexedDB.
- Prefer host-only Secure, HttpOnly cookies for `api.abdulmulafashion.com`; avoid broad `Domain=.abdulmulafashion.com` unless a specific reviewed need exists.
- Credentialed Axios requests must be explicit. CORS must use exact trusted origins, never `*` with credentials.
- Design CSRF protection for same-site cross-origin subdomains (`app.` to `api.`), including Origin validation and a server-validated CSRF token/header for state-changing cookie-authenticated requests.
- Store only one-way hashes of refresh-token secrets in the database. Rotation must be race-safe and support per-session and all-session revocation/reuse detection.
- Do not assume a local/offline unlock is equivalent to a server session. Design a separate, limited device-local offline authorization policy and get the owner’s decision before implementation.
- Auth changes must cover login, refresh, logout, logout-all, invite acceptance, password reset, staff deactivation, and all frontend callers.

## Documentation state

The handoff document is a point-in-time snapshot dated 2026-11-21. Re-verify all branch, PR, deployment, DNS, database and test states from the live repository/accounts before acting; do not treat historical status as current truth.
