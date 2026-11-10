import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity, BarChart3, BookOpen, ChevronRight, ClipboardList,
  LayoutDashboard, LogOut, Menu, Package, PanelLeftClose,
  PanelLeftOpen, Settings, ShieldCheck, ShoppingCart, Truck, UserCog, Users,
  Wallet, Wifi, WifiOff, X
} from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useRole } from '../../hooks/useRole';
import useAuthStore from '../../store/authStore';
import BottomNav from './BottomNav';
import Drawer from './Drawer';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/pos', label: 'POS', icon: ShoppingCart },
  { to: '/products', label: 'Products', icon: Package, permission: 'viewProducts' },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/suppliers', label: 'Suppliers', icon: Truck, permission: 'viewSuppliers' },
  { to: '/purchase-orders', label: 'Purchase Orders', icon: ClipboardList, permission: 'viewPOs' },
  { to: '/expenses', label: 'Expenses', icon: Wallet, permission: 'viewExpenses' },
  { to: '/cashbook', label: 'Cashbook', icon: BookOpen, permission: 'viewCashbook' },
  { to: '/reports', label: 'Reports', icon: BarChart3, permission: 'viewReports' },
  { to: '/staff', label: 'Staff', icon: UserCog, permission: 'manageStaff' },
  { to: '/audit-logs', label: 'Audit Logs', icon: ShieldCheck, permission: 'viewAuditLogs' },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const PRIMARY_TABS = [
  { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { to: '/pos', label: 'POS', icon: ShoppingCart },
  { to: '/products', label: 'Stock', icon: Package },
  { to: '/customers', label: 'People', icon: Users },
];

function getInitials(name) {
  return name?.trim()?.charAt(0)?.toUpperCase() || 'U';
}

function StatusIndicator({ isOnline, isSyncing, compact = false }) {
  const Icon = isOnline ? Wifi : WifiOff;
  const label = isSyncing ? 'Syncing' : isOnline ? 'Online' : 'Offline';

  return (
    <span
      className={`app-status ${isOnline ? 'is-online' : 'is-offline'} ${isSyncing ? 'is-syncing' : ''}`}
      role="status"
      aria-live="polite"
      title={label}
    >
      {isSyncing ? <Activity size={15} aria-hidden="true" /> : <Icon size={15} aria-hidden="true" />}
      {!compact && <span>{label}</span>}
    </span>
  );
}

function NavigationLinks({ items, collapsed = false, onNavigate }) {
  return items.map(({ to, label, icon: Icon }) => (
    <NavLink
      key={to}
      to={to}
      end
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={({ isActive }) => `app-nav-link${isActive ? ' is-active' : ''}`}
    >
      <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
      <span className="app-nav-label">{label}</span>
    </NavLink>
  ));
}

function UserIdentity({ user, compact = false }) {
  return (
    <div className={`app-user-identity${compact ? ' is-compact' : ''}`}>
      <span className="app-avatar" aria-hidden="true">{getInitials(user?.name)}</span>
      {!compact && (
        <span className="app-user-copy">
          <span className="app-user-name">{user?.name || 'Account'}</span>
          <span className="app-user-role">{user?.role || 'User'}</span>
        </span>
      )}
    </div>
  );
}

export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { isOnline, pendingCount, isSyncing } = useOnlineStatus();
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const { can } = useRole();

  const navigationItems = NAV_ITEMS.filter(item => !item.permission || can[item.permission]);
  const primaryItems = PRIMARY_TABS.filter(item => navigationItems.some(nav => nav.to === item.to));
  const moreItems = navigationItems.filter(item => !primaryItems.some(primary => primary.to === item.to));
  const currentPage = navigationItems.find(item => item.to === location.pathname);
  const isMoreActive = moreItems.some(item => item.to === location.pathname);

  useEffect(() => {
    setDrawerOpen(false);
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!moreOpen) return undefined;

    const handleKeyDown = event => {
      if (event.key === 'Escape') setMoreOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [moreOpen]);

  const handleLogout = () => {
    setDrawerOpen(false);
    setMoreOpen(false);
    logout();
    navigate('/login');
  };

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <aside className="app-sidebar" aria-label="Main navigation">
        <div className="app-sidebar-brand">
          <NavLink to="/dashboard" className="app-brand" aria-label="Abdulmula Fashion dashboard">
            <span className="app-brand-mark" aria-hidden="true">AF</span>
            <span className="app-brand-copy">
              <span className="app-brand-name">Abdulmula Fashion</span>
              <span className="app-brand-subtitle">Enterprise</span>
            </span>
          </NavLink>
          <button
            type="button"
            className="app-collapse-button"
            onClick={() => setSidebarCollapsed(value => !value)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed
              ? <PanelLeftOpen size={18} aria-hidden="true" />
              : <PanelLeftClose size={18} aria-hidden="true" />}
          </button>
        </div>

        <nav className="app-sidebar-nav" aria-label="Workspace">
          <p className="app-nav-section-label">Workspace</p>
          <NavigationLinks items={navigationItems} collapsed={sidebarCollapsed} />
        </nav>

        <div className="app-sidebar-footer">
          <UserIdentity user={user} compact={sidebarCollapsed} />
          <button
            type="button"
            className="app-logout-button"
            onClick={handleLogout}
            title={sidebarCollapsed ? 'Log out' : undefined}
            aria-label="Log out"
          >
            <LogOut size={18} aria-hidden="true" />
            <span className="app-nav-label">Log out</span>
          </button>
        </div>
      </aside>

      <div className="app-main-column">
        <header className="app-header">
          <button
            type="button"
            className="app-mobile-menu-button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
            aria-controls="app-mobile-drawer"
          >
            <Menu size={21} aria-hidden="true" />
          </button>

          <div className="app-header-title">
            <span className="app-mobile-brand-mark" aria-hidden="true">AF</span>
            <div>
              <p className="app-page-title">{currentPage?.label || 'Workspace'}</p>
              <p className="app-page-context">Abdulmula Fashion ERP</p>
            </div>
          </div>

          <div className="app-header-actions">
            <StatusIndicator isOnline={isOnline} isSyncing={isSyncing} />
            {pendingCount > 0 && (
              <span className="app-pending-count" title={`${pendingCount} offline sale(s) awaiting sync`}>
                {pendingCount} pending
              </span>
            )}
            <button
              type="button"
              className="app-mobile-profile-button"
              onClick={() => setMoreOpen(true)}
              aria-label="Open account and more navigation"
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
            >
              <UserIdentity user={user} compact />
            </button>
            <span className="app-desktop-user-name">{user?.name || 'Account'}</span>
          </div>
        </header>

        <main className="app-main-content" id="main-content">
          <Outlet />
        </main>
      </div>

      <BottomNav
        items={primaryItems.map(item => ({
          path: item.to,
          label: item.label,
          icon: <item.icon size={20} strokeWidth={1.8} aria-hidden="true" />,
        }))}
        onMoreClick={() => setMoreOpen(true)}
        isMoreActive={isMoreActive}
        isMoreOpen={moreOpen}
      />

      <Drawer isOpen={drawerOpen} onClose={closeDrawer} id="app-mobile-drawer">
        <div className="app-drawer-profile">
          <UserIdentity user={user} compact />
          <div className="app-drawer-user-details">
            <span>{user?.name || 'Account'}</span>
            <span>{user?.email || 'Signed in'}</span>
            <span className="app-drawer-user-role">{user?.role || 'User'}</span>
          </div>
        </div>
        <nav className="app-drawer-nav" aria-label="Workspace">
          <p className="app-nav-section-label">Workspace</p>
          <NavigationLinks items={navigationItems} onNavigate={closeDrawer} />
        </nav>
        <button type="button" className="app-logout-button app-drawer-logout" onClick={handleLogout}>
          <LogOut size={18} aria-hidden="true" />
          <span>Log out</span>
        </button>
      </Drawer>

      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.button
              type="button"
              className="app-more-backdrop"
              aria-label="Dismiss more menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMoreOpen(false)}
            />
            <motion.section
              className="app-more-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="More navigation"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            >
              <div className="app-more-sheet-header">
                <div>
                  <p className="app-more-sheet-title">More</p>
                  <p className="app-more-sheet-subtitle">Your workspace and account</p>
                </div>
                <button type="button" className="app-more-close" onClick={() => setMoreOpen(false)} aria-label="Close more menu">
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
              <div className="app-more-links">
                {moreItems.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end
                    onClick={() => setMoreOpen(false)}
                    className={({ isActive }) => `app-more-link${isActive ? ' is-active' : ''}`}
                  >
                    <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                    <span>{label}</span>
                    <ChevronRight size={17} className="app-more-chevron" aria-hidden="true" />
                  </NavLink>
                ))}
              </div>
              <div className="app-more-footer">
                <StatusIndicator isOnline={isOnline} isSyncing={isSyncing} />
                {pendingCount > 0 && <span>{pendingCount} sale(s) pending sync</span>}
              </div>
            </motion.section>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
