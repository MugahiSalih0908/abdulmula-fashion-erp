// routes/customers.js – /api/customers

const express  = require('express');
const router   = express.Router();
const Customer = require('../models/Customer');
const Invoice  = require('../models/Invoice');
const { protect, authorize } = require('../middleware/auth');
const { log }  = require('../utils/auditLogger');

router.get('/', protect, async (req, res, next) => {
  try {
    const { search, hasCredit } = req.query;
    const filter = { isDeleted: false };
    if (search) filter.$text = { $search: search };
    if (hasCredit === 'true') filter.creditBalance = { $gt: 0 };

    const customers = await Customer.find(filter).sort({ name: 1 });
    res.json({ success: true, data: customers });
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
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      req.body,
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
