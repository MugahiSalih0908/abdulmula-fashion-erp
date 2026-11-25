# Abdulmula Fashion ERP — Project, Security and Go-Live Handoff

**Snapshot date:** 2026-11-21
**Purpose:** Give Claude Code in VS Code a factual handoff so it can continue the existing engineering work without repeating discoveries or risking production data.

> This is a historical snapshot, not a live health check. Confirm Git, deployment, DNS, database, and environment state before acting. No credentials or secret values are included.

---

## 1. Business goal and product requirements

Abdulmula Fashion is a wholesale clothing business in Konyo-Konyo Market, Juba, South Sudan. The ERP/POS must be mobile-first and usable on phones, with an installable PWA for Android and iOS and robust offline operation.

Core workflows and modules include:

- Point of sale, barcode scanning, multi-cart/cart handling, invoices and receipts.
- Products, stock, stock movements, categories and opening inventory.
- Customers, suppliers, purchase orders and supplier balances.
- Expenses, cashbook, cash closing, currency display/exchange rate, reports and analytics.
- Staff invitations, admin/manager/staff roles, account activation and audit logs.
- Offline sale queue and eventual synchronization when connectivity returns.
- Multi-user login, cloud backup, supplier/customer management and staff administration.

Most transactions are cash-based. Do not assume UPI or Indian payment integrations apply to South Sudan. Treat money, currency conversion, inventory, invoice totals and gross-profit calculations as business-critical.

## 2. Repository and technology stack

GitHub repository: `MugahiSalih0908/abdulmula-fashion-erp` (public).
Production frontend project: Vercel project `abdulmula-fashion-erp`.
Production backend service: Render service `abdulmula-fashion-erp` (service ID `srv-d868hktckfvc73ef9erg`, root directory `backend`).

### Backend

- Node.js / Express 4 REST API.
- MongoDB Atlas and Mongoose 8.
- JWT access and refresh credentials.
- bcryptjs password hashing.
- Helmet, CORS, express-rate-limit, express-mongo-sanitize.
- AuditLog and business models including User, Product, Invoice, Customer, Supplier, Expense, StockMovement and others.

### Frontend

- React 18, Vite, Tailwind CSS.
- React Router, Zustand, TanStack React Query, Axios.
- Dexie/IndexedDB for offline data.
- vite-plugin-pwa / Workbox service worker.
- html5-qrcode barcode scanning, Recharts and Framer Motion.

### Main local project location

`D:\Abdulmula shop\abdulmula-live-bootstrap`

This is the clean bootstrap checkout based on the deployed source commit. A separate older developer checkout exists at `D:\Abdulmula shop\abdulmula-erp-v6-final\abdulmula-erp`; it had local changes and must not be confused with the clean bootstrap checkout. Do not overwrite, reset or copy `.env` files between them.

## 3. Git branches and pull request state at snapshot

### Dependency-remediation branch

Branch: `security/production-dependency-remediation-2026-11-21`

Two commits were pushed:

- `acde95b` — `fix(security): remediate backend dependency vulnerabilities`
- `1a6dd47` — `security: remediate frontend dependencies`

The branch was compared with `main`: two commits ahead, zero behind, four dependency files changed. Its working tree was clean after the push.

### Pull request #27

Title: `security: remediate backend and frontend dependencies`
URL: https://github.com/MugahiSalih0908/abdulmula-fashion-erp/pull/27

At snapshot it was **open and Draft**, not merged. GitHub showed all checks passed (four successful checks in the merge-status panel) and no merge conflicts. Workflow run shown in the conversation: #239, run ID `44904204323`.

Do not merge without the owner’s explicit approval. Dependency changes in this branch are not automatically part of the deployed `main` branch.

### Authentication branch

Branch: `security/auth-session-hardening-2026-11-21`

Created locally from the dependency-remediation branch. At snapshot it was clean but **not pushed to GitHub** and had no auth implementation commits yet. It therefore includes the dependency branch commits in its ancestry. If creating a PR against `main`, handle the ancestry deliberately after PR #27 is merged/reviewed; otherwise a second PR may include the dependency commits again. Do not force-push or rebase published work.

At task start, verify with:

```powershell
git branch --show-current
git status -sb
git log --oneline --decorate -8
git branch -vv
```

