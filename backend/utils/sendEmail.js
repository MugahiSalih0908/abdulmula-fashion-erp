// utils/sendEmail.js – Nodemailer email utility with branded HTML templates

const nodemailer = require('nodemailer');

// ── Transporter (Gmail SMTP) ──────────────────────────────────
const createTransporter = () =>
  nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,   // Google App Password – NOT Gmail password
    },
  });

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
const welcomeTemplate = ({ name, role, tempPassword, activationUrl }) => ({
  subject: `Welcome to Abdulmula Fashion ERP — Activate Your Account`,
  html: baseLayout(`
    <h1>Welcome, ${name}! 👋</h1>
    <p>Your staff account has been created on <strong>Abdulmula Fashion ERP</strong>.
    You have been assigned the role of <strong style="text-transform:capitalize;">${role}</strong>.</p>

    <p>Before you can log in, you need to activate your account and set your own password.</p>

    <div class="info-box">
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Role:</strong> <span style="text-transform:capitalize;">${role}</span></p>
      <p><strong>Temporary Password:</strong> <code style="background:#e5e7eb;padding:2px 6px;border-radius:4px;font-family:monospace;">${tempPassword}</code></p>
    </div>

    <p style="text-align:center;margin:28px 0;">
      <a class="btn" href="${activationUrl}">
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
    <p>Hello <strong>${name}</strong>,</p>
    <p>We received a request to reset your password for your Abdulmula Fashion ERP account.
    Click the button below to choose a new password.</p>

    <p style="text-align:center;margin:28px 0;">
      <a class="btn" href="${resetUrl}">
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
    <p>Hello <strong>${name}</strong>,</p>
    <p>Your password has been changed successfully on <strong>Abdulmula Fashion ERP</strong>.</p>
    <p>You can now <a href="${process.env.FRONTEND_URL}/login" style="color:${BRAND.gold};font-weight:700;">log in</a> with your new password.</p>
    <div class="warn">
      <p>🔐 If you did not make this change, contact your administrator immediately.</p>
    </div>
  `)
});

// ─────────────────────────────────────────────────────────────
// Main sendEmail function
// ─────────────────────────────────────────────────────────────
const sendEmail = async ({ to, subject, html }) => {
  // Skip in test / CI environments
  if (process.env.NODE_ENV === 'test') {
    console.log(`[EMAIL SKIP – test mode] To: ${to} | Subject: ${subject}`);
    return;
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('[EMAIL] EMAIL_USER or EMAIL_PASS not configured – skipping email send.');
    console.log(`[EMAIL WOULD SEND] To: ${to} | Subject: ${subject}`);
    return;
  }

  const transporter = createTransporter();
  const info = await transporter.sendMail({
    from:    process.env.EMAIL_FROM || `Abdulmula Fashion ERP <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });

  console.log(`[EMAIL] Sent to ${to} | MessageId: ${info.messageId}`);
  return info;
};

module.exports = {
  sendEmail,
  templates: {
    welcome:         welcomeTemplate,
    reset:           resetTemplate,
    passwordChanged: passwordChangedTemplate,
  }
};
