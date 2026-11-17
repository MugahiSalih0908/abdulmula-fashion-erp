// routes/invoices.js – /api/invoices
// Uses MongoDB transactions for atomic stock + invoice creation

const express       = require('express');
const router        = express.Router();
const mongoose      = require('mongoose');
const Invoice       = require('../models/Invoice');
const Product       = require('../models/Product');
const Customer      = require('../models/Customer');
const StockMovement = require('../models/StockMovement');
const AuditLog      = require('../models/AuditLog');
const OfflineConflictDecision = require('../models/OfflineConflictDecision');
const { protect, authorize } = require('../middleware/auth');
const { log }       = require('../utils/auditLogger');
const invoiceCalculations = import('../../shared/invoiceCalculations.mjs');
const {
  assertApprovedPayloadMatchesOriginal,
  assertApprovedItemsMatch,
  assertAuthorizedDecisionRole,
  assertPayloadFingerprint,
  claimOfflineInvoice,
  createApproval,
  createPendingDecision,
  executeInvoiceOnce,
  findOfflineIdRecords,
  fingerprintOfflinePayload,
  normalizeOfflineId,
  payloadIdentityResponse,
  rejectDecision,
  runFinancialEffectsAtomically
} = require('../services/offlineConflictDecisionService');

/* ── POST /api/invoices ──────────────────────────────────────── */
// Creates invoice + reduces stock atomically via MongoDB transaction
router.post('/', protect, async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  let requestedOfflineId;
  let incomingFingerprint;

  try {
    const {
      buildInvoiceLine,
      assertExpectedUnitPrice,
      calculateInvoiceTotals,
      calculatePayment,
      customerPurchaseDeltas,
      shouldReverseCustomerPurchases,
      addCurrency,
      subtractCurrency
    } = await invoiceCalculations;
    const {
      items,           // [{ productId, quantity, unitPrice, discount }]
      paymentMethod,
      amountPaid,
      cashReceived,
      customerId,
      taxRate,
      note,
      offlineId: submittedOfflineId, // client UUID for deduplication of offline sales
      offlineOriginalPayload,
      offlineConflictApproval
    } = req.body;
    const offlineId = normalizeOfflineId(submittedOfflineId);
    requestedOfflineId = offlineId;
    if (offlineConflictApproval) {
      const originalOfflineId = normalizeOfflineId(offlineOriginalPayload?.offlineId, { required: true });
      if (originalOfflineId !== offlineId) {
        throw Object.assign(new Error('The original offline payload ID does not match this invoice.'), {
          statusCode: 409,
          code: 'OFFLINE_IDENTITY_CONFLICT'
        });
      }
      assertApprovedPayloadMatchesOriginal(offlineOriginalPayload, { ...req.body, offlineId });
      incomingFingerprint = fingerprintOfflinePayload({
        ...offlineOriginalPayload,
        offlineId
      });
    } else {
      incomingFingerprint = offlineId
        ? fingerprintOfflinePayload({ ...req.body, offlineId })
        : undefined;
    }

    const [existingInvoice] = offlineId
      ? await findOfflineIdRecords(Invoice, 'offlineId', offlineId, session)
      : [null];
    if (existingInvoice) {
      await session.abortTransaction();
      const { invoice } = payloadIdentityResponse(existingInvoice, incomingFingerprint);
      return res.status(200).json({ success: true, data: invoice, duplicate: true });
    }

    if (offlineId && (await findOfflineIdRecords(
      AuditLog,
      'entityId',
      offlineId,
      session,
      { action: 'OFFLINE_CONFLICT_REJECT' }
    )).length) {
      throw Object.assign(new Error('This offline sale was rejected and cannot be synced.'), { statusCode: 409 });
    }

    // ── Offline deduplication ──────────────────────────────────
    let approvedDecision = null;
    if (offlineId) {
      const [decision] = await findOfflineIdRecords(
        OfflineConflictDecision,
        'offlineId',
        offlineId,
        session
      );
      if (decision) assertPayloadFingerprint(decision.payloadFingerprint, incomingFingerprint);
      if (decision?.state === 'rejected') {
        throw Object.assign(new Error('This offline sale was rejected and cannot be synced.'), { statusCode: 409 });
      }
      if (decision?.state === 'consumed') {
        throw Object.assign(new Error('The offline price decision was already consumed without a matching invoice.'), { statusCode: 409 });
      }
      if (decision?.state === 'approved' && !offlineConflictApproval) {
        throw Object.assign(new Error('This offline sale requires its approved decision to be consumed.'), { statusCode: 409 });
      }
      if (offlineConflictApproval) {
        if (!decision || decision.state !== 'approved') {
          throw Object.assign(new Error('No approved offline price decision exists for this sale.'), { statusCode: 409 });
        }
        approvedDecision = decision;
      }
    } else if (offlineConflictApproval) {
      throw Object.assign(new Error('An offline ID is required for an approved price-conflict sale.'), { statusCode: 400 });
    }

    if (!Array.isArray(items) || !items.length) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'At least one item is required.' });
    }

    // ── Validate & build line items ────────────────────────────
    const method = paymentMethod || 'Cash';
    const lineItems = [];
    const priceOverrides = [];
    const approvalAuditItems = [];
    const conflictItems = [];
    const productsById = new Map();
    let hasPriceConflict = false;
    const requestedQuantities = new Map();

    for (const [itemIndex, item] of items.entries()) {
      if (!item || !mongoose.isValidObjectId(item.productId)) {
        throw Object.assign(new Error('A valid product identifier is required.'), { statusCode: 400 });
      }

      const product = await Product.findOne(
        { _id: item.productId, isDeleted: false },
        null,
        { session }
      );

      if (!product)
        throw Object.assign(new Error(`Product ${item.productId} not found.`), { statusCode: 404 });
      productsById.set(String(product._id), product);

      if (item.expectedUnitPrice !== undefined) {
        try {
          assertExpectedUnitPrice(item.expectedUnitPrice, product.price);
        } catch (err) {
          if (err.statusCode !== 409) throw err;
          hasPriceConflict = true;
        }
        const approvalItem = offlineConflictApproval?.items?.[itemIndex];
        conflictItems.push({
          productId: String(product._id),
          productName: product.name,
          quantity: item.quantity,
          offlineQuotedUnitPrice: approvalItem?.offlineQuotedUnitPrice ?? item.unitPrice ?? item.expectedUnitPrice,
          currentUnitPriceAtReview: approvalItem?.currentUnitPriceAtReview ?? item.expectedUnitPrice,
          currentUnitPriceAtConflict: product.price
        });
      }

      const productId = String(product._id);
      const previouslyRequested = requestedQuantities.get(productId) || 0;
      const lineInput = hasPriceConflict && !approvedDecision && offlineId
        ? { ...item, unitPrice: undefined }
        : item;
      const calculatedLine = buildInvoiceLine(
        lineInput,
        product,
        approvedDecision ? 'manager' : req.user.role,
        previouslyRequested
      );
      requestedQuantities.set(productId, previouslyRequested + calculatedLine.quantity);
      lineItems.push({
        product:     product._id,
        productName: product.name,
        sku:         product.sku,
        quantity:    calculatedLine.quantity,
        unitPrice:   calculatedLine.unitPrice,
        discount:    calculatedLine.discount,
        lineTotal:   calculatedLine.lineTotal
      });

      if (calculatedLine.hasOverride) {
        priceOverrides.push({
          productId,
          productName: product.name,
          catalogPrice: product.price,
          unitPrice: calculatedLine.unitPrice
        });
      }

      if (approvedDecision) {
        approvalAuditItems.push({
          productId,
          productName: product.name,
          quantity: calculatedLine.quantity,
          offlineQuotedUnitPrice: approvedDecision.items[itemIndex].offlineQuotedUnitPrice,
          offlineQuotedUnitPriceSource: 'client-reported; unverified',
          currentUnitPriceAtReview: approvedDecision.items[itemIndex].reviewedUnitPrice,
          currentUnitPriceAtReviewSource: 'server catalog value at manager approval',
          currentUnitPriceAtApproval: product.price,
          currentUnitPriceAtApprovalSource: 'server catalog value at invoice creation'
        });
      }
    }

    if (hasPriceConflict) {
      if (approvedDecision) {
        throw Object.assign(
          new Error('Product prices changed again since this sale was reviewed. Refresh the conflict details before deciding.'),
          { statusCode: 409, conflictDetails: { items: conflictItems } }
        );
      }
      if (!offlineId) {
        throw Object.assign(new Error('An offline ID is required for price-conflict review.'), { statusCode: 400 });
      }
      const { decision } = await createPendingDecision({
        Decision: OfflineConflictDecision,
        session,
        pending: {
          offlineId,
          payloadFingerprint: incomingFingerprint,
          clientReportedOfflineAt: req.body.offlineCreatedAt || req.body.createdAt || null,
          clientReportedOfflineAtSource: 'client-reported; unverified',
          items: conflictItems.map(item => ({
            product: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            offlineQuotedUnitPrice: item.offlineQuotedUnitPrice,
            reviewedUnitPrice: item.currentUnitPriceAtConflict,
            clientReportedConflictPrice: item.currentUnitPriceAtConflict,
            clientReportedConflictPriceSource: 'server-observed catalog value at conflict detection'
          }))
        }
      });
      await session.commitTransaction();
      return res.status(409).json({
        success: false,
        message: decision.state === 'approved'
          ? 'The approved sale must be retried with its original payload.'
          : 'Manager approval is required for this offline price conflict.',
        code: 'OFFLINE_PRICE_CONFLICT',
        conflictDetails: { items: conflictItems }
      });
    }
    if (approvedDecision) {
      assertApprovedItemsMatch(approvedDecision.items, items, productsById);
    }

    const { subtotal, discountTotal, taxAmount, taxRate: validatedTaxRate, grandTotal } =
      calculateInvoiceTotals(lineItems, taxRate);
    const { paid, balanceDue, paymentStatus } =
      calculatePayment(grandTotal, method, amountPaid, cashReceived);

    // ── Resolve customer ───────────────────────────────────────
    let customerName;
    let customerPurchaseRecorded = false;
    let customer;
    if (customerId) {
      if (!mongoose.isValidObjectId(customerId)) {
        throw Object.assign(new Error('A valid customer identifier is required.'), { statusCode: 400 });
      }
      customer = await Customer.findOne({ _id: customerId, isDeleted: false }).session(session);
      if (!customer) throw Object.assign(new Error('Customer not found.'), { statusCode: 404 });
      customerName = customer.name;
      customerPurchaseRecorded = true;
      const deltas = customerPurchaseDeltas(grandTotal, balanceDue);
      customer.creditBalance = addCurrency(customer.creditBalance || 0, deltas.creditBalance);
      customer.totalPurchases = addCurrency(customer.totalPurchases || 0, deltas.totalPurchases);
    }

    const invoiceId = new mongoose.Types.ObjectId();
    const result = await runFinancialEffectsAtomically({
      session,
      operation: () => executeInvoiceOnce({
        findExistingInvoice: () => offlineId
          ? findOfflineIdRecords(Invoice, 'offlineId', offlineId, session).then(([invoice]) => invoice || null)
          : Promise.resolve(null),
        incomingFingerprint,
        consumeApproval: offlineId
          ? () => claimOfflineInvoice({
            Decision: OfflineConflictDecision,
            offlineId,
            fingerprint: incomingFingerprint,
            invoiceId,
            user: req.user,
            approved: Boolean(approvedDecision),
            session
          })
          : null,
        createFinancialEffects: async () => {
        if (customer) await customer.save({ session });

        const [createdInvoice] = await Invoice.create([{
          _id: invoiceId,
          items:         lineItems,
          subtotal,
          discountTotal,
          taxRate:       validatedTaxRate,
          taxAmount,
          grandTotal,
          amountPaid:    paid,
          balanceDue,
          paymentMethod: method,
          paymentStatus,
          customer:      customerId || undefined,
          customerName,
          customerPurchaseRecorded: customerPurchaseRecorded || undefined,
          note,
          offlineId:     offlineId || undefined,
          offlinePayloadFingerprint: incomingFingerprint,
          soldBy:        req.user._id,
          soldByName:    req.user.name
        }], { session });

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
            reference:   createdInvoice.invoiceNumber,
            note:        `Sale – ${createdInvoice.invoiceNumber}`,
            performedBy: req.user._id
          }], { session });
        }

        await AuditLog.create([{
          user: req.user._id,
          userName: req.user.name,
          action: 'INVOICE_CREATE',
          entity: 'Invoice',
          entityId: createdInvoice._id.toString(),
          details: {
            invoiceNumber: createdInvoice.invoiceNumber,
            grandTotal,
            ...(approvedDecision ? {
              offlineConflictDecision: 'approve',
              offlineId,
              approvedOfflineConflictItems: approvalAuditItems
            } : {}),
            ...(priceOverrides.length ? { priceOverrides } : {})
          },
          ip: req.ip || req.headers?.['x-forwarded-for'],
          userAgent: req.headers?.['user-agent']
        }], { session });

        return createdInvoice;
        }
      })
    });

    if (result.duplicate) {
      await session.abortTransaction();
      return res.status(200).json({ success: true, data: result.invoice, duplicate: true });
    }

    await session.commitTransaction();

    res.status(201).json({ success: true, data: result.invoice });

  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    if (
      requestedOfflineId &&
      err.code === 11000 &&
      (err.keyPattern?.offlineId || String(err.message).includes('offlineId'))
    ) {
      try {
        const [existing] = await findOfflineIdRecords(Invoice, 'offlineId', requestedOfflineId);
        if (existing) {
          payloadIdentityResponse(existing, incomingFingerprint);
          return res.status(200).json({ success: true, data: existing, duplicate: true });
        }
      } catch (lookupError) {
        return next(lookupError);
      }
    }
    if (requestedOfflineId && err.code === 11000 && err.keyPattern?.offlineId) {
      return res.status(409).json({
        success: false,
        message: 'A decision for this offline sale was recorded concurrently. Refresh the sale before retrying.'
      });
    }
    if (requestedOfflineId && (err.code === 112 || err.hasErrorLabel?.('TransientTransactionError'))) {
      try {
        const [existing] = await findOfflineIdRecords(Invoice, 'offlineId', requestedOfflineId);
        if (existing) {
          payloadIdentityResponse(existing, incomingFingerprint);
          return res.status(200).json({ success: true, data: existing, duplicate: true });
        }
      } catch (lookupError) {
        return next(lookupError);
      }
      return res.status(409).json({
        success: false,
        message: 'The offline sale decision changed concurrently. Refresh the sale before retrying.'
      });
    }
    next(err);
  } finally {
    session.endSession();
  }
});

