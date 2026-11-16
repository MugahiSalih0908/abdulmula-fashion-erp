// routes/purchaseOrders.js – controlled order, receiving and supplier-payment workflow
// Create/order/receive/pay = admin + manager | Edit/delete draft = admin only

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const PurchaseOrder = require('../models/PurchaseOrder');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const StockMovement = require('../models/StockMovement');
const { protect, authorize } = require('../middleware/auth');
const { log } = require('../utils/auditLogger');
const {
  calculatePurchaseOrderTotals,
  normalizeSupplierPayment,
  roundMoney
} = require('../utils/purchaseOrderValidation');

router.use(protect, authorize('admin', 'manager'));

const sendValidationError = (res, error) => res.status(error.statusCode || 400).json({
  success: false,
  message: error.message
});

const resolveOrderLines = async (items, session) => {
  const totals = calculatePurchaseOrderTotals(items);
  const lineItems = [];

  for (const item of totals.items) {
    if (!mongoose.isValidObjectId(item.productId)) {
      throw Object.assign(new Error('Choose a valid product for each line item.'), { statusCode: 400 });
    }

    const product = await Product.findOne({
      _id: item.productId,
      isDeleted: { $ne: true }
    }).session(session || null);

    if (!product) {
      throw Object.assign(new Error('One of the selected products is no longer available.'), { statusCode: 404 });
    }

    const lineTotal = roundMoney(item.quantity * item.unitCost);
    lineItems.push({
      product: product._id,
      productName: product.name,
      quantity: item.quantity,
      unitCost: item.unitCost,
      lineTotal
    });
  }

  const calculated = calculatePurchaseOrderTotals(totals.items, 0);
  return {
    lineItems,
    subtotal: calculated.subtotal
  };
};

/* ── GET /api/purchase-orders ─────────────────────────────────── */
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 30));
    const filter = {};

    if (req.query.supplier) {
      if (!mongoose.isValidObjectId(req.query.supplier)) {
        return res.status(400).json({ success: false, message: 'Invalid supplier filter.' });
      }
      filter.supplier = req.query.supplier;
    }

    if (req.query.status && req.query.status !== 'all') {
      const statuses = ['draft', 'ordered', 'received', 'partial', 'paid'];
      if (!statuses.includes(req.query.status)) {
        return res.status(400).json({ success: false, message: 'Invalid purchase order status filter.' });
      }
      filter.status = req.query.status;
    }

    const [orders, total] = await Promise.all([
      PurchaseOrder.find(filter)
        .populate('supplier', 'name phone email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      PurchaseOrder.countDocuments(filter)
    ]);

    res.json({ success: true, data: orders, total, page, limit });
  } catch (error) {
    next(error);
  }
});

/* ── GET /api/purchase-orders/:id ─────────────────────────────── */
router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid purchase order ID.' });
    }
    const po = await PurchaseOrder.findById(req.params.id)
      .populate('supplier', 'name phone email')
      .populate('payments.recordedBy', 'name');
    if (!po) return res.status(404).json({ success: false, message: 'Purchase order not found.' });
    res.json({ success: true, data: po });
  } catch (error) {
    next(error);
  }
});

/* ── POST /api/purchase-orders ────────────────────────────────── */
router.post('/', async (req, res, next) => {
  try {
    const { supplierId, items, discount, note } = req.body || {};
    if (!mongoose.isValidObjectId(supplierId)) {
      return res.status(400).json({ success: false, message: 'Choose a valid supplier.' });
    }

    const supplier = await Supplier.findOne({ _id: supplierId, isDeleted: { $ne: true } });
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found.' });

    const totals = calculatePurchaseOrderTotals(items, discount);
    if (String(note || '').trim().length > 400) {
      return res.status(400).json({ success: false, message: 'Purchase order note must be 400 characters or fewer.' });
    }

    const { lineItems } = await resolveOrderLines(totals.items);
    const po = await PurchaseOrder.create({
      supplier: supplier._id,
      supplierName: supplier.name,
      items: lineItems,
      subtotal: totals.subtotal,
      discount: totals.discount,
      grandTotal: totals.grandTotal,
      amountPaid: 0,
      balanceDue: totals.grandTotal,
      status: 'draft',
      note: String(note || '').trim(),
      createdBy: req.user._id
    });

    await log({
      user: req.user,
      action: 'PURCHASE_ORDER_CREATE',
      entity: 'PurchaseOrder',
      entityId: po._id,
      details: { poNumber: po.poNumber, grandTotal: po.grandTotal },
      req
    });

    res.status(201).json({ success: true, data: po, message: 'Draft purchase order created.' });
  } catch (error) {
    if (error.statusCode) return sendValidationError(res, error);
    next(error);
  }
});

