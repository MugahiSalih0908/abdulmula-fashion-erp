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
  assert.match(adminPageSources.settings, /isAdmin \?/);
  assert.match(adminPageSources.settings, /administrator-managed/);
});

test('audit logs clearly state that search is page-scoped and events are read-only', () => {
  assert.match(adminPageSources.audit, /search scans the/);
  assert.match(adminPageSources.audit, /read-only/);
  assert.match(adminPageSources.audit, /aria-pressed=/);
  assert.match(adminPageSources.audit, /<details className="admin-audit-details">/);
});


test('phase 17 keeps route splitting, skeleton loading, and mobile-safe navigation', () => {
  const app = read('src/App.jsx');
  const fallback = read('src/components/PageLoadingFallback.jsx');
  assert.ok(app.includes("const DashboardPage = lazy(() => import('./pages/DashboardPage'));"));
  assert.ok(app.includes('<Suspense fallback={<PageLoadingFallback />}>'));
  assert.ok(fallback.includes('page-loading-card'));
  assert.ok(css.includes('.bottom-nav-item svg'));
  assert.ok(css.includes('env(safe-area-inset-bottom'));
  assert.equal(css.includes('fonts.googleapis.com'), false);
});

test('phase 17 directory screens use server-side pagination and debounced search', () => {
  const pagination = read('src/components/ui/PaginationBar.jsx');
  const hook = read('src/hooks/useDebouncedValue.js');
  for (const [name, source] of Object.entries(pageSources)) {
    if (['customers', 'suppliers', 'expenses'].includes(name)) {
      assert.ok(source.includes('useDebouncedValue'), name + ' should debounce search');
      assert.ok(source.includes('limit: 25'), name + ' should request a bounded page');
      assert.ok(source.includes('<PaginationBar'), name + ' should expose page controls');
    }
  }
  assert.ok(hook.includes('setTimeout'));
  assert.ok(pagination.includes('onPageChange'));
});

test('authentication profile fetch shares a single in-flight request', () => {
  const authStore = read('src/store/authStore.js');
  assert.ok(authStore.includes('let fetchMeInFlight = null'));
  assert.ok(authStore.includes('if (fetchMeInFlight) return fetchMeInFlight'));
  assert.ok(authStore.includes('get().accessToken === token'));
});


test('product catalogue uses server pagination without changing legacy POS calls', () => {
  const products = read('src/pages/ProductsPage.jsx');
  const route = read('../backend/routes/products.js');
  assert.ok(products.includes('limit:25'));
  assert.ok(products.includes('<PaginationBar'));
  assert.ok(products.includes('healthyStock'));
  assert.ok(route.includes('paginationRequested'));
  assert.ok(route.includes('totalPages: Math.max(1, Math.ceil(total / pageSize))'));
  assert.ok(route.includes("findQuery.populate('supplier', 'name')"));
  assert.ok(route.includes("const productFields = ["));
  assert.ok(route.includes("if (isManager) productFields.push('costPrice')"));
  assert.ok(route.includes("if (!isManager) findQuery.select('-costPrice')"));
  assert.ok(route.includes("if (req.user.role === 'staff') productQuery.select('-costPrice')"));
});