Expected branch at snapshot: `security/auth-session-hardening-2026-11-21`.

## 4. Dependency remediation completed on the security branch

### Backend

- Backend `npm audit` reported zero vulnerabilities after the backend dependency update.
- Removed unused Nodemailer; the code uses Resend.
- Updated backend dependencies and lockfile; added a scoped Nodemon/minimatch override.
- Backend tests passed locally: **62 passed, 0 failed**.
- Both production-only and full backend audit were reported clean.

Files committed in `acde95b`: `backend/package.json`, `backend/package-lock.json`.

### Frontend

Final tested versions on the security branch:

- `react-router-dom` / `react-router`: `7.18.6`.
- `vite`: `6.4.6`.
- `vite-plugin-pwa`: `1.3.0`.
- `workbox-build`: `7.4.1`.
- `glob`: `14.0.6` via targeted Workbox Build override.
- `minimatch`: `11.0.9` in the primary glob chain.
- `esbuild`: patched dependency version (reported as `0.25.12` after the Vite upgrade).

`frontend/package.json` includes:

```json
{
  "overrides": {
    "workbox-build": {
      "glob": "^14.0.3"
    }
  }
}
```

This override is a targeted compatibility measure, not a claim that Workbox upstream has changed its declared dependency range. The PWA production build succeeded after applying it.

Verification reported:

- Full frontend `npm audit`: **0 vulnerabilities**.
- `npm audit --omit=dev`: **0 vulnerabilities**.
- Frontend test suite: **93 passed, 0 failed**.
- `npm run build`: passed; Workbox generated `dist/sw.js` and `dist/workbox-*.js`.
- Vite emitted a large-chunk warning for bundles over 500 kB. This is a performance optimization task, not a build failure.

Files committed in `1a6dd47`: `frontend/package.json`, `frontend/package-lock.json`.

Do not run `npm audit fix --force`. Re-verify all commands from the local checkout before relying on these historical results.

## 5. Production domain and deployment work completed

### Domains

- Existing public site: `https://www.abdulmulafashion.com`.
- Root `https://abdulmulafashion.com` redirects to `www` (Vercel showed 308).
- New frontend subdomain: `https://app.abdulmulafashion.com` (Vercel; Valid Configuration).
- New API subdomain: `https://api.abdulmulafashion.com` (Render; Verified and Certificate Issued).
- The domain uses Hostinger DNS nameservers `nebula.dns-parking.com` and `aurora.dns-parking.com`.

DNS CNAME resolution observed:

- `app.abdulmulafashion.com` -> `629b0637296bca25.vercel-dns-017.com`.
- `api.abdulmulafashion.com` -> `abdulmula-fashion-erp.onrender.com`.

DNS-over-HTTPS lookups showed CNAME aliases for AAAA/CAA query attempts, no actual AAAA address record in the returned AAAA answer, and no CAA restriction for the apex. The local `nslookup` did not support CAA type. Do not add or remove records based only on that older lookup; re-check authoritative DNS if needed.

### Render backend

Service ID: `srv-d868hktckfvc73ef9erg`.
Existing Render origin: `https://abdulmula-fashion-erp.onrender.com`.
Custom API domain: `https://api.abdulmulafashion.com`.

Render custom domain status at snapshot: **Verified**, TLS certificate **Certificate Issued**.

Health test succeeded:

```powershell
Invoke-RestMethod -Uri "https://api.abdulmulafashion.com/api/health"
```

Observed response had `success: True`, `version: 5.0`, `env: production`, and service `Abdulmula Fashion ERP`.

`curl.exe -Iv https://api.abdulmulafashion.com/api/health` returned HTTP 200 and showed HSTS:

`strict-transport-security: max-age=15552000; includeSubDomains`

CORS preflight test succeeded:

```powershell
curl.exe -i -X OPTIONS "https://api.abdulmulafashion.com/api/auth/login" `
  -H "Origin: https://app.abdulmulafashion.com" `
  -H "Access-Control-Request-Method: POST" `
  -H "Access-Control-Request-Headers: content-type"
```

Observed HTTP 204 and:

- `access-control-allow-origin: https://app.abdulmulafashion.com`
- `access-control-allow-credentials: true`
- allowed headers included `Content-Type,Authorization`.

