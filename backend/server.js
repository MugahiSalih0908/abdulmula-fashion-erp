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

const app  = express();
const PORT = process.env.PORT || 5000;

connectDB();

// ── Security headers ──────────────────────────────────────────
app.use(helmet());
app.use(mongoSanitize());
app.set('trust proxy', 1);

// ── CORS ──────────────────────────────────────────────────────
const allowed = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowed.includes(origin)) return cb(null, true);
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
app.use(express.json({ limit:'10mb' }));
app.use(express.urlencoded({ extended:true }));

// ── Logging ───────────────────────────────────────────────────
app.use(morgan('combined'));

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

// ── API Routes ────────────────────────────────────────────────
// NOTE: NO public /api/auth/register — accounts created by admin via /api/staff
app.use('/api/auth',            require('./routes/auth'));
app.use('/api/dashboard',       require('./routes/dashboard'));
app.use('/api/products',        require('./routes/products'));
app.use('/api/invoices',        require('./routes/invoices'));
app.use('/api/customers',       require('./routes/customers'));
app.use('/api/suppliers',       require('./routes/suppliers'));
app.use('/api/expenses',        require('./routes/expenses'));
app.use('/api/staff',           require('./routes/staff'));
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
  console.log(`\n🚀  Abdulmula Fashion ERP v5 API → http://localhost:${PORT}`);
  console.log(`🔐  No public registration — admin creates accounts via /api/staff`);
  console.log(`🌍  ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
