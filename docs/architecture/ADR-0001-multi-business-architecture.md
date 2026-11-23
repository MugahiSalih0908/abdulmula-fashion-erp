# ADR-0001: Multi-business, multi-shop architecture and operational integrity

| | |
|---|---|
| Status | Accepted for planning. Implementation is approved change by change: every Stage 0 commit needs the owner's approval of its exact diff. |
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
- **Commit order:** this ADR first; then the characterization tests (with the shared calculation tests added to the backend run); then S0-5, S0-6, S0-1, S0-8, S0-2, S0-3, S0-7 and S0-4. Before each commit the diff, tests, build and audit results are reviewed. Nothing is pushed, merged or deployed without approval.

### 6.4 Not changed in Stage 0

- `shared/invoiceCalculations.mjs` and the money calculations it provides.
- The POS checkout and the offline sales queue.
- Authentication and sessions (a separate branch).
- Dependencies, deployment, infrastructure and environment variables.

### 6.5 Required regression tests for later Stage 0 commits

Each later commit adds these tests in the same commit, and updates the characterization assertions marked for it in `backend/tests/stage0/`. Concurrency tests check the final state (unique numbers, exact balances, consistent stock), never timing.

- **S0-3, customer payments and cash closing:**
  - A repeated request ID records one payment, and the same ID with different details is refused.
  - An overpayment is refused and changes nothing.
  - An admin can reverse a payment once, with a mandatory reason; a second reversal is refused.
  - Cash repayments change expected cash; mobile and bank repayments are reported separately.
  - Concurrent payments on one customer leave the exact balance.
- **S0-5, audit:** when a critical audit write fails, the financial transaction it belongs to rolls back.
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

## 11. References

- `docs/PROJECT_HANDOFF_2026-11-21.md`: handoff snapshot.
- `docs/product-cost-snapshots.md`: cost snapshots on invoice lines.
- `backend/tests/stage0/`: the characterization tests (C1–C24) that record behaviour before Stage 0.