The owner changed Render environment configuration, triggering a successful environment-only deployment. The intended values were:

- `CLIENT_URL`: `https://app.abdulmulafashion.com,https://www.abdulmulafashion.com`
- `FRONTEND_URL`: `https://app.abdulmulafashion.com`

Do not expose or request any environment variable values beyond these non-secret origins. `CLIENT_PREVIEW_URL` was intended to remain unchanged.

### Vercel frontend

`VITE_API_URL` was deleted and recreated as **Config**, not Secret, because Vite exposes `VITE_*` variables to the browser bundle. It was set to Production only:

`https://api.abdulmulafashion.com/api`

The owner redeployed Vercel from `main`; screenshot showed deployment Ready, Production/Current, branch `main`, domain `app.abdulmulafashion.com` attached. The existing www/root domain association was preserved.

The owner then opened `https://app.abdulmulafashion.com`, signed in successfully, and screenshots showed the authenticated Invoices and POS pages loading data. This confirms the new frontend/API domain path was working at that time.

### Current production code status at snapshot

Render service configuration still pointed at Git branch `main`, and the latest live backend commit observed through Render was `142b02726e83f7cf294956f4fd458827b4d53bc8`. The Vercel production deployment was also from `main`. Thus the domain/env configuration changes were live, but the dependency-remediation branch had not yet been merged/deployed. The app's health version was 5.0.

Render service was on the **Free** plan, with warning that it spins down when inactive and can delay requests by 50 seconds or more. Evaluate an appropriate paid plan before relying on this for real store operations.

## 6. Current data state — critical go-live requirement

**Existing demo/historical data has NOT been cleared. The production app was visibly showing it.** Do not assume the new domain created a new database; changing hostnames does not change MongoDB data.

### Old database to preserve

Historical Atlas database: `abdulmula_erp`.

At the earlier verified count, it contained 1,108 documents across 16 collections:

- auditlogs 728
- stockmovements 175
- invoices 99
- cashbooks 36
- email logs 13
- products 13
- offlineconflictdecisions 13
- exchangerates 11
- customers 4
- purchaseorders 4
- cashclosings 3
- users 3
- invitations 3
- suppliers 2
- expenses 1
- emailwebhookevents 0

Backup created on Windows:

`D:\Abdulmula shop\backups\abdulmula_erp_20261121-145536.archive.gz`

Size: 54,337 bytes. SHA-256:

`3E823A08062E253691BCE313EA636E267C8385650D1E821D7688F38FFEA0DB94`

`mongodump` exited successfully. `mongorestore --dryRun` also exited successfully and read the archive collection/metadata headers. **This was not a full restore test.** The dry run noted source Atlas MongoDB 8.0.39 vs local MongoDB 8.2.6; do not actually restore into that incompatible target. Offsite second copy and actual isolated restore validation were not yet confirmed.

Preserve this backup and old database as archive. Never drop or repurpose the historical database.

### New live database

A new Atlas database named `abdulmula_erp_live` was created and had an empty `users` collection at the time it was checked. It was not yet verified that every collection is empty or that all indexes/collections are ready.

Atlas database users:

- `abdulmula_backup_reader`: intended as a separate read-only backup account, scoped to old `abdulmula_erp`.
- `abdulmula_live_app`: corrected to `readWrite` on `abdulmula_erp_live` only (not `readWriteAnyDatabase`).

The Render production `MONGO_URI` was deliberately **not changed** at snapshot. Production was still using historical data. Do not change it until all pre-cutover checks and explicit owner approval.

The existing `backend/scripts/create-admin.js` is designed to create the first admin using explicit `MONGO_URI`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (minimum 12 chars) and optional `ADMIN_NAME`. Ensure the connection targets only `abdulmula_erp_live` before running it. It creates a verified active admin with role `admin`; no default admin password should be used.

### Safe fresh-business go-live plan

