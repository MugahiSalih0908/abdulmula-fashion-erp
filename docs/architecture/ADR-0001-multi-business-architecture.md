# ADR-0001: Multi-business, multi-shop architecture and operational integrity

| | |
|---|---|
| Status | Accepted for planning. Implementation is approved change by change: every Stage 0 commit needs the owner's approval of its exact diff. Amendment 1 (§12, the S0-5 decisions of 23–24 November 2026) was accepted by the owner on 24 November 2026 as the approved S0-5 architecture and implementation plan. It authorizes the plan only (§12). |
| Decision date | 23 November 2026 |
| Decided by | Business and platform owner |
| Applies to | Abdulmula Fashion ERP: backend API, PWA/POS frontend and offline sales |

## 1. Context and problem

Abdulmula Fashion ERP is an offline-capable PWA and point of sale for a wholesale clothing business in Konyo-Konyo Market, Juba, South Sudan. Today it serves one business and one shop: an Express 4 and Mongoose 8 API on MongoDB Atlas, a React PWA, and an IndexedDB queue for sales made without connectivity.

The owner requires the system to serve several businesses, each with several shops and many phones selling at once. A read-only investigation of commit `85f341d` on 23 November 2026 also found integrity problems that must be fixed before the system grows:

- Invoice and purchase-order numbers are a document count plus one. Simultaneous sales can collide, and a deletion makes later numbers collide or be reissued.
- Any signed-in user, including a cashier, can hard-delete an invoice.
- Editing a product writes stock as an absolute value outside a transaction, so it can undo sales made in the meantime.
- Customer repayments are a read-then-save with no ledger, no audit entry, silent overpayment and no effect on cash closing.
- 12 of the 33 audit actions the backend writes are rejected by the audit schema and lost without any error.
- Cost prices, gross profit and supplier debt reach roles that should not see them.
- A broken, unused offline sync endpoint and a self-dispatching legacy expenses route are still registered.
- Cash days follow the server's UTC date, not Juba time.

## 2. Decision

Adopt a pooled multi-tenant architecture: one database, every business record scoped by `tenantId`, shop-level records also scoped by `shopId`, and authorization enforced on the server. Roll it out in stages. Stage 0 first fixes the integrity problems above on the current single-business system, in a separate worktree, without migrating or modifying any real data.

## 3. Architecture principles

1. The server decides scope and permissions. Hiding a button is not security.
2. A completed sale or payment is never lost, silently deleted or reassigned.
3. Financial and stock history is append-only. Corrections are new, audited records.
4. Money is handled in exact cents by the existing shared calculation module, which is not changed without separate approval.
5. A financial change that touches several documents runs in one transaction with bounded retries, and its audit entry is written in the same transaction.
6. Least privilege: each role sees and does only what its job needs.
7. Business days, numbering years and daily reports use `Africa/Juba` time.
8. Tests and load tests use synthetic data on isolated infrastructure. Production is never a test target.
9. Production data, infrastructure and settings change only with the owner's explicit approval.

## 4. Accepted decisions

- **AD-01 Capacity target.** 5 shops with about 10 phones each (50 in total), 20–28 multi-line wholesale sales per cashier per busy hour: 1,000–1,400 sales per hour (0.28–0.39 per second). These are planning estimates.
- **AD-02 Tenancy.** One shared database. Every business record carries `tenantId`; shop-level records also carry `shopId`. Authorization is enforced on the server. Records outside the caller's scope return 404.
- **AD-03 Go-live gate.** Trading moves to `abdulmula_erp_live` only after multi-tenancy, branch stock, atomic sales, counters, cash, devices and offline ownership are verified on staging.
- **AD-04 Customers.** Customers are shared only within one business. Phone numbers are normalized and possible duplicates are flagged with a warning; phone numbers are not required to be unique.
- **AD-05 Prices.** One business-wide base price. The architecture allows per-shop prices, but they are not built without approval. Wholesale price tiers apply only when the owner configures them.
- **AD-06 Stock.** Stock is held per shop. Online sales never oversell. Offline shortages are posted, flagged and reviewed without rewriting the original sale.
- **AD-07 Numbering.** Atomic per-shop, per-year counters using Africa/Juba time. Initial formats: invoice `KK1-2026-000123`, purchase order `KK1-PO-2026-000123`. Numbers are never reused, and historical numbers are kept as they are.
- **AD-08 Business day.** Midnight to midnight in `Africa/Juba`. Server time decides online dates. Implausible offline timestamps go to review.
- **AD-09 Offline safety.** Completed offline sales and payments are never deleted, reassigned or discarded. Transactions older than 72 hours go to review, and so do credit conflicts. The customer ledger changes only after validation. Offline value limits are set by the owner.
- **AD-10 Revoked devices and reassigned staff.** Sales queued by revoked phones, reassigned cashiers or ended memberships go to review. The original business, shop, cashier, device and transaction ID are preserved.
- **AD-11 Devices.** A device belongs to one shop. Authorized cashiers of that shop can sign in on it. Managers can revoke devices in their own shop. Device limits are configurable.
- **AD-12 Discounts.** Cashier 0%; manager up to 10% within the owner's policy. Cashiers cannot enter arbitrary negotiated prices.
- **AD-13 Voids and refunds.** Cashiers request them. Managers approve within their limits. The owner or an admin handles out-of-policy, high-value and post-closing cases. Partial returns are allowed. Returned stock is added back only after a physical check.
- **AD-14 Cash.** A daily cashbook per shop plus cashier shifts and drawers. Managers approve their branch's daily closing; admins review variances above a configured threshold. Cash and non-cash movements stay separate.
- **AD-15 Platform super admin.** The owner, with authenticator-app MFA and no default access to business data. Support access needs the business owner's approval, lasts four hours, is read-only by default and is fully audited. There is no emergency bypass.
- **AD-16 Retention.** Financial, stock and audit records stay online for at least 24 months, then move to a read-only archive. They are never deleted automatically. The legal retention period must be confirmed with a local accountant.
- **AD-17 Costing.** Keep last-purchase-cost snapshots and preserve existing historical calculations. The costing model does not change in this stage.
- **AD-18 Production protection.** No migration, deletion or rewriting of real records. `abdulmula_erp` stays untouched until its status and data are verified. No Render, Atlas, Vercel or environment-variable change without explicit approval.
- **AD-19 Performance.** The initial targets below are accepted. Standalone k6 testing is approved with synthetic data only, never against production, `abdulmula_erp` or `abdulmula_erp_live`. Paid infrastructure needs separate approval.

  | Measure | Target |
  |---|---|
  | Live sale | p95 ≤ 400 ms, p99 ≤ 1 s |
  | Three-times burst | p95 ≤ 800 ms |
  | Errors | ≤ 0.1%, and no completed sale lost |
  | Barcode lookup | p95 ≤ 200 ms |
  | Catalogue changes | p95 ≤ 300 ms |
  | Dashboard | p95 ≤ 1.5 s |
  | Monthly reports | p95 ≤ 5 s |
  | 2,500 queued sales | synced within 10 minutes |
  | Outage recovery | within 10 minutes |
  | Database failover | within 30 seconds, with no duplicates |

- **AD-20 Workstreams.** Three separate workstreams: the uncommitted mobile UI branch, the Stage 0 worktree based on `85f341d`, and the authentication branch. No commit, push, merge or deployment without separate approval.

## 5. Production status (recorded 23 November 2026)

- The production Render service was inspected and is configured to use `abdulmula_erp`.
- `abdulmula_erp_live` is the intended future live database.
- The owner reports that production has been used only for testing and demonstrations, not for real customer trading, and that the owner is its only user.
- The pending-sales queue on the owner's devices has not been fully inspected.
- In the owner's test, a demonstration checkout completed after connectivity returned and produced one invoice and one stock deduction. This is a single observation, not proof that offline synchronization is complete or correct.
- No migration, archive, reset or other database change has been authorized.

## 6. Stage 0 scope

### 6.1 Approved changes

1. **S0-1** Disable hard deletion of invoices for every role. Refusals are audited, and invoices and stock history are preserved.
2. **S0-2** Customer updates accept only the approved contact fields (name, phone, email, address, notes). Balances, totals and the deletion flag are protected.
3. **S0-3** An atomic customer-payment ledger: unique request IDs, overpayments refused, admin-only reversals with a mandatory reason, all audited. Cash repayments count in expected cash; non-cash repayments are reported separately.
4. **S0-4** Cost prices, gross profit and other cost data are removed from managers and cashiers according to the approved permissions.
5. **S0-5** Every action the backend writes is allowed by the audit schema. Critical financial changes and their audit entries are written atomically, and critical audit failures are never silent.
6. **S0-6** Count-based invoice and purchase-order numbers are replaced by atomic shop-and-year counters with bounded retries.
7. **S0-7** Product updates no longer set stock. Stock changes through an audited adjustment that requires a reason and protects against concurrent changes.
8. **S0-8** After confirming it has no callers, the unused offline sync endpoint `POST /api/invoices/sync-offline` is removed and returns 404.

### 6.2 Approved clarifications

- A supplier update cannot set `debtBalance`. Supplier balances change only through purchase receiving and supplier payments (with S0-2).
- After confirming it has no callers, the unused `POST /api/expenses/add` route is removed and returns 404 (with S0-8). Its current implementation may re-dispatch into itself, so it is never requested during characterization.
- `shared/invoiceCalculations.test.mjs` runs as part of the backend `npm test`, which is the command CI runs.
- A product created by a manager without a cost is marked as pending cost verification and cannot be sold until an admin records a genuine cost. The system never invents a cost and never treats a missing cost as zero (with S0-4).
- Expenses cannot be created on, or deleted from, a closed or approved cashbook day, so a closing is never altered silently. Records that are already approved are preserved (with S0-3).

### 6.3 Approved details

- **Role changes for today's roles:** managers lose purchase-order creation, supplier payments, cost prices, gross profit, supplier debt and the dashboard profit card. Cashiers see only their own sales from the last seven days, including on customer screens. When retries run out, the API answers 503 so phones keep the sale pending.
- **Shop code:** `KK1`, supplied by configuration until Stage 2 introduces the shop record.
- **Year boundary:** an offline sale that syncs in a new year receives the new year's number and keeps its original sale date.
- **Cash closing:**
  - `totalSales` preserves the full sales value of Cash invoices.
  - `expectedCash` counts only cash actually received. For a Cash invoice this is the amount paid, not the invoice total.
  - Unpaid customer balances are receivables, not drawer cash.
  - Deposits on credit invoices and the cash portions of mixed payments are deferred until payment-line support is implemented (planned for Stages 3–4).
- **Where the work happens:** Stage 0 is developed on branch `security/stage0-integrity-2026-11-23`, in a separate worktree based on `85f341d`.
- **Commit order:** this ADR first; then the characterization tests (with the shared calculation tests added to the backend run); then S0-5, S0-6, S0-1, S0-8, S0-2, S0-3, S0-7 and S0-4. Before each commit the diff, tests, build and audit results are reviewed. Nothing is pushed, merged or deployed without approval. Amendment 1 (§12.3) delivers S0-5 as S0-5a, S0-5b-backend and S0-5b-frontend, followed later by S0-5c.

### 6.4 Not changed in Stage 0

- `shared/invoiceCalculations.mjs` and the money calculations it provides.
- The POS checkout and the offline sales queue.
- Authentication and sessions (a separate branch).
- Dependencies, deployment, infrastructure and environment variables.

Amendment 1 (§12.11) adds one store, `requestIdentities`, to the offline database in Dexie version 2. The POS checkout, the offline sales queue and every existing store, index and record stay unchanged.

### 6.5 Required regression tests for later Stage 0 commits

Each later commit adds these tests in the same commit, and updates the characterization assertions marked for it in `backend/tests/stage0/`. Concurrency tests check the final state (unique numbers, exact balances, consistent stock), never timing.

- **S0-3, customer payments and cash closing:**
  - A repeated request ID records one payment, and the same ID with different details is refused.
  - An overpayment is refused and changes nothing.
  - An admin can reverse a payment once, with a mandatory reason; a second reversal is refused.
  - Cash repayments change expected cash; mobile and bank repayments are reported separately.
  - Concurrent payments on one customer leave the exact balance.
- **S0-5, audit, transactions and request identities:** replaced by the test matrix in §12.14 (Amendment 1). Its original requirement, that a failed critical audit write rolls back the financial transaction it belongs to, is kept as T7 and R1.
- **S0-6, numbering:**
  - Concurrent sales receive unique numbers.
  - No number is ever reused.
  - An offline sale synced in a new Juba year receives the new year's number and keeps its original sale date.
