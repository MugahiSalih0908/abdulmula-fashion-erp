'use strict';
// utils/auditActions.js – the only list of audit actions (ADR-0001 §12.5, §12.6)
//
// The AuditLog schema enum is built from this list. Tests compare the two exactly (A1) and check
// that every audit action written as a literal in the backend source is on it (A2, C14).

const AUDIT_ACTIONS = Object.freeze([
  // Existing actions (22)
  'LOGIN',
  'LOGOUT',
  'LOGIN_FAILED',
  'PRODUCT_CREATE',
  'PRODUCT_UPDATE',
  'PRODUCT_DELETE',
  'INVOICE_CREATE',
  'INVOICE_DELETE',
  'OFFLINE_CONFLICT_APPROVE',
  'OFFLINE_CONFLICT_REJECT',
  'EXPENSE_CREATE',
  'EXPENSE_DELETE',
  'CUSTOMER_CREATE',
  'CUSTOMER_UPDATE',
  'CUSTOMER_DELETE',
  'SUPPLIER_CREATE',
  'SUPPLIER_UPDATE',
  'SUPPLIER_DELETE',
  'STOCK_ADJUST',
  'USER_CREATE',
  'USER_UPDATE',
  'CASHBOOK_CREATE',
  // Previously missing actions (12)
  'CASHBOOK_CLOSING_SUBMIT',
  'CASHBOOK_CLOSING_APPROVE',
  'INVITATION_CREATED',
  'USER_CREATED_FROM_INVITATION',
  'INVITATION_RESENT',
  'INVITATION_DELETED',
  'PURCHASE_ORDER_CREATE',
  'PURCHASE_ORDER_UPDATE',
  'PURCHASE_ORDER_DELETE',
  'PURCHASE_ORDER_ORDERED',
  'PURCHASE_ORDER_RECEIVE',
  'SUPPLIER_PAYMENT',
  // New actions (5)
  'INVOICE_DELETE_REFUSED',
  'CUSTOMER_UPDATE_REJECTED',
  'CUSTOMER_PAYMENT_RECORD',
  'CUSTOMER_PAYMENT_REVERSE',
  'EXCHANGE_RATE_UPDATE'
]);

const ACTION_SET = new Set(AUDIT_ACTIONS);

const isAuditAction = value => typeof value === 'string' && ACTION_SET.has(value);

module.exports = { AUDIT_ACTIONS, isAuditAction };
