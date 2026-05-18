// routes/products.js – v5 with strict role guards

const express       = require('express');
const router        = express.Router();
const Product       = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const { protect, authorize } = require('../middleware/auth');
const { log } = require('../utils/auditLogger');

// GET – all authenticated users (staff need product list for POS)
router.get('/', protect, async (req, res, next) => {
  try {
    const { search, category, lowStock, page = 1, limit = 500 } = req.query;
    const filter = { isDeleted: false };
    if (search) filter.$text = { $search: search };
    if (category && category !== 'all') filter.category = category;
    if (lowStock === 'true') filter.$expr = { $lte: ['$quantity', '$lowStockThreshold'] };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [products, total] = await Promise.all([
      Product.find(filter)
             .populate('supplier', 'name')
             .sort(search ? { score: { $meta: 'textScore' } } : { name: 1 })
             .skip(skip).limit(parseInt(limit)),
      Product.countDocuments(filter)
    ]);
    res.json({ success: true, data: products, total, page: parseInt(page) });
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
    const { name, sku, barcode, price, costPrice, quantity, category, description, size, color, lowStockThreshold, supplier } = req.body;
    const product = await Product.create({
      name, sku, barcode, price, costPrice: costPrice||0, quantity: quantity||0,
      category, description, size, color, lowStockThreshold: lowStockThreshold||5,
      supplier: supplier||undefined, createdBy: req.user._id
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
    const before = await Product.findOne({ _id: req.params.id, isDeleted: false });
    if (!before) return res.status(404).json({ success: false, message: 'Product not found.' });
    const { name, sku, barcode, price, costPrice, quantity, category, description, size, color, lowStockThreshold, supplier } = req.body;
    const qtyDiff = quantity !== undefined ? quantity - before.quantity : 0;
    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      { name, sku, barcode, price, costPrice, quantity, category, description, size, color, lowStockThreshold, supplier },
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
