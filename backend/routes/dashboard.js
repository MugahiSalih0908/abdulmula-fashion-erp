// routes/dashboard.js – v5  protect only (all roles see dashboard)

const express  = require('express');
const router   = express.Router();
const Product  = require('../models/Product');
const Invoice  = require('../models/Invoice');
const Expense  = require('../models/Expense');
const Customer = require('../models/Customer');
const { protect } = require('../middleware/auth');

router.get('/', protect, async (req, res, next) => {
  try {
    const today      = new Date(); today.setHours(0,0,0,0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const isManager  = ['admin','manager'].includes(req.user.role);

    // Base queries all roles see
    const baseQueries = [
      Product.countDocuments({ isDeleted:false }),
      Invoice.aggregate([{ $group:{ _id:null, total:{ $sum:'$grandTotal' }, count:{ $sum:1 } } }]),
      Invoice.aggregate([{ $match:{ date:{ $gte:today } } }, { $group:{ _id:null, total:{ $sum:'$grandTotal' }, count:{ $sum:1 } } }]),
      Invoice.find().sort({ date:-1 }).limit(5).populate('customer','name'),
      Product.find({ isDeleted:false, $expr:{ $lte:['$quantity','$lowStockThreshold'] } }).limit(8),
      Invoice.aggregate([{ $match:{ date:{ $gte: new Date(Date.now()-180*24*60*60*1000) } } }, { $group:{ _id:{ year:{ $year:'$date' }, month:{ $month:'$date' } }, revenue:{ $sum:'$grandTotal' }, count:{ $sum:1 } } }, { $sort:{ '_id.year':1, '_id.month':1 } }])
    ];

    // Manager/Admin additional queries
    const managerQueries = isManager ? [
      Invoice.aggregate([{ $match:{ date:{ $gte:monthStart } } }, { $group:{ _id:null, total:{ $sum:'$grandTotal' } } }]),
      Expense.aggregate([{ $group:{ _id:null, total:{ $sum:'$amount' } } }]),
      Expense.find().sort({ date:-1 }).limit(5),
      Customer.countDocuments({ creditBalance:{ $gt:0 }, isDeleted:false })
    ] : [Promise.resolve([]), Promise.resolve([]), Promise.resolve([]), Promise.resolve(0)];

    const [totalProducts, salesAgg, todaySalesAgg, recentInvoices, lowStock, monthlyRevenue,
           monthSalesAgg, expensesAgg, recentExpenses, creditCustomers] = await Promise.all([...baseQueries, ...managerQueries]);

    const totalRevenue  = salesAgg[0]?.total   || 0;
    const totalExpenses = expensesAgg[0]?.total || 0;

    res.json({
      success:true,
      data: {
        stats: {
          totalProducts,
          totalRevenue,
          totalSalesCount: salesAgg[0]?.count    || 0,
          todayRevenue:    todaySalesAgg[0]?.total || 0,
          todayCount:      todaySalesAgg[0]?.count || 0,
          monthRevenue:    monthSalesAgg[0]?.total || 0,
          totalExpenses,
          profit:          totalRevenue - totalExpenses,
          creditCustomers: typeof creditCustomers === 'number' ? creditCustomers : 0
        },
        recentInvoices,
        recentExpenses: Array.isArray(recentExpenses) ? recentExpenses : [],
        lowStock,
        monthlyRevenue
      }
    });
  } catch (err) { next(err); }
});

module.exports = router;
