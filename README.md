# 🛍️ Abdulmula Fashion ERP v6
**Enterprise-grade PWA POS & ERP — Konyo-Konyo Market, Juba, South Sudan**

---

## Authentication System

v6 introduces a full enterprise onboarding and security workflow:

| Feature                   | Implementation                             |
|---|---|
| No public registration    | `POST /api/auth/register` removed entirely |
| Admin-created accounts    | Admin creates via Staff Management page    |
| Transactional email       | Resend API with delivery tracking          |
| Account activation        | Token link → `/activate/:token`            |
| Verification required     | Login blocked until `isVerified = true`    |
| Forgot password           | 15-min token → `/reset-password/:token`    |
| Account lockout           | 5 failed attempts → 30-min lock            |
| Multi-device tokens       | Up to 5 refresh tokens, rotation on use    |
| Logout all devices        | `POST /api/auth/logout-all` clears all     |
| Last login tracking       | IP + timestamp stored                      |

---

## Role Permissions

| Feature                      | Admin | Manager | Staff |
|---|---|---|---|
| POS & Sales                  | ✅    | ✅      | ✅    |
| Products (view)              | ✅    | ✅      | ✅    |
| Products (create/edit/delete)| ✅    | ✅      | ❌    |
| Customers                    | ✅    | ✅      | ✅    |
| Expenses                     | ✅    | ✅      | ❌    |
| Suppliers                    | ✅    | ✅      | ❌    |
| Purchase Orders (view/create)| ✅    | ✅      | ❌    |
| Purchase Orders (edit/delete)| ✅    | ❌      | ❌    |
| Cashbook                     | ✅    | ✅      | ❌    |
| Reports                      | ✅    | ✅      | ❌    |
| Staff Management             | ✅    | ❌      | ❌    |
| Audit Logs                   | ✅    | ❌      | ❌    |
| Settings (own profile)       | ✅    | ✅      | ✅    |

---

## Tech Stack

### Backend
- Node.js + Express.js
- MongoDB Atlas + Mongoose (transactions)
- JWT access (15m) + refresh (7d) with rotation
- Resend transactional email API with signed delivery webhooks
- bcryptjs (12 rounds), validator.js, crypto
- Helmet, CORS, rate limiting, mongo-sanitize

### Frontend
- React 18 + Vite
- Tailwind CSS (black/gold theme)
- Zustand (auth, cart, settings)
- TanStack React Query
- Framer Motion
- Dexie (IndexedDB offline)
- vite-plugin-pwa + Workbox

## Offline invoice ID index preflight

`Invoice.offlineId` is protected by a unique partial index that applies only to
non-empty string IDs. Before deploying this model change to an existing
database, an operator must perform a **read-only** duplicate preflight and
resolve any collisions through the approved data-retention process before
changing indexes. For example, inspect duplicates with:

```javascript
db.invoices.aggregate([
  { $match: { offlineId: { $type: 'string', $gt: '' } } },
  { $group: { _id: '$offlineId', count: { $sum: 1 }, invoiceIds: { $push: '$_id' } } },
  { $match: { count: { $gt: 1 } } }
])
```

Also inspect the existing index definitions before planning the deployment.
After duplicates are resolved and a backup/change plan is approved, the
database operator must drop/replace any old `offlineId` index with a **unique
partial index** restricted to non-empty strings, matching the definition in
`backend/models/Invoice.js`. Verify afterward that the resulting index reports
`unique: true` and a partial filter of `offlineId` string values greater than
the empty string, and confirm the duplicate preflight returns no rows.

These are deployment instructions only: do not run a write query as part of
application startup or this preflight. This repository change does not execute
an index migration or access a database.

Offline conflict decisions use the `offlineconflictdecisions` collection. The
required index is named `offlineId_unique_nonempty`, is unique on
`{ offlineId: 1 }`, and uses this exact partial filter:

```javascript
{ offlineId: { $type: 'string', $gt: '' } }
```

Before deploying, run these **read-only preflight** checks against the target
database. Inspect records with missing, null, empty, and whitespace-only IDs:

```javascript
db.offlineconflictdecisions.aggregate([
  {
    $match: {
      $or: [
        { offlineId: { $exists: false } },
        { offlineId: null },
        { offlineId: '' },
        { offlineId: { $type: 'string', $regex: /^\s+$/ } }
      ]
    }
  },
  { $project: { _id: 1, offlineId: 1, state: 1 } }
])
```

The partial filter `{ offlineId: { $type: 'string', $gt: '' } }` includes
whitespace-only strings because they are non-empty strings. Such historical
values therefore participate in the unique index even though the application
rejects whitespace-only IDs for new requests. Also inspect padded non-empty
IDs, which are distinct index keys today but normalize to the same application
ID:

