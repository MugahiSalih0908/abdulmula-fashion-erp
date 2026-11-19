import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import PageHeader from '../components/ui/PageHeader';
import Sheet from '../components/ui/Sheet';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import CardBody from '../components/ui/CardBody';
import Badge from '../components/ui/Badge';
import InvitationModal from '../components/InvitationModal';
import {
  AlertCircle, CheckCircle2, ChevronRight, Clock3, Eye, EyeOff,
  KeyRound, Mail, Plus, RefreshCw, Search, ShieldCheck, TrendingUp,
  UserCheck, UserRound, UserX, Users, X
} from 'lucide-react';
import { filterStaff, getStaffInitial, getStaffRoleTone } from './staffManagement.mjs';
import './staffWorkspace.css';

function getStrength(password) {
  return [
    password.length >= 12,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ].filter(Boolean).length;
}

function MetricCard({ icon: Icon, label, value, detail, tone = 'gold' }) {
  return (
    <Card className="staff-metric-card">
      <CardBody className="flex items-center gap-3 p-3.5 sm:p-4">
        <span className={'staff-metric-icon is-' + tone}><Icon size={18} aria-hidden="true" /></span>
        <div className="min-w-0">
          <p>{label}</p>
          <strong>{value}</strong>
          <small>{detail}</small>
        </div>
      </CardBody>
    </Card>
  );
}

