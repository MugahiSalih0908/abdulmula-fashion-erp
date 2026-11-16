const express = require('express');
const { Resend } = require('resend');
const EmailLog = require('../models/EmailLog');
const EmailWebhookEvent = require('../models/EmailWebhookEvent');
const { mapResendEvent, shouldApplyEmailEvent } = require('../utils/emailStatus');

const router = express.Router();

router.post('/resend', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) return res.status(503).json({ success: false, message: 'Email webhook is not configured.' });
  if (!Buffer.isBuffer(req.body)) return res.status(400).json({ success: false, message: 'Raw webhook body is required.' });

  let event;
  try {
    const verifier = new Resend(process.env.RESEND_API_KEY || 're_webhook_verification_only');
    event = verifier.webhooks.verify({
      payload: req.body.toString('utf8'),
      headers: {
        id: req.get('svix-id'),
        timestamp: req.get('svix-timestamp'),
        signature: req.get('svix-signature')
      },
      webhookSecret
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Invalid email webhook signature.' });
  }

  const eventId = req.get('svix-id');
  const eventType = event && event.type;
  const status = mapResendEvent(eventType);
  const data = (event && event.data) || {};
  const providerEmailId = data.email_id;
  const recipient = Array.isArray(data.to) ? data.to[0] : data.to;
  const occurredAt = event && event.created_at ? new Date(event.created_at) : new Date();

  if (!eventId || !eventType) return res.status(400).json({ success: false, message: 'Incomplete webhook event.' });

  try {
    await EmailWebhookEvent.create({ eventId, eventType, providerEmailId, recipient, occurredAt });
  } catch (error) {
    if (error && error.code === 11000) return res.status(200).json({ received: true, duplicate: true });
    console.error('[EMAIL WEBHOOK STORE ERROR]', error.code || error.message);
    return res.status(500).json({ success: false, message: 'Could not store webhook event.' });
  }

  if (status && providerEmailId) {
    try {
      const current = await EmailLog.findOne({ providerEmailId });
      if (current && shouldApplyEmailEvent(current.status, current.lastEventAt, status, occurredAt)) {
        current.status = status;
        current.lastEventAt = occurredAt;
        current.lastEventType = eventType;
        if (status === 'delivered') current.deliveredAt = occurredAt;
        if (['bounced', 'complained', 'failed'].includes(status)) {
          const details = (data.bounce && data.bounce.message) || data.reason || data.message || eventType;
          current.lastErrorMessage = String(details).slice(0, 240);
        }
        await current.save();
      }
    } catch (error) {
      console.error('[EMAIL WEBHOOK UPDATE ERROR]', error.code || error.message);
      return res.status(500).json({ success: false, message: 'Could not update email delivery status.' });
    }
  }

  return res.status(200).json({ received: true });
});

module.exports = router;
