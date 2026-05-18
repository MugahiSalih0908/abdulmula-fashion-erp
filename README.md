# 🛍️ Abdulmula Fashion ERP v6
**Enterprise-grade PWA POS & ERP — Konyo-Konyo Market, Juba, South Sudan**

---

## Authentication System

v6 introduces a full enterprise onboarding and security workflow:

| Feature                   | Implementation                             |
|---|---|
| No public registration    | `POST /api/auth/register` removed entirely |
| Admin-created accounts    | Admin creates via Staff Management page    |
| Email invitation          | Nodemailer + Gmail SMTP → branded HTML     |
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
- Nodemailer + Gmail SMTP for emails
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

---

## Setup

### Step 1 — Install

```bash
cd backend  && npm install
cd frontend && npm install
```

### Step 2 — Gmail App Password

1. Go to **myaccount.google.com → Security → 2-Step Verification → App Passwords**
2. Create an app password for "Mail"
3. Copy the 16-character password
4. Put it in `backend/.env` as `EMAIL_PASS`

**Important:** Use the App Password, NOT your normal Gmail password.

### Step 3 — Configure `backend/.env`

```env
MONGO_URI=mongodb://localhost:27017/abdulmula_erp
JWT_SECRET=<run: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
JWT_REFRESH_SECRET=<another 64-char hex>
JWT_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
FRONTEND_URL=http://localhost:5173
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_16_char_app_password
EMAIL_FROM=Abdulmula Fashion ERP <your_gmail@gmail.com>
ADMIN_EMAIL=admin@abdulmula.com
ADMIN_PASSWORD=Admin@12345
```

### Step 4 — Create first admin

```bash
cd backend
npm run create-admin
```

This creates `admin@abdulmula.com` / `Admin@12345` with `isVerified: true`.
**Change the password immediately after first login.**

### Step 5 — Start

```bash
# Terminal 1
cd backend  && npm run dev   # → http://localhost:5000

# Terminal 2
cd frontend && npm run dev   # → http://localhost:5173
```

### Step 6 — Add staff (admin workflow)

1. Log in as admin
2. Go to **More → Staff**
3. Tap **Add Staff**
4. Enter name, real email, role
5. Tap **Create & Send Invitation**
6. System auto-sends branded welcome email with:
   - Temporary password
   - Activation link (24-hour expiry)
7. Staff clicks link → sets own password → can log in

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