/* ── POST /api/invoices/offline-conflicts/approve ────────────── */
router.post('/offline-conflicts/approve', protect, authorize('admin', 'manager'), async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    assertAuthorizedDecisionRole(req.user.role);
    const { assertExpectedUnitPrice } = await invoiceCalculations;
    const { clientReportedOfflineAt, items, sale } = req.body;
    const offlineId = normalizeOfflineId(req.body.offlineId, { required: true });
    if (
      typeof clientReportedOfflineAt !== 'string' ||
      clientReportedOfflineAt.length > 100 ||
      Number.isNaN(Date.parse(clientReportedOfflineAt)) ||
      !sale || normalizeOfflineId(sale.offlineId, { required: true }) !== offlineId ||
      !Array.isArray(items) || !items.length ||
      items.some(item =>
        !mongoose.isValidObjectId(item?.productId) ||
        !Number.isFinite(item?.quantity) || item.quantity <= 0 ||
        !Number.isFinite(item?.offlineQuotedUnitPrice) || item.offlineQuotedUnitPrice < 0 ||
        !Number.isFinite(item?.currentUnitPriceAtConflict) || item.currentUnitPriceAtConflict < 0
      )
    ) {
      throw Object.assign(new Error('The offline price approval details are invalid.'), { statusCode: 400 });
    }
    const normalizedSale = { ...sale, offlineId };
    const payloadFingerprint = fingerprintOfflinePayload(normalizedSale);

    if ((await findOfflineIdRecords(Invoice, 'offlineId', offlineId, session)).length) {
      throw Object.assign(new Error('This offline sale has already been invoiced.'), { statusCode: 409 });
    }
    if ((await findOfflineIdRecords(
      AuditLog,
      'entityId',
      offlineId,
      session,
      { action: 'OFFLINE_CONFLICT_REJECT' }
    )).length) {
      throw Object.assign(new Error('This offline sale was already rejected.'), { statusCode: 409 });
    }

    const products = await Product.find({
      _id: { $in: items.map(item => item.productId) },
      isDeleted: false
    }).select('_id name price').session(session);
    const productsById = new Map(products.map(product => [String(product._id), product]));
    const decisionItems = items.map(item => {
      const product = productsById.get(String(item.productId));
      if (!product) {
        throw Object.assign(new Error(`Product ${item.productId} is unavailable.`), { statusCode: 404 });
      }
      try {
        assertExpectedUnitPrice(item.currentUnitPriceAtConflict, product.price);
      } catch (err) {
        if (err.statusCode !== 409) throw err;
        throw Object.assign(err, {
          conflictDetails: {
            items: items.map((conflictItem) => {
              const current = productsById.get(String(conflictItem.productId));
              return {
                productId: String(conflictItem.productId),
                productName: current?.name || conflictItem.productName,
                quantity: conflictItem.quantity,
                offlineQuotedUnitPrice: conflictItem.offlineQuotedUnitPrice,
                currentUnitPriceAtConflict: current?.price
              };
            })
          }
        });
      }
      return {
        product: product._id,
        productName: product.name,
        quantity: item.quantity,
        offlineQuotedUnitPrice: item.offlineQuotedUnitPrice,
        reviewedUnitPrice: product.price,
        clientReportedConflictPrice: item.currentUnitPriceAtConflict,
        clientReportedConflictPriceSource: 'client-reported prior server response; unverified'
      };
    });
    if (
      !Array.isArray(sale.items) ||
      sale.items.length !== decisionItems.length ||
      sale.items.some((saleItem, index) => {
        const approvedItem = decisionItems[index];
        const quotedPrice = saleItem.unitPrice ?? saleItem.expectedUnitPrice;
        return (
          String(saleItem.productId ?? saleItem.product).toLowerCase() !== String(approvedItem.product).toLowerCase() ||
          saleItem.quantity !== approvedItem.quantity ||
          quotedPrice !== approvedItem.offlineQuotedUnitPrice
        );
      })
    ) {
      throw Object.assign(new Error('The price review does not match the original offline sale.'), {
        statusCode: 409,
        code: 'OFFLINE_IDENTITY_CONFLICT'
      });
    }

    const approvedAt = new Date();
    const result = await createApproval({
      Decision: OfflineConflictDecision,
      session,
      approval: {
        offlineId,
        payloadFingerprint,
        approvedBy: req.user._id,
        approvedByName: req.user.name,
        approvedAt,
        items: decisionItems,
        clientReportedOfflineAt,
        clientReportedOfflineAtSource: 'client-reported; unverified'
      }
    });

    if (result.changed) {
      await AuditLog.create([{
        user: req.user._id,
        userName: req.user.name,
        action: 'OFFLINE_CONFLICT_APPROVE',
        entity: 'OfflineSale',
        entityId: offlineId,
        details: {
          decision: 'approve',
          payloadFingerprint,
          decisionAt: approvedAt,
          actorRole: req.user.role,
          offlineId,
          clientReportedOfflineAt: {
            value: clientReportedOfflineAt,
            source: 'client-reported; unverified'
          },
          items: decisionItems
        },
        ip: req.ip || req.headers?.['x-forwarded-for'],
        userAgent: req.headers?.['user-agent']
      }], { session });
    }

    await session.commitTransaction();
    res.status(result.created ? 201 : 200).json({
      success: true,
      data: {
        offlineId,
        decision: 'approve',
        decisionAt: result.decision.approvedAt,
        decidedBy: result.decision.approvedByName,
        items: result.decision.items
      }
    });
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    if (err.code === 11000 || err.code === 112 || err.hasErrorLabel?.('TransientTransactionError')) {
      return res.status(409).json({ success: false, message: 'Another decision was recorded concurrently. Refresh the sale before retrying.' });
    }
    next(err);
  } finally {
    session.endSession();
  }
});

