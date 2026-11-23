// app.js – Abdulmula Fashion ERP v6 — Express application factory
// NO public register endpoint
//
// createApp() builds the Express application: security headers, CORS, rate
// limiting, webhook raw-body routing, body parsing, logging, routes, 404 and
// error handling. It deliberately does NOT load .env, connect to MongoDB or
// start an HTTP listener; server.js owns those responsibilities. Tests build
// the app with createApp() against an isolated in-memory database.
//
// The middleware order below is security-relevant (e.g. the webhook router
// must stay registered before express.json() so it receives the raw body for
// signature verification). Keep it identical unless a reviewed change requires
// otherwise.

const express       = require('express');
const helmet        = require('helmet');
const cors          = require('cors');
const rateLimit     = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const morgan        = require('morgan');
const errorHandler  = require('./middleware/errorHandler');

const createApp = () => {
  const app = express();

  // ── Security headers ──────────────────────────────────────────
  app.use(helmet());
  app.use(mongoSanitize());
  app.set('trust proxy', 1);

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
        url.origin !== origin.replace(/\/+$/, '')
      ) {
        throw new Error('CORS configuration must contain exact HTTP(S) origins.');
      }
      return url.origin;
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
        origin === 'http://localhost:5173' ||
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

  app.use(express.json({ limit:'10mb' }));
  app.use(express.urlencoded({ extended:true }));

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

  return app;
};

module.exports = { createApp };
