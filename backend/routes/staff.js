// routes/staff.js – v6  admin creates users, sends welcome email automatically

const express   = require('express');
const router    = express.Router();
const crypto    = require('crypto');
const validator = require('validator');
const mongoose = require('mongoose');
const { validateNewPassword } = require('../utils/passwordValidation');
const User      = require('../models/User');
const Invoice   = require('../models/Invoice');
const AuditLog  = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');
const { log }   = require('../utils/auditLogger');
const { sendEmail, templates } = require('../utils/sendEmail');
const { getEmailDeliveryError } = require('../utils/emailDeliveryError');
const { isEmailDeliveryBlocked } = require('../utils/emailConfig');
const { buildStaffSalesLookup } = require('../utils/staffSalesSummary');

router.use(protect);

// ── Helper: generate secure temp password ─────────────────────
const generatePendingPassword = () => crypto.randomBytes(32).toString('hex');

/* ── GET /api/staff ────────────────────── admin + manager ───── */
router.get('/', authorize('admin'), async (req, res, next) => {
  try {
    // Fetch staff and all sales summaries in two independent queries.
    // The previous per-member count + aggregate loop grew by two queries per staff member.
    const [staff, salesRows] = await Promise.all([
      User.find({}).select('-password -refreshTokens').sort({ createdAt:-1 }),
      Invoice.aggregate([
        { $match: { soldBy: { $ne: null } } },
        {
          $group: {
            _id: '$soldBy',
            salesCount: { $sum: 1 },
            salesTotal: { $sum: '$grandTotal' }
          }
        }
      ])
    ]);

    const salesByStaff = buildStaffSalesLookup(salesRows);

    const withStats = staff.map(member => {
      const stats = salesByStaff.get(String(member._id));
      return {
        ...member.toObject(),
        salesCount: stats?.salesCount || 0,
        salesTotal: stats?.salesTotal || 0
      };
    });

    res.json({ success:true, data: withStats });
  } catch (err) { next(err); }
});

/* ── GET /api/staff/:id ──────────────── admin + manager ──────── */
router.get('/:id', authorize('admin'), async (req, res, next) => {
  try {
    if (req.params.id === 'system') return next(); // skip for /system/audit-logs
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success:false, message:'Staff not found.' });
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
    const allowed = ['name', 'email', 'role', 'salary'];
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).some(key => !allowed.includes(key))) {
      return res.status(400).json({ success:false, message:'Unsupported staff account field.' });
    }
    const { name, email, role = 'staff', salary = 0 } = req.body;
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const parsedSalary = typeof salary === 'number' || (typeof salary === 'string' && salary.trim() !== '') ? Number(salary) : Number.NaN;
    if (!normalizedName || normalizedName.length > 60 || !normalizedEmail || normalizedEmail.length > 254) {
      return res.status(400).json({ success:false, message:'Name (up to 60 characters) and email (up to 254 characters) are required.' });
    }
    if (!validator.isEmail(normalizedEmail)) return res.status(400).json({ success:false, message:'Enter a valid email address.' });
    if (!['admin', 'manager', 'staff'].includes(role)) return res.status(400).json({ success:false, message:'Choose a valid staff role.' });
    if (!Number.isFinite(parsedSalary) || parsedSalary < 0) return res.status(400).json({ success:false, message:'Salary must be a finite non-negative number.' });

    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(400).json({ success:false, message:'An account with this email already exists.' });

    // Create a pending account; the staff member chooses their own password during activation.
    const member = new User({
      name: normalizedName,
      email: normalizedEmail,
      password: generatePendingPassword(),
      role,
      salary: parsedSalary,
      isVerified: false
    });

    const rawToken = member.generateVerificationToken();
    await member.save();

    const frontendUrl = String(process.env.FRONTEND_URL || '').replace(/\/+$/, '');
    const activationUrl = frontendUrl + '/activate/' + rawToken;
    const tmpl = templates.welcome({
      name: member.name,
      role: member.role,
      activationUrl
    });

    let emailStatus = 'failed';
    let emailMessage = '';
    let emailErrorCode = null;

    try {
      const delivery = await sendEmail({
        to: member.email,
        ...tmpl,
        category: 'staff_activation',
        idempotencyKey: 'staff-activation:' + member._id + ':' + member.verificationToken,
        createdBy: req.user._id,
        relatedEntity: 'User',
        relatedEntityId: member._id
      });
      emailStatus = delivery.status;
      emailMessage = 'Activation email was accepted by the email provider.';
    } catch (emailErr) {
      const safeError = getEmailDeliveryError(emailErr);
      emailErrorCode = safeError.code;
      emailMessage = safeError.message;
      emailStatus = ['EMAIL_DELIVERY_UNKNOWN', 'EMAIL_SEND_IN_PROGRESS'].includes(emailErr.code)
        ? 'unknown'
        : isEmailDeliveryBlocked(emailErr) ? 'blocked' : 'failed';
      console.error('[STAFF ACTIVATION EMAIL ERROR]', emailErr.code || emailErr.message);
    }

    await log({
      user: req.user,
      action: 'USER_CREATE',
      entity: 'User',
      entityId: member._id,
      details: { name: member.name, role: member.role, email: member.email, emailStatus },
      req
    });

    res.status(201).json({
      success: true,
      data: member,
      message: emailStatus === 'sent'
        ? 'Staff account created and activation email accepted by the provider.'
        : emailStatus === 'unknown'
          ? 'Staff account created. The activation email delivery status is uncertain; check Email Center before retrying.'
          : 'Staff account created, but the activation email was not sent. The account remains pending activation. Correct email settings and use Resend activation.',
      emailStatus,
      emailMessage,
      emailErrorCode
    });
  } catch (err) {
    next(err);
  }
});

