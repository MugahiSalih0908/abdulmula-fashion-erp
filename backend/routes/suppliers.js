// routes/suppliers.js – v5  admin + manager only

const express  = require('express');
const router   = express.Router();
const Supplier = require('../models/Supplier');
const { protect, authorize } = require('../middleware/auth');
const { log } = require('../utils/auditLogger');

router.use(protect, authorize('admin','manager'));

router.get('/', async (req, res, next) => {
  try {
    const suppliers = await Supplier.find({ isDeleted: false }).sort({ name: 1 });
    res.json({ success: true, data: suppliers });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const s = await Supplier.findOne({ _id: req.params.id, isDeleted: false });
    if (!s) return res.status(404).json({ success: false, message: 'Supplier not found.' });
    res.json({ success: true, data: s });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, phone, email, address, company, notes } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Supplier name is required.' });
    const s = await Supplier.create({ name, phone, email, address, company, notes, addedBy: req.user._id });
    await log({ user: req.user, action:'SUPPLIER_CREATE', entity:'Supplier', entityId: s._id, req });
    res.status(201).json({ success: true, data: s });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const s = await Supplier.findOneAndUpdate({ _id: req.params.id, isDeleted: false }, req.body, { new:true, runValidators:true });
    if (!s) return res.status(404).json({ success: false, message: 'Supplier not found.' });
    await log({ user: req.user, action:'SUPPLIER_UPDATE', entity:'Supplier', entityId: s._id, req });
    res.json({ success: true, data: s });
  } catch (err) { next(err); }
});

router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const s = await Supplier.findByIdAndUpdate(req.params.id, { isDeleted: true }, { new:true });
    if (!s) return res.status(404).json({ success: false, message: 'Supplier not found.' });
    await log({ user: req.user, action:'SUPPLIER_DELETE', entity:'Supplier', entityId: s._id, req });
    res.json({ success: true, message: 'Supplier deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
