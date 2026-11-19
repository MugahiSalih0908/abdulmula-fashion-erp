// routes/auth.js – v6  enterprise auth: login, activate, forgot/reset password

const express   = require('express');
const router    = express.Router();
const crypto    = require('crypto');
const validator = require('validator');
const User      = require('../models/User');
const { protect } = require('../middleware/auth');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken, hashRefreshToken, buildRefreshTokenRotationPipeline } = require('../utils/tokenUtils');
const { log }   = require('../utils/auditLogger');
const { validateNewPassword, isValidOpaqueToken } = require('../utils/passwordValidation');
const { sendEmail, templates } = require('../utils/sendEmail');

// ─────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password)
      return res.status(400).json({ success:false, message:'Email and password are required.' });
    if (email.length > 254 || password.length > 128)
      return res.status(400).json({ success:false, message:'Email or password exceeds the supported length.' });
    if (!validator.isEmail(email.trim()))
      return res.status(400).json({ success:false, message:'Enter a valid email address.' });

    const user = await User.findOne({ email: email.toLowerCase().trim() })
                           .select('+password +loginAttempts +lockUntil +isVerified');

    if (!user) {
      await log({ action:'LOGIN_FAILED', details:{ email, reason:'unknown_email' }, req });
      return res.status(401).json({ success:false, message:'Invalid email or password.' });
    }

    // Account locked?
    if (user.isLocked) {
      const mins = Math.ceil((user.lockUntil - Date.now()) / 60000);
      await log({ user, action:'LOGIN_FAILED', details:{ reason:'account_locked' }, req });
      return res.status(403).json({ success:false, message:`Account locked. Try again in ${mins} minute(s).`, code:'ACCOUNT_LOCKED' });
    }

    // Account disabled?
    if (!user.isActive) {
      await log({ user, action:'LOGIN_FAILED', details:{ reason:'account_disabled' }, req });
      return res.status(403).json({ success:false, message:'Account disabled. Contact your administrator.', code:'ACCOUNT_DISABLED' });
    }

    // Not yet verified (must activate via email)
    if (!user.isVerified) {
      await log({ user, action:'LOGIN_FAILED', details:{ reason:'not_verified' }, req });
      return res.status(403).json({
        success:false,
        message:'Account not activated. Please check your email for the activation link.',
        code:'NOT_VERIFIED'
      });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      await user.incLoginAttempts();
      const remaining = Math.max(0, 4 - user.loginAttempts);
      const msg = remaining > 0
        ? `Invalid password. ${remaining} attempt(s) remaining before lockout.`
        : 'Too many failed attempts. Account locked for 30 minutes.';
      await log({ user, action:'LOGIN_FAILED', details:{ reason:'wrong_password', attempts: user.loginAttempts+1 }, req });
      return res.status(401).json({ success:false, message: msg });
    }

    // ── Success ───────────────────────────────────────────────
    const accessToken  = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.loginAttempts = 0;
    user.lockUntil     = undefined;
    user.lastLogin     = new Date();
    user.lastLoginIP   = req.ip || req.headers['x-forwarded-for'];
    await user.save();
    // Atomic append protects concurrent logins on different shop devices.
    await User.updateOne(
      { _id: user._id },
      { $push: { refreshTokens: { $each: [hashRefreshToken(refreshToken)], $slice: -5 } } }
    );

    await log({ user, action:'LOGIN', details:{ ip: req.ip }, req });

    res.json({ success:true, data:{ user: user.toJSON(), accessToken, refreshToken } });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/activate/:token   – set password, verify account
