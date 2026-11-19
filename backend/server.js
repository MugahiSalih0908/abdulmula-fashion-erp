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
const { isAllowedConfiguredOrigin, mustRejectInsecureRequest } = require('./middleware/transportSecurity');

const app  = express();
const PORT = process.env.PORT || 5000;

connectDB();

const isProduction = process.env.NODE_ENV === 'production';
app.set('trust proxy', 1);

// Render terminates public TLS before forwarding requests to this service.
// Require the trusted proxy to report HTTPS in production; never redirect a
// state-changing API request over plaintext transport.
app.use((req, res, next) => {
  if (mustRejectInsecureRequest(req, isProduction)) {
    return res.status(426).json({
      success: false,
      message: 'HTTPS is required for all production API requests.'
    });
  }
  next();
});

// ── Security headers ──────────────────────────────────────────
app.use(helmet({
  hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: false } : false
}));
app.use(mongoSanitize());

// ── CORS ──────────────────────────────────────────────────────
const configuredOrigins = [
  process.env.CLIENT_URL,
  process.env.CLIENT_PREVIEW_URL,
  ...(isProduction ? [
    'https://abdulmulafashion.com',
    'https://www.abdulmulafashion.com',
    'https://abdulmula-fashion-erp.vercel.app'
  ] : [])
]
  .filter(Boolean)
  .flatMap(origins => origins.split(','))
  .map(origin => origin.trim())
  .filter(Boolean);

const allowed = configuredOrigins.map(origin => {
  if (!isAllowedConfiguredOrigin(origin, { production: isProduction })) {
    throw new Error('CORS origins must be exact HTTPS origins in production; HTTP is allowed only for local development.');
  }
  return new URL(origin).origin;
});

const vercelPreviewHost =
  /^abdulmula-fashion-[a-z0-9]+(?:-[a-z0-9]+)*-mugahid-s-projects\.vercel\.app$/i;

const isApprovedVercelPreview = (origin) => {
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  return (
    url.protocol === 'https:' &&
    url.origin === origin &&
    vercelPreviewHost.test(url.hostname)
  );
};

app.use(cors({
  origin: (origin, cb) => {
    if (
      !origin ||
      allowed.includes(origin) ||
      (!isProduction && ['http://localhost:5173', 'http://127.0.0.1:5173'].includes(origin)) ||
      isApprovedVercelPreview(origin)
    ) return cb(null, true);
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

app.use(express.json({ limit:'1mb' }));
app.use(express.urlencoded({ extended:true, limit:'16kb', parameterLimit:50 }));

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