/* ── PUT /api/purchase-orders/:id – draft only, admin only ────── */
router.put('/:id', authorize('admin'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid purchase order ID.' });
    }

    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ success: false, message: 'Purchase order not found.' });
    if (po.status !== 'draft' || po.payments?.length) {
      return res.status(409).json({ success: false, message: 'Only unpaid draft purchase orders can be edited.' });
    }

    const supplierId = req.body?.supplierId || String(po.supplier);
    if (!mongoose.isValidObjectId(supplierId)) {
      return res.status(400).json({ success: false, message: 'Choose a valid supplier.' });
    }
    const supplier = await Supplier.findOne({ _id: supplierId, isDeleted: { $ne: true } });
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found.' });

    const items = req.body?.items || po.items.map(item => ({
      productId: String(item.product),
      quantity: item.quantity,
      unitCost: item.unitCost
    }));
    const totals = calculatePurchaseOrderTotals(items, req.body?.discount ?? po.discount);
    const note = req.body?.note === undefined ? po.note : String(req.body.note || '').trim();
    if (note.length > 400) {
      return res.status(400).json({ success: false, message: 'Purchase order note must be 400 characters or fewer.' });
    }
    const { lineItems } = await resolveOrderLines(totals.items);

    po.supplier = supplier._id;
    po.supplierName = supplier.name;
    po.items = lineItems;
    po.subtotal = totals.subtotal;
    po.discount = totals.discount;
    po.grandTotal = totals.grandTotal;
    po.balanceDue = totals.grandTotal;
    po.note = note;
    await po.save();

    await log({
      user: req.user,
      action: 'PURCHASE_ORDER_UPDATE',
      entity: 'PurchaseOrder',
      entityId: po._id,
      details: { poNumber: po.poNumber },
      req
    });
    res.json({ success: true, data: po, message: 'Draft purchase order updated.' });
  } catch (error) {
    if (error.statusCode) return sendValidationError(res, error);
    next(error);
  }
});

/* ── DELETE /api/purchase-orders/:id – draft only, admin only ── */
router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid purchase order ID.' });
    }
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ success: false, message: 'Purchase order not found.' });
    if (po.status !== 'draft' || po.payments?.length) {
      return res.status(409).json({ success: false, message: 'Only unpaid draft purchase orders can be deleted.' });
    }

    await PurchaseOrder.findByIdAndDelete(req.params.id);
    await log({
      user: req.user,
      action: 'PURCHASE_ORDER_DELETE',
      entity: 'PurchaseOrder',
      entityId: po._id,
      details: { poNumber: po.poNumber },
      req
    });
    res.json({ success: true, message: 'Draft purchase order deleted.' });
  } catch (error) {
    next(error);
  }
});

/* ── PATCH /api/purchase-orders/:id/order – draft to ordered ─── */
router.patch('/:id/order', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid purchase order ID.' });
    }
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ success: false, message: 'Purchase order not found.' });
    if (po.status !== 'draft') {
      return res.status(409).json({ success: false, message: 'Only draft purchase orders can be marked as ordered.' });
    }

    po.status = 'ordered';
    await po.save();
    await log({
      user: req.user,
      action: 'PURCHASE_ORDER_ORDERED',
      entity: 'PurchaseOrder',
      entityId: po._id,
      details: { poNumber: po.poNumber },
      req
    });
    res.json({ success: true, data: po, message: 'Purchase order marked as ordered.' });
  } catch (error) {
    next(error);
  }
});

