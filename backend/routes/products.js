// routes/products.js – v5 with strict role guards

const express       = require('express');
const router        = express.Router();
const Product       = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const { protect, authorize } = require('../middleware/auth');
const { log } = require('../utils/auditLogger');
const { validateProductPayload } = require('../utils/productValidation');

// GET – all authenticated users (staff need product list for POS)
router.get('/', protect, async (req, res, next) => {
  try {
    const { search, category, lowStock, outOfStock, healthyStock, page = 1, limit = 500 } = req.query;
    const filter = { isDeleted: false };
    if (search) filter.$text = { $search: search };
    if (category && category !== 'all' && category !== 'All') filter.category = category;
    if (outOfStock === 'true') filter.quantity = 0;
    if (lowStock === 'true') {
      filter.$expr = { $and: [{ $gt: ['$quantity', 0] }, { $lte: ['$quantity', '$lowStockThreshold'] }] };
    }
    if (healthyStock === 'true') {
      filter.$expr = { $and: [{ $gt: ['$quantity', 0] }, { $gt: ['$quantity', '$lowStockThreshold'] }] };
    }

    // The management catalogue sends an explicit page parameter.
    // Preserve the legacy full-list contract used by POS callers without "page".
    const paginationRequested = Object.prototype.hasOwnProperty.call(req.query, 'page');
    const parsedPage = Number.parseInt(page, 10);
    const parsedLimit = Number.parseInt(limit, 10);
    const pageNumber = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const pageSize = Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 500)
      : 500;
    const skip = (pageNumber - 1) * pageSize;

    const findQuery = Product.find(filter)
      .sort(search ? { score: { $meta: 'textScore' } } : { name: 1, _id: 1 })
      .skip(skip)
      .limit(pageSize);

    if (paginationRequested) {
      findQuery.select('name sku barcode price costPrice quantity category description size color imageUrl lowStockThreshold supplier');
    } else {
      findQuery.populate('supplier', 'name');
    }

    const [products, total, summaryRows] = await Promise.all([
      findQuery,
      Product.countDocuments(filter),
      paginationRequested
        ? Product.aggregate([
            { $match: { isDeleted: false } },
            {
              $group: {
                _id: null,
                productCount: { $sum: 1 },
                unitsOnHand: { $sum: { $ifNull: ['$quantity', 0] } },
                lowStockCount: {
                  $sum: {
                    $cond: [
                      { $and: [
                        { $gt: [{ $ifNull: ['$quantity', 0] }, 0] },
                        { $lte: ['$quantity', { $ifNull: ['$lowStockThreshold', 0] }] }
                      ] },
                      1,
                      0
                    ]
                  }
                },
                outOfStockCount: {
                  $sum: { $cond: [{ $eq: [{ $ifNull: ['$quantity', 0] }, 0] }, 1, 0] }
                },
                inventoryCostValue: {
                  $sum: {
                    $multiply: [
                      { $ifNull: ['$costPrice', 0] },
                      { $ifNull: ['$quantity', 0] }
                    ]
                  }
                }
              }
            }
          ])
        : Promise.resolve([])
    ]);

    const summary = summaryRows[0] || null;
    res.json({
      success: true,
      data: products,
      total,
      page: pageNumber,
      limit: pageSize,
      ...(paginationRequested && {
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        summary: summary || {
          productCount: 0,
          unitsOnHand: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
          inventoryCostValue: 0
        }
      })
    });
  } catch (err) { next(err); }
});

router.get('/barcode/:barcode', protect, async (req, res, next) => {
  try {
    const product = await Product.findOne({ barcode: req.params.barcode, isDeleted: false });
    if (!product) return res.status(404).json({ success: false, message: 'No product found for this barcode.' });
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
});

router.get('/:id', protect, async (req, res, next) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, isDeleted: false }).populate('supplier','name phone');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
});

// POST/PUT/DELETE – admin + manager only
router.post('/', protect, authorize('admin','manager'), async (req, res, next) => {
  try {
    const validationError = validateProductPayload(req.body);
    if (validationError) return res.status(400).json({ success: false, message: validationError.message, field: validationError.field });
    const { name, sku, barcode, price, costPrice, quantity, category, description, size, color, lowStockThreshold, supplier, imageUrl } = req.body;
    const product = await Product.create({
      name, sku, barcode, price, costPrice: costPrice ?? 0, quantity: quantity ?? 0,
      category, description, size, color, imageUrl, lowStockThreshold: lowStockThreshold ?? 5,
      supplier: supplier || undefined, createdBy: req.user._id
    });
    if (quantity > 0) {
      await StockMovement.create({ product: product._id, type:'opening', quantity, before:0, after:quantity, note:'Opening stock', performedBy: req.user._id });
    }
    await log({ user: req.user, action:'PRODUCT_CREATE', entity:'Product', entityId: product._id, details:{ name }, req });
    res.status(201).json({ success: true, data: product });
  } catch (err) { next(err); }
});

router.put('/:id', protect, authorize('admin','manager'), async (req, res, next) => {
  try {
    const validationError = validateProductPayload(req.body, { partial: true });
    if (validationError) return res.status(400).json({ success: false, message: validationError.message, field: validationError.field });
    const before = await Product.findOne({ _id: req.params.id, isDeleted: false });
    if (!before) return res.status(404).json({ success: false, message: 'Product not found.' });
    const { name, sku, barcode, price, costPrice, quantity, category, description, size, color, lowStockThreshold, supplier, imageUrl } = req.body;
    const qtyDiff = quantity !== undefined ? Number(quantity) - before.quantity : 0;
    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      { name, sku, barcode, price, costPrice, quantity, category, description, size, color, imageUrl, lowStockThreshold, supplier },
      { new:true, runValidators:true }
    );
    if (qtyDiff !== 0) {
      await StockMovement.create({ product: updated._id, type:'adjustment', quantity: qtyDiff, before: before.quantity, after: updated.quantity, note:'Manual adjustment', performedBy: req.user._id });
    }
    await log({ user: req.user, action:'PRODUCT_UPDATE', entity:'Product', entityId: updated._id, details:{ before: before.toObject(), after: updated.toObject() }, req });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

router.delete('/:id', protect, authorize('admin','manager'), async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { isDeleted:true }, { new:true });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    await log({ user: req.user, action:'PRODUCT_DELETE', entity:'Product', entityId: product._id, details:{ name: product.name }, req });
    res.json({ success: true, message: `"${product.name}" removed from inventory.` });
  } catch (err) { next(err); }
});

router.get('/:id/movements', protect, authorize('admin','manager'), async (req, res, next) => {
  try {
    const movements = await StockMovement.find({ product: req.params.id })
                                         .populate('performedBy','name')
                                         .sort({ createdAt: -1 })
                                         .limit(50);
    res.json({ success: true, data: movements });
  } catch (err) { next(err); }
});

module.exports = router;
