// routes/suppliers.js – v5  admin + manager only

const express  = require('express');
const mongoose = require('mongoose');
const router   = express.Router();
const Supplier = require('../models/Supplier');
const { protect, authorize } = require('../middleware/auth');
const { log } = require('../utils/auditLogger');
const { getPaginationOptions, escapeRegExp } = require('../utils/queryPagination');
const { validateSupplierPayload } = require('../utils/supplierValidation');

router.use(protect, authorize('admin','manager'));

router.get('/', async (req, res, next) => {
  try {
    const { search, hasDebt } = req.query;
    const filter = { isDeleted: false };

    if (search && String(search).trim()) {
      const pattern = new RegExp(escapeRegExp(String(search).trim()), 'i');
      filter.$or = [
        { name: pattern },
        { company: pattern },
        { email: pattern },
        { phone: pattern },
        { address: pattern }
      ];
    }
    if (hasDebt === 'true') filter.debtBalance = { $gt: 0 };

    const pagination = getPaginationOptions(req.query);
    if (!pagination) {
      const suppliers = await Supplier.find(filter).sort({ name: 1 });
      return res.json({ success: true, data: suppliers });
    }

    const [suppliers, total, summaryRows] = await Promise.all([
      Supplier.find(filter)
        .select('name phone email address company debtBalance createdAt updatedAt')
        .sort({ name: 1, _id: 1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Supplier.countDocuments(filter),
      Supplier.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalDebt: { $sum: { $ifNull: ['$debtBalance', 0] } },
            withDebt: {
              $sum: { $cond: [{ $gt: [{ $ifNull: ['$debtBalance', 0] }, 0] }, 1, 0] }
            },
            withPhone: {
              $sum: { $cond: [{ $ne: [{ $ifNull: ['$phone', ''] }, ''] }, 1, 0] }
            },
            withEmail: {
              $sum: { $cond: [{ $ne: [{ $ifNull: ['$email', ''] }, ''] }, 1, 0] }
            }
          }
        }
      ])
    ]);

    const summary = summaryRows[0] || {
      count: 0,
      totalDebt: 0,
      withDebt: 0,
      withPhone: 0,
      withEmail: 0
    };

    res.json({
      success: true,
      data: suppliers,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
      summary
    });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Supplier not found.' });
    const s = await Supplier.findOne({ _id: req.params.id, isDeleted: false });
    if (!s) return res.status(404).json({ success: false, message: 'Supplier not found.' });
    res.json({ success: true, data: s });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const validation = validateSupplierPayload(req.body);
    if (validation.error) return res.status(400).json({ success: false, message: validation.error, field: validation.field });
    const s = await Supplier.create({ ...validation.value, addedBy: req.user._id });
    await log({ user: req.user, action:'SUPPLIER_CREATE', entity:'Supplier', entityId: s._id, req });
    res.status(201).json({ success: true, data: s });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Supplier not found.' });
    const validation = validateSupplierPayload(req.body, { partial: true });
    if (validation.error) return res.status(400).json({ success: false, message: validation.error, field: validation.field });
    const s = await Supplier.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: validation.value },
      { new: true, runValidators: true }
    );
    if (!s) return res.status(404).json({ success: false, message: 'Supplier not found.' });
    await log({ user: req.user, action:'SUPPLIER_UPDATE', entity:'Supplier', entityId: s._id, req });
    res.json({ success: true, data: s });
  } catch (err) { next(err); }
});

router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Supplier not found.' });
    const s = await Supplier.findOneAndUpdate({ _id: req.params.id, isDeleted: false }, { $set: { isDeleted: true } }, { new: true, runValidators: true });
    if (!s) return res.status(404).json({ success: false, message: 'Supplier not found.' });
    await log({ user: req.user, action:'SUPPLIER_DELETE', entity:'Supplier', entityId: s._id, req });
    res.json({ success: true, message: 'Supplier deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
