// routes/staff.js – v6  admin creates users, sends welcome email automatically

const express   = require('express');
const router    = express.Router();
const crypto    = require('crypto');
const validator = require('validator');
const User      = require('../models/User');
const Invoice   = require('../models/Invoice');
const AuditLog  = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');
const { log }   = require('../utils/auditLogger');
const { sendEmail, templates } = require('../utils/sendEmail');

router.use(protect);

// ── Helper: generate secure temp password ─────────────────────
const generateTempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

/* ── GET /api/staff ────────────────────── admin + manager ───── */
router.get('/', authorize('admin','manager'), async (req, res, next) => {
  try {
    const staff = await User.find({}).select('-password -refreshTokens').sort({ createdAt:-1 });
    const withStats = await Promise.all(staff.map(async m => {
      const [cnt, agg] = await Promise.all([
        Invoice.countDocuments({ soldBy: m._id }),
        Invoice.aggregate([{ $match:{ soldBy: m._id } }, { $group:{ _id:null, total:{ $sum:'$grandTotal' } } }])
      ]);
      return { ...m.toObject(), salesCount:cnt, salesTotal: agg[0]?.total||0 };
    }));
    res.json({ success:true, data: withStats });
  } catch (err) { next(err); }
});

/* ── GET /api/staff/:id ──────────────── admin + manager ──────── */
router.get('/:id', authorize('admin','manager'), async (req, res, next) => {
  try {
    if (req.params.id === 'system') return next(); // skip for /system/audit-logs
    const member = await User.findById(req.params.id).select('-password -refreshTokens');
    if (!member) return res.status(404).json({ success:false, message:'Staff not found.' });
    const [recent, logs, month] = await Promise.all([
      Invoice.find({ soldBy: req.params.id }).sort({ date:-1 }).limit(10),
      AuditLog.find({ user: req.params.id }).sort({ createdAt:-1 }).limit(20),
      Invoice.aggregate([{ $match:{ soldBy: member._id, date:{ $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }, { $group:{ _id:null, total:{ $sum:'$grandTotal' }, count:{ $sum:1 } } }])
    ]);
    res.json({ success:true, data:{ member, recentSales:recent, auditLogs:logs, monthStats:{ total:month[0]?.total||0, count:month[0]?.count||0 } } });
  } catch (err) { next(err); }
});

/* ── POST /api/staff ──────────────────── admin only ─────────── */
// Admin creates account → system auto-sends welcome + activation email
router.post('/', authorize('admin'), async (req, res, next) => {
  try {
    const { name, email, role, salary } = req.body;

    if (!name || !email)
      return res.status(400).json({ success:false, message:'Name and email are required.' });
    if (!validator.isEmail(email))
      return res.status(400).json({ success:false, message:'Enter a valid email address.' });
    if (role === 'admin' && req.user.role !== 'admin')
      return res.status(403).json({ success:false, message:'Only admins can create admin accounts.' });

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) return res.status(400).json({ success:false, message:'An account with this email already exists.' });

    // Generate temp password (will be shown in email; user must change on activation)
    const tempPassword = generateTempPassword();

    // Create user (NOT yet verified)
    const member = new User({
      name:       name.trim(),
      email:      email.toLowerCase().trim(),
      password:   tempPassword,
      role:       role || 'staff',
      salary:     salary || 0,
      isVerified: false,
    });

    // Generate activation token
    const rawToken = member.generateVerificationToken();
    await member.save();

    // Build activation URL
    const activationUrl = `${process.env.FRONTEND_URL}/activate/${rawToken}`;
    console.log('ACTIVATION URL:', activationUrl);
    const tmpl          = templates.welcome({ name: member.name, role: member.role, tempPassword, activationUrl });

    // Send welcome email
    try {
      await sendEmail({ to: member.email, ...tmpl });
    } catch (emailErr) {
      console.error('[EMAIL ERROR] Welcome email failed:', emailErr.message);
      // Don't fail the creation — admin can resend
    }

    await log({ user: req.user, action:'USER_CREATE', entity:'User', entityId: member._id, details:{ name: member.name, role: member.role, email: member.email }, req });

    res.status(201).json({
      success:true,
      data:    member,
      message: `Account created. Welcome email sent to ${member.email}.`
    });
  } catch (err) { next(err); }
});

/* ── POST /api/staff/:id/resend-activation ── admin ─────────── */
router.post('/:id/resend-activation', authorize('admin'), async (req, res, next) => {
  try {
    const member = await User.findById(req.params.id)
                             .select('+verificationToken +verificationTokenExpire');
    if (!member) return res.status(404).json({ success:false, message:'Staff not found.' });
    if (member.isVerified)
      return res.status(400).json({ success:false, message:'Account is already activated.' });

    const tempPassword = generateTempPassword();
    member.password    = tempPassword;
    const rawToken     = member.generateVerificationToken();
    await member.save();

    const activationUrl = `${process.env.FRONTEND_URL}/activate/${rawToken}`;
    const tmpl          = templates.welcome({ name: member.name, role: member.role, tempPassword, activationUrl });

    await sendEmail({ to: member.email, ...tmpl });

    res.json({ success:true, message:`Activation email resent to ${member.email}.` });
  } catch (err) { next(err); }
});

/* ── PUT /api/staff/:id ──────────────────── admin only ──────── */
router.put('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const { name, email, role, salary } = req.body;
    if (email && !validator.isEmail(email))
      return res.status(400).json({ success:false, message:'Enter a valid email address.' });
    const member = await User.findByIdAndUpdate(
      req.params.id,
      { name, email: email?.toLowerCase().trim(), role, salary },
      { new:true, runValidators:true, select:'-password -refreshTokens' }
    );
    if (!member) return res.status(404).json({ success:false, message:'Staff not found.' });
    await log({ user: req.user, action:'USER_UPDATE', entity:'User', entityId: member._id, details:{ name, role }, req });
    res.json({ success:true, data: member });
  } catch (err) { next(err); }
});
                                                                                                                                                                                                                                                              
