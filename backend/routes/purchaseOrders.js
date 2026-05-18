// routes/purchaseOrders.js – v5
// Create/receive/pay = admin+manager | Edit/Delete = admin only

const express       = require('express');
const router        = express.Router();
const mongoose      = require('mongoose');
const PurchaseOrder = require('../models/PurchaseOrder');
const Product       = require('../models/Product');
const Supplier      = require('../models/Supplier');
const StockMovement = require('../models/StockMovement');
const { protect, authorize } = require('../middleware/auth');
const { log } = require('../utils/auditLogger');

router.use(protect, authorize('admin','manager'));

router.get('/', async (req, res, next) => {
  try {
    const { supplier, status, page=1, limit=30 } = req.query;
    const filter = {};
    if (supplier) filter.supplier = supplier;
    if (status && status !== 'all') filter.status = status;
    const skip = (parseInt(page)-1)*parseInt(limit);
    const [orders, total] = await Promise.all([
      PurchaseOrder.find(filter).populate('supplier','name phone').sort({ createdAt:-1 }).skip(skip).limit(parseInt(limit)),
      PurchaseOrder.countDocuments(filter)
    ]);
    res.json({ success:true, data:orders, total });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id).populate('supplier','name phone email');
    if (!po) return res.status(404).json({ success:false, message:'PO not found.' });
    res.json({ success:true, data:po });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { supplierId, items, discount, note } = req.body;
    if (!supplierId || !items?.length)
      return res.status(400).json({ success:false, message:'Supplier and items required.' });
    const supplier = await Supplier.findById(supplierId);
    if (!supplier) return res.status(404).json({ success:false, message:'Supplier not found.' });

    const lineItems = [];
    let subtotal = 0;
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) throw Object.assign(new Error(`Product ${item.productId} not found.`), { statusCode:404 });
      const lineTotal = item.unitCost * item.quantity;
      lineItems.push({ product: product._id, productName: product.name, quantity: item.quantity, unitCost: item.unitCost, lineTotal });
      subtotal += lineTotal;
    }
    const disc       = parseFloat(discount)||0;
    const grandTotal = subtotal - disc;
    const po = await PurchaseOrder.create({ supplier: supplier._id, supplierName: supplier.name, items: lineItems, subtotal, discount: disc, grandTotal, balanceDue: grandTotal, note, createdBy: req.user._id });
    await log({ user: req.user, action:'SUPPLIER_CREATE', entity:'PurchaseOrder', entityId: po._id, details:{ poNumber: po.poNumber }, req });
    res.status(201).json({ success:true, data:po });
  } catch (err) { next(err); }
});

// Edit PO – admin only
router.put('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ success:false, message:'PO not found.' });
    if (po.status === 'received' || po.status === 'paid')
      return res.status(400).json({ success:false, message:'Cannot edit a received or paid PO.' });
    const updated = await PurchaseOrder.findByIdAndUpdate(req.params.id, req.body, { new:true, runValidators:true });
    await log({ user: req.user, action:'SUPPLIER_UPDATE', entity:'PurchaseOrder', entityId: po._id, req });
    res.json({ success:true, data:updated });
  } catch (err) { next(err); }
});

// Delete PO – admin only
router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ success:false, message:'PO not found.' });
    if (po.status === 'received' || po.status === 'paid')
      return res.status(400).json({ success:false, message:'Cannot delete a received or paid PO.' });
    await PurchaseOrder.findByIdAndDelete(req.params.id);
    await log({ user: req.user, action:'SUPPLIER_DELETE', entity:'PurchaseOrder', entityId: po._id, details:{ poNumber: po.poNumber }, req });
    res.json({ success:true, message:'Purchase order deleted.' });
  } catch (err) { next(err); }
});

// Receive goods – admin + manager
router.patch('/:id/receive', async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const po = await PurchaseOrder.findById(req.params.id).session(session);
    if (!po) { await session.abortTransaction(); return res.status(404).json({ success:false, message:'PO not found.' }); }
    if (po.status === 'received' || po.status === 'paid') { await session.abortTransaction(); return res.status(400).json({ success:false, message:'Already received.' }); }

    for (const item of po.items) {
      const product = await Product.findById(item.product).session(session);
      if (product) {
        const before = product.quantity;
        product.quantity  += item.quantity;
        product.costPrice  = item.unitCost;
        await product.save({ session });
        await StockMovement.create([{ product: item.product, type:'purchase', quantity: item.quantity, before, after: product.quantity, reference: po.poNumber, note:`Purchase received – ${po.poNumber}`, performedBy: req.user._id }], { session });
      }
    }
    await Supplier.findByIdAndUpdate(po.supplier, { $inc: { debtBalance: po.balanceDue } }, { session });
    po.status     = 'received';
    po.receivedAt = new Date();
    await po.save({ session });
    await session.commitTransaction();
    res.json({ success:true, data:po, message:'Goods received and stock updated.' });
  } catch (err) { await session.abortTransaction(); next(err); }
  finally { session.endSession(); }
});

// Pay supplier
router.patch('/:id/pay', async (req, res, next) => {
  try {
    const { amount } = req.body;
    const pay = parseFloat(amount);
    if (!pay || pay <= 0) return res.status(400).json({ success:false, message:'Enter a valid amount.' });
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ success:false, message:'PO not found.' });
    po.amountPaid += pay;
    po.balanceDue  = Math.max(0, po.grandTotal - po.amountPaid);
    po.status      = po.balanceDue === 0 ? 'paid' : 'partial';
    await po.save();
    await Supplier.findByIdAndUpdate(po.supplier, { $inc: { debtBalance: -pay } });
    res.json({ success:true, data:po, message:`Payment of $${pay.toFixed(2)} recorded.` });
  } catch (err) { next(err); }
});

module.exports = router;