/* ── POST /api/invoices/offline-conflicts/reject ─────────────── */
router.post('/offline-conflicts/reject', protect, authorize('admin', 'manager'), async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    assertAuthorizedDecisionRole(req.user.role);
    const { clientReportedOfflineAt, items, reason, sale } = req.body;
    const offlineId = normalizeOfflineId(req.body.offlineId, { required: true });
    if (
      typeof clientReportedOfflineAt !== 'string' ||
      clientReportedOfflineAt.length > 100 ||
      Number.isNaN(Date.parse(clientReportedOfflineAt)) ||
      !sale || normalizeOfflineId(sale.offlineId, { required: true }) !== offlineId ||
      !Array.isArray(items) || !items.length ||
      items.some(item =>
        !mongoose.isValidObjectId(item?.productId) ||
        !Number.isFinite(item?.quantity) || item.quantity <= 0 ||
        !Number.isFinite(item?.offlineQuotedUnitPrice) || item.offlineQuotedUnitPrice < 0
      )
    ) {
      throw Object.assign(new Error('The offline conflict rejection details are invalid.'), { statusCode: 400 });
    }
    const normalizedSale = { ...sale, offlineId };
    const payloadFingerprint = fingerprintOfflinePayload(normalizedSale);

    if ((await findOfflineIdRecords(Invoice, 'offlineId', offlineId, session)).length) {
      throw Object.assign(new Error('This offline sale has already been synced and cannot be rejected.'), { statusCode: 409 });
    }

    const products = await Product.find({
      _id: { $in: items.map(item => item.productId) }
    }).select('_id name price').session(session);
    const productsById = new Map(products.map(product => [String(product._id), product]));
    const decisionAt = new Date();
    const rejectionItems = items.map(item => {
      const product = productsById.get(String(item.productId));
      return {
        product: item.productId,
        productName: product?.name || item.productName || 'Unknown product',
        quantity: item.quantity,
        offlineQuotedUnitPrice: item.offlineQuotedUnitPrice,
        ...(product ? { reviewedUnitPrice: product.price } : {}),
        ...(Number.isFinite(item.currentUnitPriceAtConflict)
          ? {
            clientReportedConflictPrice: item.currentUnitPriceAtConflict,
            clientReportedConflictPriceSource: 'client-reported prior server response; unverified'
          }
          : {})
      };
    });
    const rejection = {
      rejectedBy: req.user._id,
      rejectedByName: req.user.name,
      rejectedAt: decisionAt,
      items: rejectionItems,
      clientReportedOfflineAt,
      clientReportedOfflineAtSource: 'client-reported; unverified'
    };
    const result = await rejectDecision({
      Decision: OfflineConflictDecision,
      offlineId,
      fingerprint: payloadFingerprint,
      rejection,
      session
    });

    if (result.changed) {
      await AuditLog.create([{
        user: req.user._id,
        userName: req.user.name,
        action: 'OFFLINE_CONFLICT_REJECT',
        entity: 'OfflineSale',
        entityId: offlineId,
        details: {
          decision: 'reject',
          payloadFingerprint,
          decisionAt,
          actorRole: req.user.role,
          offlineId,
          reason: typeof reason === 'string' ? reason.slice(0, 300) : 'Rejected by manager.',
          clientReportedOfflineAt: {
            value: clientReportedOfflineAt,
            source: 'client-reported; unverified'
          },
          items: rejectionItems
        },
        ip: req.ip || req.headers?.['x-forwarded-for'],
        userAgent: req.headers?.['user-agent']
      }], { session });
    }

    await session.commitTransaction();
    res.status(result.changed ? 201 : 200).json({
      success: true,
      data: {
        decision: 'reject',
        decisionAt: result.decision.rejectedAt,
        decidedBy: result.decision.rejectedByName,
        offlineId
      }
    });
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    if (err.code === 11000 || err.code === 112 || err.hasErrorLabel?.('TransientTransactionError')) {
      return res.status(409).json({ success: false, message: 'The offline decision changed concurrently. Refresh and retry.' });
    }
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
    const { shouldReverseCustomerPurchases, subtractCurrency } = await invoiceCalculations;
    const invoice = await Invoice.findById(req.params.id).session(session);
    if (!invoice) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    if (invoice.customer && invoice.balanceDue > 0) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: 'Invoices with an outstanding balance cannot be deleted because customer repayments are not allocated per invoice.'
      });
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

    if (invoice.customer && shouldReverseCustomerPurchases(invoice)) {
      const customer = await Customer.findById(invoice.customer).session(session);
      if (customer) {
        customer.totalPurchases = subtractCurrency(customer.totalPurchases || 0, invoice.grandTotal);
        await customer.save({ session });
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