/* ── POST /api/staff/:id/resend-activation ── admin ─────────── */
router.post('/:id/resend-activation', authorize('admin'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success:false, message:'Staff not found.' });
    const member = await User.findById(req.params.id)
                             .select('+verificationToken +verificationTokenExpire');
    if (!member) return res.status(404).json({ success:false, message:'Staff not found.' });
    if (member.isVerified)
      return res.status(400).json({ success:false, message:'Account is already activated.' });

    const previousToken = member.verificationToken;
    const previousExpiry = member.verificationTokenExpire;
    const rawToken = member.generateVerificationToken();
    await member.save();

    const activationUrl = `${process.env.FRONTEND_URL}/activate/${rawToken}`;
    const tmpl = templates.welcome({ name: member.name, role: member.role, activationUrl });
    try {
      const delivery = await sendEmail({
        to: member.email,
        ...tmpl,
        category: 'staff_activation',
        idempotencyKey: `staff-activation:${member._id}:${member.verificationToken}`,
        createdBy: req.user._id,
        relatedEntity: 'User',
        relatedEntityId: member._id
      });
      res.json({ success:true, message:`Activation email accepted for ${member.email}.`, emailStatus: delivery.status });
    } catch (emailErr) {
      if (emailErr.code !== 'EMAIL_DELIVERY_UNKNOWN') {
        await User.updateOne(
          { _id: member._id },
          { $set: { verificationToken: previousToken, verificationTokenExpire: previousExpiry } }
        );
      }
      throw emailErr;
    }
  } catch (err) { next(err); }
});

/* ── PUT /api/staff/:id ──────────────────── admin only ──────── */
router.put('/:id', authorize('admin'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success:false, message:'Staff not found.' });
    const allowed = ['name', 'email', 'role', 'salary'];
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).length === 0 || Object.keys(req.body).some(key => !allowed.includes(key))) {
      return res.status(400).json({ success:false, message:'Provide only name, email, role or salary fields.' });
    }
    const update = {};
    if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
      if (typeof req.body.name !== 'string' || !req.body.name.trim() || req.body.name.trim().length > 60) {
        return res.status(400).json({ success:false, message:'Name must be 1–60 characters.' });
      }
      update.name = req.body.name.trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'email')) {
      if (typeof req.body.email !== 'string' || !validator.isEmail(req.body.email.trim()) || req.body.email.trim().length > 254) {
        return res.status(400).json({ success:false, message:'Enter a valid email address.' });
      }
      update.email = req.body.email.trim().toLowerCase();
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'role')) {
      if (!['admin', 'manager', 'staff'].includes(req.body.role)) return res.status(400).json({ success:false, message:'Choose a valid staff role.' });
      if (String(req.params.id) === String(req.user._id) && req.body.role !== req.user.role) {
        return res.status(400).json({ success:false, message:'You cannot change your own administrator role.' });
      }
      update.role = req.body.role;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'salary')) {
      const salary = Number(req.body.salary);
      if (typeof req.body.salary === 'boolean' || !Number.isFinite(salary) || salary < 0) {
        return res.status(400).json({ success:false, message:'Salary must be a finite non-negative number.' });
      }
      update.salary = salary;
    }
    const member = await User.findByIdAndUpdate(
      req.params.id, { $set: update },
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
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success:false, message:'Staff not found.' });
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
    const newPassword = req.body?.newPassword;
    const passwordError = validateNewPassword(newPassword);
    if (passwordError) return res.status(400).json({ success:false, message:passwordError });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success:false, message:'Staff not found.' });
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
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success:false, message:'Staff not found.' });
    const { startDate, endDate } = req.query;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 30));
    const filter = { soldBy: req.params.id };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        const start = new Date(startDate);
        if (Number.isNaN(start.getTime())) return res.status(400).json({ success:false, message:'Invalid start date.' });
        filter.date.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (Number.isNaN(end.getTime())) return res.status(400).json({ success:false, message:'Invalid end date.' });
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
      if (filter.date.$gte && filter.date.$lte && filter.date.$gte > filter.date.$lte) return res.status(400).json({ success:false, message:'Start date cannot be after end date.' });
    }
    const skip = (page - 1) * limit;
    const [invoices, total, revenue] = await Promise.all([
      Invoice.find(filter).sort({ date:-1 }).skip(skip).limit(limit),
      Invoice.countDocuments(filter),
      Invoice.aggregate([{ $match:filter }, { $group:{ _id:null, total:{ $sum:'$grandTotal' } } }])
    ]);
    res.json({ success:true, data:invoices, total, totalRevenue: revenue[0]?.total||0, page, limit });
  } catch (err) { next(err); }
});

/* ── GET /api/staff/system/audit-logs ──── admin only ────────── */
router.get('/system/audit-logs', authorize('admin'), async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const { action } = req.query;
    const filter = {};
    if (action && action !== 'all') filter.action = action;
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      AuditLog.find(filter).populate('user','name email role').sort({ createdAt:-1 }).skip(skip).limit(limit),
      AuditLog.countDocuments(filter)
    ]);
    res.json({ success:true, data:logs, total });
  } catch (err) { next(err); }
});

module.exports = router;
