const express = require('express');
const EmailLog = require('../models/EmailLog');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect, authorize('admin'));

const VALID_STATUSES = ['queued', 'sending', 'sent', 'delivered', 'delivery_delayed', 'bounced', 'complained', 'failed', 'unknown'];
const VALID_CATEGORIES = ['staff_activation', 'staff_invitation', 'password_reset', 'password_changed', 'security_alert', 'business_notification', 'system'];

router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const filter = {};
    if (VALID_STATUSES.includes(req.query.status)) filter.status = req.query.status;
    if (VALID_CATEGORIES.includes(req.query.category)) filter.category = req.query.category;

    const search = String(req.query.search || '').trim().slice(0, 120);
    if (search) {
      const escaped = search.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
      filter.recipient = { $regex: escaped, $options: 'i' };
    }

    const [records, total, grouped] = await Promise.all([
      EmailLog.find(filter).select('-idempotencyKey -__v').sort({ createdAt: -1 })
        .skip((page - 1) * limit).limit(limit).populate('createdBy', 'name email'),
      EmailLog.countDocuments(filter),
      EmailLog.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
    ]);

    const summary = Object.fromEntries(VALID_STATUSES.map(status => [status, 0]));
    grouped.forEach(item => { summary[item._id] = item.count; });
    res.json({ success: true, data: records, total, page, limit, summary });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
