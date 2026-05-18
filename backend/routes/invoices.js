// routes/invoices.js – /api/invoices
// Uses MongoDB transactions for atomic stock + invoice creation

const express       = require('express');
const router        = express.Router();
const mongoose      = require('mongoose');
const Invoice       = require('../models/Invoice');
const Product       = require('../models/Product');
const Customer      = require('../models/Customer');
const StockMovement = require('../models/StockMovement');
const { protect }   = require('../middleware/auth');
const { log }       = require('../utils/auditLogger');

/* ── POST /api/invoices ──────────────────────────────────────── */
// Creates invoice + reduces stock atomically via MongoDB transaction
router.post('/', protect, async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      items,           // [{ productId, quantity, unitPrice, discount }]
      paymentMethod,
      amountPaid,
      customerId,
      taxRate,
      note,
      offlineId        // client UUID for deduplication of offline sales
    } = req.body;

    // ── Offline deduplication ──────────────────────────────────
    if (offlineId) {
      const existing = await Invoice.findOne({ offlineId });
      if (existing) {
        await session.abortTransaction();
        return res.status(200).json({ success: true, data: existing, duplicate: true });
      }
    }

    if (!items || !items.length)
      return res.status(400).json({ success: false, message: 'At least one item is required.' });

    // ── Validate & build line items ────────────────────────────
    const lineItems  = [];
    let   subtotal   = 0;
    let   discountTotal = 0;

    for (const item of items) {
      const product = await Product.findOne(
        { _id: item.productId, isDeleted: false },
        null,
        { session }
      );

      if (!product)
        throw Object.assign(new Error(`Product ${item.productId} not found.`), { statusCode: 404 });

      if (product.quantity < item.quantity)
        throw Object.assign(
          new Error(`Insufficient stock for "${product.name}". Available: ${product.quantity}`),
          { statusCode: 400 }
        );

      const unitPrice  = item.unitPrice ?? product.price;
      const discount   = item.discount  ?? 0;
      const lineTotal  = Math.max(0, unitPrice * item.quantity - discount);

      lineItems.push({
        product:     product._id,
        productName: product.name,
        sku:         product.sku,
        quantity:    item.quantity,
        unitPrice,
        discount,
        lineTotal
      });

      subtotal      += unitPrice * item.quantity;
      discountTotal += discount;
    }

    const taxAmount  = taxRate ? subtotal * (taxRate / 100) : 0;
    const grandTotal = subtotal - discountTotal + taxAmount;
    const paid       = amountPaid ?? grandTotal;
    const balanceDue = Math.max(0, grandTotal - paid);

    const payStatus  = balanceDue === 0 ? 'paid'
                     : paid > 0 ? 'partial' : 'unpaid';

    // ── Resolve customer ───────────────────────────────────────
    let customerName;
    if (customerId) {
      const cust = await Customer.findById(customerId).session(session);
      customerName = cust?.name;
      // Add to credit balance if balance is due
      if (balanceDue > 0 && cust) {
        cust.creditBalance    += balanceDue;
        cust.totalPurchases   += grandTotal;
        await cust.save({ session });
      }
    }

    // ── Create invoice ─────────────────────────────────────────
    const [invoice] = await Invoice.create([{
      items:         lineItems,
      subtotal,
      discountTotal,
      taxRate:       taxRate || 0,
      taxAmount,
      grandTotal,
      amountPaid:    paid,
      balanceDue,
      paymentMethod: paymentMethod || 'Cash',
      paymentStatus: payStatus,
      customer:      customerId || undefined,
      customerName,
      note,
      offlineId:     offlineId || undefined,
      soldBy:        req.user._id,
      soldByName:    req.user.name
    }], { session });

    // ── Reduce stock + record movements ───────────────────────
    for (const item of lineItems) {
      const product = await Product.findById(item.product).session(session);
      const before  = product.quantity;
      product.quantity -= item.quantity;
      await product.save({ session });

      await StockMovement.create([{
        product:     item.product,
        type:        'sale',
        quantity:    -item.quantity,
        before,
        after:       product.quantity,
        reference:   invoice.invoiceNumber,
        note:        `Sale – ${invoice.invoiceNumber}`,
        performedBy: req.user._id
      }], { session });
    }

    await session.commitTransaction();

    await log({
      user: req.user, action: 'INVOICE_CREATE', entity: 'Invoice',
      entityId: invoice._id, details: { invoiceNumber: invoice.invoiceNumber, grandTotal }, req
    });

    res.status(201).json({ success: true, data: invoice });

  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
});

