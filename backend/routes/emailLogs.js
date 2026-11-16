const express = require('express');
const crypto = require('crypto');
const EmailLog = require('../models/EmailLog');
const { protect, authorize } = require('../middleware/auth');
const { getEmailConfig } = require('../utils/emailConfig');
const { sendEmail, templates } = require('../utils/sendEmail');

const router = express.Router();
router.use(protect, authorize('admin'));

const VALID_STATUSES = ['queued', 'sending', 'sent', 'delivered', 'delivery_delayed', 'bounced', 'complained', 'failed', 'unknown'];
const VALID_CATEGORIES = ['staff_activation', 'staff_invitation', 'password_reset', 'password_changed', 'security_alert', 'business_notification', 'system'];

router.post('/test', async (req, res, next) => {
  try {
    const config = getEmailConfig();
    if (config.mode === 'disabled') {
      return res.status(403).json({ success: false, message: 'Email delivery is disabled.' });
    }
    if (!req.user.email) {
      return res.status(400).json({ success: false, message: 'The signed-in administrator has no email address.' });
    }

    const result = await sendEmail({
      to: req.user.email,
      ...templates.test({ name: req.user.name }),
      category: 'system',
      idempotencyKey: `admin-email-test:${req.user._id}:${crypto.randomUUID()}`,
      createdBy: req.user._id,
      relatedEntity: 'User',
      relatedEntityId: req.user._id
    });

    return res.status(202).json({
      success: true,
      message: 'Test email accepted by the configured provider.',
      data: { status: result.status, id: result.id }
    });
  } catch (error) {
    next(error);
  }
});

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
    res.json({ success: true, data: records, total, page, limit, summary, emailConfig: getEmailConfig() });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