// ─────────────────────────────────────────────────────────────
router.post('/activate/:token', async (req, res, next) => {
  try {
    const { password, confirmPassword } = req.body || {};
    if (typeof password !== 'string' || typeof confirmPassword !== 'string' || !password || !confirmPassword)
      return res.status(400).json({ success:false, message:'Password and confirmation are required.' });
    if (password !== confirmPassword)
      return res.status(400).json({ success:false, message:'Passwords do not match.' });
    const passwordError = validateNewPassword(password);
    if (passwordError) return res.status(400).json({ success:false, message:passwordError });
    if (!isValidOpaqueToken(req.params.token))
      return res.status(400).json({ success:false, message:'Activation link is invalid or has expired.', code:'INVALID_TOKEN' });

    // Hash the token from the URL and find matching user
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({
      verificationToken:       hashedToken,
      verificationTokenExpire: { $gt: Date.now() },
    }).select('+verificationToken +verificationTokenExpire');

    if (!user)
      return res.status(400).json({ success:false, message:'Activation link is invalid or has expired. Ask admin to resend.', code:'INVALID_TOKEN' });

    if (user.isVerified)
      return res.status(400).json({ success:false, message:'Account is already activated. Please log in.', code:'ALREADY_VERIFIED' });

    // Set new password and mark verified
    user.password                = password;   // pre-save hook will hash
    user.isVerified              = true;
    user.verificationToken       = undefined;
    user.verificationTokenExpire = undefined;
    await user.save();

    await log({ user, action:'USER_UPDATE', entity:'User', entityId: user._id, details:{ action:'account_activated' }, req });

    res.json({ success:true, message:'Account activated successfully. You can now log in.' });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password
// ─────────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (typeof email !== 'string' || email.trim().length > 254 || !validator.isEmail(email.trim()))
      return res.status(400).json({ success:false, message:'Enter a valid email address.' });

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail })
                           .select('+resetPasswordToken +resetPasswordExpire');

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ success:true, message:'If that email exists, a reset link has been sent.' });
    }

    if (!user.isVerified)
      return res.status(400).json({ success:false, message:'Account not yet activated. Please use the activation link from your welcome email.' });

    const rawToken = user.generateResetToken();
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${rawToken}`;
    const tmpl     = templates.reset({ name: user.name, resetUrl });

    try {
      await sendEmail({
        to: user.email,
        ...tmpl,
        category: 'password_reset',
        idempotencyKey: `password-reset:${user._id}:${user.resetPasswordToken}`,
        createdBy: user._id,
        relatedEntity: 'User',
        relatedEntityId: user._id
      });
    } catch (emailErr) {
      // Don't fail if email service is down – log it
      console.error('[EMAIL ERROR]', emailErr.message);
      user.resetPasswordToken  = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
      return res.status(500).json({ success:false, message:'Could not send reset email. Please contact admin.' });
    }

    await log({ user, action:'USER_UPDATE', entity:'User', entityId: user._id, details:{ action:'password_reset_requested' }, req });

    res.json({ success:true, message:'Password reset link sent to your email.' });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/reset-password/:token
// ─────────────────────────────────────────────────────────────
router.post('/reset-password/:token', async (req, res, next) => {
  try {
    const { password, confirmPassword } = req.body || {};
    if (typeof password !== 'string' || typeof confirmPassword !== 'string' || !password || !confirmPassword)
      return res.status(400).json({ success:false, message:'Password and confirmation are required.' });
    if (password !== confirmPassword)
      return res.status(400).json({ success:false, message:'Passwords do not match.' });
    const passwordError = validateNewPassword(password);
    if (passwordError) return res.status(400).json({ success:false, message:passwordError });
    if (!isValidOpaqueToken(req.params.token))
      return res.status(400).json({ success:false, message:'Reset link is invalid or has expired.', code:'INVALID_TOKEN' });

    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken:  hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    }).select('+resetPasswordToken +resetPasswordExpire +refreshTokens');

    if (!user)
      return res.status(400).json({ success:false, message:'Reset link is invalid or has expired.', code:'INVALID_TOKEN' });

    user.password            = password;
    user.resetPasswordToken  = undefined;
    user.resetPasswordExpire = undefined;
    user.refreshTokens       = [];            // force re-login on all devices
    user.loginAttempts       = 0;
    user.lockUntil           = undefined;
    await user.save();

    // Send confirmation email (fire and forget)
    sendEmail({
      to: user.email,
      ...templates.passwordChanged({ name: user.name }),
      category: 'password_changed',
      idempotencyKey: `password-changed:${user._id}:${user.passwordChangedAt ? user.passwordChangedAt.getTime() : Date.now()}`,
      createdBy: user._id,
      relatedEntity: 'User',
      relatedEntityId: user._id
    }).catch(err => console.error('[PASSWORD CONFIRMATION EMAIL ERROR]', err.code || err.message));

    await log({ user, action:'USER_UPDATE', entity:'User', entityId: user._id, details:{ action:'password_reset_completed' }, req });

    res.json({ success:true, message:'Password reset successfully. You can now log in.' });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/refresh
// ─────────────────────────────────────────────────────────────
router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.body?.refreshToken;
    if (typeof refreshToken !== 'string' || !refreshToken || refreshToken.length > 4096)
      return res.status(400).json({ success:false, message:'Refresh token required.' });

    let decoded;
    try { decoded = verifyRefreshToken(refreshToken); }
    catch { return res.status(401).json({ success:false, message:'Invalid or expired refresh token.', code:'REFRESH_EXPIRED' }); }

    const refreshDigest = hashRefreshToken(refreshToken);
    // Legacy raw values are accepted only to migrate existing sessions. Both
    // forms are consumed in the same atomic update so replay cannot create a
    // second live token and concurrent device rotations cannot overwrite peers.
    const consumedTokens = [refreshDigest, refreshToken];
    const newAccess  = generateAccessToken(decoded.id);
    const newRefresh = generateRefreshToken(decoded.id);
    const rotatedUser = await User.findOneAndUpdate(
      {
        _id: decoded.id,
        isActive: true,
        refreshTokens: { $in: consumedTokens }
      },
      buildRefreshTokenRotationPipeline(consumedTokens, hashRefreshToken(newRefresh)),
      { new: true, projection: { _id: 1 } }
    );

    if (!rotatedUser)
      return res.status(401).json({ success:false, message:'Session revoked. Please log in again.' });

    res.json({ success:true, data:{ accessToken: newAccess, refreshToken: newRefresh } });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────────────────────
router.post('/logout', protect, async (req, res, next) => {
  try {
    const refreshToken = req.body?.refreshToken;
    if (refreshToken !== undefined && (typeof refreshToken !== 'string' || refreshToken.length > 4096))
      return res.status(400).json({ success:false, message:'Invalid refresh token.' });
    if (refreshToken) {
      const digest = hashRefreshToken(refreshToken);
      // $pull is a single atomic write and cannot overwrite another device's
      // concurrent token rotation.
      await User.updateOne(
        { _id: req.user._id },
        { $pull: { refreshTokens: { $in: [refreshToken, digest] } } }
      );
    }
    await log({ user: req.user, action:'LOGOUT', req });
    res.json({ success:true, message:'Logged out successfully.' });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/logout-all  – revoke every device
// ─────────────────────────────────────────────────────────────
router.post('/logout-all', protect, async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { $set: { refreshTokens:[] } });
    await log({ user: req.user, action:'LOGOUT', details:{ allDevices:true }, req });
    res.json({ success:true, message:'Logged out from all devices.' });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────────────────────
router.get('/me', protect, (req, res) => {
  res.json({ success:true, data: req.user });
});

module.exports = router;