/* ── PATCH /api/purchase-orders/:id/receive – ordered only ───── */
router.patch('/:id/receive', async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    let receivedOrder;

    await session.withTransaction(async () => {
      if (!mongoose.isValidObjectId(req.params.id)) {
        throw Object.assign(new Error('Invalid purchase order ID.'), { statusCode: 400 });
      }

      const po = await PurchaseOrder.findById(req.params.id).session(session);
      if (!po) throw Object.assign(new Error('Purchase order not found.'), { statusCode: 404 });
      if (po.status !== 'ordered') {
        throw Object.assign(new Error('Only ordered purchase orders can be received.'), { statusCode: 409 });
      }

      const supplier = await Supplier.findById(po.supplier).session(session);
      if (!supplier) throw Object.assign(new Error('The supplier linked to this order no longer exists.'), { statusCode: 409 });

      for (const item of po.items) {
        const product = await Product.findById(item.product).session(session);
        if (!product || product.isDeleted) {
          throw Object.assign(new Error('A product on this purchase order no longer exists. No stock was changed.'), { statusCode: 409 });
        }

        const before = Number(product.quantity) || 0;
        product.quantity = before + item.quantity;
        product.costPrice = item.unitCost;
        await product.save({ session });
        await StockMovement.create([{
          product: item.product,
          type: 'purchase',
          quantity: item.quantity,
          before,
          after: product.quantity,
          reference: po.poNumber,
          note: 'Purchase received – ' + po.poNumber,
          performedBy: req.user._id
        }], { session });
      }

      supplier.debtBalance = Number(supplier.debtBalance || 0) + Number(po.balanceDue || 0);
      await supplier.save({ session });

      po.status = 'received';
      po.receivedAt = new Date();
      await po.save({ session });
      receivedOrder = po;
    });

    await log({
      user: req.user,
      action: 'PURCHASE_ORDER_RECEIVE',
      entity: 'PurchaseOrder',
      entityId: receivedOrder._id,
      details: { poNumber: receivedOrder.poNumber, grandTotal: receivedOrder.grandTotal },
      req
    });
    res.json({ success: true, data: receivedOrder, message: 'Goods received and stock updated.' });
  } catch (error) {
    if (error.statusCode) return sendValidationError(res, error);
    next(error);
  } finally {
    await session.endSession();
  }
});

/* ── PATCH /api/purchase-orders/:id/pay – received only ──────── */
router.patch('/:id/pay', async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    let updatedOrder;
    let payment;

    await session.withTransaction(async () => {
      if (!mongoose.isValidObjectId(req.params.id)) {
        throw Object.assign(new Error('Invalid purchase order ID.'), { statusCode: 400 });
      }

      const po = await PurchaseOrder.findById(req.params.id).session(session);
      if (!po) throw Object.assign(new Error('Purchase order not found.'), { statusCode: 404 });

      payment = normalizeSupplierPayment(req.body, {
        balanceDue: po.balanceDue,
        status: po.status
      });

      const supplier = await Supplier.findById(po.supplier).session(session);
      if (!supplier) throw Object.assign(new Error('The supplier linked to this order no longer exists.'), { statusCode: 409 });

      po.payments.push({ ...payment, recordedBy: req.user._id });
      po.amountPaid = roundMoney(Number(po.amountPaid || 0) + payment.amount);
      po.balanceDue = Math.max(0, roundMoney(Number(po.grandTotal) - po.amountPaid));
      po.status = po.balanceDue === 0 ? 'paid' : 'partial';
      await po.save({ session });

      const supplierDebt = Number(supplier.debtBalance || 0);
      if (supplierDebt + 0.000001 < payment.amount) {
        throw Object.assign(new Error('The supplier account balance is lower than this purchase order balance. Reconcile the supplier account before recording payment.'), { statusCode: 409 });
      }
      supplier.debtBalance = Math.max(0, roundMoney(supplierDebt - payment.amount));
      await supplier.save({ session });
      updatedOrder = po;
    });

    await log({
      user: req.user,
      action: 'SUPPLIER_PAYMENT',
      entity: 'PurchaseOrder',
      entityId: updatedOrder._id,
      details: {
        poNumber: updatedOrder.poNumber,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        reference: payment.reference
      },
      req
    });

    res.json({
      success: true,
      data: updatedOrder,
      message: 'Supplier payment recorded.'
    });
  } catch (error) {
    if (error.statusCode) return sendValidationError(res, error);
    next(error);
  } finally {
    await session.endSession();
  }
});

module.exports = router;