1. Keep `abdulmula_erp` untouched as archive; verify backup hash and make a second protected/offsite copy.
2. Inspect `abdulmula_erp_live` read-only: list collections and exact document counts, check there are no business records, inspect indexes. Do not delete any records to make it empty; stop and reconcile if it already contains data.
3. Read `backend/config/db.js`, all Mongoose models, schema indexes and transaction requirements. Do not use `syncIndexes()` because it can drop indexes. Plan explicit collection/index creation; use `createIndexes()` or safe `createCollection()` as appropriate.
4. Test schema/index initialization and `create-admin.js` against an isolated database/URI first; never print URI/password.
5. Verify `abdulmula_live_app` has only least-privilege access required on the new DB. Confirm cluster topology supports MongoDB transactions if routes rely on them.
6. Check the PWA's IndexedDB on each device. Dexie database name is `AbdumulaFashionERP`, with `pendingSales`, `products`, `customers`, and `syncMeta`. Identify every unsynchronized sale and reconcile/sync/export it before any local cache reset or account switch.
7. Check Workbox caches and decide how to clear old account/private cached data safely. Never purge unsynced IndexedDB sales as part of cache cleanup.
8. Test new DB with a staging/local service using restricted new-db credentials; create first admin; verify login and that products, invoices, customers, suppliers, expenses, purchase orders, cashbook, audit logs, etc. show empty/zero values.
9. Prepare a rollback plan: keep old Render deployment/URI securely recoverable, old DB unchanged, and record the new deployment commit. Do not put credentials in documentation or chat.
10. With owner approval, change Render `MONGO_URI` to the new database/least-privilege application user, run deployment, verify health/readiness, login and every major module.
11. Ensure old/new frontend offline queues are not cross-account synced. Only after a verified data reconciliation and owner go-live acceptance may business start with freshly entered real products/opening inventory.
12. Keep the old DB and backup according to an agreed retention policy; do not delete them immediately after cutover.

## 7. Authentication and session security findings

Read the current source, not just this summary, before editing. Key files:

- `backend/routes/auth.js`
- `backend/models/User.js`
- `backend/middleware/auth.js`
- `backend/utils/tokenUtils.js`
- `backend/routes/invitations.js`
- `backend/routes/staff.js`
- `frontend/src/store/authStore.js`
- `frontend/src/services/api.js`
- `frontend/src/services/invitationService.js`
- `frontend/src/pages/InvitePage.jsx`
- `frontend/src/components/InvitationModal.jsx`
- `frontend/src/components/ProtectedRoute.jsx`
- `frontend/src/App.jsx`

### Confirmed current implementation findings

- Frontend `authStore.js` reads and writes access/refresh tokens in `localStorage` and persists user/auth state.
- Frontend `services/api.js` attaches a Bearer access token from `localStorage`; on `TOKEN_EXPIRED` it posts the stored refresh token in the request body, then stores new access/refresh tokens in localStorage. It has an in-flight refresh queue.
- `invitationService.js` manually injects the access token into invitation admin calls. `InvitationModal.jsx` reads the access token from Zustand. `InvitePage.jsx` sets auth using both access and refresh tokens after invitation acceptance.
- `ProtectedRoute.jsx` / `GuestRoute` use accessToken in Zustand to decide access/routing.
- Backend `User` model has `refreshTokens: [{ type: String, select: false }]` storing raw JWT strings.
- Login route generates refresh token and pushes raw value into `user.refreshTokens`; array capped at five.
- Refresh route reads user refreshTokens, checks `includes(refreshToken)`, filters the old token and pushes a new raw refresh JWT. This is not an atomic rotation/reuse-detection design.
- Logout removes a refresh token from the raw array; logout-all clears the array.
- Password reset clears stored refresh tokens.
- Staff account deactivation and admin password reset clear `refreshTokens`.
- Invitation acceptance creates a new user, generates access and refresh tokens, stores raw refresh token and returns both in JSON.
- Access-token middleware checks JWT signature/expiry, loads user and checks `isActive`; it does not appear to check a per-session record.
- Password model minimum was 6, UI reset/activation minimum 8, admin bootstrap minimum 12. Harmonize policy based on a reviewed password guideline; do not silently lock out existing users.
- Login is rate-limited (20 attempts/15 min), global API rate limit is 500/15 min. Refresh and password-reset routes need dedicated rate limiting review. Invitation routes have their own limiters.
- Full-history secret scan has not been independently verified for this dependency branch/current main. A previous run on an older hardening branch showed a successful Full-history secret scan, but do not treat that as evidence the current branch/history is clean.

