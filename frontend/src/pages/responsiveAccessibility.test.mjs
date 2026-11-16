import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

const appLayout = read('src/components/layout/AppLayout.jsx');
const drawer = read('src/components/layout/Drawer.jsx');
const sheet = read('src/components/ui/Sheet.jsx');
const css = read('src/index.css');

const pageSources = {
  customers: read('src/pages/CustomersPage.jsx'),
  suppliers: read('src/pages/SuppliersPage.jsx'),
  expenses: read('src/pages/ExpensesPage.jsx'),
  purchaseOrders: read('src/pages/PurchaseOrdersPage.jsx'),
  invoices: read('src/pages/InvoicesPage.jsx'),
  reports: read('src/pages/ReportsPage.jsx')
};

test('application shell has one content landmark target and a keyboard skip link', () => {
  assert.match(appLayout, /className="app-skip-link" href="#main-content"/);
  assert.match(appLayout, /<div className="app-main-content" id="main-content" tabIndex=\{-1\}>/);
  assert.doesNotMatch(appLayout, /<main className="app-main-content"/);
});

test('reusable sheets expose modal semantics, trap focus and restore prior focus', () => {
  assert.match(sheet, /role="dialog"/);
  assert.match(sheet, /aria-modal="true"/);
  assert.match(sheet, /event\.key === 'Escape'/);
  assert.match(sheet, /event\.key !== 'Tab'/);
  assert.match(sheet, /last\.focus\(\)/);
  assert.match(sheet, /previouslyFocused\.focus\(\)/);
  assert.match(sheet, /document\.body\.style\.overflow = 'hidden'/);
});

test('mobile navigation drawer retains keyboard focus management', () => {
  assert.match(drawer, /role="dialog"/);
  assert.match(drawer, /aria-modal="true"/);
  assert.match(drawer, /event\.key === 'Escape'/);
  assert.match(drawer, /event\.key !== 'Tab'/);
  assert.match(drawer, /previouslyFocused\.focus\(\)/);
});

test('more navigation dialog traps focus and restores scroll and focus', () => {
  assert.match(appLayout, /moreDialogRef/);
  assert.match(appLayout, /moreCloseRef/);
  assert.match(appLayout, /aria-modal="true"/);
  assert.match(appLayout, /event\.key === 'Escape'/);
  assert.match(appLayout, /event\.key !== 'Tab'/);
  assert.match(appLayout, /previouslyFocused\.focus\(\)/);
});

test('layout defines phone, compact-phone and desktop breakpoints with safe-area handling', () => {
  assert.match(css, /min-width:\s*320px/);
  assert.match(css, /@media\s*\(max-width:\s*359px\)/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)/);
  assert.match(css, /@media\s*\(min-width:\s*1024px\)/);
  assert.match(css, /env\(safe-area-inset-bottom/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test('business pages retain responsive desktop and mobile list layouts', () => {
  for (const [name, source] of Object.entries(pageSources)) {
    assert.match(source, /sm:/, name + ' should define a small-screen layout');
    assert.match(source, /lg:/, name + ' should define a desktop layout');
  }
  assert.match(pageSources.customers, /lg:hidden/);
  assert.match(pageSources.suppliers, /lg:hidden/);
  assert.match(pageSources.expenses, /lg:hidden/);
  assert.match(pageSources.purchaseOrders, /sm:grid-cols-2/);
  assert.match(pageSources.invoices, /lg:hidden/);
});

test('new business forms use explicit labels for primary input fields', () => {
  for (const [name, source] of Object.entries({
    customers: pageSources.customers,
    suppliers: pageSources.suppliers,
    expenses: pageSources.expenses,
    purchaseOrders: pageSources.purchaseOrders
  })) {
    assert.match(source, /<label htmlFor=/, name + ' should label primary form controls');
  }
});


const adminPageSources = {
  settings: read('src/pages/SettingsPage.jsx'),
  audit: read('src/pages/AuditLogsPage.jsx'),
  adminStyles: read('src/pages/adminWorkspace.css')
};

test('remaining administration pages use the shared premium workspace shell', () => {
  assert.match(adminPageSources.settings, /admin-page admin-settings-page/);
  assert.match(adminPageSources.audit, /admin-page admin-audit-page/);
  assert.match(adminPageSources.adminStyles, /\.admin-settings-profile/);
  assert.match(adminPageSources.adminStyles, /\.admin-audit-hero/);
  assert.match(adminPageSources.adminStyles, /@media \(max-width: 639px\)/);
  assert.match(adminPageSources.adminStyles, /@media \(min-width: 1024px\)/);
});

test('settings keeps accessible account, password and exchange-rate form labels', () => {
  assert.match(adminPageSources.settings, /htmlFor="settings-profile-name"/);
  assert.match(adminPageSources.settings, /htmlFor="settings-profile-email"/);
  assert.match(adminPageSources.settings, /htmlFor="settings-new-password"/);
  assert.match(adminPageSources.settings, /htmlFor="settings-confirm-password"/);
  assert.match(adminPageSources.settings, /htmlFor="settings-exchange-rate"/);
});

test('audit logs clearly state that search is page-scoped and events are read-only', () => {
  assert.match(adminPageSources.audit, /search scans the/);
  assert.match(adminPageSources.audit, /read-only/);
  assert.match(adminPageSources.audit, /aria-pressed=/);
  assert.match(adminPageSources.audit, /<details className="admin-audit-details">/);
});
