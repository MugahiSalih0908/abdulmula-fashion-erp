// routes/reports.js – v5 admin + manager only

const express  = require('express');
const router   = express.Router();
const Invoice  = require('../models/Invoice');
const Product  = require('../models/Product');
const Expense  = require('../models/Expense');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin','manager'));

router.get('/summary', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : (() => { const d=new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();
    const end   = endDate   ? (() => { const d=new Date(endDate); d.setHours(23,59,59,999); return d; })() : new Date();
    const dateFilter = { date: { $gte: start, $lte: end } };
    const [salesAgg, expAgg, byPayment, topProducts, creditCustomers, supplierDebt] = await Promise.all([
      Invoice.aggregate([{ $match: dateFilter }, { $group: { _id:null, revenue:{ $sum:'$grandTotal' }, count:{ $sum:1 }, discount:{ $sum:'$discountTotal' } } }]),
      Expense.aggregate([{ $match: dateFilter }, { $group: { _id:null, total:{ $sum:'$amount' } } }]),
      Invoice.aggregate([{ $match: dateFilter }, { $group: { _id:'$paymentMethod', total:{ $sum:'$grandTotal' }, count:{ $sum:1 } } }]),
      Invoice.aggregate([{ $match: dateFilter }, { $unwind:'$items' }, { $group: { _id:'$items.product', name:{ $first:'$items.productName' }, qty:{ $sum:'$items.quantity' }, revenue:{ $sum:'$items.lineTotal' } } }, { $sort:{ qty:-1 } }, { $limit:10 }]),
      Customer.aggregate([{ $group: { _id:null, total:{ $sum:'$creditBalance' } } }]),
      Supplier.aggregate([{ $group: { _id:null, total:{ $sum:'$debtBalance' } } }])
    ]);
    const revenue  = salesAgg[0]?.revenue || 0;
    const expenses = expAgg[0]?.total     || 0;
    res.json({ success:true, data: { period:{ start, end }, revenue, expenses, profit: revenue-expenses, salesCount: salesAgg[0]?.count||0, totalDiscount: salesAgg[0]?.discount||0, byPayment, topProducts, totalCreditOwed: creditCustomers[0]?.total||0, totalSupplierDebt: supplierDebt[0]?.total||0 } });
  } catch (err) { next(err); }
});

router.get('/daily', async (req, res, next) => {
  try {
    const since = new Date(); since.setDate(since.getDate()-29); since.setHours(0,0,0,0);
    const [salesByDay, expByDay] = await Promise.all([
      Invoice.aggregate([{ $match:{ date:{ $gte:since } } }, { $group:{ _id:{ $dateToString:{ format:'%Y-%m-%d', date:'$date' } }, revenue:{ $sum:'$grandTotal' }, count:{ $sum:1 } } }, { $sort:{ _id:1 } }]),
      Expense.aggregate([{ $match:{ date:{ $gte:since } } }, { $group:{ _id:{ $dateToString:{ format:'%Y-%m-%d', date:'$date' } }, total:{ $sum:'$amount' } } }, { $sort:{ _id:1 } }])
    ]);
    res.json({ success:true, data:{ salesByDay, expByDay } });
  } catch (err) { next(err); }
});

router.get('/monthly', async (req, res, next) => {
  try {
    const since = new Date(); since.setMonth(since.getMonth()-11); since.setDate(1); since.setHours(0,0,0,0);
    const monthly = await Invoice.aggregate([{ $match:{ date:{ $gte:since } } }, { $group:{ _id:{ year:{ $year:'$date' }, month:{ $month:'$date' } }, revenue:{ $sum:'$grandTotal' }, count:{ $sum:1 } } }, { $sort:{ '_id.year':1, '_id.month':1 } }]);
    res.json({ success:true, data: monthly });
  } catch (err) { next(err); }
});

router.get('/staff-performance', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = {};
    if (startDate||endDate) { filter.date={}; if (startDate) filter.date.$gte=new Date(startDate); if (endDate) { const e=new Date(endDate); e.setHours(23,59,59,999); filter.date.$lte=e; } }
    const perf = await Invoice.aggregate([{ $match:filter }, { $group:{ _id:'$soldBy', name:{ $first:'$soldByName' }, revenue:{ $sum:'$grandTotal' }, count:{ $sum:1 }, avgSale:{ $avg:'$grandTotal' } } }, { $sort:{ revenue:-1 } }]);
    res.json({ success:true, data: perf });
  } catch (err) { next(err); }
});

router.get('/inventory', async (req, res, next) => {
  try {
    const [total, lowStock, deadStock, valueAgg] = await Promise.all([
      Product.countDocuments({ isDeleted:false }),
      Product.find({ isDeleted:false, $expr:{ $lte:['$quantity','$lowStockThreshold'] } }).sort({ quantity:1 }).limit(20),
      Product.find({ isDeleted:false, quantity:0 }).sort({ updatedAt:1 }).limit(20),
      Product.aggregate([{ $match:{ isDeleted:false } }, { $group:{ _id:null, atCost:{ $sum:{ $multiply:['$costPrice','$quantity'] } }, atRetail:{ $sum:{ $multiply:['$price','$quantity'] } } } }])
    ]);
    res.json({ success:true, data:{ totalProducts:total, lowStock, deadStock, inventoryValue:{ atCost: valueAgg[0]?.atCost||0, atRetail: valueAgg[0]?.atRetail||0 } } });
  } catch (err) { next(err); }
});

router.get('/categories', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = {};
    if (startDate||endDate) { filter.date={}; if (startDate) filter.date.$gte=new Date(startDate); if (endDate) { const e=new Date(endDate); e.setHours(23,59,59,999); filter.date.$lte=e; } }
    const cats = await Invoice.aggregate([{ $match:filter }, { $unwind:'$items' }, { $lookup:{ from:'products', localField:'items.product', foreignField:'_id', as:'prod' } }, { $unwind:{ path:'$prod', preserveNullAndEmptyArrays:true } }, { $group:{ _id:'$prod.category', revenue:{ $sum:'$items.lineTotal' }, qty:{ $sum:'$items.quantity' } } }, { $sort:{ revenue:-1 } }]);
    res.json({ success:true, data: cats });
  } catch (err) { next(err); }
});

module.exports = router;
