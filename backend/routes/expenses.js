// routes/expenses.js – v6 (safe, non‑crashing)
const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const { protect, authorize } = require('../middleware/auth');
const { log } = require('../utils/auditLogger');
const { getPaginationOptions, escapeRegExp } = require('../utils/queryPagination');

// All routes require authentication + admin or manager role
router.use(protect, authorize('admin', 'manager'));

/**
 * GET /api/expenses
 * Query: ?category=...&startDate=...&endDate=...
 */
router.get('/', async (req, res, next) => {
  try {
    const { category, startDate, endDate, search } = req.query;
    const filter = {};

    if (category && category !== 'all' && category !== 'All') {
      filter.category = category;
    }
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        const start = new Date(startDate);
        if (Number.isNaN(start.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid start date.' });
        }
        filter.date.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (Number.isNaN(end.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid end date.' });
        }
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }
    if (search && String(search).trim()) {
      const pattern = new RegExp(escapeRegExp(String(search).trim()), 'i');
      filter.$or = [
        { title: pattern },
        { category: pattern },
        { description: pattern }
      ];
    }

    const pagination = getPaginationOptions(req.query);
    if (!pagination) {
      const expenses = await Expense.find(filter).sort({ date: -1, _id: -1 });
      const total = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
      return res.json({ success: true, data: expenses, total });
    }

    const [expenses, totalCount, aggregateRows, categoryRows] = await Promise.all([
      Expense.find(filter)
        .select('title amount category description date createdAt updatedAt addedBy')
        .sort({ date: -1, _id: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Expense.countDocuments(filter),
      Expense.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            total: { $sum: '$amount' },
            average: { $avg: '$amount' },
            largest: { $max: '$amount' }
          }
        }
      ]),
      Expense.aggregate([
        { $match: filter },
        { $group: { _id: '$category', amount: { $sum: '$amount' } } },
        { $sort: { amount: -1 } }
      ])
    ]);

    const aggregate = aggregateRows[0] || { count: 0, total: 0, average: 0, largest: 0 };
    const categoryBreakdown = categoryRows.map(row => ({
      category: row._id || 'Other',
      amount: row.amount,
      share: aggregate.total > 0 ? (row.amount / aggregate.total) * 100 : 0
    }));

    res.json({
      success: true,
      data: expenses,
      total: aggregate.total,
      totalCount,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.max(1, Math.ceil(totalCount / pagination.limit)),
      summary: {
        count: aggregate.count,
        total: aggregate.total,
        average: aggregate.average,
        largest: aggregate.largest,
        categoryBreakdown
      }
    });
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