### Target design to evaluate and implement

- Short-lived access JWT (e.g. existing 15 minutes) held only in application memory; never persist access or refresh tokens in localStorage, sessionStorage, Dexie or service-worker caches.
- Refresh token delivered only as host-only `HttpOnly; Secure` cookie from `api.abdulmulafashion.com`; select `SameSite=Lax` for same-site app/api subdomains after verifying actual browser behavior. Avoid broad `.abdulmulafashion.com` cookie Domain unless there is a documented reason. Scope cookie Path to refresh/logout endpoints if feasible.
- Axios configured with `withCredentials: true` for the API. CORS exact allow-list includes `https://app.abdulmulafashion.com`; no wildcard with credentials. Preview origins must be explicitly reviewed. Production localhost allow-list should be removed or limited to development.
- CSRF: validate exact Origin/Referer for cookie-authenticated unsafe methods and use an explicit server-validated CSRF token/header. Because the cookie is host-only to the API subdomain, do not assume the frontend can read it. A synchronizer token returned by a CSRF bootstrap endpoint and held in memory is one design to evaluate; document threats and test it.
- Store only one-way cryptographic hashes of refresh-token random secrets or opaque credentials. If JWT refresh tokens are retained, hash the complete token and include `jti`/session id; compare securely. Consider opaque refresh tokens rather than refresh JWTs.
- Use a dedicated Session model/collection rather than a growing User.refreshTokens array. A session should track user, token hash, session/family id, creation/expiry, last use, rotation/revocation and user-agent/IP metadata with privacy minimization. Use TTL index only for expired-record cleanup; explicit revocation still required.
- Rotate refresh tokens with atomic compare-and-swap/session update; detect reuse of an already-consumed refresh token and revoke the affected token family/session(s). Handle simultaneous API 401s with one shared refresh promise in frontend.
- Implement `/auth/me` or `/auth/session` bootstrap after a page reload to obtain a new in-memory access token using the HttpOnly refresh cookie. Do not render authenticated routes until initial session bootstrap completes.
- Logout revokes current session and clears cookie; logout-all revokes every user's active session; staff disable/password reset revokes all sessions. Preserve audit logs and clear frontend query/user caches at logout/account switch.
- Update invite acceptance to set refresh cookie and return only safe user + access token (or a documented no-token bootstrap strategy); no refresh token in response JSON.
- Migrate every caller in `InvitationModal`, `invitationService`, `InvitePage`, Settings/logout, ProtectedRoute, GuestRoute, authStore and API service. No direct token passing from UI to services.
- Verify email activation/password reset/session revocation behavior and consistent login error messages without account enumeration.
- Add backend integration tests for cookie flags, CORS, CSRF, login/refresh/logout/logout-all, replay/reuse, simultaneous refresh requests, password resets, disabled staff, invite acceptance, wrong Origin, missing CSRF, expired/revoked session and role/object access.

### Offline POS policy — unresolved owner decision

The owner has not yet answered whether a staff member must be able to close the installed PWA, reopen it with no internet, and continue POS without entering online credentials. Do not assume an answer.

Design a separate restricted device-local offline unlock if the owner requires this. It must not store reusable server refresh tokens. It should be device-bound, time-limited, scope-limited, revocable/expirable when online, and must not allow offline admin-only approvals or imply server authorization. A cached user/role snapshot is not authority for online API access. Preserve pending sale queue and attach records to a clear user/device identity; prevent one staff account's queued data from syncing under another account.

## 8. PWA and offline data protection findings

`frontend/vite.config.js` previously configured Workbox runtime caches:

- `/api/products`: `StaleWhileRevalidate`, 24-hour cache.
- `/api/customers`: `StaleWhileRevalidate`, up to 300 entries, 24-hour cache.
- `/api/dashboard`: `NetworkFirst`, five-second network timeout.

These endpoints are authenticated and can expose private customer/business information. Review and replace this caching policy. Prefer network-only/no-store for authenticated private APIs; cache only public app shell/static assets or explicitly designed offline catalog data with per-user scoping and retention. Purge relevant Cache Storage entries and in-memory query caches on logout/account switch. Do not indiscriminately cache private responses through Workbox.

