// routes/expenses.js – v6 (safe, non‑crashing)
const express = require('express');
const mongoose = require('mongoose');
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
 * Create an expense using a strict allowlist; /add remains a compatibility alias.
 */
const createExpense = async (req, res, next) => {
  try {
    const allowed = ['title', 'amount', 'category', 'description', 'date'];
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ success: false, message: 'An expense object is required.' });
    }
    const unknown = Object.keys(req.body).filter(key => !allowed.includes(key));
    if (unknown.length) {
      return res.status(400).json({ success: false, message: `Unsupported expense field(s): ${unknown.join(', ')}.` });
    }

    const { title, amount, category = 'Other', description = '', date } = req.body;
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 120) {
      return res.status(400).json({ success: false, message: 'Expense title is required and must be 120 characters or fewer.' });
    }
    const parsedAmount = typeof amount === 'number' || (typeof amount === 'string' && amount.trim() !== '')
      ? Number(amount)
      : Number.NaN;
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || !Number.isSafeInteger(Math.round(parsedAmount * 100))) {
      return res.status(400).json({ success: false, message: 'Amount must be a finite positive number.' });
    }
    const categories = ['Rent', 'Transport', 'Salaries', 'Electricity', 'Stock Purchase', 'Marketing', 'Maintenance', 'Other'];
    if (!categories.includes(category)) {
      return res.status(400).json({ success: false, message: 'Choose a valid expense category.' });
    }
    if (typeof description !== 'string' || description.trim().length > 300) {
      return res.status(400).json({ success: false, message: 'Description must be 300 characters or fewer.' });
    }
    const expenseDate = date === undefined || date === null || date === '' ? new Date() : new Date(date);
    if (Number.isNaN(expenseDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Enter a valid expense date.' });
    }

    const expense = await Expense.create({
      title: title.trim(),
      amount: Math.round(parsedAmount * 100) / 100,
      category,
      description: description.trim(),
      addedBy: req.user._id,
      date: expenseDate
    });

    await log({
      user: req.user,
      action: 'EXPENSE_CREATE',
      entity: 'Expense',
      entityId: expense._id,
      req
    });
    res.status(201).json({ success: true, data: expense });
  } catch (err) {
    next(err);
  }
};

router.post('/', createExpense);
router.post('/add', createExpense);

/**
 * DELETE /api/expenses/:id
 * Financial record deletion remains restricted to administrators.
 */
router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Expense not found.' });
    }
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found.' });
    }
    await log({
      user: req.user,
      action: 'EXPENSE_DELETE',
      entity: 'Expense',
      entityId: expense._id,
      req
    });
    res.json({ success: true, message: 'Expense deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;