- **S0-7, stock adjustments:**
  - A stale stock version is refused.
  - A repeated request ID applies an adjustment only once.
  - Concurrent adjustments leave stock equal to the opening quantity plus all recorded movements.
- **S0-4, financial visibility:** managers and cashiers receive no cost, gross-profit or supplier-debt data, and a product pending cost verification cannot be sold.

## 7. Rollout stages

| Stage | Work | Gate |
|---|---|---|
| 0 | Integrity fixes (section 6) | Owner approval of each exact diff |
| 1 | Authentication and session hardening, phase A, on its own branch | Decision on the dependency pull request; owner approval |
| 2 | Multi-business foundation: businesses, shops, memberships, scoped queries and indexes | Owner approval |
| 3 | Per-shop stock, a single sale service, transfers, voids and refunds | Owner approval; return-window value |
| 4 | Devices, shifts, cash and customer ledgers, offline sync v2 and dashboards; mobile UI phase 2 in parallel | Owner approval; credit-freshness window |
| 5 | Load tests on isolated staging, security review, pilot with synthetic data | Infrastructure approval |
| Cutover | Trading starts on `abdulmula_erp_live`; `abdulmula_erp` is kept unmodified | Backup, real restore test, dry run, reconciliation, rollback plan and owner approval |
| 6 | Onboarding other businesses | Owner approval |

## 8. Security and data-preservation rules

- Secrets are never read, printed, copied, committed or uploaded: `.env` files, database URIs, JWT secrets, API keys, cookies, access tokens and refresh tokens.
- No destructive database command, IndexedDB clearing, deletion of pending offline sales, history rewrite or force-push without explicit, informed approval and a verified backup and recovery plan.
- No Render, Vercel or Atlas change, deployment, merge or environment-variable change without approval. Production credentials are never used locally.
- Unsynchronized sales stay recoverable through authentication changes, account changes, logout and database cutover.
- Any migration requires a backup, a real restore test, a dry run, reconciliation, a rollback plan and approval. Indexes are not dropped without approval.
- Automated tests use the isolated, network-blocked in-memory MongoDB harness and synthetic records. Load tests use isolated staging.
- Tests and security checks are not weakened or skipped to make a build pass. `npm audit fix --force` is not used, and the tested dependency versions and the Workbox override are preserved.

## 9. Deferred decisions

- Return-window value (Stage 3).
- Credit-balance freshness window, per-customer credit limits, and whether managers may register devices (Stage 4).
- Values for offline limits, the discount policy, the cash-variance threshold and device limits (all configurable by the owner).
- Weighted-average costing (a comparison was prepared; no change is approved) and the treatment of transport costs on transfers.
- Per-shop prices and wholesale price tiers.
- The legal retention period, to be confirmed with a local accountant.
- Atlas and Render plans, the cost comparison (needs the current plan details) and paid staging for load tests.
- Archiving or retiring `abdulmula_erp`, and inspecting the pending sales on the owner's devices.
- The dependency-remediation pull request and the authentication branch.

## 10. Risks and assumptions

- **Assumption:** the production API runs in UTC. `backend/render.yaml` sets no `TZ`, and the live service has not been checked. The Stage 0 tests pin `TZ=UTC`.
- The owner's devices may still hold unsynced demonstration sales. They must be inspected before cutover and must stay recoverable.
- Phones running a cached older version of the app may send old request shapes after Stage 0 (for example a product edit that includes stock) and be refused until they update.
- After Stage 0, purchase-order creation and supplier payments need an admin.
- Products pending cost verification cannot be sold until an admin records their cost.
- Invoice and purchase-order numbers will mix the legacy formats (`INV-YYYYMMDD-NNNN`, `PO-YYYYMMDD-NNNN`) with the new `KK1-…` formats.
- The capacity figures are planning estimates until load tests confirm them.
- The test harness runs an in-memory MongoDB 8.0.38 replica set. Production behaviour can differ from local test results, so a passing local test is not a production verification.
- Amendment 1 records the S0-5 rollout, offline-database and rollback risks in §12.17.

## 11. References

- `docs/PROJECT_HANDOFF_2026-11-21.md`: handoff snapshot.
- `docs/product-cost-snapshots.md`: cost snapshots on invoice lines.
- `backend/tests/stage0/`: the characterization tests (C1–C24) that record behaviour before Stage 0.
- `backend/tests/app.contract.test.js`: API contract tests, including the blocked-CORS response kept by D18 (§12.7).
- MongoDB Node.js driver 6.20.0, `lib/sessions.js` and `lib/operations/execute_operation.js`: commit retries, the general retry loop and transaction error labels (§12.4); `lib/error.js`: the error labels the driver defines (§12.5).
- `cors` 2.8.6, `lib/index.js`: passes the CORS check's error object to the error handler unchanged (§12.7).
- Dexie 3.2.7, `dist/dexie.js`: how the offline database is opened and versioned (§12.13).

## 12. Amendment 1 (24 November 2026): S0-5 audit, transactions and request identities

| | |
|---|---|
| Status | Accepted by the owner on 24 November 2026 as the approved S0-5 architecture and implementation plan. Acceptance authorizes the plan only. It doesn't authorize implementation, staging, commits, pushes, merges, production database creation, migrations, deployment or hosting changes, and each of these still needs separate approval. O-3, O-4, O-5, O-6 (provisioning and costs) and O-9 remain open (§12.18). |
| Decisions recorded | D1–D12 and corrections A–D (23 November 2026); D13–D17 (24 November 2026, 10:01); D18–D24 and O-8 (24 November 2026); the nine implementation choices and the eight details confirmed with them, in §12.20 (24 November 2026) |
| Decided by | Business and platform owner |
| Applies to | Stage 0 change S0-5: audit recording, bounded transactions and request identities in the backend, and the request-identity store in the frontend's offline database |
| Does not authorize | Creating a production collection or index, deployment, merging, data migration, or any Render, Vercel, Atlas or environment-variable change. Each implementation diff and each rollout step needs separate approval. |

### 12.1 Scope and superseded provisions

**Planned work only.** Everything in §12 describes planned S0-5 work. None of it is implemented at the current baseline, commit `225f4e4`: no S0-5 code, model, test, offline-database store or page change described here exists yet. The characterization tests in §12.15 already exist at that commit; S0-5 only changes them. Accepting this amendment approves the plan. It doesn't approve or record any implementation or deployment.

This amendment records the S0-5 decisions and the implementation boundaries, tests, rollout and rollback rules that follow from them. It changes only these provisions:

1. **Status row at the top of this ADR:** adds a pointer to this amendment and its status.
2. **§6.3, commit order:** S0-5 is delivered as the commits in §12.3.
3. **§6.4, clarified:** the POS checkout and the offline sales queue still don't change. The offline database gains one store, `requestIdentities`, in Dexie version 2 (§12.11).
4. **§6.5, S0-5 test:** replaced by the test matrix in §12.14. Its requirement, that a failed critical audit write rolls back the financial transaction, is kept as T7 and R1.
5. **§10, risks:** adds a pointer to the S0-5 risks in §12.17.
6. **§11, references:** adds the API contract tests, the MongoDB driver's `lib/sessions.js`, `lib/operations/execute_operation.js` and `lib/error.js`, the `cors` package's `lib/index.js`, and Dexie's `dist/dexie.js`.

Every other provision stays in force, including AD-18 (§4) and the security and data-preservation rules (§8).

### 12.2 Owner decisions and requirements

| Decision | Approved rule |
|---|---|
| D1 Retry limits | At most 3 transaction attempts per `runTransaction()` call, and at most 3 helper-level `commitTransaction()` calls within each transaction attempt: at most 9 helper-level commit calls across the whole operation (O-8). The MongoDB driver's own internal retry isn't counted (§12.4). An unknown commit result retries only the commit, a transient error retries the whole transaction, and when an error carries both labels the unknown commit result takes precedence. Delays use exponential backoff with jitter between 25 and 250 ms; sleep and randomness are injected, so tests are deterministic. The 503 responses and internal codes are unchanged (§12.7). |
| D2 Failures, and idempotency first | Only the failures in §12.4 are retried. An unknown commit result retries the commit only, never the callback. When retries run out, the response is 503 with a generic message. The internal codes `TRANSACTION_RETRY_EXHAUSTED` and `TRANSACTION_COMMIT_UNKNOWN` appear only in server logs, and no database detail reaches clients. Request identities (§12.8) are built and verified before any non-idempotent create route is converted, so a retry after a successful but unconfirmed commit never creates a second record. |
| D3 Products and stock | Product update is deferred to S0-7. Product create and delete are converted in S0-5b. Stock-editing semantics don't change in S0-5: the existing stock effects of converted routes (opening stock on product creation; stock on purchase-order receiving) are only moved inside transactions. |
| D4 Delivery (amended by D20) | Three logical stages: S0-5a (audit and transaction foundation), S0-5b (financial routes and request identities) and S0-5c (mandatory request IDs, from D13). S0-5b is delivered as two separately releasable commits, S0-5b-backend and S0-5b-frontend (§12.3). |
| D5 Best-effort audit | Customer and supplier creation and deletion stay best effort only while they change no balance, debt, payment history or other financial record. Critical financial changes use transactional audit recording. |
| D6 Exchange rate | `EXCHANGE_RATE_UPDATE` is added, making 39 actions. The rate change and its audit entry are stored atomically, in one transaction. |
| D7 Request IDs | The six operations in §12.8 use client request identities. Enforcement follows the tolerant rollout (D13) and is switched on by S0-5c. |
| D8 Frontend | Durable request identities on the device, the request lifecycle and a pending-attempts notice, for the six operations (§12.11). |
| D9 Unexpected errors | An unexpected 500 response carries a generic message. Expected business responses don't change (§12.7). Error logging is covered by D22. |
| D10 Reused ID | An ID reused with a different operation, user or fingerprint gets 409 with a message only. No public error code is added. |
| D11 Email | `sendEmail()` refuses to run inside a `runTransaction()` callback. No email, external HTTP call or other irreversible side effect runs inside a retried callback. |
| D12 Indexes | S0-5 adds no index to any model and changes no existing index. Any new unique index needs staging verification, a production preflight and separate deployment approval. `RequestRecord` relies only on MongoDB's default unique `_id` index. |
| D13 Tolerant rollout, then enforcement | (1) In S0-5b a missing ID is accepted and logged as `REQUEST_ID_MISSING`. (2) A supplied malformed ID is rejected with 400. (3) After the frontend rollout and device verification, S0-5c rejects both missing and malformed IDs. The rollout is in §12.12. |
| D14 Refused and unconfirmed attempts | Approved with correction. The client treats any 409 as refused: the ID is retired, and the attempt stays visible until dismissed. An unconfirmed outcome keeps its ID. |
| D15 RequestRecord collection | Approved in principle. Only MongoDB's default unique `_id` index is permitted. Mongoose automatic creation and indexing are off for this model only. Creating the production collection needs the manual preflight (§12.9) and separate approval. |
| D16 Cashbook date | Cashbook close sends the business date. The server refuses a date that doesn't match today's date as the server computes it now: UTC, until a separately approved `Africa/Juba` business-day change. |
| D17 Build identifier | Settings shows a build identifier, so the owner can confirm which build each device runs. As agreed, it is a release label maintained by hand in `frontend/src/buildInfo.js` and updated for every frontend release (§12.11). |
| D18 Blocked CORS | The existing blocked-CORS response (500 with `{ success: false, message: 'CORS blocked: <origin>' }`) stays exactly as it is, and A6 must pass the existing contract test. |
| D19 Legacy cashbook close | S0-5b accepts a cashbook close with neither a request ID nor a date (what current builds send). When a request ID is supplied, the date is required, and the client takes it from `GET /api/cashbook/today`. S0-5c requires both. |
| D20 S0-5b split | S0-5b is two separately releasable changes: backend only first, then frontend only. The tolerant backend and RequestRecord readiness are hard prerequisites for the frontend rollout. |
| D21 Repeated product delete | Deleting an already-deleted product returns 200 with the existing message and writes no second `PRODUCT_DELETE` entry. |
| D22 Error-handler logging (resolves O-1) | Directed by the owner on 24 November 2026. S0-5a replaces the error handler's log line with a safe structured line (§12.5) that never contains a raw error message, a stack trace, a token, a password, an IP address, a user agent or a request body. Generic 500 responses (D9) never expose sensitive internal details, including stack traces, in any environment. The blocked-CORS response (D18) is an explicit compatibility exception: it stays exactly as it is, although its Origin value can be an IP address. A6 passes unchanged, and A7 tests the log and the generic responses. The line's fields in §12.5 were approved on 24 November 2026 (§12.20, choice 9); its exact event constant is reviewed in the S0-5a diff. |
| D23 Cashbook date without an ID (resolves O-7) | In S0-5b, a cashbook close that sends a date but no request ID has its date checked against the server's current cashbook business date: a malformed date gets 400 and a stale one 409. The date is never ignored. A request with neither an ID nor a date keeps the legacy behaviour (D19), and S0-5c still requires both. |
| D24 Staging architecture | Staging is a separate service with its own separate database, holding synthetic test data only. Production credentials and production records are never used there. This approves the architecture only: creating accounts, spending, provisioning and hosting or environment changes each need separate approval. |

