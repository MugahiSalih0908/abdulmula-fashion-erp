// routes/invitations.js – Invitation link authentication

const express   = require('express');
const router    = express.Router();
const crypto    = require('crypto');
const validator = require('validator');
const Invitation = require('../models/Invitation');
const User      = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { sendEmail, templates } = require('../utils/sendEmail');
const { log }   = require('../utils/auditLogger');

// ─────────────────────────────────────────────────────────────
// POST /api/invitations/create (Admin only)
// Create new invitation link for staff
// ─────────────────────────────────────────────────────────────
router.post('/create', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { email, role } = req.body;

    // ── Validation ─────────────────────────────────────────────
    if (!email || !validator.isEmail(email))
      return res.status(400).json({ success: false, message: 'Valid email is required.' });

    const validRoles = ['admin', 'manager', 'staff'];
    if (!role || !validRoles.includes(role))
      return res.status(400).json({ success: false, message: 'Valid role is required.' });

    const normalizedEmail = email.toLowerCase().trim();

    // ── Check if user already exists ───────────────────────────
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser)
      return res.status(409).json({ success: false, message: 'User with this email already exists.' });

    // ── Check if pending invitation already exists ─────────────
    const existingInvitation = await Invitation.findOne({
      email: normalizedEmail,
      status: { $in: ['pending'] }
    });
    if (existingInvitation)
      return res.status(409).json({
        success: false,
        message: 'Pending invitation already exists for this email. Delete or resend the existing one.'
      });

    // ── Generate secure token ──────────────────────────────────
    const { raw, hashed } = Invitation.generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // ── Create invitation ──────────────────────────────────────
    const invitation = new Invitation({
      email: normalizedEmail,
      role,
      token: hashed,
      expiresAt,
      invitedBy: req.user._id,
      status: 'pending',
    });

    await invitation.save();

    // ── Send invitation email ──────────────────────────────────
    const inviteUrl = `${process.env.FRONTEND_URL}/invite/${raw}`;
    const emailTemplate = templates.invitation({ email: normalizedEmail, role, inviteUrl });

    try {
      await sendEmail({
        to: normalizedEmail,
        ...emailTemplate
      });
    } catch (emailErr) {
      console.error('[INVITATION EMAIL ERROR]', emailErr.message);
      // Delete the invitation if email fails
      await Invitation.findByIdAndDelete(invitation._id);
      return res.status(500).json({
        success: false,
        message: 'Could not send invitation email. Please try again.'
      });
    }

    // ── Audit log ──────────────────────────────────────────────
    await log({
      user: req.user,
      action: 'INVITATION_CREATED',
      entity: 'Invitation',
      entityId: invitation._id,
      details: { email: normalizedEmail, role },
      req
    });

    res.status(201).json({
      success: true,
      message: `Invitation sent to ${normalizedEmail}`,
      data: {
        id: invitation._id,
        email: normalizedEmail,
        role,
        expiresAt,
        status: 'pending'
      }
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
    newUser.refreshTokens = [refreshToken];
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

    // ── Find invitation ────────────────────────────────────────
    const invitation = await Invitation.findById(invitationId);

    if (!invitation)
      return res.status(404).json({ success: false, message: 'Invitation not found.' });

    // ── Check ownership ────────────────────────────────────────
    if (!invitation.invitedBy.equals(req.user._id))
      return res.status(403).json({ success: false, message: 'You can only resend your own invitations.' });

    // ── Check if already accepted ──────────────────────────────
    if (invitation.status === 'accepted')
      return res.status(400).json({ success: false, message: 'Cannot resend accepted invitation.' });

    // ── Generate new token ─────────────────────────────────────
    const { raw, hashed } = Invitation.generateToken();
    invitation.token = hashed;
    invitation.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    invitation.status = 'pending';
    invitation.resendCount += 1;
    invitation.lastResentAt = new Date();
    await invitation.save();

    // ── Send new invitation email ──────────────────────────────
    const inviteUrl = `${process.env.FRONTEND_URL}/invite/${raw}`;
    const emailTemplate = templates.invitation({
      email: invitation.email,
      role: invitation.role,
      inviteUrl
    });

    try {
      await sendEmail({
        to: invitation.email,
        ...emailTemplate
      });
    } catch (emailErr) {
      console.error('[RESEND EMAIL ERROR]', emailErr.message);
      return res.status(500).json({
        success: false,
        message: 'Could not send invitation email. Please try again.'
      });
    }

    // ── Audit log ──────────────────────────────────────────────
    await log({
      user: req.user,
      action: 'INVITATION_RESENT',
      entity: 'Invitation',
      entityId: invitation._id,
      details: { email: invitation.email, resendCount: invitation.resendCount },
      req
    });

    res.json({
      success: true,
      message: `Invitation resent to ${invitation.email}`,
      data: {
        id: invitation._id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        resendCount: invitation.resendCount
      }
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