Dexie database `AbdumulaFashionERP` stores:

- `pendingSales: '++id, offlineId, createdAt, isSynced'`
- `products: '_id, name, category, barcode, sku, updatedAt'`
- `customers: '_id, name, phone, updatedAt'`
- `syncMeta: 'key'`

`syncManager.js` saves offline sale payloads, syncs when online, marks blocked/rejected conflicts and supports manager approval/rejection. It also uses `localStorage` keys `pos.pendingCheckoutId` and `pos.pendingCheckoutCreatedAt`. Review whether checkout metadata or other user identifiers remain in localStorage; this work is separate from auth-token removal. Current pending sale records are not explicitly indexed/scoped by user. Design a safe migration/version upgrade and data ownership policy, not a blind database clear.

## 9. Broader security audit — remaining work

### A. Secrets and repository history

- Run a reputable secret scanner (e.g. Gitleaks) against all reachable Git history, current branches, tags and PR diffs.
- Report secret fingerprints/paths only, never print actual secret values.
- If a credential was ever committed, rotate it at the provider; deleting it from current files is insufficient.
- Check `.gitignore`, frontend source, build output, workflow logs, Vercel/Render environment variable scopes, source maps and public bundles.
- Re-scan after remediation. Separate findings into true positive, false positive and test fixture.

### B. Transport, CORS, headers and network

- HSTS is currently observed from production API. Verify redirects from HTTP to HTTPS for both custom domains and no mixed-content/API fallback to HTTP.
- Confirm `helmet` policy and CSP impact on app/PWA; do not weaken CSP without a justified requirement.
- Remove production `http://localhost:5173` CORS exception; allow exact HTTPS origins only.
- Add appropriate `Cache-Control: no-store` for auth/session and sensitive endpoints; make health/readiness status truthful.
- Health endpoint currently reports success/version/env but does not prove DB readiness; redesign readiness carefully and avoid leaking sensitive operational data.

### C. Authorization and IDOR

- Build a route inventory of every Express route and each `protect` / `authorize` middleware.
- Test admin, manager, staff and unauthenticated access.
- Test object-level authorization/IDOR by substituting IDs for invoices, products, customers, suppliers, expenses, purchase orders, audit logs, cashbook/closing, staff and invitations.
- Verify backend enforces permissions; hiding frontend navigation is not a security control.
- Inspect staff profile/password routes and self-service policy; current Settings UI uses staff endpoints that may be admin-only, so validate intended workflow.

### D. Input, abuse and operational controls

- Add appropriate per-route limits for login, refresh, password reset, activation, invitation validation/acceptance and sensitive financial endpoints.
- Review body limits, schema validation, object ID validation, Mongo operators, file/image URLs, receipt data and injection paths.
- Ensure audit events never store credentials, refresh tokens, reset tokens or private request bodies.
- Review request logging, IP forwarding and trusted proxy settings.
- Validate dependency scans locally and in GitHub Actions. Include the auth branch in CI through PR triggers.

### E. PWA and device security

- Restrict service-worker runtime caching as described above.
- Clear caches on logout and account switch; scope offline data per user/device.
- Preserve offline pending sales and validate queue tamper resistance, idempotency, price conflicts and server revalidation.
- Test Chrome/Android, Safari/iOS installed PWA, browser reload, offline restart, network restoration, token expiry and concurrent requests.
- Test service-worker update lifecycle and ensure old app caches cannot reintroduce sensitive data.

### F. Database and production readiness

- Verify backup integrity and perform a full isolated restore test with a compatible MongoDB major version; the prior dry-run was not a restore test.
- Verify Atlas network access rules; Render service IP allow-list was `0.0.0.0/0` at one observed snapshot, so review whether a narrower safe policy is possible for Render outbound IPs or private networking.
- Ensure least-privilege `abdulmula_live_app` is used by production when cutover is approved.
- Confirm indexes, transactions, backup schedule, restore runbook, retention and audit history.
- Decide production Render plan based on required availability; current Free plan sleeps when idle.

## 10. Recommended order of execution