export default function StaffPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [selected, setSelected] = useState(null);
  const [resetFor, setResetFor] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const currentUser = useAuthStore(state => state.user);
  const queryClient = useQueryClient();

  const staffQuery = useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const response = await api.get('/staff');
      return Array.isArray(response.data?.data) ? response.data.data : [];
    }
  });

  const toggleMutation = useMutation({
    mutationFn: id => api.patch('/staff/' + id + '/toggle'),
    onSuccess: response => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast.success(response.data.message || 'Account status updated.');
    },
    onError: error => toast.error(error?.response?.data?.message || 'Account status could not be updated.')
  });

  const resendMutation = useMutation({
    mutationFn: id => api.post('/staff/' + id + '/resend-activation'),
    onSuccess: response => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast.success(response.data.message || 'Activation email sent.');
    },
    onError: error => toast.error(error?.response?.data?.message || 'Activation email could not be sent.')
  });

  const staff = staffQuery.data || [];
  const filteredStaff = useMemo(
    () => filterStaff(staff, { search, role: roleFilter, status: statusFilter }),
    [staff, search, roleFilter, statusFilter]
  );

  const activeCount = staff.filter(member => member.isActive).length;
  const verifiedCount = staff.filter(member => member.isVerified).length;
  const pendingCount = staff.filter(member => !member.isVerified).length;
  const totalSales = staff.reduce((sum, member) => sum + (Number(member.salesTotal) || 0), 0);
  const filtersActive = Boolean(search || roleFilter !== 'all' || statusFilter !== 'all');

  const clearFilters = () => {
    setSearch('');
    setRoleFilter('all');
    setStatusFilter('all');
  };

  const handleToggle = member => {
    const action = member.isActive ? 'disable' : 'enable';
    if (!window.confirm('Are you sure you want to ' + action + ' ' + member.name + '\'s account?')) return;
    toggleMutation.mutate(member._id);
  };

  return (
    <main className="admin-page staff-page">
      <PageHeader
        title="Staff Management"
        sub="Manage team access, account activation and staff performance"
        action={
          <div className="staff-page-actions">
            <Button variant="secondary" size="sm" onClick={() => setShowInvite(true)}>
              <Mail size={15} aria-hidden="true" /> Send invite
            </Button>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus size={15} aria-hidden="true" /> Add staff
            </Button>
          </div>
        }
      />

      <section className="staff-hero" aria-label="Team management overview">
        <div className="staff-hero-copy">
          <span>PEOPLE & ACCESS</span>
          <h2>Your team, in one place</h2>
          <p>Manage staff accounts, verify access and review team activity from one workspace.</p>
        </div>
        <div className="staff-hero-summary">
          <Users size={19} aria-hidden="true" />
          <div><strong>{staff.length.toLocaleString()}</strong><span>team members</span></div>
        </div>
      </section>

      <section className="staff-metrics" aria-label="Team metrics">
        <MetricCard icon={Users} label="Team members" value={staff.length.toLocaleString()} detail="All staff accounts" tone="slate" />
        <MetricCard icon={UserCheck} label="Active accounts" value={activeCount.toLocaleString()} detail="Currently enabled" tone="gold" />
        <MetricCard icon={ShieldCheck} label="Verified accounts" value={verifiedCount.toLocaleString()} detail={pendingCount + ' awaiting activation'} tone="success" />
        <MetricCard icon={TrendingUp} label="Recorded team sales" value={'$' + totalSales.toLocaleString('en-US', { maximumFractionDigits: 0 })} detail="Lifetime sales total" tone="dark" />
      </section>

      <section className="staff-directory" aria-label="Team directory">
        <div className="staff-directory-heading">
          <div><h2>Team directory</h2><p>Search team members and manage their account access</p></div>
          <Badge variant="primary">{filteredStaff.length} of {staff.length}</Badge>
        </div>

        <div className="staff-toolbar">
          <label className="staff-search">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">Search staff members</span>
            <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by name, email or role…" />
            {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search"><X size={15} /></button>}
          </label>
          <label className="staff-select">
            <span>Role</span>
            <select value={roleFilter} onChange={event => setRoleFilter(event.target.value)}>
              <option value="all">All roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="staff">Staff</option>
            </select>
          </label>
          <label className="staff-select">
            <span>Account status</span>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
              <option value="all">All accounts</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
              <option value="pending">Pending activation</option>
            </select>
          </label>
          {filtersActive && <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>}
        </div>

        {staffQuery.isLoading ? (
          <div className="staff-list" aria-label="Loading staff accounts">
            {[1,2,3,4].map(item => <div key={item} className="staff-skeleton" />)}
          </div>
        ) : staffQuery.isError ? (
          <Card className="staff-empty-card">
            <CardBody className="staff-empty-state">
              <AlertCircle size={27} aria-hidden="true" />
              <h3>Staff accounts could not be loaded</h3>
              <p>{staffQuery.error?.response?.data?.message || staffQuery.error?.message || 'Check your connection and try again.'}</p>
              <Button variant="secondary" onClick={() => staffQuery.refetch()} loading={staffQuery.isFetching}><RefreshCw size={14} /> Retry</Button>
            </CardBody>
          </Card>
        ) : staff.length === 0 ? (
          <Card className="staff-empty-card">
            <CardBody className="staff-empty-state">
              <Users size={30} aria-hidden="true" />
              <h3>No staff accounts yet</h3>
              <p>Add your first team member or send an invitation to get started.</p>
              <div className="staff-empty-actions">
                <Button variant="secondary" onClick={() => setShowInvite(true)}><Mail size={14} /> Send invite</Button>
                <Button onClick={() => setShowAdd(true)}><Plus size={14} /> Add staff</Button>
              </div>
            </CardBody>
          </Card>
        ) : filteredStaff.length === 0 ? (
          <Card className="staff-empty-card">
            <CardBody className="staff-empty-state">
              <Search size={27} aria-hidden="true" />
              <h3>No team members match these filters</h3>
              <p>Try a different name, email, role or account status.</p>
              <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button>
            </CardBody>
          </Card>
        ) : (
          <div className="staff-list">
            {filteredStaff.map(member => {
              const isSelf = member._id === currentUser?._id;
              return (
                <Card key={member._id} className={'staff-member-card' + (!member.isActive ? ' is-disabled' : '')}>
                  <CardBody className="p-4 sm:p-5">
                    <div className="staff-member-layout">
                      <div className={'staff-avatar' + (!member.isActive ? ' is-disabled' : '')} aria-hidden="true">
                        {getStaffInitial(member.name)}
                        <span className={member.isVerified ? 'is-verified' : 'is-unverified'} />
                      </div>

                      <div className="staff-member-info">
                        <div className="staff-member-title">
                          <h3>{member.name || 'Unnamed user'}</h3>
                          <Badge variant={getStaffRoleTone(member.role)}>{member.role || 'staff'}</Badge>
                          <Badge variant={member.isActive ? 'success' : 'danger'}>{member.isActive ? 'Active' : 'Disabled'}</Badge>
                          {!member.isVerified && <Badge variant="warning"><Clock3 size={11} /> Pending activation</Badge>}
                          {isSelf && <Badge variant="info">You</Badge>}
                        </div>
                        <p className="staff-member-email">{member.email}</p>
                        <div className="staff-member-meta">
                          <span><TrendingUp size={13} aria-hidden="true" /> {Number(member.salesCount) || 0} sales</span>
                          <span>{'$' + (Number(member.salesTotal) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} total</span>
                          {Number(member.salary) > 0 && <span>{'$' + Number(member.salary).toLocaleString('en-US') + '/month'}</span>}
                        </div>
                      </div>

                      <div className="staff-member-actions" aria-label={'Actions for ' + member.name}>
                        {!isSelf && (
                          <>
                            {!member.isVerified && (
                              <button
                                type="button"
                                onClick={() => resendMutation.mutate(member._id)}
                                disabled={resendMutation.isPending}
                                aria-label={'Resend activation email to ' + member.name}
                                title="Resend activation email"
                              >
                                <RefreshCw size={16} className={resendMutation.isPending ? 'staff-spin' : ''} aria-hidden="true" />
                              </button>
                            )}
                            <button type="button" onClick={() => setResetFor(member)} aria-label={'Reset password for ' + member.name} title="Reset password">
                              <KeyRound size={16} aria-hidden="true" />
                            </button>
                            <button type="button" onClick={() => handleToggle(member)} disabled={toggleMutation.isPending} aria-label={(member.isActive ? 'Disable ' : 'Enable ') + member.name} title={member.isActive ? 'Disable account' : 'Enable account'}>
                              {member.isActive ? <UserX size={16} aria-hidden="true" /> : <UserCheck size={16} aria-hidden="true" />}
                            </button>
                          </>
                        )}
                        <button type="button" onClick={() => setSelected(member)} aria-label={'View details for ' + member.name} title="View staff details">
                          <ChevronRight size={17} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <Sheet open={showAdd} title="Add staff member" subtitle="Creates a pending account and attempts to send its activation email" onClose={() => setShowAdd(false)} maxH="94dvh">
        <AddStaffForm onSaved={() => { queryClient.invalidateQueries({ queryKey: ['staff'] }); setShowAdd(false); }} />
      </Sheet>

      <Sheet open={Boolean(resetFor)} title="Reset password" subtitle={resetFor?.name || ''} onClose={() => setResetFor(null)} maxH="94dvh">
        {resetFor && <ResetPwdForm member={resetFor} onSaved={() => { setResetFor(null); toast.success('Password reset successfully.'); }} />}
      </Sheet>

      <Sheet open={Boolean(selected)} title={selected?.name || 'Staff details'} subtitle={selected?.email || ''} onClose={() => setSelected(null)} maxH="94dvh">
        {selected && <StaffDetail memberId={selected._id} />}
      </Sheet>

      <InvitationModal isOpen={showInvite} onClose={() => setShowInvite(false)} />
    </main>
  );
}

function AddStaffForm({ onSaved }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { role: 'staff', salary: 0 }
  });

  const onSubmit = async data => {
    try {
      const response = await api.post('/staff', {
        name: data.name.trim(),
        email: data.email.trim(),
        role: data.role,
        salary: Number(data.salary) || 0
      });
      if (response.data?.emailStatus === 'sent') {
        toast.success(response.data.message || 'Staff account created and activation email accepted.');
      } else if (response.data?.emailStatus === 'unknown') {
        toast.error(
          'Account created, but activation email delivery is uncertain. Check Email Center before retrying.',
          { duration: 8000 }
        );
      } else {
        toast.error(
          response.data?.emailMessage
            ? 'Account created, but activation email was not sent: ' + response.data.emailMessage
            : (response.data?.message || 'Account created, but activation email was not sent.'),
          { duration: 8000 }
        );
      }
      // The account exists even when email delivery is blocked; refresh the list
      // so the administrator can use Resend activation after fixing configuration.
      onSaved();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Staff account could not be created.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="staff-form" noValidate>
      <div className="staff-form-callout"><Mail size={16} aria-hidden="true" /><p>A pending account is created first. The activation email is attempted next; check Email Center and use Resend activation if delivery is blocked.</p></div>

      <div className="staff-field">
        <label htmlFor="staff-add-name">Full name <span>*</span></label>
        <input id="staff-add-name" autoComplete="name" placeholder="e.g. Hassan Ahmed" aria-invalid={!!errors.name} aria-describedby={errors.name ? 'staff-add-name-error' : undefined} {...register('name', { required: 'Enter the staff member’s name.', minLength: { value: 2, message: 'Name must be at least 2 characters.' } })} />
        {errors.name && <p id="staff-add-name-error" role="alert">{errors.name.message}</p>}
      </div>

      <div className="staff-field">
        <label htmlFor="staff-add-email">Email address <span>*</span></label>
        <input id="staff-add-email" type="email" autoComplete="email" placeholder="staff@example.com" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'staff-add-email-error' : undefined} {...register('email', { required: 'Enter an email address.', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address.' } })} />
        {errors.email && <p id="staff-add-email-error" role="alert">{errors.email.message}</p>}
      </div>

      <div className="staff-form-grid">
        <div className="staff-field">
          <label htmlFor="staff-add-role">Role</label>
          <select id="staff-add-role" {...register('role')}><option value="staff">Staff</option><option value="manager">Manager</option><option value="admin">Admin</option></select>
        </div>
        <div className="staff-field">
          <label htmlFor="staff-add-salary">Monthly salary (USD)</label>
          <input id="staff-add-salary" type="number" min="0" step="0.01" inputMode="decimal" aria-invalid={!!errors.salary} {...register('salary', { valueAsNumber: true, min: { value: 0, message: 'Salary cannot be negative.' } })} />
          {errors.salary && <p role="alert">{errors.salary.message}</p>}
        </div>
      </div>

      <Button type="submit" className="w-full" loading={isSubmitting}><Plus size={15} /> Create staff account</Button>
    </form>
  );
}

function ResetPwdForm({ member, onSaved }) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm();
  const [show, setShow] = useState(false);
  const password = watch('newPassword', '');
  const strength = getStrength(password);

  const onSubmit = async ({ newPassword }) => {
    try {
      await api.patch('/staff/' + member._id + '/reset-password', { newPassword });
      onSaved();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Password reset failed.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="staff-form" noValidate>
      <div className="staff-field">
        <label htmlFor="staff-reset-password">New password <span>*</span></label>
        <div className="staff-password-input">
          <input id="staff-reset-password" type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="At least 12 characters" aria-invalid={!!errors.newPassword} aria-describedby={errors.newPassword ? 'staff-reset-password-error' : 'staff-reset-password-strength'} {...register('newPassword', { required: 'Enter a new password.', minLength: { value: 12, message: 'Use at least 12 characters.' } })} />
          <button type="button" onClick={() => setShow(value => !value)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
            {show ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
          </button>
        </div>
        {errors.newPassword && <p id="staff-reset-password-error" role="alert">{errors.newPassword.message}</p>}
        {password && <div id="staff-reset-password-strength"><div className="staff-password-meter" data-score={strength}>{[1,2,3,4,5].map(item => <span key={item} />)}</div><small>Password strength: {['','Very weak','Weak','Fair','Strong','Very strong'][strength]}</small></div>}
      </div>

      <div className="staff-form-callout is-warning"><ShieldCheck size={16} aria-hidden="true" /><p>Resetting this password will sign the staff member out of all devices.</p></div>
      <Button type="submit" className="w-full" loading={isSubmitting}><KeyRound size={15} /> Reset password</Button>
    </form>
  );
}

function StaffDetail({ memberId }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['staff-detail', memberId],
    queryFn: async () => {
      const response = await api.get('/staff/' + memberId);
      return response.data.data;
    }
  });

  const member = data?.member;
  const sales = data?.recentSales || [];
  const monthlyStats = data?.monthStats;

  if (isLoading) {
    return <div className="staff-detail-skeletons" aria-label="Loading staff details">{[1,2,3].map(item => <div key={item} />)}</div>;
  }

  if (isError || !data) {
    return <div className="staff-detail-error" role="alert"><AlertCircle size={18} /><p>{error?.response?.data?.message || error?.message || 'Staff details could not be loaded.'}</p></div>;
  }

  return (
    <div className="staff-detail-content">
      {member && (
        <div className="staff-detail-status">
          <Badge variant={member.isVerified ? 'success' : 'warning'}>{member.isVerified ? 'Activated' : 'Pending activation'}</Badge>
          <Badge variant={member.isActive ? 'success' : 'danger'}>{member.isActive ? 'Active account' : 'Disabled account'}</Badge>
          {member.lastLogin && <span>Last login {new Date(member.lastLogin).toLocaleDateString()}</span>}
        </div>
      )}

      <div className="staff-detail-metrics">
        <MetricCard icon={TrendingUp} label="Sales this month" value={'$' + (Number(monthlyStats?.total) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} detail="Recorded invoice total" />
        <MetricCard icon={CheckCircle2} label="Transactions" value={(Number(monthlyStats?.count) || 0).toLocaleString()} detail="Sales this month" tone="slate" />
      </div>

      <section className="staff-detail-sales">
        <div className="staff-directory-heading"><div><h2>Recent sales</h2><p>Latest recorded invoices for this staff member</p></div></div>
        {sales.length === 0 ? (
          <p className="staff-detail-empty">No sales have been recorded yet.</p>
        ) : sales.map(invoice => (
          <div key={invoice._id} className="staff-detail-sale">
            <div><strong>{invoice.invoiceNumber}</strong><span>{new Date(invoice.date).toLocaleDateString()}</span></div>
            <strong>{'$' + (Number(invoice.grandTotal) || 0).toFixed(2)}</strong>
          </div>
        ))}
      </section>
    </div>
  );
}
