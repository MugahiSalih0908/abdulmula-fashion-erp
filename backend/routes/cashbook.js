// routes/cashbook.js – daily cashbook and admin-approved closing workflow

const express = require('express');
const router = express.Router();
const CashBook = require('../models/CashBook');
const CashClosing = require('../models/CashClosing');
const ExchangeRate = require('../models/ExchangeRate');
const Invoice = require('../models/Invoice');
const Expense = require('../models/Expense');
const PurchaseOrder = require('../models/PurchaseOrder');
const { protect, authorize } = require('../middleware/auth');
const { log } = require('../utils/auditLogger');

const todayStr = () => new Date().toISOString().split('T')[0];

router.use(protect, authorize('admin', 'manager'));

const getDateBounds = date => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const getDailyFinancialTotals = async date => {
  const { start, end } = getDateBounds(date);
  const [salesAgg, expenseAgg, supplierPaymentsAgg] = await Promise.all([
    Invoice.aggregate([
      { $match: { date: { $gte: start, $lte: end }, paymentMethod: 'Cash' } },
      { $group: { _id: null, total: { $sum: '$grandTotal' } } }
    ]),
    Expense.aggregate([
      { $match: { date: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    PurchaseOrder.aggregate([
      { $unwind: '$payments' },
      { $match: { 'payments.date': { $gte: start, $lte: end }, 'payments.paymentMethod': 'Cash' } },
      { $group: { _id: null, total: { $sum: '$payments.amount' } } }
    ])
  ]);

  return {
    cashSales: salesAgg[0]?.total || 0,
    recordedExpenses: expenseAgg[0]?.total || 0,
    cashSupplierPayments: supplierPaymentsAgg[0]?.total || 0
  };
};

const getCashbookSnapshot = async (date, entry) => {
  const totals = await getDailyFinancialTotals(date);
  return {
    ...entry.toObject(),
    livesCashSales: totals.cashSales,
    liveExpenses: totals.recordedExpenses,
    cashSupplierPayments: totals.cashSupplierPayments
  };
};

/* ── GET today ───────────────────────────────────────────────── */
router.get('/today', async (req, res, next) => {
  try {
    const date = todayStr();
    const entry = await CashBook.findOne({ date });
    if (!entry) {
      return res.json({
        success: true,
        data: null,
        code: 'CASHBOOK_NOT_OPEN',
        message: 'No cashbook entry is open for today.'
      });
    }
    res.json({ success: true, data: await getCashbookSnapshot(date, entry) });
  } catch (error) {
    next(error);
  }
});

/* ── POST open today ─────────────────────────────────────────── */
router.post('/open', async (req, res, next) => {
  try {
    if (req.body && (typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).length)) {
      return res.status(400).json({ success: false, message: 'This action does not accept a request body.' });
    }
    const date = todayStr();
    let entry = await CashBook.findOne({ date });
    let created = false;

    if (!entry) {
      const previous = await CashBook.findOne({ date: { $lt: date } }).sort({ date: -1 });
      try {
        entry = await CashBook.create({
          date,
          openingCash: previous?.closingCash || 0,
          openedBy: req.user._id
        });
        created = true;
      } catch (error) {
        if (error.code !== 11000) throw error;
        entry = await CashBook.findOne({ date });
        if (!entry) throw error;
      }
    }

    if (created) {
      await log({
        user: req.user,
        action: 'CASHBOOK_CREATE',
        entity: 'CashBook',
        entityId: entry._id,
        details: { date, openingCash: entry.openingCash },
        req
      });
    }

    res.status(created ? 201 : 200).json({
      success: true,
      data: await getCashbookSnapshot(date, entry),
      message: created ? "Today's cashbook opened." : "Today's cashbook is already open."
    });
  } catch (error) {
    next(error);
  }
});

/* ── POST close day (submit for approval) ────────────────────── */
router.post('/close', async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some(key => !['actualCash', 'notes'].includes(key))) {
      return res.status(400).json({ success: false, message: 'Unsupported cash closing field.' });
    }
    const rawActual = body.actualCash;
    const actual = typeof rawActual === 'number' || (typeof rawActual === 'string' && rawActual.trim() !== '')
      ? Number(rawActual)
      : Number.NaN;
    if (typeof body.notes !== 'undefined' && typeof body.notes !== 'string') {
      return res.status(400).json({ success: false, message: 'Closing notes must be text.' });
    }
    const notes = String(body.notes || '').trim();

    if (!Number.isFinite(actual) || actual < 0 || !Number.isSafeInteger(Math.round(actual * 100))) {
      return res.status(400).json({ success: false, message: 'Enter a valid non-negative cash count.' });
    }
    if (notes.length > 500) {
      return res.status(400).json({ success: false, message: 'Closing notes must be 500 characters or fewer.' });
    }

    const date = todayStr();
    const entry = await CashBook.findOne({ date });
    if (!entry) return res.status(404).json({ success: false, message: 'No cashbook entry for today.' });
    if (entry.isClosed) return res.status(409).json({ success: false, message: 'This cashbook day is already closed.' });

    const totals = await getDailyFinancialTotals(date);
    const expectedCash = Number(entry.openingCash || 0) +
      totals.cashSales -
      totals.recordedExpenses -
      totals.cashSupplierPayments;
    const diff = actual - expectedCash;

    const existing = await CashClosing.findOne({ date });
    if (existing && existing.status === 'approved') {
      return res.status(409).json({ success: false, message: 'Day already closed and approved.' });
    }

    const closing = await CashClosing.findOneAndUpdate(
      { date },
      {
        date,
        openingCash: entry.openingCash,
        expectedCash,
        actualCash: actual,
        shortage: diff < 0 ? Math.abs(diff) : 0,
        excess: diff > 0 ? diff : 0,
        totalSales: totals.cashSales,
        totalExpenses: totals.recordedExpenses,
        supplierCashPayments: totals.cashSupplierPayments,
        status: 'pending_approval',
        notes,
        closedBy: req.user._id,
        closedByName: req.user.name
      },
      { upsert: true, new: true, runValidators: true }
    );

    await log({
      user: req.user,
      action: 'CASHBOOK_CLOSING_SUBMIT',
      entity: 'CashClosing',
      entityId: closing._id,
      details: { date, expectedCash, actualCash: actual, diff, supplierCashPayments: totals.cashSupplierPayments },
      req
    });

    res.json({ success: true, data: closing, message: 'Cash closing submitted for approval.' });
  } catch (error) {
    next(error);
  }
});