All 39 audit actions in §12.6 are approved.

#### Mandatory requirements

| ID | Requirement | Tests |
|---|---|---|
| MR-1 | Sign-in, sign-out and failed sign-in keep working when audit writes fail. | A4 |
| MR-2 | Audit failure reports contain no personal data, emails, tokens, IP addresses or user agents. | A3 (A7 covers the error-handler log) |
| MR-3 | `recordAudit()` requires a valid, active transaction session and propagates failures. | T7, T8 |
| MR-4 | `log()` is best effort and never throws. | A3, T9 |
| MR-5 | Audit entries roll back with their financial operation. | T7, R1 |
| MR-6 | An unknown commit result retries the commit only, not the callback. | T4, R3, R4 |
| MR-7 | Every retry uses freshly loaded documents and session-bound reads and writes. | T2, T3 |
| MR-8 | No email, external HTTP call or other irreversible side effect runs inside a retried callback. | T9, G1 |

#### Corrections A–D

- A, persistent request identities: §12.11.
- B, cashbook close idempotency: §12.8 and §12.10.
- C, draft purchase-order replay: §12.10.
- D, deployment compatibility and rollout order: §12.3 and §12.12.

### 12.3 Stages, commits and releases (D4, D13, D20)

| Logical stage | Commit | Contents | Release |
|---|---|---|---|
| S0-5a | S0-5a | The audit action list, `recordAudit()` and `log()`, `runTransaction()`, the email guard, generic 500 messages, the marked CORS error and the safe error-handler log | Backend only. Works with current frontends. |
| S0-5b | S0-5b-backend | `RequestRecord`, request-ID checks in tolerant mode, the readiness check and the route conversions | Backend only, released before S0-5b-frontend. Works with current frontends. |
| S0-5b | S0-5b-frontend | Dexie version 2, device request identities, the six call sites, the pending-attempts notice and the build identifier | Frontend only. Released only after S0-5b-backend and RequestRecord readiness are verified (§12.12, step 2). |
| S0-5c | S0-5c | Missing and malformed IDs both refused | Backend only. Released only after rollout step 3. |

"Separately releasable" means that each commit changes only its own side (S0-5b-backend changes no frontend file and S0-5b-frontend changes no backend file), and that every combination the rollout allows keeps working:

| Backend in service | Frontend before S0-5b-frontend | Frontend S0-5b-frontend or later |
|---|---|---|
| Before S0-5b-backend | Today's behaviour | **Not allowed:** the backend ignores request IDs and dates, so a resend can create a duplicate. |
| S0-5b-backend (tolerant) | Works. Missing IDs are logged, and today's duplicate risk remains until S0-5c (accepted, §12.17). | Full protection |
| S0-5c | The six operations get 400 (intended, after step 3). | Full protection |

**Commit order:** this amendment (documentation only), S0-5a, S0-5b-backend and S0-5b-frontend, then S0-6, S0-1, S0-8, S0-2, S0-3, S0-7 and S0-4 as in §6.3. S0-5c must not be released before rollout step 3 is verified. Because releases come from one branch, any commit placed after S0-5c can only be released with it or after it. Its position is open item O-3 (§12.18).

**Order inside each commit:**

- **S0-5a:** the action list and the schema enum; `log()` and `recordAudit()`; `runTransaction()` and the guard; the marked CORS error (§12.7) and the error-handler response and log changes (D9, D18, D22); tests T1–T9 and A1–A8; full verification.
- **S0-5b-backend:** `RequestRecord`, `idempotency.js` and the readiness check, with no route change yet, verified by I10 and the helper-level tests; the state-safe routes; the six request-ID operations, in the order in §12.10; the remaining tests; full verification. This carries out D2's rule that request identities come before any non-idempotent create is converted.
- **S0-5b-frontend:** Dexie version 2 with F1, F2 and F7; the request-identity store and lifecycle; the six call sites, the notice and the build identifier; F3–F6 and F8–F11; full verification.
- **S0-5c:** the switch to required IDs; I5b, X1's enforcement part and the characterization requests (§12.15); full verification.

**Offline-database rule:** once S0-5b-frontend has been released, every frontend build served on the production origin must declare Dexie version 2 (§12.13). This includes any later release of the mobile UI branch, which today declares only version 1.

### 12.4 Transaction helper (D1, D2, D11)

```js
runTransaction(work, {
  maxAttempts: 3,
  maxCommitAttempts: 3,
  baseDelayMs: 25,
  maxDelayMs: 250,
  sleep,
  random
});
```

1. Each attempt starts a transaction with snapshot read concern, majority write concern and primary read preference, and runs `work(session, { attempt })` in a context marked "inside a transaction".
2. `work` reloads every document on each attempt and reads and writes only through `session`.
3. If `work` throws, the transaction is aborted. An error from the abort itself is ignored, because the server may already have aborted it. The error is retried only if it carries `TransientTransactionError` and an attempt remains. Every other error, including every business refusal, propagates with its own status and is not retried.
4. If the commit fails with `UnknownTransactionCommitResult`, only `commitTransaction()` is called again, and `work` doesn't run again. This label wins when the error also carries `TransientTransactionError`, which matches the installed driver's own order (MongoDB Node.js driver 6.20.0, `withTransaction` in `lib/sessions.js`). If the result is still unknown after the last allowed commit call, the helper stops: it never starts a new attempt, because running `work` again could apply the change twice.
5. A commit error with `TransientTransactionError` but without `UnknownTransactionCommitResult` means the transaction aborted, so a new attempt starts if one remains.
6. Any other commit error is a definite failure and is not retried.
7. Before every retry (a new attempt or a commit-only retry), the helper waits through the injected `sleep`. The delays grow exponentially, include jitter from the injected `random`, and always lie between 25 and 250 ms.
8. When attempts run out: 503, internal code `TRANSACTION_RETRY_EXHAUSTED`. When the commit result is still unknown after the last commit attempt: 503, internal code `TRANSACTION_COMMIT_UNKNOWN`. The public messages are in §12.7.
9. The session is always ended.

**Retry limits, precisely.**

| Limit | Maximum | What is counted |
|---|---|---|
| Transaction attempts | 3 per `runTransaction()` call (D1) | Executions of `work`: the first attempt and at most two retries. Each attempt is a new transaction. |
| Helper commit calls in one attempt | 3 (D1) | `commitTransaction()` calls the helper makes within one attempt: the first commit and at most two commit-only retries. |
| Helper commit calls in one `runTransaction()` call | 9 (O-8) | At most 3 in each of the at most 3 attempts. The count starts again with each new attempt. |

| Per `runTransaction()` call | Maximum |
|---|---|
| Executions of `work` | 3 |
| Helper commit calls | 9 |
| Commit commands sent to the server | 18: each helper commit call sends the commit at most twice in the installed driver (see below) |
| Waits | 8: twice between attempts, and at most twice between commit calls in each attempt |
| Deliberate waiting | 2 seconds: 8 waits of at most 250 ms |

- The driver's internal retries are never counted. In the installed driver (MongoDB Node.js driver 6.20.0, pinned in `backend/package-lock.json`), one `commitTransaction()` call sends the commit at most twice: once, and once more only after a retryable write error (`lib/sessions.js`). That retry uses majority write concern and, by default, a 10-second write-concern timeout; a `wtimeoutMS` already set in the effective write concern overrides the default. `abortTransaction()` also sends its command at most twice. Any such write-concern wait is separate from the helper's waits.
- The commit is sent as a plain command that the driver's general retry loop doesn't handle (`lib/operations/execute_operation.js` gives such commands one try). So the two-command limit also holds if Client-Side Operations Timeout (`timeoutMS`) is turned on, which makes that loop retry other operations until a deadline. With `timeoutMS`, a commit may send fewer commands, because it stops at the deadline, but `timeoutMS` can never raise the maximum of two commands per helper commit call.
- The application code doesn't set `timeoutMS`: `config/db.js` sets only `maxPoolSize`, `serverSelectionTimeoutMS` and `socketTimeoutMS`. The connection string could set it, but it wasn't read; under this driver version that doesn't change the count. Driver 6.20.0 also has no retries for server-overload errors.
- The limit of 18 commit commands is therefore guaranteed for driver 6.20.0. Any driver upgrade, which needs separate approval, must re-check it.
- The driver doesn't retry operations inside `work`, because retryable writes and reads don't apply inside a transaction.
- The helper sets no `maxCommitTimeMS`.
- Tests count at the helper boundary, with a wrapped session, and never rely on driver-internal retries (T4, T6).

`session.withTransaction()` (which retries for up to 120 seconds, with no attempt limit) and Mongoose's `connection.transaction()` (which wraps it) are not used. The two existing `withTransaction()` calls in `purchaseOrders.js` (receive and pay) move to `runTransaction()` in S0-5b-backend. The sessions in `invoices.js` don't change in S0-5 (they belong to S0-6 and S0-1).

**Inside-a-transaction guard (D11, MR-8):** inside a `runTransaction()` callback, `sendEmail()` throws before sending anything, and `log()` writes nothing, reports the misuse in a safe log line and still doesn't throw. The guard sees only `runTransaction()` callbacks. Sessions started elsewhere (today only in `invoices.js`, which sends no email) are invisible to it; G1 and code review cover that gap.

### 12.5 Audit recording and safe logs (D5, D6, MR-1 to MR-5)

- `backend/utils/auditActions.js` is the only list of the 39 actions (§12.6). The `AuditLog` schema's enum comes from it.
- `recordAudit(entry, { session })` throws before writing anything unless `session` has an active transaction and the action is on the list. It writes through `session`, and a failed write propagates, so the financial change rolls back with it. The stored entry has the same fields as today.
- `log(entry)` stays best effort and never throws. It checks the action, and on any failure emits one safe log line.
- Converted financial routes (§12.10) use `recordAudit()`. When a request ID is present, the audit details include it.
- Call sites pass audit actions as string literals, so the C14 source scan stays complete. Any non-literal use is listed and explained in C14.
- Sign-in, sign-out and failed sign-in stay on `log()`, because `auth.js` doesn't change. Customer and supplier creation and deletion also stay on `log()` (D5).

**Safe log line.** One JSON line containing only:

- `event`: a fixed internal event name;
- `action`, `entity` and `entityId`, where they apply;
- `error`: the error's `name`, `code`, `codeName` and allow-listed error labels (below). Never its message or stack: database messages can repeat stored values, and a duplicate-key message, for example, includes the duplicate value, such as an email address;
- `code`: an internal code, where one applies.

It never contains audit details, user names, emails, tokens, passwords, IP addresses, user agents or request bodies. Today `auditLogger.js` prints the error message; S0-5a replaces that line.

**Internal codes** (server logs only, never in responses): `TRANSACTION_RETRY_EXHAUSTED`, `TRANSACTION_COMMIT_UNKNOWN` and `REQUEST_ID_MISSING`. The other safe lines (an audit write failure, misuse inside a transaction, RequestRecord not ready, and the error-handler line) use fixed internal event names chosen in the reviewed diff.

**Error-handler log (D22, resolves O-1).** Today `errorHandler.js` prints the message and stack of every error it handles, and these can contain stored values. S0-5a replaces that with one safe structured line per handled error, containing only:

- `event`: a fixed internal event name. Its exact value is defined once, as a constant, in the S0-5a diff and reviewed there; this amendment doesn't fix it;
- `status`: the final response status;
- `method` and `route`: the matched route pattern (for example `PUT /api/customers/:id`), or `unmatched`; never the concrete URL or its query string;
- `error`: the error's `name`, `code`, `codeName` and allow-listed error labels (below).

The line never contains the error message, a stack trace, duplicate-key values, validation or cast values, request bodies, query strings, headers, cookies, tokens, passwords, IP addresses, user agents, user names or emails.

