// routes/cashbook.js – v5 with CashClosing approval workflow

const express      = require('express');
const router       = express.Router();
const CashBook     = require('../models/CashBook');
const CashClosing  = require('../models/CashClosing');
const ExchangeRate = require('../models/ExchangeRate');
const Invoice      = require('../models/Invoice');
const Expense      = require('../models/Expense');
const { protect, authorize } = require('../middleware/auth');
const { log } = require('../utils/auditLogger');

const todayStr = () => new Date().toISOString().split('T')[0];

// All cashbook routes: admin + manager only
router.use(protect, authorize('admin','manager'));

/* ── GET today ───────────────────────────────────────────────── */
router.get('/today', async (req, res, next) => {
  try {
    const date  = todayStr();
    let entry   = await CashBook.findOne({ date });
    if (!entry) {
      const prev = await CashBook.findOne({ date: { $lt: date } }).sort({ date: -1 });
      entry = await CashBook.create({ date, openingCash: prev?.closingCash||0, openedBy: req.user._id });
    }
    const start = new Date(date); start.setHours(0,0,0,0);
    const end   = new Date(date); end.setHours(23,59,59,999);
    const [salesAgg, expAgg] = await Promise.all([
      Invoice.aggregate([{ $match:{ date:{ $gte:start, $lte:end }, paymentMethod:'Cash' } }, { $group:{ _id:null, total:{ $sum:'$grandTotal' } } }]),
      Expense.aggregate([{ $match:{ date:{ $gte:start, $lte:end } } }, { $group:{ _id:null, total:{ $sum:'$amount' } } }])
    ]);
    res.json({ success:true, data:{ ...entry.toObject(), livesCashSales: salesAgg[0]?.total||0, liveExpenses: expAgg[0]?.total||0 } });
  } catch (err) { next(err); }
});

/* ── POST close day (submit for approval) ────────────────────── */
router.post('/close', async (req, res, next) => {
  try {
    const { actualCash, notes } = req.body;
    if (actualCash === undefined || actualCash === null)
      return res.status(400).json({ success:false, message:'Enter actual cash count.' });

    const date  = todayStr();
    const entry = await CashBook.findOne({ date });
    if (!entry) return res.status(404).json({ success:false, message:'No cashbook entry for today.' });

    const start = new Date(date); start.setHours(0,0,0,0);
    const end   = new Date(date); end.setHours(23,59,59,999);
    const [salesAgg, expAgg] = await Promise.all([
      Invoice.aggregate([{ $match:{ date:{ $gte:start, $lte:end }, paymentMethod:'Cash' } }, { $group:{ _id:null, total:{ $sum:'$grandTotal' } } }]),
      Expense.aggregate([{ $match:{ date:{ $gte:start, $lte:end } } }, { $group:{ _id:null, total:{ $sum:'$amount' } } }])
    ]);
    const totalSales    = salesAgg[0]?.total || 0;
    const totalExpenses = expAgg[0]?.total   || 0;
    const expectedCash  = entry.openingCash + totalSales - totalExpenses;
    const actual        = parseFloat(actualCash);
    const diff          = actual - expectedCash;

    // Check if closing already submitted today
    const existing = await CashClosing.findOne({ date });
    if (existing && existing.status === 'approved')
      return res.status(400).json({ success:false, message:'Day already closed and approved.' });

    const closing = await CashClosing.findOneAndUpdate(
      { date },
      {
        date, openingCash: entry.openingCash, expectedCash, actualCash: actual,
        shortage: diff < 0 ? Math.abs(diff) : 0,
        excess:   diff > 0 ? diff : 0,
        totalSales, totalExpenses,
        status: 'pending_approval',
        notes: notes||'', closedBy: req.user._id, closedByName: req.user.name
      },
      { upsert:true, new:true }
    );

    await log({ user: req.user, action:'STOCK_ADJUST', entity:'CashClosing', entityId: closing._id, details:{ date, expectedCash, actualCash: actual, diff }, req });

    res.json({ success:true, data: closing, message:'Cash closing submitted for approval.' });
  } catch (err) { next(err); }
});

/* ── POST approve closing – admin only ───────────────────────── */
router.post('/approve/:id', authorize('admin'), async (req, res, next) => {
  try {
    const closing = await CashClosing.findById(req.params.id);
    if (!closing) return res.status(404).json({ success:false, message:'Closing not found.' });
    if (closing.status === 'approved') return res.status(400).json({ success:false, message:'Already approved.' });

    closing.status        = 'approved';
    closing.approvedBy    = req.user._id;
    closing.approvedByName= req.user.name;
    closing.approvedAt    = new Date();
    await closing.save();

    // Mark cashbook as closed
    await CashBook.findOneAndUpdate({ date: closing.date }, { isClosed:true, closingCash: closing.actualCash, closedBy: req.user._id, closedAt: new Date() });

    await log({ user: req.user, action:'STOCK_ADJUST', entity:'CashClosing', entityId: closing._id, details:{ approved:true }, req });
    res.json({ success:true, data: closing, message:'Cash closing approved.' });
  } catch (err) { next(err); }
});

/* ── GET pending closings (admin review) ─────────────────────── */
router.get('/closings', async (req, res, next) => {
  try {
    const closings = await CashClosing.find().sort({ date:-1 }).limit(30);
    res.json({ success:true, data: closings });
  } catch (err) { next(err); }
});

/* ── GET history ──────────────────────────────────────────────── */
router.get('/history', async (req, res, next) => {
  try {
    const entries = await CashBook.find().sort({ date:-1 }).limit(30);
    res.json({ success:true, data: entries });
  } catch (err) { next(err); }
});

/* ── Exchange rate ───────────────────────────────────────────── */
router.get('/rate', async (req, res, next) => {
  try {
    const rate = await ExchangeRate.findOne().sort({ createdAt:-1 });
    res.json({ success:true, data: rate || { usdToSsp:1300, sspToUsd:0.00077 } });
  } catch (err) { next(err); }
});

router.post('/rate', async (req, res, next) => {
  try {
    const { usdToSsp } = req.body;
    if (!usdToSsp || parseFloat(usdToSsp) <= 0)
      return res.status(400).json({ success:false, message:'Enter a valid rate.' });
    const rate = await ExchangeRate.create({ date: todayStr(), usdToSsp: parseFloat(usdToSsp), sspToUsd: 1/parseFloat(usdToSsp), setBy: req.user._id });
    res.json({ success:true, data: rate, message:'Exchange rate updated.' });
  } catch (err) { next(err); }
});

module.exports = router;