/* ── POST approve closing – admin only ───────────────────────── */
router.post('/approve/:id', authorize('admin'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Closing not found.' });
    const closing = await CashClosing.findById(req.params.id);
    if (!closing) return res.status(404).json({ success: false, message: 'Closing not found.' });
    if (closing.status === 'approved') return res.status(409).json({ success: false, message: 'Already approved.' });

    closing.status = 'approved';
    closing.approvedBy = req.user._id;
    closing.approvedByName = req.user.name;
    closing.approvedAt = new Date();
    await closing.save();

    await CashBook.findOneAndUpdate(
      { date: closing.date },
      { isClosed: true, closingCash: closing.actualCash, closedBy: req.user._id, closedAt: new Date() }
    );

    await log({
      user: req.user,
      action: 'CASHBOOK_CLOSING_APPROVE',
      entity: 'CashClosing',
      entityId: closing._id,
      details: { approved: true },
      req
    });
    res.json({ success: true, data: closing, message: 'Cash closing approved.' });
  } catch (error) {
    next(error);
  }
});

/* ── GET closings ────────────────────────────────────────────── */
router.get('/closings', async (req, res, next) => {
  try {
    const closings = await CashClosing.find().sort({ date: -1 }).limit(30);
    res.json({ success: true, data: closings });
  } catch (error) {
    next(error);
  }
});

/* ── GET cashbook history ────────────────────────────────────── */
router.get('/history', async (req, res, next) => {
  try {
    const entries = await CashBook.find().sort({ date: -1 }).limit(30);
    res.json({ success: true, data: entries });
  } catch (error) {
    next(error);
  }
});

/* ── Exchange rate ───────────────────────────────────────────── */
router.get('/rate', async (req, res, next) => {
  try {
    const rate = await ExchangeRate.findOne().sort({ createdAt: -1 });
    res.json({ success: true, data: rate || { usdToSsp: 1300, sspToUsd: 0.00077 } });
  } catch (error) {
    next(error);
  }
});

router.post('/rate', async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some(key => key !== 'usdToSsp')) {
      return res.status(400).json({ success: false, message: 'Only usdToSsp may be supplied.' });
    }
    const rawRate = body.usdToSsp;
    const usdToSsp = typeof rawRate === 'number' || (typeof rawRate === 'string' && rawRate.trim() !== '')
      ? Number(rawRate)
      : Number.NaN;
    if (!Number.isFinite(usdToSsp) || usdToSsp < 1 || usdToSsp > 100000) {
      return res.status(400).json({ success: false, message: 'Enter a valid exchange rate of at least 1.' });
    }
    const rate = await ExchangeRate.create({
      date: todayStr(),
      usdToSsp,
      sspToUsd: 1 / usdToSsp,
      setBy: req.user._id
    });
    res.json({ success: true, data: rate, message: 'Exchange rate updated.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