```javascript
db.offlineconflictdecisions.aggregate([
  { $match: { offlineId: { $type: 'string', $gt: '' } } },
  {
    $match: {
      $expr: {
        $ne: ['$offlineId', { $trim: { input: '$offlineId' } }]
      }
    }
  },
  { $project: { _id: 1, offlineId: 1, state: 1 } }
])
```

Then detect duplicate valid non-empty IDs (including the record IDs for
investigation):

```javascript
db.offlineconflictdecisions.aggregate([
  { $match: { offlineId: { $type: 'string', $gt: '' } } },
  {
    $group: {
      _id: '$offlineId',
      count: { $sum: 1 },
      decisionIds: { $push: '$_id' }
    }
  },
  { $match: { count: { $gt: 1 } } }
])
```

Also identify IDs that are distinct in storage but collide after trimming:

```javascript
db.offlineconflictdecisions.aggregate([
  { $match: { offlineId: { $type: 'string', $gt: '' } } },
  {
    $group: {
      _id: { $trim: { input: '$offlineId' } },
      count: { $sum: 1 },
      originalIds: { $push: { _id: '$_id', offlineId: '$offlineId' } }
    }
  },
  { $match: { count: { $gt: 1 } } }
])
```

Review all four query results before enabling the normalized-ID workflow.
Do not silently rewrite historical identifiers. Any whitespace-only or
padded IDs, and any collisions after trimming, require an explicitly approved
retention/reconciliation plan; leave existing records unchanged until that
plan is carried out separately. Inspect
`db.offlineconflictdecisions.getIndexes()` and identify the exact obsolete
index name and definition. After a backup and an approved staging-first
change plan, replace **only that verified obsolete index**—never use
`dropIndexes()` or `dropIndex()` against an unverified name:

```javascript
db.offlineconflictdecisions.dropIndex('<verified-obsolete-index-name>')
db.offlineconflictdecisions.createIndex(
  { offlineId: 1 },
  {
    name: 'offlineId_unique_nonempty',
    unique: true,
    partialFilterExpression: { offlineId: { $type: 'string', $gt: '' } }
  }
)
```

Do not drop an index already named `offlineId_unique_nonempty` with the exact
definition above. Verify with `getIndexes()` that the named index is unique,
has the exact key and partial filter, then rerun all applicable read-only
preflight checks and confirm no duplicate normalized IDs remain. Perform and
verify this in staging first; production migration requires separate approval. Invoice,
decision, stock, customer, and audit writes must remain in the same MongoDB
transaction. This repository change does not execute a migration or access a
database.

---

## Setup

### Vercel and Render deployment origins

Set `VITE_API_URL` to `https://abdulmula-fashion-erp.onrender.com/api` in
Vercel's Production and Preview environments. Keep those environment scopes
separate so either deployment can be changed independently; the frontend
normalizes the value to one `/api` path.

On Render, keep `CLIENT_URL` set to the exact production Vercel origin and set
`CLIENT_PREVIEW_URL` only when additional exact frontend origins are needed
(comma-separated). The backend also allows HTTPS preview deployments matching
the `abdulmula-fashion-<deployment-id>-mugahid-s-projects.vercel.app` project
and team hostname, plus `http://localhost:5173`. It does not allow arbitrary
`vercel.app` sites. Do not use `*`; set no URL paths or trailing slashes.
The backend must be redeployed after changing its environment variables.

### Step 1 — Install

```bash
cd backend  && npm install
cd frontend && npm install
```

### Step 2 — Configure local environment

Copy `backend/.env.example` to `backend/.env` and configure:

- `MONGO_URI`: your development MongoDB database (use a separate database from production).
- `JWT_SECRET` and `JWT_REFRESH_SECRET`: generate two independent, random secrets.
- `CLIENT_URL` and `FRONTEND_URL`: use `http://localhost:5173` for local development.
- Resend settings: leave `EMAIL_DELIVERY_MODE=disabled` until you deliberately configure a restricted test inbox.

Never reuse production JWT secrets or the production MongoDB URI in a local development environment.

### Step 3 — Create the first admin (one time only)

Set `ADMIN_NAME`, `ADMIN_EMAIL`, and a strong `ADMIN_PASSWORD` of at least 12 characters in the untracked `backend/.env` file. Then run:

```bash
cd backend
npm run create-admin
```

The seed script refuses to create an account without an explicit password. It does not print the password to logs. Remove the bootstrap-only `ADMIN_PASSWORD` value from the environment after the first admin is created.

### Step 4 — Configure transactional email

Follow [docs/email-delivery-setup.md](docs/email-delivery-setup.md). The application uses Resend; it does not use Gmail SMTP or email temporary passwords.

### Step 5 — Start

```bash
# Terminal 1
cd backend  && npm run dev   #https://abdulmula-fashion-erp.onrender.com/api

# Terminal 2
cd frontend && npm run dev   # → http://localhost:5173
```

### Step 6 — Add staff (admin workflow)

