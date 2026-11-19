// server.js – Abdulmula Fashion ERP v6 — Production Backend
// NO public register endpoint

require('dotenv').config();


const express       = require('express');
const helmet        = require('helmet');
const cors          = require('cors');
const rateLimit     = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const morgan        = require('morgan');
const connectDB     = require('./config/db');
const errorHandler  = require('./middleware/errorHandler');
const { isAllowedBrowserOrigin } = require('./config/corsOrigins');

const app  = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';
const { validateProductionSecurity } = require('./config/securityConfig');
validateProductionSecurity(process.env);
connectDB();

// ── Security headers ──────────────────────────────────────────
app.use(helmet());
app.use(mongoSanitize());
app.set('trust proxy', 1);

// Enforce HTTPS at the application edge as a second layer behind Render TLS.
// The platform health probe is exempt so deployment health checks remain available.
app.use((req, res, next) => {
  if (isProduction && req.path !== '/api/health' && !req.secure) {
    return res.status(426).json({
      success: false,
      message: 'HTTPS is required for all production API requests.'
    });
  }
  next();
});

// ── CORS ──────────────────────────────────────────────────────
const allowed = [
  process.env.CLIENT_URL,
  process.env.CLIENT_PREVIEW_URL,
]
  .filter(Boolean)
  .flatMap((origins) => origins.split(','))
  .map((origin) => origin.trim())
  .filter(Boolean)
  .map((origin) => {
    let url;
    try {
      url = new URL(origin);
    } catch {
      throw new Error('CORS configuration must contain exact HTTP(S) origins.');
    }

    if (
      !['http:', 'https:'].includes(url.protocol) ||
      (isProduction && url.protocol !== 'https:') ||
      url.origin !== origin.replace(/\/+$/, '')
    ) {
      throw new Error('CORS configuration must contain exact HTTP(S) origins.');
    }
    return url.origin;
  });


app.use(cors({
  origin: (origin, cb) => {
    if (isAllowedBrowserOrigin({ origin, allowedOrigins: allowed, isProduction })) {
      return cb(null, true);
    }
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials:    true,
  methods:        ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

// ── Rate limiting ──────────────────────────────────────────────
app.use('/api/', rateLimit({ windowMs:15*60*1000, max:500, standardHeaders:true, legacyHeaders:false }));
app.use('/api/auth/login', rateLimit({ windowMs:15*60*1000, max:20, message:{ success:false, message:'Too many login attempts. Wait 15 minutes.' } }));

// ── Body parsing ──────────────────────────────────────────────
app.use('/api/webhooks', require('./routes/webhooks'));

app.use(express.json({ limit:'10mb' }));
app.use(express.urlencoded({ extended:true }));

// ERP API responses contain employee, customer and financial data.
// Explicitly prevent browsers, service workers and intermediaries from caching them.
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Pragma', 'no-cache');
  next();
});

// ── Logging ───────────────────────────────────────────────────
const { redactRequestPath } = require('./utils/safeRequestPath');
morgan.token('safe-url', req => redactRequestPath(req));
app.use(morgan(':remote-addr - [:date[clf]] ":method :safe-url HTTP/:http-version" :status :res[content-length]'));

// ── Health check ──────────────────────────────────────────────
// ── Root route ───────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Abdulmula Fashion ERP API running'
  });
});

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({
  success: true,
  version: '5.0',
  env: process.env.NODE_ENV,
  time: new Date().toISOString(),
  service: 'Abdulmula Fashion ERP'
}));

// ── Invitation rate limiters ──────────────────────────────────────
const { createInvitationLimiter, validateTokenLimiter, acceptInvitationLimiter } = require('./middleware/invitationLimiter');

// ── API Routes ────────────────────────────────────────────────
// NOTE: NO public /api/auth/register — accounts created by admin via /api/staff or invitations
app.use('/api/auth',            require('./routes/auth'));
app.use('/api/dashboard',       require('./routes/dashboard'));
app.use('/api/invitations',     createInvitationLimiter, validateTokenLimiter, acceptInvitationLimiter, require('./routes/invitations'));
app.use('/api/products',        require('./routes/products'));
app.use('/api/invoices',        require('./routes/invoices'));
app.use('/api/customers',       require('./routes/customers'));
app.use('/api/suppliers',       require('./routes/suppliers'));
app.use('/api/expenses',        require('./routes/expenses'));
app.use('/api/staff',           require('./routes/staff'));
app.use('/api/email-logs',       require('./routes/emailLogs'));
app.use('/api/purchase-orders', require('./routes/purchaseOrders'));
app.use('/api/cashbook',        require('./routes/cashbook'));
app.use('/api/reports',         require('./routes/reports'));

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({
  success:false, message:`${req.method} ${req.originalUrl} not found.`
}));

// ── Error handler ──────────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 Abdulmula Fashion ERP API');
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`📡 Port: ${PORT}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});
module.exports = app;
