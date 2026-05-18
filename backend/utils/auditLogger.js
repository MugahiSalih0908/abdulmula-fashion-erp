// utils/auditLogger.js – helper to write audit log entries

const AuditLog = require('../models/AuditLog');

/**
 * log({ user, action, entity, entityId, details, req })
 */
const log = async ({ user, action, entity, entityId, details, req }) => {
  try {
    await AuditLog.create({
      user:      user?._id || user,
      userName:  user?.name,
      action,
      entity,
      entityId:  entityId?.toString(),
      details,
      ip:        req?.ip || req?.headers?.['x-forwarded-for'],
      userAgent: req?.headers?.['user-agent']
    });
  } catch (err) {
    // Audit logging must never crash the main flow
    console.error('Audit log error:', err.message);
  }
};

module.exports = { log };
