import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import useSettingsStore from '../store/settingsStore';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useRole } from '../hooks/useRole';
import {
  approveOfflinePriceConflict,
  getOfflineSales,
  rejectOfflinePriceConflict
} from '../offline/syncManager';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import CardBody from '../components/ui/CardBody';
import Badge from '../components/ui/Badge';
import Sheet from '../components/ui/Sheet';
import {
  UserRound, LockKeyhole, Wifi, WifiOff, ChevronRight, AlertTriangle,
  CheckCircle2, Eye, EyeOff, AlertCircle, LogOut, RefreshCw,
  DollarSign, ArrowLeftRight, Info, ShieldCheck, SlidersHorizontal
} from 'lucide-react';
import './adminWorkspace.css';

export default function SettingsPage() {
  const user = useAuthStore(state => state.user);
  const offlineUserId = useAuthStore(state => state.offlineUserId || state.user?._id || state.user?.id);
  const logout = useAuthStore(state => state.logout);
  const navigate = useNavigate();
  const { isOnline, pendingCount, isSyncing } = useOnlineStatus();
  const { isManager, isAdmin } = useRole();
  const { currency, setCurrency, usdToSsp, setRate } = useSettingsStore();
  const [sheet, setSheet] = useState(null);
  const [offlineSales, setOfflineSales] = useState([]);
  const [offlineLoadError, setOfflineLoadError] = useState('');
  const [resolvingSaleId, setResolvingSaleId] = useState(null);

  useEffect(() => {
    let active = true;
    getOfflineSales(offlineUserId, isManager)
      .then(sales => {
        if (!active) return;
        setOfflineSales(Array.isArray(sales) ? sales : []);
        setOfflineLoadError('');
      })
      .catch(error => {
        if (active) setOfflineLoadError(error?.message || 'Offline sales could not be loaded.');
      });
    return () => { active = false; };
  }, [pendingCount, offlineUserId, isManager]);

  const reviewSales = offlineSales.filter(sale => ['blocked', 'rejected'].includes(sale.syncStatus));

  const refreshOfflineSales = async () => {
    const sales = await getOfflineSales(offlineUserId, isManager);
    setOfflineSales(Array.isArray(sales) ? sales : []);
    setOfflineLoadError('');
  };

  const handleApproveOfflineSale = async saleId => {
    const sale = offlineSales.find(item => item.id === saleId);
    const priceLines = (sale?.syncConflict?.items || []).map(item =>
      (item.productName || item.productId) + ' — qty ' + item.quantity
        + ', offline quote ' + formatPrice(item.offlineQuotedUnitPrice)
        + ', current catalog ' + formatPrice(item.currentUnitPriceAtConflict)
    ).join('\n');

    if (!window.confirm(
      'Approve this sale at its offline quoted prices?\n\n' + priceLines
      + '\n\nThe server will re-check current catalog prices before saving.'
    )) return;

    setResolvingSaleId(saleId);
    try {
      const invoice = await approveOfflinePriceConflict(saleId, offlineUserId, isManager);
      toast.success('Offline sale ' + invoice.invoiceNumber + ' approved and synced.');
      await refreshOfflineSales();
    } catch (error) {
      refreshOfflineSales().catch(() => {});
      toast.error(error?.response?.data?.message || error.message || 'Could not resolve offline sale.');
    } finally {
      setResolvingSaleId(null);
    }
  };

  const handleRejectOfflineSale = async saleId => {
    if (!isOnline) {
      toast.error('Connect to the internet to record a manager rejection.');
      return;
    }
    if (!window.confirm(
      'Reject this offline sale? It will be marked terminal on this device and will never sync automatically.'
    )) return;

    setResolvingSaleId(saleId);
    try {
      const resolution = await rejectOfflinePriceConflict(saleId, offlineUserId, isManager);
      toast.success('Offline sale rejected by ' + resolution.decidedBy + '.');
      await refreshOfflineSales();
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message || 'Could not reject offline sale.');
    } finally {
      setResolvingSaleId(null);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm('Log out of Abdulmula Fashion ERP?')) return;
    await logout();
    navigate('/login');
  };

  const initials = user?.name?.trim()?.charAt(0)?.toUpperCase() || 'U';

  return (
    <main className="admin-page admin-settings-page">
      <PageHeader
        title="Settings"
        sub="Manage your account, workspace preferences and connection status"
        action={<Badge variant="info"><SlidersHorizontal size={13} aria-hidden="true" /> Preferences</Badge>}
      />

      <section className="admin-settings-profile" aria-label="Signed-in account">
        <div className="admin-settings-identity">
          <span className="admin-settings-avatar" aria-hidden="true">{initials}</span>
          <div className="admin-settings-identity-copy">
            <span className="admin-settings-eyebrow">SIGNED IN AS</span>
            <h2>{user?.name || 'Account'}</h2>
            <p>{user?.email || 'Email not available'}</p>
            <div className="admin-settings-profile-badges">
              <Badge variant="primary">{String(user?.role || 'user').toUpperCase()}</Badge>
              <span className="admin-settings-profile-status"><span /> Active session</span>
            </div>
          </div>
        </div>
        {isAdmin ? (
          <div className="admin-settings-profile-actions">
            <Button variant="secondary" onClick={() => setSheet('profile')}>
              <UserRound size={15} aria-hidden="true" /> Edit profile
            </Button>
            <Button variant="secondary" onClick={() => setSheet('password')}>
              <LockKeyhole size={15} aria-hidden="true" /> Change password
            </Button>
          </div>
        ) : (
          <p className="admin-settings-access-note"><ShieldCheck size={15} aria-hidden="true" /> Account profile and password changes are administrator-managed in this workspace.</p>
        )}
      </section>

      <section className="admin-settings-summary" aria-label="Workspace status">
        <article className="admin-settings-summary-card">
          <span className="admin-settings-summary-icon"><Wifi size={17} aria-hidden="true" /></span>
          <div><span>Connection</span><strong>{isOnline ? 'Online' : 'Offline mode'}</strong></div>
          <span className={'admin-settings-dot ' + (isOnline ? 'is-online' : 'is-offline')} />
        </article>
        <article className="admin-settings-summary-card">
          <span className="admin-settings-summary-icon"><RefreshCw size={17} aria-hidden="true" /></span>
          <div><span>Pending sync</span><strong>{pendingCount.toLocaleString()} sale(s)</strong></div>
        </article>
        <article className="admin-settings-summary-card">
          <span className="admin-settings-summary-icon"><DollarSign size={17} aria-hidden="true" /></span>
          <div><span>Display currency</span><strong>{currency}</strong></div>
        </article>
        <article className="admin-settings-summary-card">
          <span className="admin-settings-summary-icon"><ArrowLeftRight size={17} aria-hidden="true" /></span>
          <div><span>Exchange rate</span><strong>1 USD = {Number(usdToSsp || 0).toLocaleString()} SSP</strong></div>
        </article>
      </section>

      <div className="admin-settings-grid">
        <div className="admin-settings-main-column">
          <Card className="admin-settings-panel">
            <CardBody className="p-4 sm:p-5">
              <div className="admin-settings-panel-heading">
                <span className="admin-settings-panel-icon"><DollarSign size={18} aria-hidden="true" /></span>
                <div>
                  <h2>Display & currency</h2>
                  <p>Choose how monetary values appear across your workspace</p>
                </div>
              </div>
              <div className="admin-settings-currency-block">
                <div>
                  <p className="admin-settings-field-label">Preferred display currency</p>
                  <p className="admin-settings-field-help">This changes display formatting, not stored transaction values.</p>
                </div>
                <div className="admin-settings-segmented" role="group" aria-label="Display currency">
                  {['USD', 'SSP'].map(option => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={currency === option}
                      onClick={() => setCurrency(option)}
                      className={currency === option ? 'is-active' : ''}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              <div className="admin-settings-rate-row">
                <div>
                  <span className="admin-settings-field-label">Current exchange rate</span>
                  <strong>1 USD = {Number(usdToSsp || 0).toLocaleString()} SSP</strong>
                </div>
                {isManager && (
                  <Button variant="secondary" size="sm" onClick={() => setSheet('rate')}>
                    <ArrowLeftRight size={14} aria-hidden="true" /> Update rate
                  </Button>
                )}
              </div>
              {!isManager && (
                <p className="admin-settings-inline-note"><Info size={14} aria-hidden="true" /> Ask a manager or administrator to update the business exchange rate.</p>
              )}
            </CardBody>
          </Card>

          <Card className="admin-settings-panel">
            <CardBody className="p-4 sm:p-5">
              <div className="admin-settings-panel-heading">
                <span className="admin-settings-panel-icon"><Wifi size={18} aria-hidden="true" /></span>
                <div>
                  <h2>Connection & offline activity</h2>
                  <p>See whether this device can reach the server and whether sales are waiting to sync</p>
                </div>
              </div>
              <div className={'admin-settings-connection ' + (isOnline ? 'is-online' : 'is-offline')}>
                <span className="admin-settings-connection-icon">
                  {isOnline ? <Wifi size={19} aria-hidden="true" /> : <WifiOff size={19} aria-hidden="true" />}
                </span>
                <div>
                  <strong>{isOnline ? 'Connected to the workspace' : 'Working offline'}</strong>
                  <p>{isOnline ? 'The application can communicate with the server.' : 'Sales can be saved on this device and synchronized when the connection returns.'}</p>
                </div>
                {isSyncing && <RefreshCw className="admin-settings-sync-icon" size={18} aria-label="Synchronizing offline sales" />}
              </div>
              {pendingCount > 0 && (
                <div className="admin-settings-pending">
                  <div><strong>{pendingCount.toLocaleString()} sale(s) awaiting synchronization</strong><p>Keep this device online until the queue has been processed.</p></div>
                  <Badge variant="warning">Pending</Badge>
                </div>
              )}
              {offlineLoadError && (
                <p className="admin-settings-inline-note is-warning"><AlertCircle size={14} aria-hidden="true" /> {offlineLoadError}</p>
              )}
              {reviewSales.length > 0 && (
                <div className="admin-settings-conflicts">
                  <div className="admin-settings-conflicts-heading">
                    <AlertTriangle size={18} aria-hidden="true" />
                    <div><strong>Offline sales requiring review</strong><p>Price conflicts do not retry automatically. Rejected records remain available for audit visibility.</p></div>
                  </div>
                  {reviewSales.map(sale => (
                    <article key={sale.id} className="admin-settings-conflict-item">
                      <div className="admin-settings-conflict-title">
                        <div><strong>{sale.syncStatus === 'rejected' ? 'Rejected offline sale' : 'Price conflict'}</strong><span>{sale.offlineId}</span></div>
                        <Badge variant={sale.syncStatus === 'rejected' ? 'danger' : 'warning'}>{sale.syncStatus}</Badge>
                      </div>
                      {sale.syncStatus === 'rejected' ? (
                        <>
                          <p className="admin-settings-conflict-copy">Rejected by {sale.resolution?.decidedBy || 'manager/admin'} on {formatDate(sale.resolution?.decidedAt)}. This sale is retained for audit visibility and will not sync.</p>
                          <p className="admin-settings-conflict-meta">Client-reported saved time (unverified): {formatDate(sale.createdAt)}</p>
                        </>
                      ) : (
                        <>
                          <p className="admin-settings-conflict-copy">{sale.syncError || 'The saved offline prices differ from the current product catalogue.'}</p>
                          <p className="admin-settings-conflict-meta">Client-reported saved time (unverified): {formatDate(sale.createdAt)}</p>
                          <OfflineConflictPrices sale={sale} />
                          {isManager && sale.syncConflict?.items?.length > 0 && (
                            <div className="admin-settings-conflict-actions">
                              <Button onClick={() => handleApproveOfflineSale(sale.id)} disabled={resolvingSaleId === sale.id || !isOnline}>
                                <CheckCircle2 size={15} aria-hidden="true" />
                                {resolvingSaleId === sale.id ? 'Approving…' : 'Approve quoted prices'}
                              </Button>
                              <Button variant="secondary" onClick={() => handleRejectOfflineSale(sale.id)} disabled={resolvingSaleId === sale.id || !isOnline}>
                                {resolvingSaleId === sale.id ? 'Recording…' : 'Reject sale'}
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </article>
                  ))}
                </div>
              )}
              {!pendingCount && reviewSales.length === 0 && !offlineLoadError && (
                <div className="admin-settings-clear-state"><CheckCircle2 size={16} aria-hidden="true" /><span>No offline sales are waiting for review.</span></div>
              )}
            </CardBody>
          </Card>
        </div>

        <aside className="admin-settings-side-column" aria-label="Account preferences and information">
          <Card className="admin-settings-panel">
            <CardBody className="p-4 sm:p-5">
              <div className="admin-settings-panel-heading">
                <span className="admin-settings-panel-icon"><ShieldCheck size={18} aria-hidden="true" /></span>
                <div><h2>Account & security</h2><p>Personal profile and sign-in controls</p></div>
              </div>
              {isAdmin ? (
                <div className="admin-settings-actions-list">
                  <SettingsAction icon={<UserRound size={17} />} label="Edit profile" description="Update your name and email" onClick={() => setSheet('profile')} />
                  <SettingsAction icon={<LockKeyhole size={17} />} label="Change password" description="Use a new password for future sign-ins" onClick={() => setSheet('password')} />
                </div>
              ) : (
                <p className="admin-settings-access-note"><ShieldCheck size={15} aria-hidden="true" /> Contact an administrator to update account details or reset your password. These actions use administrator-only endpoints.</p>
              )}
            </CardBody>
          </Card>

          <Card className="admin-settings-panel">
            <CardBody className="p-4 sm:p-5">
              <div className="admin-settings-panel-heading">
                <span className="admin-settings-panel-icon"><Info size={18} aria-hidden="true" /></span>
                <div><h2>About this workspace</h2><p>Application and business information</p></div>
              </div>
              <div className="admin-settings-actions-list">
                <SettingsAction icon={<Info size={17} />} label="About Abdulmula Fashion" description="Version, business and platform details" onClick={() => setSheet('about')} />
              </div>
              <div className="admin-settings-version">
                <span>Application</span><strong>Abdulmula Fashion ERP</strong>
                <span>Version</span><strong>3.0.0</strong>
              </div>
            </CardBody>
          </Card>

          <Card className="admin-settings-danger-panel">
            <CardBody className="p-4 sm:p-5">
              <div className="admin-settings-panel-heading">
                <span className="admin-settings-panel-icon is-danger"><LogOut size={18} aria-hidden="true" /></span>
                <div><h2>End your session</h2><p>Sign out of this device</p></div>
              </div>
              <Button variant="danger" className="w-full" onClick={handleLogout}>
                <LogOut size={15} aria-hidden="true" /> Log out
              </Button>
            </CardBody>
          </Card>
        </aside>
      </div>

      {sheet === 'profile' && <Sheet open title="Edit Profile" onClose={() => setSheet(null)}><EditProfileForm onClose={() => setSheet(null)} /></Sheet>}
      {sheet === 'password' && <Sheet open title="Change Password" onClose={() => setSheet(null)}><ChangePasswordForm onClose={() => setSheet(null)} /></Sheet>}
      {sheet === 'rate' && <Sheet open title="Exchange Rate" onClose={() => setSheet(null)}><RateForm onClose={() => setSheet(null)} /></Sheet>}
      {sheet === 'about' && <Sheet open title="About Abdulmula Fashion" onClose={() => setSheet(null)}><AboutContent /></Sheet>}
    </main>
  );
}

function formatPrice(value) {
  const number = Number(value);
  return Number.isFinite(number) ? '$' + number.toFixed(2) : 'Unavailable';
}

function formatDate(value) {
  if (!value) return 'unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function OfflineConflictPrices({ sale }) {
  const items = sale.syncConflict?.items || [];
  if (!items.length) {
    return <p className="admin-settings-conflict-meta">Price comparison details are unavailable for this older queued record.</p>;
  }
  return (
    <div className="admin-settings-price-list">
      {items.map((item, index) => (
        <div key={(item.productId || 'product') + '-' + index}>
          <strong>{item.productName || item.productId} · quantity {item.quantity}</strong>
          <span>Offline quoted price: <b>{formatPrice(item.offlineQuotedUnitPrice)}</b></span>
          <span>Current catalogue price at last server check: <b>{formatPrice(item.currentUnitPriceAtConflict)}</b></span>
        </div>
      ))}
    </div>
  );
}

function SettingsAction({ icon, label, description, onClick }) {
  return (
    <button type="button" className="admin-settings-action" onClick={onClick}>
      <span className="admin-settings-action-icon" aria-hidden="true">{icon}</span>
      <span className="admin-settings-action-copy"><strong>{label}</strong><small>{description}</small></span>
      <ChevronRight size={17} aria-hidden="true" />
    </button>
  );
}

function EditProfileForm({ onClose }) {
  const user = useAuthStore(state => state.user);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { name: user?.name || '', email: user?.email || '' }
  });

  const onSubmit = async data => {
    try {
      await api.put('/staff/' + user?.id, data);
      toast.success('Profile updated.');
      onClose();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Profile update failed.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="admin-settings-form">
      <div className="admin-settings-form-field">
        <label htmlFor="settings-profile-name">Full name</label>
        <input id="settings-profile-name" autoComplete="name" {...register('name', { required: 'Enter your name.' })} />
        {errors.name && <p role="alert">{errors.name.message}</p>}
      </div>
      <div className="admin-settings-form-field">
        <label htmlFor="settings-profile-email">Email address</label>
        <input id="settings-profile-email" type="email" autoComplete="email" {...register('email', { required: 'Enter your email.' })} />
        {errors.email && <p role="alert">{errors.email.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting} loading={isSubmitting}>Save profile</Button>
    </form>
  );
}

function ChangePasswordForm({ onClose }) {
  const user = useAuthStore(state => state.user);
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm();

  const onSubmit = async ({ newPassword }) => {
    try {
      await api.patch('/staff/' + user?.id + '/reset-password', { newPassword });
      toast.success('Password changed.');
      onClose();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Password could not be changed.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="admin-settings-form">
      <div className="admin-settings-form-field">
        <label htmlFor="settings-new-password">New password</label>
        <div className="admin-settings-password-field">
          <input id="settings-new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="At least 8 characters" {...register('newPassword', { required: 'Enter a new password.', minLength: { value: 8, message: 'Use at least 8 characters.' } })} />
          <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
            {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
          </button>
        </div>
        {errors.newPassword && <p role="alert">{errors.newPassword.message}</p>}
      </div>
      <div className="admin-settings-form-field">
        <label htmlFor="settings-confirm-password">Confirm new password</label>
        <input id="settings-confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" {...register('confirm', { required: 'Confirm your new password.', validate: value => value === watch('newPassword') || 'Passwords do not match.' })} />
        {errors.confirm && <p role="alert">{errors.confirm.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting} loading={isSubmitting}>Update password</Button>
    </form>
  );
}

function RateForm({ onClose }) {
  const { usdToSsp, setRate } = useSettingsStore();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { usdToSsp: Number(usdToSsp || 0) }
  });

  const onSubmit = async ({ usdToSsp: rate }) => {
    try {
      const response = await api.post('/cashbook/rate', { usdToSsp: rate });
      const savedRate = Number(response.data?.data?.usdToSsp ?? rate);
      setRate(savedRate);
      toast.success('Exchange rate updated.');
      onClose();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Exchange rate could not be updated.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="admin-settings-form">
      <div className="admin-settings-rate-callout">
        <span>Current rate</span>
        <strong>1 USD = {Number(usdToSsp || 0).toLocaleString()} SSP</strong>
      </div>
      <div className="admin-settings-form-field">
        <label htmlFor="settings-exchange-rate">1 USD = ? SSP</label>
        <input id="settings-exchange-rate" type="number" min="1" step="1" inputMode="numeric" {...register('usdToSsp', { required: 'Enter an exchange rate.', valueAsNumber: true, min: { value: 1, message: 'Rate must be at least 1.' } })} />
        {errors.usdToSsp && <p role="alert">{errors.usdToSsp.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting} loading={isSubmitting}>Save exchange rate</Button>
    </form>
  );
}

function AboutContent() {
  const details = [
    ['Business', 'Abdulmula Fashion'],
    ['Location', 'Konyo-Konyo Market, Juba'],
    ['Country', 'South Sudan'],
    ['Type', 'Wholesale & Retail Fashion'],
    ['Offline capability', 'Sales can be queued on this device'],
    ['PWA', 'Installable on Android & iOS'],
    ['Currency', 'USD / SSP display']
  ];

  return (
    <div className="admin-settings-about">
      <div className="admin-settings-about-brand"><span>AF</span><div><strong>Abdulmula Fashion ERP</strong><small>Enterprise workspace · Version 3.0.0</small></div></div>
      <div className="admin-settings-about-list">
        {details.map(([label, value]) => (
          <div key={label}><span>{label}</span><strong>{value}</strong></div>
        ))}
      </div>
    </div>
  );
}
