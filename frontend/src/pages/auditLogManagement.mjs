export const AUDIT_ACTIONS = [
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
  'CASHBOOK_CREATE'
];

const SUCCESS_ACTIONS = new Set(['LOGIN', 'INVOICE_CREATE', 'CUSTOMER_CREATE']);
const DANGER_ACTIONS = new Set(['LOGIN_FAILED', 'PRODUCT_DELETE', 'INVOICE_DELETE', 'CUSTOMER_DELETE', 'SUPPLIER_DELETE']);
const WARNING_ACTIONS = new Set(['EXPENSE_CREATE', 'EXPENSE_DELETE', 'SUPPLIER_CREATE', 'SUPPLIER_UPDATE', 'OFFLINE_CONFLICT_REJECT']);

export function getAuditActionLabel(action) {
  return String(action || 'UNKNOWN').replaceAll('_', ' ');
}

export function getAuditActionTone(action) {
  if (SUCCESS_ACTIONS.has(action)) return 'success';
  if (DANGER_ACTIONS.has(action)) return 'danger';
  if (WARNING_ACTIONS.has(action)) return 'warning';
  if (action === 'LOGOUT') return 'primary';
  return 'info';
}

export function filterAuditLogs(logs, search) {
  const query = String(search || '').trim().toLowerCase();
  if (!query) return Array.isArray(logs) ? logs : [];

  return (Array.isArray(logs) ? logs : []).filter(log => {
    const searchable = [
      log.action,
      log.entity,
      log.entityId,
      log.user?.name,
      log.user?.email,
      log.user?.role,
      log.userName,
      log.ip,
      safeStringify(log.details)
    ].filter(Boolean).join(' ').toLowerCase();

    return searchable.includes(query);
  });
}

export function formatAuditDate(value, locale) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function safeStringify(value) {
  if (value == null) return '';
  try {
    return typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    return '';
  }
}