/* ── GET /api/invoices ───────────────────────────────────────── */
router.get('/', protect, async (req, res, next) => {
  try {
    const { startDate, endDate, paymentMethod, paymentStatus, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate)   { const e = new Date(endDate); e.setHours(23,59,59); filter.date.$lte = e; }
    }
    if (paymentMethod && paymentMethod !== 'all') filter.paymentMethod = paymentMethod;
    if (paymentStatus && paymentStatus !== 'all') filter.paymentStatus = paymentStatus;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [invoices, total, revenue] = await Promise.all([
      Invoice.find(filter)
             .populate('customer', 'name phone')
             .sort({ date: -1 })
             .skip(skip)
             .limit(parseInt(limit)),
      Invoice.countDocuments(filter),
      Invoice.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } }
      ])
    ]);

    res.json({
      success: true,
      data:    invoices,
      total,
      totalRevenue: revenue[0]?.total || 0,
      page: parseInt(page)
    });
  } catch (err) { next(err); }
});

/* ── GET /api/invoices/:id ───────────────────────────────────── */
router.get('/:id', protect, async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
                                 .populate('customer', 'name phone')
                                 .populate('soldBy', 'name');
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });
    res.json({ success: true, data: invoice });
  } catch (err) { next(err); }
});

/* ── POST /api/invoices/sync-offline ─────────────────────────── */
// Accepts an array of offline-queued invoices and processes each safely
router.post('/sync-offline', protect, async (req, res, next) => {
  try {
    const { invoices } = req.body;
    if (!invoices?.length)
      return res.status(400).json({ success: false, message: 'No invoices to sync.' });

    const results = [];

    for (const inv of invoices) {
      try {
        // Reuse the single-invoice creation logic via internal call
        const response = await createInvoiceInternal({ ...inv, soldBy: req.user._id, soldByName: req.user.name });
        results.push({ offlineId: inv.offlineId, success: true, invoiceNumber: response.invoiceNumber });
      } catch (err) {
        results.push({ offlineId: inv.offlineId, success: false, error: err.message });
      }
    }

    res.json({ success: true, data: results });
  } catch (err) { next(err); }
});

/* ── DELETE /api/invoices/:id ────────────────────────────────── */
router.delete('/:id', protect, async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const invoice = await Invoice.findById(req.params.id).session(session);
    if (!invoice) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    // Restore stock for each line item
    for (const item of invoice.items) {
      const product = await Product.findById(item.product).session(session);
      if (product) {
        const before = product.quantity;
        product.quantity += item.quantity;
        await product.save({ session });
        await StockMovement.create([{
          product:     item.product,
          type:        'return',
          quantity:    item.quantity,
          before,
          after:       product.quantity,
          reference:   invoice.invoiceNumber,
          note:        `Invoice deleted – stock restored`,
          performedBy: req.user._id
        }], { session });
      }
    }

    await Invoice.findByIdAndDelete(req.params.id, { session });
    await session.commitTransaction();

    await log({ user: req.user, action: 'INVOICE_DELETE', entity: 'Invoice', entityId: invoice._id, details: { invoiceNumber: invoice.invoiceNumber }, req });
    res.json({ success: true, message: 'Invoice deleted and stock restored.' });
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
});

module.exports = router;