1. **Orient and verify:** inspect repo, branch, working tree, remote state, package versions, existing CLAUDE.md, CI workflows, and exact current auth implementation. Do not change anything yet.
2. **Authentication design review:** map login, invitation acceptance, refresh, `me`, logout, logout-all, staff deactivation/reset, CSRF, CORS and offline reopen. Resolve the owner’s offline policy.
3. **Backend test-first implementation:** Session model, hashed token storage, cookie set/clear helpers, CSRF strategy, rotation/reuse detection, rate limits, revocation integration and backend integration tests.
4. **Frontend migration:** in-memory access token, session bootstrap, credentialed Axios, shared refresh lock, CSRF header, logout cache clearing, invitation flows, route loading state, no token localStorage. Update tests.
5. **PWA/offline migration:** fix private Workbox caching, design safe per-user Dexie ownership and offline unlock, preserve all pending sales, test account switching and offline restart.
6. **Local quality gates:** backend tests, frontend tests, full build, backend/frontend audits, static analysis, secret scan and targeted security tests. Do not remove tests to pass.
7. **PR and CI:** first resolve dependency PR #27 sequencing. Ensure branch ancestry is correct. Push only after user approval; get CI green; review diffs. Keep PR draft until auth review is complete.
8. **Staging validation:** use staging database and test accounts only; test browser and installed PWAs across platforms. Never test by creating sales in production.
9. **Production auth rollout:** publish coordinated backend/frontend version, migrate sessions (force sign-in once), verify rollback. Do not deploy half a migration where old frontend expects refresh token JSON but backend only sets cookie.
10. **Fresh database cutover:** execute Section 6 in a maintenance window with backup, queue reconciliation, explicit owner approval, least-privilege URI, admin bootstrap, and post-cutover verification.
11. **Go-live acceptance:** real products and opening stock entered; report/dashboard totals correct; suppliers/customers/expenses initialized deliberately; backups and support/rollback plan verified.

## 11. Commands and checkpoints

### Backend

```powershell
Set-Location "D:\Abdulmula shop\abdulmula-live-bootstrap\backend"
npm ci
npm audit
npm audit --omit=dev
npm test
```

### Frontend

```powershell
Set-Location "D:\Abdulmula shop\abdulmula-live-bootstrap\frontend"
npm ci
npm audit
npm audit --omit=dev
node --test
npm run build
```

If the repository's CI uses a narrower test glob, preserve that contract and also run the full relevant test suite. Do not assume an older test count still matches after code changes.

### Git before and after changes

```powershell
Set-Location "D:\Abdulmula shop\abdulmula-live-bootstrap"
git status -sb
git diff --check
git diff --stat
git log --oneline --decorate -8
```

Never run `git reset --hard`, `git clean -fd`, `git push --force`, database drops or bulk deletes as a shortcut.

## 12. First task for Claude Code

Start in **Plan** mode. Read this file and `CLAUDE.md`, inspect all relevant source/test files, then produce:

1. A current-state diagram for login, refresh, `/me`, invitation acceptance, logout, logout-all, staff disable/password reset, CORS and CSRF.
2. A table of every frontend and backend caller that must change.
3. A proposed Session schema and atomic refresh-rotation/reuse-detection approach.
4. A cookie/CSRF design specific to same-site subdomains `app.abdulmulafashion.com` and `api.abdulmulafashion.com`.
5. A precise offline-reopen policy question and at least two safe design options.
6. A test plan and staged rollout/rollback plan.
7. A list of unknowns requiring owner answers.

Do not modify source files, commit, push, alter hosted environment variables, merge PR #27, deploy, or mutate databases until the owner has reviewed the plan and explicitly approved the implementation scope.

---

## 13. Useful dashboard/repository links

- Repository: https://github.com/MugahiSalih0908/abdulmula-fashion-erp
- Draft dependency PR #27: https://github.com/MugahiSalih0908/abdulmula-fashion-erp/pull/27
- Render backend: https://dashboard.render.com/web/srv-d868hktckfvc73ef9erg
- Vercel project deployments: https://vercel.com/mugahid-s-projects/abdulmula-fashion-erp/deployments
- Vercel environment variables: https://vercel.com/mugahid-s-projects/abdulmula-fashion-erp/settings/environment-variables
- Live frontend: https://app.abdulmulafashion.com
- Live API health: https://api.abdulmulafashion.com/api/health
- Existing public site: https://www.abdulmulafashion.com
