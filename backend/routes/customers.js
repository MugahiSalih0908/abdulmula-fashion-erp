// routes/customers.js – /api/customers

const express  = require('express');
const router   = express.Router();
const Customer = require('../models/Customer');
const Invoice  = require('../models/Invoice');
const { protect, authorize } = require('../middleware/auth');
const { log }  = require('../utils/auditLogger');
const { getPaginationOptions, escapeRegExp } = require('../utils/queryPagination');

router.get('/', protect, async (req, res, next) => {
  try {
    const { search, hasCredit } = req.query;
    const filter = { isDeleted: false };

    if (search && String(search).trim()) {
      const pattern = new RegExp(escapeRegExp(String(search).trim()), 'i');
      filter.$or = [
        { name: pattern },
        { phone: pattern },
        { email: pattern },
        { address: pattern }
      ];
    }
    if (hasCredit === 'true') filter.creditBalance = { $gt: 0 };

    const pagination = getPaginationOptions(req.query);
    if (!pagination) {
      const customers = await Customer.find(filter).sort({ name: 1 });
      return res.json({ success: true, data: customers });
    }

    const [customers, total, summaryRows] = await Promise.all([
      Customer.find(filter)
        .select('name phone email address creditBalance totalPurchases createdAt updatedAt')
        .sort({ name: 1, _id: 1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Customer.countDocuments(filter),
      Customer.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalPurchases: { $sum: { $ifNull: ['$totalPurchases', 0] } },
            outstandingCredit: { $sum: { $ifNull: ['$creditBalance', 0] } },
            withCredit: {
              $sum: { $cond: [{ $gt: [{ $ifNull: ['$creditBalance', 0] }, 0] }, 1, 0] }
            },
            withEmail: {
              $sum: { $cond: [{ $ne: [{ $ifNull: ['$email', ''] }, ''] }, 1, 0] }
            },
            withPhone: {
              $sum: { $cond: [{ $ne: [{ $ifNull: ['$phone', ''] }, ''] }, 1, 0] }
            }
          }
        }
      ])
    ]);

    const summary = summaryRows[0] || {
      count: 0,
      totalPurchases: 0,
      outstandingCredit: 0,
      withCredit: 0,
      withEmail: 0,
      withPhone: 0
    };

    res.json({
      success: true,
      data: customers,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
      summary
    });
  } catch (err) { next(err); }
});

router.get('/:id', protect, async (req, res, next) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, isDeleted: false });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    const invoices = await Invoice.find({ customer: req.params.id }).sort({ date: -1 }).limit(20);
    res.json({ success: true, data: customer, invoices });
  } catch (err) { next(err); }
});

router.post('/', protect, async (req, res, next) => {
  try {
    const { name, phone, email, address, notes } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required.' });

    const customer = await Customer.create({ name: name.trim(), phone, email, address, notes, addedBy: req.user._id });
    await log({ user: req.user, action: 'CUSTOMER_CREATE', entity: 'Customer', entityId: customer._id, req });
    res.status(201).json({ success: true, data: customer });
  } catch (err) { next(err); }
});

router.put('/:id', protect, async (req, res, next) => {
  try {
    // Only profile fields may be edited here. Credit balances, purchase totals,
    // deletion state, and ownership are changed by their dedicated workflows.
    const allowedFields = ['name', 'phone', 'email', 'address', 'notes'];
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? req.body
      : {};
    const updates = Object.fromEntries(
      allowedFields
        .filter(field => Object.prototype.hasOwnProperty.call(body, field))
        .map(field => [field, body[field]])
    );

    if (!Object.keys(updates).length) {
      return res.status(400).json({ success: false, message: 'No editable customer fields were supplied.' });
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'name') &&
        (typeof updates.name !== 'string' || !updates.name.trim())) {
      return res.status(400).json({ success: false, message: 'Customer name cannot be empty.' });
    }

    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      updates,
      { new: true, runValidators: true }
    );
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });
    await log({ user: req.user, action: 'CUSTOMER_UPDATE', entity: 'Customer', entityId: customer._id, req });
    res.json({ success: true, data: customer });
  } catch (err) { next(err); }
});

// Record a credit repayment
router.post('/:id/pay', protect, async (req, res, next) => {
  try {
    const { amount } = req.body;
    const pay = parseFloat(amount);
    if (!pay || pay <= 0) return res.status(400).json({ success: false, message: 'Enter a valid payment amount.' });

    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    customer.creditBalance = Math.max(0, customer.creditBalance - pay);
    await customer.save();
    res.json({ success: true, data: customer, message: `$${pay.toFixed(2)} payment recorded for ${customer.name}.` });
  } catch (err) { next(err); }
});

router.delete('/:id', protect, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndUpdate(req.params.id, { isDeleted: true }, { new: true });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });
    await log({ user: req.user, action: 'CUSTOMER_DELETE', entity: 'Customer', entityId: customer._id, req });
    res.json({ success: true, message: 'Customer deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