**Error labels in every safe line.** Only labels on a fixed allow-list are logged. The list is written out in the S0-5a code, not read from the driver at run time, and holds the nine labels that MongoDB Node.js driver 6.20.0 defines (`MongoErrorLabel` in `lib/error.js`): `RetryableWriteError`, `TransientTransactionError`, `UnknownTransactionCommitResult`, `ResumableChangeStreamError`, `HandshakeError`, `ResetPool`, `PoolRequstedRetry` (the driver's spelling), `InterruptInUseConnections` and `NoWritesPerformed`. Any other label is left out. These are fixed protocol names that carry no stored value. A driver upgrade, which needs separate approval, re-checks the list.

**Responses.** A generic 500 response (D9) contains only `success: false` and the fixed generic message, whatever `NODE_ENV` is set to: the development-only `stack` field is never added to it. Every other response keeps its current body. The blocked-CORS response (D18) is an explicit compatibility exception to these rules: it stays exactly as it is, including the request's Origin value, which can be an IP address. A6 passes unchanged, and A7 tests the log line and the generic responses.

**Other server log lines (existing, outside S0-5):** the request log writes each client's IP address; `config/db.js` and `middleware/auth.js` print whole error objects; and several email error lines print error messages. S0-5 doesn't change them. They belong to the Stage 1 security review.

### 12.6 The 39 audit actions

#### Existing actions (22)

```text
LOGIN
LOGOUT
LOGIN_FAILED
PRODUCT_CREATE
PRODUCT_UPDATE
PRODUCT_DELETE
INVOICE_CREATE
INVOICE_DELETE
OFFLINE_CONFLICT_APPROVE
OFFLINE_CONFLICT_REJECT
EXPENSE_CREATE
EXPENSE_DELETE
CUSTOMER_CREATE
CUSTOMER_UPDATE
CUSTOMER_DELETE
SUPPLIER_CREATE
SUPPLIER_UPDATE
SUPPLIER_DELETE
STOCK_ADJUST
USER_CREATE
USER_UPDATE
CASHBOOK_CREATE
```

#### Previously missing actions (12)

```text
CASHBOOK_CLOSING_SUBMIT
CASHBOOK_CLOSING_APPROVE
INVITATION_CREATED
USER_CREATED_FROM_INVITATION
INVITATION_RESENT
INVITATION_DELETED
PURCHASE_ORDER_CREATE
PURCHASE_ORDER_UPDATE
PURCHASE_ORDER_DELETE
PURCHASE_ORDER_ORDERED
PURCHASE_ORDER_RECEIVE
SUPPLIER_PAYMENT
```

#### New actions (5)

```text
INVOICE_DELETE_REFUSED
CUSTOMER_UPDATE_REJECTED
CUSTOMER_PAYMENT_RECORD
CUSTOMER_PAYMENT_REVERSE
EXCHANGE_RATE_UPDATE
```

These are 39 distinct `UPPER_SNAKE_CASE` actions. The list and the schema must match exactly, and tests detect missing, duplicate and unregistered actions (A1, A2).

### 12.7 Error responses (D2, D9, D10, D18)

| Case | Status | Body |
|---|---|---|
| Transaction attempts exhausted, or RequestRecord not ready | 503 | `message`: "The system is busy. Please try again." |
| Commit result still unknown, or a duplicate-key reread that finds no request record (§12.8) | 503 | `message`: "This change could not be confirmed. Check before trying again." |
| Request ID reused with another operation, user or fingerprint (D10) | 409 | message only |
| Malformed request ID; missing request ID (S0-5c only); malformed cashbook date, with or without an ID (D23); missing cashbook date when an ID is sent | 400 | message only |
| Stale cashbook date, with or without an ID (D16, D23) | 409 | message only |
| Unexpected error (D9) | 500 | one fixed generic message, with no raw message or stack trace in any environment (D22) |
| Blocked CORS origin (D18) | 500 | `{ success: false, message: 'CORS blocked: <origin>' }`, unchanged, and only for the error marked by `app.js`'s CORS check (below). An explicit exception to D22: the Origin value can be an IP address. |

Every body has `success: false`. "Message only" means no `code` field: S0-5 adds no public error code. The two 503 messages are the wording in the approved plan. No 503 body names a collection, index, collection option or database, or contains an error message or internal code (D2); this includes the not-ready response (§12.9).

**D9 in detail.** After `errorHandler.js` has applied its existing mappings, a response whose status is 500 gets the generic message. The one exception is the CORS rejection (D18), which is recognized by a dedicated marker, never by its message:

- A new module, `backend/utils/corsBlockedError.js`, creates the CORS rejection error with exactly today's message (`CORS blocked: <origin>`) and marks it with a symbol private to that module, so an error can be marked only through that module. The module also provides the check for the marker.
- `app.js`'s CORS check creates its error only through that module. Nothing else in `app.js` changes: the allowed origins, the CORS options and the middleware order stay as they are. The `cors` package passes that error object to the error handler unchanged.
- `errorHandler.js` gives the D18 response only to an error that carries the marker, and returns it exactly as today. The message text plays no part in recognizing it.
- Any other error, including one whose message starts with `CORS blocked: `, is handled like every other error, so a 500 gets the generic message (A8).

These stay unchanged:

- errors with an explicit status, including every business refusal and the 503s above;
- `EMAIL_` errors, with their existing safe messages and codes;
- `OFFLINE_` codes and `conflictDetails`;
- validation errors (400), duplicate keys (400), invalid IDs (400) and JWT errors (401);
- the fixed 500 messages that `middleware/auth.js`, `routes/auth.js` and `routes/webhooks.js` send directly, which never reach `errorHandler.js`.

How these errors are logged is covered by D22 (§12.5).

### 12.8 Request identities on the server (D2, D7, D10, D13)

| Operation | Route | Scope | Success status |
|---|---|---|---|
| `expense.create` | `POST /api/expenses` | none | 201 |
| `purchaseOrder.create` | `POST /api/purchase-orders` | none | 201 |
| `purchaseOrder.pay` | `PATCH /api/purchase-orders/:id/pay` | the purchase order | 200 |
| `product.create` | `POST /api/products` | none | 201 |
| `exchangeRate.update` | `POST /api/cashbook/rate` | none | 200 |
| `cashbook.close` | `POST /api/cashbook/close` | the business date | 200 |

No other route creates these records. `POST /api/expenses/add` is still registered, but it re-dispatches into itself and never reaches the create handler (C18). Tests never request it, and S0-8 removes it (§6.2).

#### Format and fingerprint

- `clientRequestId` is a JSON body field, not a header, because CORS allows only `Content-Type` and `Authorization`. It is a string of 8–100 characters from `[A-Za-z0-9_-]`; the frontend sends a UUID.
- The fingerprint is SHA-256 over the operation, the scope and the operation's allow-listed fields (§12.11), after the route's own normalization: text trimmed, money amounts in cents, purchase-order items in the order sent.
- `usdToSsp` is a rate, not money. It is fingerprinted exactly as the route stores it, without rounding.
- Only fields the client sent are included, so server defaults such as "now" never change the fingerprint. `clientRequestId` itself is excluded.
- The server's fingerprint is independent of the device's (§12.11).

#### RequestRecord

`backend/models/RequestRecord.js` has the fields `_id`, `operation`, `userId`, `fingerprint`, `entity`, `entityId` and `createdAt`.

- `_id` is a required String holding the client's request ID (a UUID) exactly as sent, once it has passed the format check. The schema declares it as `_id: { type: String, required: true }`, so it is never converted to an ObjectId and no ObjectId is generated in its place.
- Uniqueness comes only from MongoDB's default unique `_id` index (§12.9). No other index is added (D12, D15).
- Records are never deleted automatically.
- I13 checks that the ID is stored and found as a string.

#### Processing order

1. The existing authentication and role checks run first.
2. **Request ID.** A supplied malformed ID gets 400. For a missing ID: in S0-5b the request continues on the legacy path, and a `REQUEST_ID_MISSING` line is logged with only the route pattern (for example `PATCH /api/purchase-orders/:id/pay`, never the concrete URL) and the time; in S0-5c it gets 400.
3. **Format checks:** only what is needed to read the request and compute its fingerprint: types, required fields, lengths, allowed values and the cashbook date format (§12.10). A failure gets 400 with the existing response.
4. **Readiness,** if an ID is present: the check in §12.9, outside any transaction. If not ready: 503.
5. `runTransaction()` starts. If an ID is present, the RequestRecord is read through the session:
   - same operation, user and fingerprint: the entity is reloaded and a duplicate is returned (below), before any state check;
   - anything different: 409.
6. **State checks,** with today's statuses and messages: referenced records exist, order status, balances, cash-day rules, the cashbook date (§12.10) and every other existing rule.
7. The business change, through the session.
8. If an ID is present, the RequestRecord is created through the session.
9. `recordAudit()`, through the session.
10. Commit (§12.4), then the existing success response.

Each check keeps its status and message. Only the order of format checks before state checks can change, which affects only a request that fails both. Legacy requests (no ID, S0-5b only) skip steps 4, 5 and 8, so their change and audit entry are still atomic.

#### Precedence for reused and invalid requests

| Request | Response | Why |
|---|---|---|
| A malformed ID, with any body | 400 | Step 2 |
| A valid ID with a body that fails the format checks or can't be normalized (for example a non-numeric amount), whether the ID is new or already recorded | 400, with the route's existing validation response | Step 3 runs before the lookup. No fingerprint is computed, the stored record isn't read, and the response reveals nothing about the ID. |
| A valid ID and a valid body, while the collection isn't ready | 503 | Step 4 |
| A recorded ID with the same operation, user and fingerprint | 200 duplicate | Step 5, before any state check |
| A recorded ID with a valid body but a different operation, user or fingerprint (D10) | 409, message only | Step 5 |
| An ID that isn't recorded | The route's normal result, including its existing state refusals | Steps 6–10 |
| The same valid ID sent twice at once, where the other request commits first while this one is still running | This request's transaction hits a write conflict and retries; step 5 then returns the duplicate, or 409 if the operation, user or fingerprint differs | Concurrency rules below |
| As above, but this request's insert of the request record fails with a duplicate-key error on `_id` | The transaction aborts and the record is read again outside it, not counted as an attempt: the duplicate, or 409 if anything differs; 503 if the reread finds nothing, without guessing the outcome | Concurrency rules below |

D10's 409 therefore applies only to a payload that has passed the format checks. An invalid payload gets 400, whether its ID is new or reused, and the client treats that 400 as a refusal (§12.11). The race paths apply D10 in the same way: a mismatch is always 409, never a duplicate.

#### Duplicate response

- Status 200, even where the original returned 201.
- The operation's normal success body, with the entity reloaded in its current state, plus `duplicate: true`.
- If the entity has since been deleted, `data` is `null`: an expense or a draft purchase order that was removed, or a product marked `isDeleted: true`. Never 404: the request itself succeeded.
- A duplicate never recreates, restores or changes the entity, and writes no business record, request record or audit entry. A deleted product stays marked `isDeleted: true`, and a removed expense or purchase order isn't recreated.
- A duplicate is returned even when the business state has changed since. Examples: a supplier-payment replay after the order became fully paid, and a cashbook-close replay after the date changed.
- A new ID is never a duplicate, and it must pass every current state check.

#### Concurrency and uncertain outcomes

- Two identical requests at once leave one business record, one RequestRecord and one audit entry.
- A write conflict with a concurrent identical request is transient: the transaction retries, and step 5 then returns the duplicate.
- A duplicate-key error on the RequestRecord `_id` is not transient. The transaction aborts, the record is read again outside it (not counted as an attempt), and the response is the duplicate or 409. If the reread finds no record, the response is 503 with the "could not be confirmed" message (§12.7): the server doesn't guess whether the other request with that ID succeeded, and this request has written nothing. The device keeps the attempt unconfirmed with the same ID (§12.11), so a retry returns the duplicate or applies the operation exactly once. Duplicate-key errors on any other collection are not request-ID collisions and keep today's 400 response.
- An unknown commit result is retried as a commit only. If it stays unknown, the response is 503. The client keeps the ID, and a resend returns the stored result or applies the operation exactly once.

### 12.9 RequestRecord collection (D12, D15)

#### Model settings

The `RequestRecord` schema sets `autoCreate: false` and `autoIndex: false` and declares no index. These settings apply to this model only: the connection defaults and every existing model's indexes are unchanged. The application therefore never creates this collection or an index on it.

#### Manual creation procedure

This procedure is documented here only. No script for it is added in S0-5a, S0-5b or S0-5c, and it never runs at application start-up, during a deployment, during a request or in CI. An operator performs it only after the owner separately approves the change for the target database.

1. Confirm the target database, approved under O-9, and the approved change record.
2. Check whether `requestrecords` exists. If it does, inspect it without changing it, and stop for review.
3. Create `requestrecords` explicitly, outside any application transaction, with default options: no collation, validator, capped size, clustered index or time-series settings.
4. Verify that it exists as an ordinary collection.
5. List its indexes and verify that only the default `_id_` index exists.
6. If anything else is present, stop. Do not drop or change anything.
7. Without changing any privilege, confirm that the application's existing database role allows listing collections and indexes, which the readiness check needs.
8. Record the result and the approval. This record is the gate for rollout step 1 (§12.12).

This amendment creates no collection.

#### Readiness check

- Runs outside any transaction, and only for requests that carry an ID.
- Ready means all of these:
  - `requestrecords` exists as an ordinary collection: not a view and not a time-series collection;
  - it is not capped and has no collation;
  - its indexes are exactly the default `_id_` index on `{ _id: 1 }`: no other index, and not a clustered index. MongoDB always enforces that index as unique, and `listIndexes` reports no `unique` flag for it, so the check doesn't require one.
- A successful result is cached for the life of the server process, so later requests add no database round trips.
- A failed result is not cached: the next request with an ID checks again.
- If not ready: 503 with the generic busy message (§12.7), before the financial transaction starts, and a safe log line. The response contains no internal database information: no collection, index, option or database name, and no error text. Nothing is written, so a request can never create the collection implicitly.
- I10 tests this in the local harness. Staging rehearses the manual procedure (M4).

### 12.10 Route conversions in S0-5b-backend

The state-safe routes are converted first. The six request-ID operations follow in this order: expense create, purchase-order create, supplier payment, product create, exchange rate, cashbook close.

#### State-safe routes (no request ID)

| Route | Repeat after S0-5b | Audit entries |
|---|---|---|
| `POST /api/cashbook/open` | 200 "already open", as today. A concurrent open that commits first also ends as "already open". | one `CASHBOOK_CREATE` |
| `POST /api/cashbook/approve/:id` | 409 "Already approved.", as today. The approval and the day's closed flag are written in one transaction. | one `CASHBOOK_CLOSING_APPROVE` |
| `DELETE /api/expenses/:id` | 404, as today | one `EXPENSE_DELETE` |
| `PUT /api/purchase-orders/:id` | An identical replay returns 200 and saves nothing (below). | one `PURCHASE_ORDER_UPDATE` per genuine change |
| `PATCH /api/purchase-orders/:id/order` | 409, as today | one `PURCHASE_ORDER_ORDERED` |
| `PATCH /api/purchase-orders/:id/receive` | 409, as today. Stock, stock movements, cost prices and supplier debt change once, in the same transaction as the audit entry. | one `PURCHASE_ORDER_RECEIVE` |
| `DELETE /api/purchase-orders/:id` | 404, as today | one `PURCHASE_ORDER_DELETE` |
| `DELETE /api/products/:id` | D21: an already-deleted product returns 200 with the existing message (`"<name>" removed from inventory.`), and nothing is written. An unknown product still gets 404. | one `PRODUCT_DELETE` |

#### Request-ID operations

- **`expense.create`:** validation and response are unchanged.
- **`purchaseOrder.create`:** the supplier and product lookups are state checks (step 6).
- **`purchaseOrder.pay`:** `normalizeSupplierPayment()` mixes format checks with state checks. S0-5b-backend separates them in `purchaseOrderValidation.js`:
  - format checks (amount, payment method, date, reference, note) run at step 3;
  - state checks (order status, balance due, and the amount against the balance due) run at step 6, with the existing cash-day and supplier-debt checks.

  Statuses and messages don't change. The existing `normalizeSupplierPayment()` keeps its behaviour, so `backend/utils/purchaseOrderValidation.test.js` passes unchanged.
- **`product.create`:** the opening-stock movement is written in the same transaction (D3).
- **`exchangeRate.update`:** the rate and `EXCHANGE_RATE_UPDATE` are written in one transaction (D6). The rate keeps the server's UTC `date`.
- **`cashbook.close`:** below.

#### Cashbook close (D16, D19, correction B)

The body with an ID is `{ clientRequestId, date, actualCash, notes }`, where `date` is `YYYY-MM-DD`. "Today" is the route's existing UTC date. Stage 0 doesn't introduce `Africa/Juba` dates here.

| Request | S0-5b | S0-5c |
|---|---|---|
| No ID and no date (what current builds send) | Accepted and handled as today; `REQUEST_ID_MISSING` logged | 400 |
| No ID, with a date | D23: the date is checked against the server's current cashbook date, 400 if malformed and 409 if stale, and never ignored; `REQUEST_ID_MISSING` logged | 400 |
| An ID but no date | 400 | 400 |
| A malformed ID or date | 400 | 400 |
| A valid ID and date | Processed as in §12.8 and the rules below | Same |

D13, D19 and D23 decide every row.

Rules for a request with a valid ID and date:

1. The duplicate lookup runs before the date and closed-day checks. A replay returns 200 duplicate, without recalculating and without a second `CASHBOOK_CLOSING_SUBMIT`, even after the date has changed or the closing was approved.
2. The same ID with a different fingerprint gets 409.
3. A new ID with a date that isn't today gets 409.
4. Then today's checks run, in today's order: no cashbook for today, 404; day already closed, 409; closing already approved, 409.
5. A new ID while today's closing awaits approval re-submits it: the closing is recalculated and overwritten, and gets its own `CASHBOOK_CLOSING_SUBMIT`, as today.

The client takes `date` from the `date` field of `GET /api/cashbook/today`, never from the device clock. The page's existing display fallback (`new Date().toISOString().slice(0, 10)`) is never sent. Between 00:00 and 02:00, a phone's local date in Juba (UTC+2) is a day ahead of the server's UTC date.

#### Draft purchase-order replay (correction C)

Inside the transaction, the route reloads the draft, validates and normalizes the supplier, items (product, quantity and unit cost), discount and note, and compares them with the draft:

- identical: 200 with the current order and today's message; nothing is saved and no audit entry is written;
- any difference: saved and audited as `PURCHASE_ORDER_UPDATE`, as today.

The copied supplier and product names are not compared.

### 12.11 Device-side request identities (D8, D14, D17, correction A)

#### Offline database

`frontend/src/offline/db.js` keeps `new Dexie('AbdumulaFashionERP')` and its `db.version(1).stores(...)` declaration exactly as they are:

| Store | Version 1 indexes |
|---|---|
| `pendingSales` | `'++id, offlineId, createdAt, isSynced'` |
| `products` | `'_id, name, category, barcode, sku, updatedAt'` |
| `customers` | `'_id, name, phone, updatedAt'` |
| `syncMeta` | `'key'` |

Version 2 adds only:

```js
db.version(2).stores({
  requestIdentities: 'id, userId, [userId+operation+scope], updatedAt'
});
```

There is no upgrade function. Stores not named in version 2 keep their version 1 definition, so every existing store, index and record, including `pendingSales`, is preserved. Nothing clears, replaces or deletes an existing store. No frontend build may roll back below version 2 (§12.13).

#### What each attempt stores

- `id`, `userId`, `operation`, `scope` (an empty string when the operation has none), `method`, `path`, `body`, `fingerprint`, `state` (`pending`, `unconfirmed` or `refused`), `attempts`, `lastStatus`, `createdAt` and `updatedAt`.
- `id` is a version 4 UUID from `crypto.randomUUID()`, or built from `crypto.getRandomValues()` where that is unavailable. It never comes from `Math.random()`.
- `fingerprint` is computed on the device from the operation, the scope and the stored body. It need not match the server's.
- Never stored: tokens, passwords, `Authorization` headers, user names, emails or server message text.

#### Stored body allow-lists

| Operation | Fields |
|---|---|
| `expense.create` | `title`, `amount`, `category`, `description`, `date` |
| `purchaseOrder.create` | `supplierId`, `items[].productId`, `items[].quantity`, `items[].unitCost`, `discount`, `note` |
| `purchaseOrder.pay` | `amount`, `paymentMethod`, `date`, `reference`, `note` |
| `product.create` | `name`, `category`, `price`, `costPrice`, `quantity`, `lowStockThreshold`, `sku`, `barcode`, `size`, `color`, `supplier`, `imageUrl`, `description` |
| `exchangeRate.update` | `usdToSsp` |
| `cashbook.close` | `date`, `actualCash`, `notes` |

- These are the fields the current forms send. Each page builds its body with its existing, unchanged normalizer, and only these fields are stored.
- Every send, including the first, uses exactly the stored method, path and body, plus `clientRequestId`.
- For `cashbook.close`, `date` comes from `GET /api/cashbook/today` (§12.10).

#### Lifecycle

| Event or response | What happens |
|---|---|
| The user submits | In one IndexedDB transaction, look for the user's open (`pending` or `unconfirmed`) attempt for the same operation and scope. Same fingerprint: reuse its ID and body. Different fingerprint: stop, show the open attempt and offer Retry, with no new ID. None open: store a new `pending` attempt before sending. |
| 200 or 201, including a duplicate, also with `data: null` | Confirmed: the attempt is deleted. |
| 400, 403, 404 or any 409 | Refused: the ID is retired and never sent again. The attempt stays visible with Dismiss only, never Retry, until the user dismisses it. |
| 401 or 429 | Unconfirmed: the ID and stored body are kept, and Retry is offered after signing in or after a pause. |
| 503, any other 5xx, a timeout or a network failure | Unconfirmed: the ID and stored body are kept, `attempts` and `lastStatus` are updated, and Retry is offered. Nothing is resent automatically. |
| Any other status | Unconfirmed, as above. |
| A reload, browser restart or crash while sending | Attempts persist. A `pending` attempt found after a reload becomes `unconfirmed`. |
| Reopening a page | The page lists the current user's unconfirmed and refused attempts for its operations. An unconfirmed attempt offers Retry, which resends the stored request with the same ID. A refused attempt offers Dismiss only. Nothing is resent automatically. |
| Logout or a user switch | Attempts are kept. Other users never see or retry them. |
| An attempt older than 7 days | It shows "check the records first". It is never deleted automatically, and retrying an unconfirmed attempt stays safe. |

- The client can't tell one 409 from another, because D10 gives only a message, so every 409 is a refusal (D14).
- If a refusal follows an earlier unconfirmed outcome of the same attempt (`attempts` above 1), the notice says the change may already be recorded and asks the user to check the records before entering it again. Role checks run before the duplicate lookup, so after a role change a resend can get 403 even though the original succeeded. The notice still offers Dismiss only.
- **Actions.** An unconfirmed attempt offers Retry and can't be dismissed (correction A). A refused attempt offers Dismiss and can never be retried. Both stay visible until the user resolves them: an unconfirmed attempt by a retry that ends confirmed or refused, a refused attempt by dismissing it.
- Dismissing removes only the local attempt and its notice. It sends no request and changes no server data.
- **Automatic resends.** The request-identity code never resends anything by itself: not in the background, not when the device comes back online, and not after a timeout, a network failure or a 5xx. The only automatic resend is the existing API client's replay after a 401 `TOKEN_EXPIRED` (`services/api.js`, unchanged in S0-5):
  - after refreshing the token, it resends the original request config, so the body and request ID are identical;
  - the request that starts the refresh is replayed at most once;
  - a request that waits for a refresh already in progress is replayed without that once-only flag, so in the rare case that its replay also gets `TOKEN_EXPIRED`, it is replayed once more;
  - no replay can apply a change twice, because `TOKEN_EXPIRED` is returned by the authentication check before any route logic runs;
  - a replay belongs to the same send, so `attempts` doesn't change;
  - if the refresh fails, the client goes to the sign-in page, and the stored attempt is shown as unconfirmed after the reload.

  S0-5 adds no other automatic retry.
- After an unconfirmed outcome, the page refreshes its data, so the user can see whether the record exists.
- A confirmed response with `data: null` puts no entity into the page's data. The page refreshes its data from the server instead, so a deleted record never reappears on the device.
- Request-identity code never reads or writes `pendingSales`, and the offline sales queue never touches `requestIdentities`.

#### Pages

| Page | Operations |
|---|---|
| `ExpensesPage.jsx` | `expense.create` |
| `PurchaseOrdersPage.jsx` | `purchaseOrder.create`, `purchaseOrder.pay` |
| `ProductsPage.jsx` | `product.create` (product update is unchanged) |
| `CashClosingPage.jsx` | `cashbook.close`, `exchangeRate.update` |
| `SettingsPage.jsx` | `exchangeRate.update` (the rate form), and the build identifier |

- `PendingRequestsNotice.jsx` shows the attempts on each of these pages, with Retry on unconfirmed attempts and Dismiss on refused ones, never both. The two exchange-rate forms share the same `exchangeRate.update` attempts.
- `CashbookPage.jsx` also calls close and rate, but no route renders it (`App.jsx` maps `/cashbook` to `CashClosingPage`). It stays unchanged and is the one recorded exception in F9.

#### Build identifier (D17)

- `frontend/src/buildInfo.js` exports a constant release label, updated by hand for every frontend release. Settings, which every role can open, shows it.
- As agreed, the label is maintained by hand and is not generated at build time. S0-5 changes neither `vite.config.js` nor environment variables.
- No earlier build shows a build label (the existing "Version 3.0.0" text is not one), so any label proves that a device runs S0-5b-frontend or later. Every later release must change the label.

### 12.12 Rollout (D13, D20, correction D)

S0-5a has no rollout dependency and can be released on its own before step 0.

| Step | Action | Gate before the next step |
|---|---|---|
| 0 | With separate approval: the manual RequestRecord procedure (§12.9) on the target database. Blocked until the owner has explicitly approved that database and its status and data have been verified (O-9). | The recorded result: an ordinary collection with default options and only `_id_`, and a database role that can list collections and indexes |
| 1 | Release S0-5b-backend (tolerant mode) | The deployed backend commit is confirmed, read-only, on the hosting service; the S0-5b-backend tests, including I5a and I10, passed for that commit; M4 passed on the separate staging service (D24), if it has been provisioned |
| 2 | **Hard gate (D20): only after steps 0 and 1 are verified.** Release S0-5b-frontend, outside trading hours. | — |
| 3 | On each intended device: it has reloaded, Settings shows the build label, and the pending-sales count is unchanged (M1, observation only). On the server, `REQUEST_ID_MISSING` lines have stopped. | The verified device list is recorded |
| 4 | Release S0-5c, after its exact diff is approved | — |
| 5 | An old build gets 400 on all six operations (M2, on staging), and X1 passes | Enforcement verified |

- Every step needs separate approval. This amendment authorizes none.
- The hosting services' deployment settings (for example automatic deployment from a branch) have not been checked. Changing them needs separate approval (O-5).
- Tolerant mode is not full protection: old builds keep today's duplicate risk until S0-5c (§12.17), so the rollout must continue to steps 3–5.

### 12.13 Rollback and offline-data protection

**Why no build may go below Dexie version 2.** Dexie 3.2.7 opens the database at its declared version times 10 (`indexedDB.open(dbName, Math.round(db.verno * 10))` in `dist/dexie.js`) and has no downgrade path. Once a device has opened version 2, a build that declares only version 1 fails with a version error and can't open the database at all, including `pendingSales`.

**Before any rollback:** outside trading hours, and immediately before the frontend rollback, check each intended device for unconfirmed attempts, and resolve them by retrying or record them. An attempt made after the check would be hidden by the rollback.

**Order (the reverse of the rollout):**

1. Roll back S0-5c, if it was released, to tolerant S0-5b-backend.
2. Roll back the frontend with a new, reviewed commit that undoes S0-5b-frontend but keeps the version 2 declaration in `db.js`. Never redeploy an earlier build, including through the hosting service's instant rollback: every build before S0-5b-frontend declares only version 1. The rollback build hides stored attempts without deleting them.
3. Check on the devices that pending sales and stored request identities are unchanged.
4. Only after every device has been checked and its unconfirmed attempts resolved, roll back S0-5b-backend. A backend without request-ID handling would turn a resend into a duplicate. S0-5b-frontend is never restored against a backend older than S0-5b-backend.
5. S0-5a doesn't depend on request IDs. It is rolled back last, if at all.

No rollback drops `requestrecords`, deletes a request record, clears IndexedDB, or deletes or reassigns a pending sale (§8).

### 12.14 Test matrix

Backend tests use the network-blocked in-memory harness with synthetic data, and frontend tests use `fake-indexeddb`. Manual checks use the separate staging service and database (D24), once provisioned with approval, and the intended devices; production is never a test target. A local pass is not a production verification.

| ID | Commit and file | Proves |
|---|---|---|
| T1 | S0-5a, `transactions.test.js` | A successful callback commits once, returns its result and ends the session. |
| T2 | S0-5a, `transactions.test.js` | A transient error on attempt 1 is retried, leaving one business record and one audit entry. |
| T3 | S0-5a, `transactions.test.js` | A real write conflict (attempt 1 reads, an outside write intervenes, then the conflict) is retried with freshly loaded documents, leaving one audit entry. |
| T4 | S0-5a, `transactions.test.js` | An unknown commit result (the commit succeeds, then a labelled error) retries only the commit: `work` runs exactly once, the helper makes exactly two commit calls, and one audit entry remains. The same holds when the error also carries `TransientTransactionError`. |
| T5 | S0-5a, `transactions.test.js` | A business error is not retried, and nothing is written. |
| T6 | S0-5a, `transactions.test.js` | The exact limits in §12.4, counted at the helper boundary. (a) `work` throws `TransientTransactionError` every time: it runs exactly 3 times with 2 waits, nothing is written, and the result is 503, logged as `TRANSACTION_RETRY_EXHAUSTED`. (b) Every commit call reports an unknown result: `work` runs once, the helper makes exactly 3 commit calls with 2 waits and starts no second attempt, and the result is 503, logged as `TRANSACTION_COMMIT_UNKNOWN`. (c) Every commit fails with `TransientTransactionError`: `work` runs exactly 3 times with one commit call each, then 503, logged as `TRANSACTION_RETRY_EXHAUSTED`. (d) Attempt 1's commit is unknown, unknown, then transient, and every later commit is unknown: `work` runs twice, the helper makes 6 commit calls with 5 waits, and the result is 503, logged as `TRANSACTION_COMMIT_UNKNOWN`. (e) The longest possible sequence (unknown, unknown, then transient in attempts 1 and 2; unknown three times in attempt 3) runs `work` 3 times and makes exactly 9 commit calls with 8 waits, never a 10th commit call, and the result is 503, logged as `TRANSACTION_COMMIT_UNKNOWN`. Every wait is within 25–250 ms, and no response contains a database detail or an internal code. |
| T7 | S0-5a, `transactions.test.js` | An audit write failure rolls back the business write. |
| T8 | S0-5a, `transactions.test.js` | `recordAudit()` without an active transaction, or with an unknown action, fails before writing. |
| T9 | S0-5a, `transactions.test.js` | Inside a `runTransaction()` callback, `sendEmail()` throws without sending, and `log()` writes nothing, reports the misuse and doesn't throw. |
| A1 | S0-5a, `auditFoundation.test.js` | The schema enum equals the list of 39 unique `UPPER_SNAKE_CASE` actions. |
| A2 | S0-5a, `auditFoundation.test.js` | Every literal action in the backend source is on the list (the C14 scanner). |
| A3 | S0-5a, `auditFoundation.test.js` | `log()` never throws, for an unknown action or a failing write. An injected error whose message contains a test email address, IP address and user agent produces a safe line containing none of them, and no token. |
| A4 | S0-5a, `auditFoundation.test.js` | With every audit write failing: a correct sign-in returns 200 with tokens; a wrong password returns 401, and the attempt is counted; an unknown email returns 401; sign-out returns 200. |
| A5 | S0-5a, `auditFoundation.test.js` | A normal sign-in stores `LOGIN` exactly once. |
| A6 | S0-5a, `auditFoundation.test.js` | An unexpected 500 returns the generic message. The responses listed as unchanged in §12.7 are unchanged, and `tests/app.contract.test.js`, including the blocked-CORS case, passes unchanged (D18). |
| A7 | S0-5a, `auditFoundation.test.js` | Error-handler log and generic responses (D22). Errors whose message, duplicate-key value, validation value or cast value, or whose request query string, headers or body, carry a test email address, phone number, password, token, IP address, user agent and body value produce log lines containing none of them, no raw error message and no stack trace. That includes a blocked-CORS request from an IP-address origin: its log line contains no Origin value. The lines do contain the expected status, route pattern and error name, so the test can't pass by logging nothing. A generic 500 response contains only `success: false` and the generic message, including with `NODE_ENV` set to `development`. The blocked-CORS response is excluded from that check (D18): A6 and `tests/app.contract.test.js` keep asserting its unchanged body. This is checked with direct calls to the handler and with requests through the test app. An error carrying allow-listed labels and labels outside the allow-list in §12.5 logs only the allow-listed ones. |
| A8 | S0-5a, `auditFoundation.test.js` | Recognizing the CORS rejection (§12.7). The error created by `app.js`'s CORS check gets the D18 response, unchanged (A6 asserts it too). Errors not created through `corsBlockedError.js` get the generic 500, with no Origin value: a plain error with exactly the CORS message (`CORS blocked: https://evil.example`), and one whose message only starts with `CORS blocked: `. This is checked with direct calls to the handler and through a test route in front of the real handler. A source scan shows that `app.js`'s CORS check is the only code that creates the marked error. |
| R1 | S0-5b-backend, `financialAudit.test.js` | With the audit write failing in each converted route, the response is an error and nothing changes: records, stock, movements, cost prices, supplier debt, cashbook flags, closings, rates and request records. |
| R2 | S0-5b-backend, `financialAudit.test.js` | One injected transient failure still gives success, with one record and one audit entry. |
| R3 | S0-5b-backend, `financialAudit.test.js` | An unknown commit at route level gives one record and one audit entry. |
| R4 | S0-5b-backend, `financialAudit.test.js` | A commit that stays unknown gives 503. A resend with the same ID returns the duplicate, with no second record or audit entry. |
| R5 | S0-5b-backend, `financialAudit.test.js` | Exhausted attempts give 503. A resend with the same ID creates the record once. |
| G1 | S0-5b-backend, `financialAudit.test.js` | No misuse report appears in any route test, and no email is sent inside a `runTransaction()` callback. |
| I1 | S0-5b-backend, `idempotency.test.js` | For all six operations, the same ID and payload return 200 duplicate, with no new record, request record or audit entry. |
| I2 | S0-5b-backend, `idempotency.test.js` | The same ID with a different but valid payload returns 409 and writes nothing. The same ID with an invalid payload returns 400 with the route's validation response, and so does a new ID with that payload (§12.8 precedence). |
| I3 | S0-5b-backend, `idempotency.test.js` | The same ID from another user, or for another operation, returns 409 and reveals nothing. |
| I4 | S0-5b-backend, `idempotency.test.js` | Two identical requests sent together leave one business record, one request record and one audit entry, whichever runs first. |
| I5a | S0-5b-backend, `idempotency.test.js` | Tolerant mode: a missing ID is accepted, and `REQUEST_ID_MISSING` is logged with only the route pattern and the time. A malformed ID gets 400. The cashbook rows decided by D13 and D19 behave as listed in §12.10 for S0-5b; the "no ID, with a date" row follows D23: 400 for a malformed date and 409 for a stale one. |
| I5b | S0-5c, `idempotency.test.js` | Missing and malformed IDs get 400 on all six operations, and a close with an ID but no date gets 400. Replaces I5a. |
| I6 | S0-5b-backend, `idempotency.test.js` | A supplier-payment replay after a partial payment, and after a full payment, returns 200 duplicate and adds no payment. The lookup runs before the status and balance checks. A new ID after full payment gets 409. |
| I7 | S0-5b-backend, `idempotency.test.js` | Cashbook close: a replay after the date changed returns 200 duplicate, with no recalculation and no second `CASHBOOK_CLOSING_SUBMIT`; a different fingerprint gets 409; a new ID with a stale date gets 409; a new ID while the closing awaits approval re-submits it and is audited; a new ID after approval gets 409. |
| I8 | S0-5b-backend, `idempotency.test.js` | Draft purchase order: a genuine update is audited once; an identical replay returns 200, with no save and no audit entry; the next genuine change is audited. |
| I9 | S0-5b-backend, `idempotency.test.js` | Each state-safe route in §12.10, repeated, returns the status listed there, writes one audit entry in total and repeats no effect. Product delete follows D21. |
| I10 | S0-5b-backend, `requestRecordReadiness.test.js` | Starting without `requestrecords`, a request with a valid ID gets 503 before any transaction, and the collection still doesn't exist. The body is exactly `{ success: false, message: 'The system is busy. Please try again.' }`, naming no collection, index, option or database. Each other not-ready state, set up in the in-memory test database, also gets that 503: a view, a time-series collection, a capped collection, a collection with a collation, a clustered collection, and an ordinary collection with one extra index. The model creates no collection or index, and a failed check is not cached. After the test creates the collection as in §12.9, a request succeeds, and later requests don't repeat the readiness listing. |
| I11 | S0-5b-backend, `idempotency.test.js` | A replay after the entity was deleted (an expense, a draft purchase order, a product marked `isDeleted: true`) returns 200 with `duplicate: true` and `data: null`, never 404. The entity stays deleted: the product is still marked `isDeleted: true`, no expense or purchase order is recreated, and the replay writes no business record, request record or audit entry. |
| I12 | S0-5b-backend, `idempotency.test.js` | A simulated duplicate-key error on the request record's `_id` aborts the transaction and is resolved by a reread outside it, not counted as an attempt, giving the duplicate or 409. When the reread finds no record, the response is 503 with the "could not be confirmed" message and nothing is written; a resend with the same ID then applies the operation exactly once. A duplicate-key error on another collection keeps today's 400. |
| I13 | S0-5b-backend, `idempotency.test.js` | A stored request record's `_id` is exactly the request-ID string that was sent, of type string and never an ObjectId; the record is found by that string; and the collection still has only its `_id_` index. |
| X1 | S0-5b-backend and S0-5c, `idempotency.test.js` | S0-5b-backend: an inventory of the backend source shows that only the six routes in §12.8 create these records, and that each goes through the request-ID check. `POST /api/expenses/add` is registered, re-dispatches into itself and is never requested. S0-5c adds: each of the six refuses missing and malformed IDs. S0-8 updates the `/add` entry when it removes the route. |
| F1 | S0-5b-frontend, `offlineDatabaseMigration.test.mjs` | A version 1 database holding pending, blocked, rejected and synced sales, products, customers and sync metadata is opened by the version 2 code: every record is unchanged, the old indexes still work and the new store is empty. |
| F2 | S0-5b-frontend, `offlineDatabaseMigration.test.mjs` | The four version 1 declarations are exactly as in §12.11, version 2 adds only `requestIdentities`, and there is no upgrade function. |
| F3 | S0-5b-frontend, `requestIdentity.test.mjs` | The full lifecycle, including a simulated reload with a fresh connection: a `pending` attempt becomes `unconfirmed`, and Retry sends the same ID and body. |
| F4 | S0-5b-frontend, `requestIdentity.test.mjs` | No silent new ID: the same payload reuses its ID, a different payload is blocked while one is open, and a new ID is possible only after resolution. ID generation works without `crypto.randomUUID()`. |
| F5 | S0-5b-frontend, `requestIdentity.test.mjs` | Attempts are scoped by user. Logout and a user switch keep them, and other users never see or retry them. |
| F6 | S0-5b-frontend, `requestIdentity.test.mjs` | Each operation stores exactly its allow-list, and every field the page's normalizer produces is on it. Every send uses exactly the stored body. No token, password, header, name, email or server message is stored. |
| F7 | S0-5b-frontend, `offlineDatabaseMigration.test.mjs` | Request-identity operations never change `pendingSales`. |
| F8 | S0-5b-frontend, `requestIdentity.test.mjs` | Every status maps as in the lifecycle table, including a duplicate with `data: null` (confirmed, with no entity handed to the page), any 409 (refused) and an unlisted status (unconfirmed). An unconfirmed attempt offers Retry and no Dismiss, and Retry resends the same ID and stored body. A refused attempt offers Dismiss and no Retry: its ID is never sent again, and no helper function will resend it. Dismissing sends no request and changes nothing on the server. A refusal after an unconfirmed outcome shows the "may already be recorded" warning, still with Dismiss only. Both kinds stay listed until the user resolves them. |
| F9 | S0-5b-frontend, `requestIdentity.test.mjs` | A static scan: every frontend call to the six routes goes through the request-identity helper, and `CashbookPage.jsx` (unrouted) is the only recorded exception. Cashbook close sends `date` from `GET /api/cashbook/today`, never the device-clock fallback. |
| F10 | S0-5b-frontend, `requestIdentity.test.mjs` | Settings shows the label exported by `buildInfo.js`, and the label is not empty. |
| F11 | S0-5b-frontend, `requestIdentity.test.mjs` | No automatic resend. After a timeout, a network failure, a 503, going offline and back online, a reload or an app start, the helper sends nothing until the user presses Retry, and `attempts` rises by exactly one per user send. A source check of `services/api.js` confirms that its only automatic resends follow a 401 `TOKEN_EXPIRED` and resend the original request config unchanged, so the body and request ID are identical. |
| M1 | Manual, devices, step 3 | Observation only. On each production device, after the automatic reload, open the POS, confirm it loads, and check that the pending-sales count is the same as before the update. Don't complete a sale, change stock, create any production record or interfere with pending offline sales. |
| M2 | Manual, staging, step 5 | An old build against the S0-5c backend gets 400 on all six operations. |
| M3 | Manual, staging | Submit, cut the network, reload and retry: one business record and one audit entry result. |
| M4 | Manual, staging, before step 1 | A rehearsal of the manual procedure in §12.9, including its stop rules, followed by a successful request with an ID. |

**Existing suites:**

- Backend `npm test` passes at every commit. This includes the characterization tests as changed in §12.15, `tests/app.contract.test.js` unchanged (D18) and `utils/purchaseOrderValidation.test.js` unchanged.
- Frontend `node --test src/pages/*.test.mjs src/store/*.test.js` (the CI command) passes, including `responsiveAccessibility.test.mjs` and the three page-normalizer tests, unchanged.
- New frontend tests live in `src/pages`, so CI runs them. The modules they import must load under `node --test`: explicit file extensions and no Vite-only imports.

Before every commit: backend and frontend tests, the production build, the four dependency audits, `git diff --check` and a full diff review. Any failure blocks the commit until it is investigated.

### 12.15 Characterization test transitions and fixtures

**S0-5a:**

- **C13** (`cashbook.characterization.test.js`): the `CASHBOOK_CLOSING_SUBMIT` count goes from 0 to 1. It is stored by `log()`, and from S0-5b-backend inside the closing transaction.
- **C24** (`records.characterization.test.js`): the `SUPPLIER_PAYMENT` count goes from 0 to 1.
- **C14** (`access.characterization.test.js`):
  - the list of written actions missing from the schema becomes empty, and `allowed.length` goes from 22 to 39;
  - the unused list goes from `STOCK_ADJUST` alone to `STOCK_ADJUST` plus the five new actions;
  - the non-literal list is updated for the changed lines of `models/AuditLog.js` and `utils/auditLogger.js`, each entry explained;
  - the purchase-order check: `PURCHASE_ORDER_CREATE` is stored once (0 to 1), and no "Audit log error:" console message appears;
  - the comment naming the new actions lists all five (it names four today), and the title no longer says that 12 actions are dropped.

  The written-actions inventory (33 literals) and the label list don't change.

**S0-5b-backend:**

- **C14:** `EXCHANGE_RATE_UPDATE` joins the written-actions inventory (34) and leaves the unused list. The non-literal list is updated for every new or moved `action` occurrence in the changed routes and in `utils/idempotency.js` (for example a helper that forwards `action` as a variable), each entry explained.
- Every other characterization test passes unchanged: its requests carry no ID (accepted in tolerant mode), and its cash closings carry no date (D19).
- **`fixtures.js`:** `RequestRecord` joins `MODEL_NAMES` (its `init()` creates nothing); `startSuite()` creates `requestrecords` explicitly, with an option to skip that for I10's file; and a new `requestId()` helper returns a fresh valid ID. The helper only generates IDs and doesn't change tolerant mode (D13): until S0-5c, characterization requests send no ID and are accepted and logged as `REQUEST_ID_MISSING`, a malformed ID gets 400 (I5a), and S0-5c makes IDs mandatory, which is when the requests listed below start sending `requestId()` values.
- The new S0-5b tests send a valid ID on the six operations, except the tolerant-mode cases in I5a. S0-5c therefore changes only `idempotency.test.js` among them.

**S0-5b-frontend:** no backend test changes.

**S0-5c:** these successful requests gain a valid ID, and each cash close also sends the date from `GET /api/cashbook/today`. Their assertions don't change.

| File | Requests |
|---|---|
| `access.characterization.test.js` | The shared setup's expense and purchase order (used by C14, C15a, C15b, C16 and C18); C14's purchase order; C16's manager purchase order |
| `cashbook.characterization.test.js` | The `closeAndApproveToday` helper's close (used by C19 and C20); C13's expense, purchase order, supplier payment and close; C19's two expenses; C20's expense; C22's close |
| `records.characterization.test.js` | C23's three products; C24's purchase order and supplier payment |

Cashbook open and approve, purchase-order order and receive, and customer payments (S0-3) need no ID. The refusals of missing IDs, malformed IDs and missing dates are proved by I5b, so no coverage is removed, and no characterization assertion is weakened.

### 12.16 File lists

**Amendment commit:** `docs/architecture/ADR-0001-multi-business-architecture.md` only.

**S0-5a (backend only):**

- New: `backend/utils/auditActions.js`; `backend/utils/transactions.js`; `backend/utils/corsBlockedError.js` (the marked CORS error and its check, §12.7); `backend/tests/stage0/transactions.test.js` (T1–T9); `backend/tests/stage0/auditFoundation.test.js` (A1–A8).
- Changed:
  - `backend/models/AuditLog.js` (enum from the list);
  - `backend/utils/auditLogger.js` (`log()`, `recordAudit()`, the safe line);
  - `backend/utils/sendEmail.js` (D11 guard);
  - `backend/middleware/errorHandler.js` (D9 responses, D18 through the marker, D22 safe log line);
  - `backend/app.js` (the CORS check creates its error through `corsBlockedError.js`; nothing else in the file changes);
  - `backend/tests/stage0/access.characterization.test.js` (C14);
  - `backend/tests/stage0/cashbook.characterization.test.js` (C13);
  - `backend/tests/stage0/records.characterization.test.js` (C24).

**S0-5b-backend (backend only):**

- New: `backend/models/RequestRecord.js`; `backend/utils/idempotency.js`; `backend/tests/stage0/financialAudit.test.js` (R1–R5, G1); `backend/tests/stage0/idempotency.test.js` (I1–I9, I11–I13, X1); `backend/tests/stage0/requestRecordReadiness.test.js` (I10, in its own process because the readiness cache lasts for the process; `node --test`, the backend test command, runs each test file in a separate process).
- Changed:
  - `backend/routes/cashbook.js` (open, close, approve, rate);
  - `backend/routes/expenses.js` (create, delete; `/add` unchanged);
  - `backend/routes/purchaseOrders.js` (create, update, delete, order, receive, pay);
  - `backend/routes/products.js` (create and delete only);
  - `backend/utils/purchaseOrderValidation.js` (format and state checks separated);
  - `backend/tests/stage0/fixtures.js`;
  - `backend/tests/stage0/access.characterization.test.js` (C14).

**S0-5b-frontend (frontend only):**

- New: `frontend/src/offline/requestIdentities.js`; `frontend/src/pages/requestIdentityLifecycle.mjs`; `frontend/src/components/PendingRequestsNotice.jsx`; `frontend/src/buildInfo.js`; `frontend/src/pages/requestIdentity.test.mjs` (F3–F6, F8–F11); `frontend/src/pages/offlineDatabaseMigration.test.mjs` (F1, F2, F7).
- Changed:
  - `frontend/src/offline/db.js` (version 2 added; version 1 unchanged);
  - `frontend/src/pages/ExpensesPage.jsx`;
  - `frontend/src/pages/PurchaseOrdersPage.jsx` (create, pay);
  - `frontend/src/pages/ProductsPage.jsx` (create);
  - `frontend/src/pages/CashClosingPage.jsx` (close, rate);
  - `frontend/src/pages/SettingsPage.jsx` (exchange-rate update, build identifier).

**S0-5c (backend only):** changed `backend/utils/idempotency.js` (required mode); `backend/tests/stage0/idempotency.test.js` (I5a replaced by I5b; X1's enforcement part); `backend/tests/stage0/access.characterization.test.js`, `backend/tests/stage0/cashbook.characterization.test.js` and `backend/tests/stage0/records.characterization.test.js` (§12.15).

**Not changed by any S0-5 commit:**

- Backend: everything in `app.js` except the CORS check's error creation (S0-5a, §12.7); `routes/invoices.js`; `routes/customers.js`; `routes/suppliers.js`; product update in `routes/products.js` (S0-7); `routes/auth.js`, `routes/staff.js` and `routes/invitations.js`; the authentication middleware; `tests/app.contract.test.js`; `tests/helpers/harness.js`; `utils/purchaseOrderValidation.test.js`.
- Frontend: `POSPage.jsx`; `offline/syncManager.js` and the `pendingSales` logic; `services/api.js`; `App.jsx`; `src/store/`; `CashbookPage.jsx`; the page normalizers (`expenseManagement.mjs`, `purchaseOrderManagement.mjs`, `productManagement.mjs`) and their tests; `responsiveAccessibility.test.mjs`; `vite.config.js`.
- Everywhere: `shared/` and its money calculations; dependencies and lockfiles; CI; hosting configuration (`render.yaml`, `vercel.json`); environment variables.

**Overlap with the mobile UI branch** (uncommitted, based on `85f341d`):

- That branch changes `responsiveAccessibility.test.mjs`, `App.jsx`, `services/api.js` and `vite.config.js`, none of which S0-5 changes.
- Because that branch changes `services/api.js`, whose automatic resend F11 checks (§12.11), F11 must be re-verified when the branches are reconciled (O-4).
- `responsiveAccessibility.test.mjs` reads the source of `ExpensesPage.jsx`, `PurchaseOrdersPage.jsx`, `SettingsPage.jsx` and `ProductsPage.jsx`, which S0-5b-frontend changes. S0-5b-frontend must keep that test passing unchanged.
- The UI branch restyles shared components such as `Button`, `Sheet` and `Modal` without changing their props. `PendingRequestsNotice.jsx` relies only on their current props.
- Whichever branch is merged second re-runs every suite and must keep Dexie version 2 (§12.3). The merge order is open item O-4.

### 12.17 Risks

| Risk | Protection |
|---|---|
| In tolerant mode, old builds send no ID, so they keep today's duplicate risk after a timeout or an unknown commit until S0-5c. Accepted, temporary. | `REQUEST_ID_MISSING` monitoring; rollout steps 3–5 |
| A frontend build that declares only Dexie version 1 can't open an upgraded database, including pending sales. This covers any build before S0-5b-frontend, an instant rollback, and the UI branch released without the version 2 declaration. | The rules in §12.3 and §12.13 |
| The automatic PWA update reloads open tabs, possibly mid-checkout. An unsaved cart may be lost; pending sales are safe. | Release outside trading hours; M1 |
| An already-open tab running the old build can't use the offline database after another tab upgrades it, until it reloads. | The automatic reload; the device check in step 3 |
| Request IDs live only on the device that made the attempt. Re-entering the change on another device can create a duplicate. | Resolve attempts on the same device |
| An attempt that stays unconfirmed blocks a different submission of the same operation and scope, by that user on that device, until a retry resolves it. | Retrying is always safe; the 7-day warning |
| After a role change, a resend can get 403 even though the original succeeded. | The "may already be recorded" warning |
| Stored request bodies hold business data on the device, as pending sales do. | Allow-lists only |
| Request records accumulate, and none are deleted automatically. | A retention policy needs separate approval |
| The build label is maintained by hand. | Every release must change it (§12.11) |
| The inside-a-transaction guard can miss code that loses its async context. | G1 and code review |
| Three attempts replace the driver's retries of up to 120 seconds on purchase-order receive and pay, so 503 is possible under contention. | Accepted under D1; the client keeps the ID |
| Snapshot reads and majority writes add latency. | The load-test targets (AD-19) |
| Other server log lines can contain personal data (existing): the request log with IP addresses, whole error objects in `config/db.js` and `middleware/auth.js`, and email error messages. The error-handler line is fixed by D22. | The Stage 1 security review |
| A later release that tightens a format rule for one of the six operations can make the resend of an earlier, already-applied attempt get 400. | The "may already be recorded" warning (§12.11); review every such change |
| With no stack traces in logs or generic responses, unexpected errors are harder to diagnose. | Each log line keeps the route pattern, error name and code; reproduce the error on staging (D24) |
| The existing API client can replay a request twice if it waited for another request's token refresh and its first replay also gets `TOKEN_EXPIRED` (§12.11). | Safe: the same body and ID, and nothing is written before the authentication check. Tightening it belongs to the authentication workstream (Stage 1) |
| Count-based purchase-order numbers can still collide until S0-6. A collision returns 400, and the attempt is refused (existing, §1). | S0-6 |
| The authentication workstream changes logout and sessions. | It must keep `requestIdentities` through logout, account changes and session migration, as it must keep `pendingSales` (§8). |
| The planned authentication work, or any later change, may rewrite the CORS check in `app.js` and create its error without the marker. The blocked-CORS response would then become the generic 500, breaking D18. | A6 and A8 fail; that work must keep the marker (§12.7) |
| Completing S0-5 doesn't prove that offline POS, stock and synchronization are production-ready. | Later stages and staging tests |
| Results from the local harness (in-memory MongoDB 8.0.38) can differ from production. | Never treated as production verification (§10) |

### 12.18 Open items

| ID | Item | Decide before |
|---|---|---|
| O-1 | Resolved by D22: S0-5a makes the error-handler log safe (§12.5) | — |
| O-2 | Settled: the release label maintained by hand in `frontend/src/buildInfo.js` (D17, §12.11) | — |
| O-3 | Where S0-5c's commit sits relative to the later Stage 0 commits (S0-6 onward). Its release already follows rollout steps 1–3 (D13) | Committing S0-5c |
| O-4 | The merge order of the mobile UI branch and S0-5b-frontend. Both branches are based on `85f341d`, so whichever is merged first also brings `acde95b`, `1a6dd47` and `85f341d`. Whichever goes second must keep Dexie version 2 (§12.3, §12.13) | Merging either |
| O-5 | How each release is triggered on Render and Vercel (the live settings have not been checked) | Rollout step 1 |
| O-6 | Partly resolved by D24: the separate staging service and database are approved; provisioning them and their costs still need approval | Rollout step 1 |
| O-7 | Resolved by D23 (§12.10) | — |
| O-8 | Resolved on 24 November 2026: the 3 commit attempts apply to each transaction attempt, so at most 9 helper commit calls per operation (D1, §12.4) | — |
| O-9 | The exact database that rollout step 0 targets, and how that reconciles with AD-18 (`abdulmula_erp` stays untouched until its status and data are verified). No database is assumed: not `abdulmula_erp`, `abdulmula_erp_live`, a staging database or any other. Step 0 stays blocked until the owner explicitly approves the target database and its status and data have been verified | Rollout step 0 |

### 12.19 Requirements for later plans

These are requirements on later work, recorded so they aren't lost. None of them is part of S0-5, and this section doesn't design any of them.

- **A durable release-plan record.** The owner's release-plan decisions exist so far only in planning messages of 24 November 2026, not in the repository. They cover P1–P7, the Abdulmula Heritage visual reference and its colours, the product and staff photo requirements, SEC-1, the staging HTTP end-to-end suite, the release gates and the R1–R5 release-checklist sections. They must be recorded in a durable repository document, approved by the owner, before release planning depends on them. Where that document lives is the owner's decision.
- **S0-6: the Juba-year boundary.** S0-6 numbers invoices and purchase orders by `Africa/Juba` year (§6.3, §6.5), while S0-5 keeps cashbook days in UTC (§12.10). A new number year therefore starts two hours before the UTC cashbook day changes. S0-6's plan must state how that boundary is handled and tested.
- **S0-3 and S0-7: request IDs.** Customer payments (S0-3) and stock adjustments (S0-7) need request IDs (§6.5). Each plan must specify its request-ID handling, including whether it reuses `RequestRecord`, its stored-body allow-list and fingerprint, and its tests.
- **Stage 2: tenant-scoped idempotency.** `RequestRecord` has no business or shop scope. Stage 2's architecture must decide how request identities are scoped per business and shop. Any additional `RequestRecord` index must follow D12: staging verification, a production preflight and separate deployment approval. S0-5 adds no index.

### 12.20 Approval record

- D1–D12 and corrections A–D: approved on 23 November 2026.
- D13: approved on 24 November 2026.
- D14: approved with correction on 24 November 2026. The client treats any 409 as refused; the ID is retired and the attempt stays visible until dismissed. Unconfirmed outcomes keep their ID.
- D15: approved in principle on 24 November 2026. Only MongoDB's default unique `_id` index is permitted, and the collection is created only through the separately approved manual procedure.
- D16: approved on 24 November 2026, keeping the server's current UTC date during Stage 0.
- D17: approved on 24 November 2026.
- All 39 audit actions: approved on 24 November 2026.
- D18–D21: approved on 24 November 2026.
- D22 (resolves O-1): directed by the owner on 24 November 2026. The log line's fields in §12.5 were approved on 24 November 2026 (choice 9 below); the exact event constant is reviewed in the S0-5a diff.
- D23 (resolves O-7) and D24 (staging architecture only): approved on 24 November 2026.
- O-2: settled as the release label maintained by hand (D17).
- O-8: approved on 24 November 2026. D1's 3 commit attempts apply to each transaction attempt, so at most 9 helper commit calls per operation.
- The nine implementation choices, decided by the owner on 24 November 2026:
  1. RequestRecord readiness (§12.9): approved. An ordinary collection, not a view, time-series or capped collection, with no collation and exactly the default unique `_id_` index; checked outside any transaction; a successful result cached for the life of the server process, a failed one never cached. D12 and D15 are unchanged.
  2. Duplicates of deleted entities (§12.8): approved. 200 with `duplicate: true` and `data: null`, including a product marked `isDeleted: true`. A duplicate never recreates or restores a deleted entity.
  3. A duplicate-key reread that finds no request record (§12.8): approved. 503; the request identity is kept, and the response doesn't guess whether the original operation succeeded.
  4. RequestRecord not ready (§12.7, §12.9): approved. 503 with the generic busy message, exposing no internal database information.
  5. Recognizing the CORS rejection (§12.7): message-prefix matching not approved. A dedicated internal marker is used instead, so no unrelated error can get the D18 response, and D18's public response stays exactly as it is. `app.js` and the new `utils/corsBlockedError.js` join S0-5a, and A8 proves that an unrelated error with the same message prefix gets the generic 500 (§12.14, §12.16).
  6. Test-file placements (§12.14, §12.16): approved. I10 in its own file and process; A7 in `auditFoundation.test.js`; I13 and X1 in `idempotency.test.js`; F9–F11 in `requestIdentity.test.mjs`.
  7. `requestId()` (§12.15): approved for S0-5b-backend, with tolerant mode unchanged (D13): missing IDs are accepted and logged until S0-5c, a malformed ID gets 400, and S0-5c makes IDs mandatory.
  8. D18–D24: approved as the stable decision numbers.
  9. D22 log fields (§12.5): approved. A fixed internal event, the status, the method, the matched route pattern, and the error's name, code, codeName and error labels, restricted to the allow-list of known protocol labels. No sensitive value or raw error appears. The exact event constant is reviewed separately in the S0-5a diff.
- The eight details filled in for those choices: confirmed by the owner on 24 November 2026.
  1. A duplicate-key reread that finds no request record gets 503 with "This change could not be confirmed. Check before trying again."; a RequestRecord readiness failure keeps the generic busy message. These are distinct conditions (§12.7, §12.8, §12.9).
  2. The CORS marker is a symbol private to `backend/utils/corsBlockedError.js`, and only the marked CORS rejection gets D18's exact response. A8, in `auditFoundation.test.js` with its source check, and the related risk in §12.17 are kept (§12.7, §12.14).
  3. The label allow-list is exactly the nine labels of MongoDB driver 6.20.0, including the upstream spelling `PoolRequstedRetry`, and applies to every safe structured log line (§12.5).
  4. Readiness requires exactly the default `_id_` index and no clustered collection; the check doesn't require a `unique` flag. D12 and D15 are unchanged (§12.9).
  5. A duplicate with `data: null` gives the page no entity to receive or restore, and the page refreshes from the server (§12.11, F8).
  6. `requestId()` is a test-only helper in `backend/tests/stage0/fixtures.js`. D13's tolerant mode is unchanged (§12.15).
  7. The D22 status sentence in §12.2 is approved. The exact event constant still needs review in the S0-5a implementation diff (§12.5).
  8. I10's stricter scenarios and exact busy response body are approved, with I10 in its own test process (§12.14, §12.16).
- Still open, each until the point in the "Decide before" column of §12.18: O-3, O-4, O-5, the provisioning and costs under O-6, and O-9.

This amendment records decisions and test requirements. It doesn't replace the approval of each implementation diff.
