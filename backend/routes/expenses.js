// routes/expenses.js – v6 (safe, non‑crashing)
const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const { protect, authorize } = require('../middleware/auth');
const { log } = require('../utils/auditLogger');

// All routes require authentication + admin or manager role
router.use(protect, authorize('admin', 'manager'));

/**
 * GET /api/expenses
 * Query: ?category=...&startDate=...&endDate=...
 */
router.get('/', async (req, res, next) => {
  try {
    const { category, startDate, endDate } = req.query;
    const filter = {};

    if (category && category !== 'all') {
      filter.category = category;
    }
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    const expenses = await Expense.find(filter).sort({ date: -1 });
    const total = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    res.json({ success: true, data: expenses, total });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/expenses – main create endpoint (used by frontend)
 * Body: { title, amount, category, description?, date? }
 */
router.post('/', async (req, res, next) => {
  try {
    const { title, amount, category, description, date } = req.body;

    // Input validation
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Expense title is required and must be a non‑empty string.'
      });
    }
    if (amount === undefined || amount === null) {
      return res.status(400).json({
        success: false,
        message: 'Amount is required.'
      });
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number.'
      });
    }

    // Prepare expense data
    const expenseData = {
      title: title.trim(),
      amount: parsedAmount,
      category: category || 'Other',
      description: description ? description.trim() : '',
      addedBy: req.user._id,
      date: date ? new Date(date) : new Date()
    };

    const expense = await Expense.create(expenseData);

    // Audit log (if log function exists, otherwise skip)
    if (typeof log === 'function') {
      await log({
        user: req.user,
        action: 'EXPENSE_CREATE',
        entity: 'Expense',
        entityId: expense._id,
        req
      }).catch(e => console.error('Audit log failed:', e));
    }

    res.status(201).json({ success: true, data: expense });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/expenses/add – legacy endpoint (kept for compatibility)
 * Same as POST / – just forwards logic
 */
router.post('/add', async (req, res, next) => {
  // Reuse the same handler by calling the route handler
  // This avoids code duplication and ensures same behaviour
  router.handle(req, res, next);
});

/**
 * DELETE /api/expenses/:id
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found.'
      });
    }

    await Expense.findByIdAndDelete(req.params.id);

    // Audit log
    if (typeof log === 'function') {
      await log({
        user: req.user,
        action: 'EXPENSE_DELETE',
        entity: 'Expense',
        entityId: expense._id,
        req
      }).catch(e => console.error('Audit log failed:', e));
    }

    res.json({ success: true, message: 'Expense deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;