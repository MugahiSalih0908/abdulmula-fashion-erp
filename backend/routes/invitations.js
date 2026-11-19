// routes/invitations.js – Invitation link authentication

const express   = require('express');
const router    = express.Router();
const crypto    = require('crypto');
const validator = require('validator');
const Invitation = require('../models/Invitation');
const User      = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { sendEmail, templates } = require('../utils/sendEmail');
const { getEmailDeliveryError } = require('../utils/emailDeliveryError');
const { isEmailDeliveryBlocked } = require('../utils/emailConfig');
const { log }   = require('../utils/auditLogger');
const { hashRefreshToken } = require('../utils/tokenUtils');

// ─────────────────────────────────────────────────────────────
// POST /api/invitations/create (Admin only)
// Create new invitation link for staff
// ─────────────────────────────────────────────────────────────
router.post('/create', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { email, role } = req.body;

    if (!email || !validator.isEmail(email))
      return res.status(400).json({ success: false, message: 'Valid email is required.' });

    const validRoles = ['admin', 'manager', 'staff'];
    if (!role || !validRoles.includes(role))
      return res.status(400).json({ success: false, message: 'Valid role is required.' });

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser)
      return res.status(409).json({ success: false, message: 'User with this email already exists.' });

    const existingInvitation = await Invitation.findOne({
      email: normalizedEmail,
      status: 'pending'
    });
    if (existingInvitation)
      return res.status(409).json({
        success: false,
        message: 'Pending invitation already exists for this email. Open Manage existing and resend it after email is configured.'
      });

    const { raw, hashed } = Invitation.generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const invitation = new Invitation({
      email: normalizedEmail,
      role,
      token: hashed,
      expiresAt,
      invitedBy: req.user._id,
      status: 'pending',
      emailStatus: 'not_attempted'
    });
    await invitation.save();

    const frontendUrl = String(process.env.FRONTEND_URL || '').replace(/\/+$/, '');
    const inviteUrl = frontendUrl + '/invite/' + raw;
    const emailTemplate = templates.invitation({
      email: normalizedEmail,
      role,
      inviteUrl
    });

    let emailStatus = 'failed';
    let emailMessage = '';
    let emailErrorCode = null;

    try {
      const delivery = await sendEmail({
        to: normalizedEmail,
        ...emailTemplate,
        category: 'staff_invitation',
        idempotencyKey: 'invitation:' + invitation._id + ':initial',
        createdBy: req.user._id,
        relatedEntity: 'Invitation',
        relatedEntityId: invitation._id
      });
      emailStatus = delivery.status;
      emailMessage = 'Invitation email was accepted by the email provider.';
    } catch (emailErr) {
      const safeError = getEmailDeliveryError(emailErr);
      emailErrorCode = safeError.code;
      emailMessage = safeError.message;
      emailStatus = ['EMAIL_DELIVERY_UNKNOWN', 'EMAIL_SEND_IN_PROGRESS'].includes(emailErr.code)
        ? 'unknown'
        : isEmailDeliveryBlocked(emailErr) ? 'blocked' : 'failed';
      console.error('[INVITATION EMAIL ERROR]', emailErr.code || emailErr.message);
    }

    // Keep the invitation and token so the admin can retry after email is configured.
    invitation.emailStatus = emailStatus;
    invitation.emailErrorCode = emailErrorCode || undefined;
    invitation.emailErrorMessage = emailMessage.slice(0, 240) || undefined;
    await invitation.save();

    await log({
      user: req.user,
      action: 'INVITATION_CREATED',
      entity: 'Invitation',
      entityId: invitation._id,
      details: { email: normalizedEmail, role, emailStatus },
      req
    });

    res.status(201).json({
      success: true,
      message: emailStatus === 'sent'
        ? 'Invitation email accepted by the provider for ' + normalizedEmail + '.'
        : emailStatus === 'unknown'
          ? 'Invitation saved for ' + normalizedEmail + '. Delivery is uncertain; check Email Center before retrying.'
          : 'Invitation saved for ' + normalizedEmail + ', but the email was not sent. Correct email settings and use Resend.',
      data: {
        id: invitation._id,
        email: normalizedEmail,
        role,
        expiresAt,
        status: 'pending',
        emailStatus,
        emailMessage,
        emailErrorCode
      },
      emailStatus,
      emailMessage,
      emailErrorCode
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/invitations (Admin only)
// List all invitations for current admin
// ─────────────────────────────────────────────────────────────
router.get('/', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { status } = req.query;
    const query = { invitedBy: req.user._id };

    if (status && ['pending', 'accepted', 'expired'].includes(status)) {
      query.status = status;
    }

    // Auto-expire old pending invitations
    await Invitation.expireOldInvitations();

    const invitations = await Invitation.find(query)
      .sort({ createdAt: -1 })
      .populate('invitedBy', 'name email')
      .populate('acceptedBy', 'name email');

    const stats = await Invitation.getStats(req.user._id);

    res.json({
      success: true,
      data: {
        invitations: invitations.map(inv => inv.toJSON()),
        stats
      }
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/invitations/validate/:token (Public)
// Validate invitation token without accepting it
// ─────────────────────────────────────────────────────────────
router.post('/validate/:token', async (req, res, next) => {
  try {
    const { token } = req.params;

    // ── Validate token format ──────────────────────────────────
    if (!token || token.length !== 64)
      return res.status(400).json({ success: false, message: 'Invalid token format.' });

    // ── Hash the token ─────────────────────────────────────────
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // ── Find invitation ────────────────────────────────────────
    const invitation = await Invitation.findOne({
      token: hashedToken,
      status: 'pending'
    });

    if (!invitation)
      return res.status(404).json({
        success: false,
        message: 'Invitation not found or already used.',
        code: 'INVALID_TOKEN'
      });

    // ── Check expiration ───────────────────────────────────────
    if (invitation.isExpired) {
      await invitation.markExpired();
      return res.status(410).json({
        success: false,
        message: 'Invitation has expired.',
        code: 'EXPIRED_TOKEN',
        data: { email: invitation.email, invitationId: invitation._id }
      });
    }

    // ── Return invitation details ──────────────────────────────
    res.json({
      success: true,
      data: {
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        company: {
          name: 'Abdulmula Fashion ERP',
          location: 'Konyo-Konyo Market, Juba, South Sudan'
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/invitations/accept/:token (Public)
// Accept invitation, create user account, and auto-login
// ─────────────────────────────────────────────────────────────
router.post('/accept/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword, name } = req.body;

    // ── Validation ─────────────────────────────────────────────
    if (!token || token.length !== 64)
      return res.status(400).json({ success: false, message: 'Invalid token format.' });

    if (!password || !confirmPassword)
      return res.status(400).json({ success: false, message: 'Password and confirmation are required.' });

    if (password !== confirmPassword)
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });

    if (password.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });

    if (!name || name.trim().length < 2)
      return res.status(400).json({ success: false, message: 'Valid name is required.' });

    // ── Hash and find invitation ───────────────────────────────
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const invitation = await Invitation.findOne({
      token: hashedToken,
      status: 'pending'
    });

    if (!invitation)
      return res.status(404).json({
        success: false,
        message: 'Invitation not found or already used.',
        code: 'INVALID_TOKEN'
      });

    // ── Check expiration ───────────────────────────────────────
    if (invitation.isExpired) {
      await invitation.markExpired();
      return res.status(410).json({
        success: false,
        message: 'Invitation has expired.',
        code: 'EXPIRED_TOKEN',
        data: { email: invitation.email, invitationId: invitation._id }
      });
    }

    // ── Create user account ────────────────────────────────────
    const newUser = new User({
      name: name.trim(),
      email: invitation.email,
      password, // pre-save hook will hash
      role: invitation.role,
      isActive: true,
      isVerified: true, // Mark as verified since invited by admin
    });

    await newUser.save();

    // ── Mark invitation as accepted ────────────────────────────
    await invitation.markAccepted(newUser._id);

    // ── Audit log ──────────────────────────────────────────────
    await log({
      user: newUser,
      action: 'USER_CREATED_FROM_INVITATION',
      entity: 'User',
      entityId: newUser._id,
      details: { invitationId: invitation._id, role: invitation.role },
      req
    });

    // ── Generate tokens for auto-login ────────────────────────
    const { generateAccessToken, generateRefreshToken } = require('../utils/tokenUtils');
    const accessToken = generateAccessToken(newUser._id);
    const refreshToken = generateRefreshToken(newUser._id);

    // ── Store refresh token ────────────────────────────────────
    newUser.refreshTokens = [hashRefreshToken(refreshToken)];
    newUser.lastLogin = new Date();
    newUser.lastLoginIP = req.ip || req.headers['x-forwarded-for'];
    await newUser.save();

    res.status(201).json({
      success: true,
      message: 'Account created successfully! You are now logged in.',
      data: {
        user: newUser.toJSON(),
        accessToken,
        refreshToken,
        invitationId: invitation._id
      }
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/invitations/resend (Admin only)
// Resend invitation to existing email/invitation
// ─────────────────────────────────────────────────────────────
router.post('/resend', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { invitationId } = req.body;
    if (!invitationId)
      return res.status(400).json({ success: false, message: 'Invitation ID is required.' });

    const invitation = await Invitation.findById(invitationId);
    if (!invitation)
      return res.status(404).json({ success: false, message: 'Invitation not found.' });
    if (!invitation.invitedBy.equals(req.user._id))
      return res.status(403).json({ success: false, message: 'You can only resend your own invitations.' });
    if (invitation.status === 'accepted')
      return res.status(400).json({ success: false, message: 'Cannot resend accepted invitation.' });

    const previous = {
      token: invitation.token,
      expiresAt: invitation.expiresAt,
      status: invitation.status,
      resendCount: invitation.resendCount,
      lastResentAt: invitation.lastResentAt,
      emailStatus: invitation.emailStatus,
      emailErrorCode: invitation.emailErrorCode,
      emailErrorMessage: invitation.emailErrorMessage
    };

    const { raw, hashed } = Invitation.generateToken();
    invitation.token = hashed;
    invitation.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    invitation.status = 'pending';
    invitation.resendCount += 1;
    invitation.lastResentAt = new Date();
    await invitation.save();

    const frontendUrl = String(process.env.FRONTEND_URL || '').replace(/\/+$/, '');
    const inviteUrl = frontendUrl + '/invite/' + raw;
    const emailTemplate = templates.invitation({
      email: invitation.email,
      role: invitation.role,
      inviteUrl
    });

    let emailStatus = 'failed';
    let emailMessage = '';
    let emailErrorCode = null;
    try {
      const delivery = await sendEmail({
        to: invitation.email,
        ...emailTemplate,
        category: 'staff_invitation',
        idempotencyKey: 'invitation:' + invitation._id + ':resend:' + invitation.resendCount,
        createdBy: req.user._id,
        relatedEntity: 'Invitation',
        relatedEntityId: invitation._id
      });
      emailStatus = delivery.status;
      emailMessage = 'Invitation email was accepted by the email provider.';
    } catch (emailErr) {
      const safeError = getEmailDeliveryError(emailErr);
      emailErrorCode = safeError.code;
      emailMessage = safeError.message;
      emailStatus = ['EMAIL_DELIVERY_UNKNOWN', 'EMAIL_SEND_IN_PROGRESS'].includes(emailErr.code)
        ? 'unknown'
        : isEmailDeliveryBlocked(emailErr) ? 'blocked' : 'failed';

      if (!['EMAIL_DELIVERY_UNKNOWN', 'EMAIL_SEND_IN_PROGRESS'].includes(emailErr.code)) {
        invitation.token = previous.token;
        invitation.expiresAt = previous.expiresAt;
        invitation.status = previous.status;
        invitation.resendCount = previous.resendCount;
        invitation.lastResentAt = previous.lastResentAt;
      }
      invitation.emailStatus = emailStatus;
      invitation.emailErrorCode = emailErrorCode;
      invitation.emailErrorMessage = emailMessage.slice(0, 240);
      await invitation.save();
      console.error('[RESEND EMAIL ERROR]', emailErr.code || emailErr.message);
    }

    if (emailStatus === 'sent') {
      invitation.emailStatus = 'sent';
      invitation.emailErrorCode = undefined;
      invitation.emailErrorMessage = undefined;
      await invitation.save();
    }

    await log({
      user: req.user,
      action: 'INVITATION_RESENT',
      entity: 'Invitation',
      entityId: invitation._id,
      details: { email: invitation.email, resendCount: invitation.resendCount, emailStatus },
      req
    });

    res.json({
      success: true,
      message: emailStatus === 'sent'
        ? 'Invitation email accepted by the provider for ' + invitation.email + '.'
        : emailStatus === 'unknown'
          ? 'Invitation remains saved. Delivery is uncertain; check Email Center before retrying.'
          : 'Invitation remains saved, but the email was not sent. ' + emailMessage,
      data: {
        id: invitation._id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        resendCount: invitation.resendCount,
        emailStatus,
        emailMessage,
        emailErrorCode
      },
      emailStatus,
      emailMessage,
      emailErrorCode
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/invitations/:id (Admin only)
// Delete/cancel invitation
// ─────────────────────────────────────────────────────────────
router.delete('/:id', protect, authorize('admin'), async (req, res, next) => {
  try {
    const invitation = await Invitation.findById(req.params.id);

    if (!invitation)
      return res.status(404).json({ success: false, message: 'Invitation not found.' });

    if (!invitation.invitedBy.equals(req.user._id))
      return res.status(403).json({ success: false, message: 'You can only delete your own invitations.' });

    if (invitation.status === 'accepted')
      return res.status(400).json({ success: false, message: 'Cannot delete accepted invitation.' });

    await Invitation.findByIdAndDelete(req.params.id);

    await log({
      user: req.user,
      action: 'INVITATION_DELETED',
      entity: 'Invitation',
      entityId: req.params.id,
      details: { email: invitation.email },
      req
    });

    res.json({
      success: true,
      message: 'Invitation deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
