// utils/sendEmail.js – Resend email utility with branded HTML templates
const { Resend } = require('resend');
const crypto = require('crypto');
const validator = require('validator');
const EmailLog = require('../models/EmailLog');
const { validateEmailDelivery } = require('./emailConfig');

// ── Initialize Resend with API key ───────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY);

// ── Brand constants ───────────────────────────────────────────
const BRAND = {
  name:    'Abdulmula Fashion ERP',
  tagline: 'Konyo-Konyo Market · Juba, South Sudan',
  gold:    '#d4a017',
  dark:    '#111111',
};

// ── Base HTML layout ──────────────────────────────────────────
const baseLayout = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${BRAND.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
           background: #f5f5f5; color: #1a1a1a; }
    .wrapper { max-width: 600px; margin: 32px auto; background: #fff;
               border-radius: 16px; overflow: hidden;
               box-shadow: 0 4px 24px rgba(0,0,0,0.10); }
    .header  { background: ${BRAND.dark}; padding: 32px 40px; text-align: center;
               border-bottom: 3px solid ${BRAND.gold}; }
    .logo    { width: 64px; height: 64px; background: ${BRAND.gold};
               border-radius: 14px; display: inline-flex; align-items: center;
               justify-content: center; font-size: 26px; font-weight: 900;
               color: ${BRAND.dark}; letter-spacing: -1px; margin-bottom: 16px; }
    .brand   { color: #fff; font-size: 22px; font-weight: 800; margin-bottom: 4px; }
    .tagline { color: rgba(255,255,255,0.5); font-size: 12px; }
    .body    { padding: 40px; }
    .footer  { background: #f9f9f9; padding: 24px 40px; text-align: center;
               border-top: 1px solid #eee; }
    .footer p{ color: #999; font-size: 12px; line-height: 1.6; }
    h1       { font-size: 24px; font-weight: 800; color: #111; margin-bottom: 8px; }
    p        { font-size: 15px; line-height: 1.7; color: #444; margin-bottom: 16px; }
    .btn     { display: inline-block; padding: 14px 32px; background: ${BRAND.gold};
               color: ${BRAND.dark}; text-decoration: none; border-radius: 10px;
               font-weight: 700; font-size: 15px; margin: 8px 0; }
    .info-box{ background: #f9f9f9; border-left: 4px solid ${BRAND.gold};
               border-radius: 0 10px 10px 0; padding: 16px 20px; margin: 20px 0; }
    .info-box p { margin: 4px 0; font-size: 14px; }
    .info-box strong { color: #111; }
    .warn    { background: #fff8e1; border-left: 4px solid #f59e0b;
               border-radius: 0 10px 10px 0; padding: 12px 16px; margin: 16px 0; }
    .warn p  { font-size: 13px; color: #92400e; margin: 0; }
    .divider { border: none; border-top: 1px solid #eee; margin: 24px 0; }
    @media(max-width:480px){ .body,.footer{ padding:24px 20px; } }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">AF</div>
      <div class="brand">${BRAND.name}</div>
      <div class="tagline">${BRAND.tagline}</div>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>This is an automated message from <strong>${BRAND.name}</strong>.<br/>
      Please do not reply to this email.</p>
      <p style="margin-top:8px;">© ${new Date().getFullYear()} Abdulmula Fashion · Juba, South Sudan</p>
    </div>
  </div>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────
// TEMPLATE: Welcome + Activation
// ─────────────────────────────────────────────────────────────
const escapeHtml = (value) => String(value ?? '').replace(/[&<>\"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[char]));

const welcomeTemplate = ({ name, role, activationUrl }) => ({
  subject: `Welcome to Abdulmula Fashion ERP — Activate Your Account`,
  html: baseLayout(`
    <h1>Welcome, ${escapeHtml(name)}! 👋</h1>
    <p>Your staff account has been created on <strong>Abdulmula Fashion ERP</strong>.
    You have been assigned the role of <strong style="text-transform:capitalize;">${escapeHtml(role)}</strong>.</p>

    <p>Before you can log in, you need to activate your account and set your own password.</p>

    <div class="info-box">
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Role:</strong> <span style="text-transform:capitalize;">${escapeHtml(role)}</span></p>
      <p><strong>Next step:</strong> Create your own password using the secure activation link.</p>
    </div>

    <p style="text-align:center;margin:28px 0;">
      <a class="btn" href="${escapeHtml(activationUrl)}">
        🔑 Activate My Account
      </a>
    </p>

    <div class="warn">
      <p>⏰ This activation link expires in <strong>24 hours</strong>.
      After activating, you will set your own secure password.</p>
    </div>

    <hr class="divider"/>
    <p style="font-size:13px;color:#888;">If you were not expecting this email, please ignore it
    or contact your system administrator.</p>
  `)
});

// ─────────────────────────────────────────────────────────────
// TEMPLATE: Password Reset
// ─────────────────────────────────────────────────────────────
const resetTemplate = ({ name, resetUrl }) => ({
  subject: `Abdulmula Fashion ERP — Password Reset Request`,
  html: baseLayout(`
    <h1>Password Reset Request</h1>
    <p>Hello <strong>${escapeHtml(name)}</strong>,</p>
    <p>We received a request to reset your password for your Abdulmula Fashion ERP account.
    Click the button below to choose a new password.</p>

    <p style="text-align:center;margin:28px 0;">
      <a class="btn" href="${escapeHtml(resetUrl)}">
        🔒 Reset My Password
      </a>
    </p>

    <div class="warn">
      <p>⏰ This link expires in <strong>15 minutes</strong> for your security.</p>
    </div>

    <hr class="divider"/>
    <p style="font-size:13px;color:#888;">
      If you did not request a password reset, please ignore this email.
      Your password will not change until you click the link above and create a new one.
    </p>
  `)
});

// ─────────────────────────────────────────────────────────────
// TEMPLATE: Password Changed Confirmation
// ─────────────────────────────────────────────────────────────
const passwordChangedTemplate = ({ name }) => ({
  subject: `Abdulmula Fashion ERP — Password Changed Successfully`,
  html: baseLayout(`
    <h1>Password Changed ✅</h1>
    <p>Hello <strong>${escapeHtml(name)}</strong>,</p>
    <p>Your password has been changed successfully on <strong>Abdulmula Fashion ERP</strong>.</p>
    <p>You can now <a href="${escapeHtml(process.env.FRONTEND_URL)}/login" style="color:${BRAND.gold};font-weight:700;">log in</a> with your new password.</p>
    <div class="warn">
      <p>🔐 If you did not make this change, contact your administrator immediately.</p>
    </div>
  `)
});

// ─────────────────────────────────────────────────────────────
// TEMPLATE: Staff Invitation
// ─────────────────────────────────────────────────────────────
const invitationTemplate = ({ email, role, inviteUrl, expiresIn = 24 }) => ({
  subject: `🎉 You're Invited to Abdulmula Fashion ERP`,
  html: baseLayout(`
    <h1>Welcome to Abdulmula Fashion! 🎉</h1>
    <p>Hello <strong>${escapeHtml(email)}</strong>,</p>
    <p>You have been invited to join <strong>Abdulmula Fashion ERP</strong> as a <span style="text-transform:capitalize;font-weight:700;color:${BRAND.gold};">${escapeHtml(role)}</span>.</p>

    <p>Our Enterprise Resource Planning system helps us manage inventory, sales, suppliers, and more. You'll be part of our growing team!</p>

    <div class="info-box">
      <p><strong>📧 Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>👤 Role:</strong> <span style="text-transform:capitalize;">${escapeHtml(role)}</span></p>
      <p><strong>🏢 Company:</strong> Abdulmula Fashion · Konyo-Konyo Market, Juba, South Sudan</p>
    </div>

    <p style="margin-top:28px;margin-bottom:28px;text-align:center;">
      Click the button below to set up your account and get started:
    </p>

    <p style="text-align:center;margin:28px 0;">
      <a class="btn" href="${escapeHtml(inviteUrl)}" style="display:inline-block;padding:16px 36px;font-size:16px;">
        ✨ Accept Invitation & Create Account
      </a>
    </p>

    <div class="warn">
      <p>⏰ <strong>Important:</strong> This invitation link expires in <strong>${expiresIn} hours</strong>. 
      After that, you'll need to ask your administrator to send a new invitation.</p>
    </div>

    <p style="margin-top:24px;font-size:13px;color:#888;">
      <strong>What to expect:</strong><br/>
      1. Click the button above<br/>
      2. Create a secure password<br/>
      3. You'll be automatically logged in<br/>
      4. Access your dashboard immediately
    </p>

    <hr class="divider"/>
    <p style="font-size:13px;color:#888;">
      If you were not expecting this invitation, please ignore this email or contact your system administrator.
      Do not share this link with anyone else.
    </p>
  `)
});

// ─────────────────────────────────────────────────────────────
// Central Resend sender with persistent delivery tracking
// ─────────────────────────────────────────────────────────────
let resendClient;

const getResendClient = () => {
  if (!process.env.RESEND_API_KEY) {
    const error = new Error('Email provider is not configured.');
    error.code = 'EMAIL_CONFIGURATION_ERROR';
    error.statusCode = 400;
    throw error;
  }
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
};

const terminalStatuses = new Set(['sent', 'delivered', 'delivery_delayed', 'bounced', 'complained']);

const sendEmail = async ({
  to,
  subject,
  html,
  category = 'system',
  idempotencyKey,
  createdBy,
  relatedEntity,
  relatedEntityId
}) => {
  if (process.env.NODE_ENV === 'test') {
    return { id: 'test-mode', status: 'sent', skipped: true };
  }

  const recipient = String(to || '').trim().toLowerCase();
  if (!validator.isEmail(recipient)) {
    const error = new Error('A valid email recipient is required.');
    error.code = 'EMAIL_INVALID_RECIPIENT';
    error.statusCode = 400;
    throw error;
  }
  if (!subject || !html) {
    const error = new Error('Email subject and HTML content are required.');
    error.code = 'EMAIL_INVALID_MESSAGE';
    error.statusCode = 400;
    throw error;
  }

  const stableKey = String(idempotencyKey || crypto.randomUUID()).trim();
  if (!stableKey || stableKey.length > 256) {
    const error = new Error('Email idempotency key must be 1–256 characters.');
    error.code = 'EMAIL_INVALID_IDEMPOTENCY_KEY';
    error.statusCode = 400;
    throw error;
  }

  const from = String(process.env.EMAIL_FROM || '').trim();
  let logEntry;
  try {
    logEntry = await EmailLog.findOneAndUpdate(
      { idempotencyKey: stableKey },
      {
        $setOnInsert: {
          recipient,
          sender: from || undefined,
          subject: String(subject).slice(0, 240),
          category,
          provider: 'resend',
          idempotencyKey: stableKey,
          createdBy: createdBy || undefined,
          relatedEntity: relatedEntity || undefined,
          relatedEntityId: relatedEntityId ? String(relatedEntityId) : undefined,
          status: 'queued',
          attempts: 0
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error && error.code === 11000) {
      logEntry = await EmailLog.findOne({ idempotencyKey: stableKey });
    } else {
      throw error;
    }
  }
  if (!logEntry) throw new Error('Could not create email delivery record.');

  if (terminalStatuses.has(logEntry.status) && logEntry.providerEmailId) {
    return { id: logEntry.providerEmailId, status: logEntry.status, alreadyProcessed: true, logId: logEntry._id };
  }
  if (logEntry.status === 'unknown') {
    const error = new Error('Email delivery is uncertain. Check delivery events before trying again.');
    error.code = 'EMAIL_DELIVERY_UNKNOWN';
    error.statusCode = 409;
    throw error;
  }

  const claim = await EmailLog.findOneAndUpdate(
    { _id: logEntry._id, status: { $in: ['queued', 'failed'] } },
    {
      $set: {
        status: 'sending',
        lastAttemptAt: new Date(),
        sender: from || undefined,
        lastErrorCode: undefined,
        lastErrorMessage: undefined
      },
      $inc: { attempts: 1 }
    },
    { new: true }
  );
  if (!claim) {
    const error = new Error('This email is already being processed or has already been submitted.');
    error.code = 'EMAIL_SEND_IN_PROGRESS';
    error.statusCode = 409;
    throw error;
  }

  try {
    validateEmailDelivery({ recipient });

    const { data, error: providerError } = await getResendClient().emails.send(
      { from, to: [recipient], subject, html },
      { idempotencyKey: stableKey }
    );

    if (providerError) {
      const error = new Error(providerError.message || 'Resend rejected the email.');
      error.code = providerError.name || 'RESEND_ERROR';
      error.statusCode = providerError.statusCode || 400;
      throw error;
    }
    if (!data || !data.id) {
      const error = new Error('Resend did not return an email ID.');
      error.code = 'RESEND_MISSING_EMAIL_ID';
      error.statusCode = 503;
      throw error;
    }

    claim.status = 'sent';
    claim.providerEmailId = data.id;
    claim.sentAt = new Date();
    await claim.save();
    return { id: data.id, status: 'sent', logId: claim._id };
  } catch (error) {
    const statusCode = Number(error && (error.statusCode || error.status) || 0);
    const uncertain = !statusCode || statusCode === 408 || statusCode === 409 || statusCode === 429 || statusCode >= 500;
    claim.status = uncertain ? 'unknown' : 'failed';
    claim.lastErrorCode = String(error && error.code || 'EMAIL_SEND_ERROR').slice(0, 80);
    claim.lastErrorMessage = String(error && error.message || 'Email send failed.').slice(0, 240);
    await claim.save();
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────
module.exports = {
  sendEmail,
  templates: {
    welcome:         welcomeTemplate,
    reset:           resetTemplate,
    passwordChanged: passwordChangedTemplate,
    invitation:      invitationTemplate,
  },
};