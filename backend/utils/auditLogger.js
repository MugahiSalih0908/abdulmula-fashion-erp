// utils/auditLogger.js – helpers to write audit log entries (ADR-0001 §12.5)
//
// log(entry)                       Best effort, outside transactions; never throws. Inside a
//                                  runTransaction() callback it writes nothing and reports the
//                                  misuse instead (D11).
// recordAudit(entry, { session })  Transactional: needs an active transaction session and a
//                                  listed action, writes through the session and propagates a
//                                  failed write, so the business change rolls back with it.
// Both store the same fields as before S0-5a. A failure is reported only as a safe log line:
// never the error message, audit details, user names, emails, tokens, IP addresses or user agents.

const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const { isAuditAction } = require('./auditActions');
const { describeError, emitSafeLine, isInsideTransaction } = require('./transactions');

const AUDIT_WRITE_FAILED_EVENT = 'audit.write_failed';
const AUDIT_ACTION_REJECTED_EVENT = 'audit.action_rejected';
const AUDIT_INSIDE_TRANSACTION_EVENT = 'audit.log_inside_transaction';

const ENTITY_NAME = /^[A-Z][A-Za-z]{0,63}$/;
const OBJECT_ID = /^[0-9a-f]{24}$/i;

// The stored entry, with the same fields as before S0-5a.
const buildEntry = ({ user, action, entity, entityId, details, req }) => ({
  user:      user?._id || user,
  userName:  user?.name,
  action,
  entity,
  entityId:  entityId?.toString(),
  details,
  ip:        req?.ip || req?.headers?.['x-forwarded-for'],
  userAgent: req?.headers?.['user-agent']
});

const entityIdOf = entry => {
  try {
    const value = entry?.entityId?.toString();
    return typeof value === 'string' && OBJECT_ID.test(value) ? value : undefined;
  } catch {
    return undefined;
  }
};

// A safe line about an audit entry: the event, a listed action, the entity name, an
// ObjectId-shaped entity ID and the error's safe description. Nothing else from the entry.
const auditLine = (event, entry, error) => {
  const line = { event };
  if (isAuditAction(entry?.action)) line.action = entry.action;
  if (typeof entry?.entity === 'string' && ENTITY_NAME.test(entry.entity)) line.entity = entry.entity;
  const entityId = entityIdOf(entry);
  if (entityId !== undefined) line.entityId = entityId;
  if (error !== undefined) line.error = describeError(error);
  return line;
};

/**
 * log({ user, action, entity, entityId, details, req }) – best effort; never throws (MR-4)
 */
const log = async entry => {
  try {
    if (isInsideTransaction()) {
      emitSafeLine(auditLine(AUDIT_INSIDE_TRANSACTION_EVENT, entry));
      return;
    }
    if (!isAuditAction(entry?.action)) {
      emitSafeLine(auditLine(AUDIT_ACTION_REJECTED_EVENT, entry));
      return;
    }
    await AuditLog.create(buildEntry(entry));
  } catch (error) {
    try {
      emitSafeLine(auditLine(AUDIT_WRITE_FAILED_EVENT, entry, error));
    } catch {
      // Audit logging must never crash the main flow.
    }
  }
};

const auditRecordError = message => {
  const error = new Error(message);
  error.name = 'AuditRecordError';
  return error;
};

/**
 * recordAudit({ user, action, entity, entityId, details, req }, { session }) – inside a
 * transaction (MR-3, MR-5). Checks everything before writing; a failed write propagates.
 */
const recordAudit = async (entry, options) => {
  const session = options?.session;
  if (!(session instanceof mongoose.mongo.ClientSession) || session.hasEnded || !session.inTransaction()) {
    throw auditRecordError('recordAudit() needs an active transaction session.');
  }
  if (!isAuditAction(entry?.action)) {
    throw auditRecordError('recordAudit() needs a listed audit action.');
  }
  try {
    const [stored] = await AuditLog.create([buildEntry(entry)], { session });
    return stored;
  } catch (error) {
    emitSafeLine(auditLine(AUDIT_WRITE_FAILED_EVENT, entry, error));
    throw error;
  }
};

module.exports = { log, recordAudit };