1. Log in as admin
2. Go to **More → Staff**
3. Tap **Add Staff**
4. Enter name, real email, role
5. Tap **Create & Send Invitation**
6. System sends a branded, one-time activation link (24-hour expiry) through Resend.
7. Staff opens the link, chooses their own password, and activates the account. No temporary password is emailed.

---

## Authentication API

```
POST /api/auth/login                  No auth required
POST /api/auth/activate/:token        No auth required
POST /api/auth/forgot-password        No auth required
POST /api/auth/reset-password/:token  No auth required
POST /api/auth/refresh                No auth required
POST /api/auth/logout                 Requires auth
POST /api/auth/logout-all             Requires auth
GET  /api/auth/me                     Requires auth
```

### Staff management

```
GET    /api/staff                          Admin + Manager
GET    /api/staff/:id                      Admin + Manager
POST   /api/staff                          Admin only — creates + sends email
POST   /api/staff/:id/resend-activation    Admin only
PUT    /api/staff/:id                      Admin only
PATCH  /api/staff/:id/toggle               Admin only
PATCH  /api/staff/:id/reset-password       Admin only
GET    /api/staff/:id/sales                Admin + Manager
GET    /api/staff/system/audit-logs        Admin only
```

---

## Email Templates

All emails are branded HTML with:
- Black/gold Abdulmula Fashion header
- AF logo block
- Responsive layout
- Footer with © notice

| Template | Trigger | Expiry |
|---|---|---|
| Welcome + Activation | Admin creates staff | 24 hours |
| Password Reset | User requests via /forgot-password | 15 minutes |
| Password Changed | After successful reset | — |

---

## Frontend Routes

| Route | Access | Page |
|---|---|---|
| `/login` | Public (guest only) | LoginPage |
| `/activate/:token` | Public | ActivateAccountPage |
| `/forgot-password` | Public (guest only) | ForgotPasswordPage |
| `/reset-password/:token` | Public | ResetPasswordPage |
| `/dashboard` | All authenticated | DashboardPage |
| `/pos` | All authenticated | POSPage |
| `/products` | All authenticated | ProductsPage |
| `/customers` | All authenticated | CustomersPage |
| `/settings` | All authenticated | SettingsPage |
| `/expenses` | Admin + Manager | ExpensesPage |
| `/suppliers` | Admin + Manager | SuppliersPage |
| `/purchase-orders` | Admin + Manager | PurchaseOrdersPage |
| `/cashbook` | Admin + Manager | CashClosingPage |
| `/reports` | Admin + Manager | ReportsPage |
| `/staff` | Admin only | StaffPage |
| `/audit-logs` | Admin only | AuditLogsPage |

---

## Security Notes

- Passwords hashed with bcryptjs rounds=12
- Tokens hashed with SHA-256 before storing in DB
- Raw tokens only ever in email links / API responses
- Account lock resets automatically after 30 minutes or admin password reset
- Refresh token rotation: old token revoked on every use
- `isVerified: false` accounts cannot log in
- Disabled accounts (`isActive: false`) cannot log in and have all refresh tokens cleared
- Rate limiting: 500 req/15min global, 20/15min on login route
- Email enumeration prevented on forgot-password (always returns success)

## Transactional email configuration

Configure these values in the backend deployment environment (for example, Render)
and in a local, untracked backend `.env` file:

- `RESEND_API_KEY`: Resend sending API key.
- `EMAIL_FROM`: sender identity on a domain verified in Resend.
- `RESEND_WEBHOOK_SECRET`: signing secret from the Resend webhook endpoint.
- `FRONTEND_URL`: public frontend origin used to construct activation and reset links.

Never commit live credentials, raw activation URLs, reset tokens, email HTML, or
temporary passwords. Staff activation emails use a one-time setup link; the
system does not email a temporary password.

Resend domain verification is only one prerequisite for production delivery.
The Render backend must also have the live delivery mode, a restricted sending
API key, a sender address on the verified domain, the sending-domain value,
and the explicit domain-verification flag configured. Confirm a successful
Email Center test before relying on real staff invitations.

Provider acceptance (`sent`) is not the same as recipient delivery
(`delivered`). Signed Resend webhook events update the application delivery
state. The same stable idempotency key is reused for retries of the same logical
email to reduce duplicate sends.

### Email delivery safety modes

- `EMAIL_DELIVERY_MODE=disabled` is the default. No outbound email is sent.
- `EMAIL_DELIVERY_MODE=test` requires `EMAIL_TEST_RECIPIENTS` and restricts all sending to those exact addresses.
- `EMAIL_DELIVERY_MODE=live` requires `EMAIL_DOMAIN_VERIFIED=true`, a configured Resend key, and an `EMAIL_FROM` address on `EMAIL_SENDING_DOMAIN`.

Do not enable live mode until Resend verifies the domain and the SPF/DKIM records
are passing. The application does not infer domain verification from a DNS
setting; the operator must confirm it in Resend before changing this flag.