/* ── PATCH /api/staff/:id/toggle ─────────── admin only ──────── */
router.patch('/:id/toggle', authorize('admin'), async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString())
      return res.status(400).json({ success:false, message:'Cannot disable your own account.' });
    const member = await User.findById(req.params.id).select('+refreshTokens');
    if (!member) return res.status(404).json({ success:false, message:'Staff not found.' });
    member.isActive = !member.isActive;
    if (!member.isActive) member.refreshTokens = [];
    await member.save();
    await log({ user: req.user, action:'USER_UPDATE', entity:'User', entityId: member._id, details:{ isActive: member.isActive }, req });
    res.json({ success:true, data:{ isActive: member.isActive }, message:`Account ${member.isActive?'enabled':'disabled'}.` });
  } catch (err) { next(err); }
});

/* ── PATCH /api/staff/:id/reset-password ─── admin only ──────── */
router.patch('/:id/reset-password', authorize('admin'), async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8)
      return res.status(400).json({ success:false, message:'New password must be at least 8 characters.' });
    const member = await User.findById(req.params.id).select('+refreshTokens');
    if (!member) return res.status(404).json({ success:false, message:'Staff not found.' });
    member.password      = newPassword;
    member.refreshTokens = [];
    member.loginAttempts = 0;
    member.lockUntil     = undefined;
    await member.save();
    await log({ user: req.user, action:'USER_UPDATE', entity:'User', entityId: member._id, details:{ action:'password_reset_by_admin' }, req });
    res.json({ success:true, message:`Password reset for ${member.name}.` });
  } catch (err) { next(err); }
});

/* ── GET /api/staff/:id/sales ──────────── admin + manager ───── */
router.get('/:id/sales', authorize('admin','manager'), async (req, res, next) => {
  try {
    const { startDate, endDate, page=1, limit=30 } = req.query;
    const filter = { soldBy: req.params.id };
    if (startDate||endDate) { filter.date={}; if (startDate) filter.date.$gte=new Date(startDate); if (endDate) { const e=new Date(endDate); e.setHours(23,59,59,999); filter.date.$lte=e; } }
    const skip = (parseInt(page)-1)*parseInt(limit);
    const [invoices, total, revenue] = await Promise.all([
      Invoice.find(filter).sort({ date:-1 }).skip(skip).limit(parseInt(limit)),
      Invoice.countDocuments(filter),
      Invoice.aggregate([{ $match:filter }, { $group:{ _id:null, total:{ $sum:'$grandTotal' } } }])
    ]);
    res.json({ success:true, data:invoices, total, totalRevenue: revenue[0]?.total||0 });
  } catch (err) { next(err); }
});

/* ── GET /api/staff/system/audit-logs ──── admin only ────────── */
router.get('/system/audit-logs', authorize('admin'), async (req, res, next) => {
  try {
    const { page=1, limit=50, action } = req.query;
    const filter = {};
    if (action && action !== 'all') filter.action = action;
    const skip = (parseInt(page)-1)*parseInt(limit);
    const [logs, total] = await Promise.all([
      AuditLog.find(filter).populate('user','name email role').sort({ createdAt:-1 }).skip(skip).limit(parseInt(limit)),
      AuditLog.countDocuments(filter)
    ]);
    res.json({ success:true, data:logs, total });
  } catch (err) { next(err); }
});

module.exports = router;
