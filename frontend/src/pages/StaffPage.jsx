// src/pages/StaffPage.jsx – v6 with activation status + resend button

import { useState }                          from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm }                           from 'react-hook-form';
import { motion, AnimatePresence }           from 'framer-motion';
import toast                                 from 'react-hot-toast';
import api                                   from '../services/api';
import useAuthStore                          from '../store/authStore';
import PageHeader from '../components/ui/PageHeader';
import Sheet      from '../components/ui/Sheet';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import CardHeader from '../components/ui/CardHeader';
import CardBody from '../components/ui/CardBody';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import InvitationModal from '../components/InvitationModal';
import {
  Plus, ChevronRight, X, UserCheck, UserX,
  KeyRound, BarChart3, ShieldCheck, Eye, EyeOff,
  Mail, RefreshCw, Clock, CheckCircle, Users, TrendingUp
} from 'lucide-react';

const ROLE_COLORS = {
  admin:   'bg-red-100 text-red-700',
  manager: 'bg-blue-100 text-blue-700',
  staff:   'bg-emerald-50 text-emerald-700',
};

const getStrength = (pwd) => {
  let s = 0;
  if (pwd.length >= 8) s++;
  if (/[A-Z]/.test(pwd)) s++;
  if (/[a-z]/.test(pwd)) s++;
  if (/\d/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  return s;
};

export default function StaffPage() {
  const [showAdd,  setShowAdd]  = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [selected, setSelected] = useState(null);
  const [resetFor, setResetFor] = useState(null);
  const currentUser = useAuthStore(s => s.user);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn:  async () => { const { data } = await api.get('/staff'); return data.data; },
  });

  const toggleMutation = useMutation({
    mutationFn: (id) => api.patch(`/staff/${id}/toggle`),
    onSuccess:  (res) => { queryClient.invalidateQueries(['staff']); toast.success(res.data.message); },
    onError:    (e)   => toast.error(e?.response?.data?.message || 'Failed.'),
  });

  const resendMutation = useMutation({
    mutationFn: (id) => api.post(`/staff/${id}/resend-activation`),
    onSuccess:  (res) => toast.success(res.data.message),
    onError:    (e)   => toast.error(e?.response?.data?.message || 'Failed.'),
  });

  const staff       = data || [];
  const activeCount = staff.filter(s => s.isActive).length;
  const verifiedCnt = staff.filter(s => s.isVerified).length;
  const totalSales  = staff.reduce((s, m) => s + (m.salesTotal||0), 0);

  return (
    <div className="p-4 space-y-5">
      <PageHeader
        title="Staff Management"
        sub={`${activeCount} active · ${verifiedCnt} verified`}
        action={
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-1.5"
            >
              <Mail size={16} /> Send Invite
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5"
            >
              <Plus size={16} /> Add Staff
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardBody className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{staff.length}</div>
            <div className="text-xs text-gray-500 mt-1">Total Staff</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4 text-center">
            <div className="text-2xl font-bold text-emerald-600">{verifiedCnt}</div>
            <div className="text-xs text-gray-500 mt-1">Verified</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4 text-center">
            <div className="text-2xl font-bold text-emerald-700">${totalSales.toFixed(0)}</div>
            <div className="text-xs text-gray-500 mt-1">Team Sales</div>
          </CardBody>
        </Card>
      </div>

      {/* Staff list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : staff.length === 0 ? (
        <div className="text-center py-16">
          <Users size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-semibold">No staff accounts yet</p>
          <p className="text-xs text-gray-400 mt-1">Add your first staff member to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map(member => (
            <motion.div
              key={member._id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Card className={!member.isActive ? 'opacity-60' : ''}>
                <CardBody className="p-4">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-base shrink-0 text-white relative"
                      style={{ background: member.isActive ? '#16a34a' : '#9ca3af' }}
                    >
                      {member.name?.charAt(0).toUpperCase()}
                      {/* Verification dot */}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                          member.isVerified ? 'bg-emerald-500' : 'bg-amber-400'
                        }`}
                        title={member.isVerified ? 'Activated' : 'Pending activation'}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900">{member.name}</p>
                        <Badge variant={member.role === 'admin' ? 'danger' : member.role === 'manager' ? 'info' : 'secondary'}>
                          {member.role}
                        </Badge>
                        {!member.isActive && <Badge variant="danger">Disabled</Badge>}
                        {!member.isVerified && (
                          <Badge variant="warning" className="flex items-center gap-1">
                            <Clock size={10} /> Pending
                          </Badge>
                        )}
                        {member._id === currentUser?._id && <span className="text-xs text-gray-400">(You)</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{member.email}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <TrendingUp size={14} />
                          {member.salesCount || 0} sales
                        </span>
                        <span>${(member.salesTotal || 0).toFixed(0)}</span>
                        {member.salary > 0 && <span>${member.salary}/mo</span>}
                      </div>
                    </div>

                    {/* Actions (not for self) */}
                    {member._id !== currentUser?._id && (
                      <div className="flex gap-1 shrink-0">
                        {/* Resend activation for unverified */}
                        {!member.isVerified && (
                          <button
                            onClick={() => resendMutation.mutate(member._id)}
                            disabled={resendMutation.isPending}
                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition disabled:opacity-50"
                            title="Resend activation email"
                          >
                            <RefreshCw size={16} className={resendMutation.isPending ? 'animate-spin' : ''} />
                          </button>
                        )}
                        <button
                          onClick={() => setResetFor(member)}
                          className="p-2 text-gray-400 hover:text-emerald-600 rounded-lg transition"
                          title="Reset password"
                        >
                          <KeyRound size={16} />
                        </button>
                        <button
                          onClick={() => toggleMutation.mutate(member._id)}
                          disabled={toggleMutation.isPending}
                          className={`p-2 rounded-lg transition disabled:opacity-50 ${
                            member.isActive ? 'text-gray-400 hover:text-red-500' : 'text-gray-400 hover:text-emerald-600'
                          }`}
                          title={member.isActive ? 'Disable account' : 'Enable account'}
                        >
                          {member.isActive ? <UserX size={16} /> : <UserCheck size={16} />}
                        </button>
                        <button
                          onClick={() => setSelected(member)}
                          className="p-2 text-gray-400 hover:text-gray-700 rounded-lg transition"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <div className="h-4" />

      {/* Add Staff Sheet */}
      <Sheet open={showAdd} title="Add Staff Member" subtitle="System will send activation email automatically"
             onClose={() => setShowAdd(false)}>
        <AddStaffForm
          onClose={() => setShowAdd(false)}
          onSaved={() => { queryClient.invalidateQueries(['staff']); setShowAdd(false); }}
        />
      </Sheet>

      {/* Reset Password Sheet */}
      <Sheet open={!!resetFor} title="Reset Password" subtitle={resetFor?.name} onClose={() => setResetFor(null)}>
        {resetFor && (
          <ResetPwdForm member={resetFor}
                        onClose={() => setResetFor(null)}
                        onSaved={() => { setResetFor(null); toast.success('Password reset successfully.'); }}/>
        )}
      </Sheet>

      {/* Staff Detail Sheet */}
      <Sheet open={!!selected} title={selected?.name} subtitle={selected?.email} onClose={() => setSelected(null)}>
        {selected && <StaffDetail memberId={selected._id}/>}
      </Sheet>

      {/* Invitation Modal */}
      <InvitationModal isOpen={showInvite} onClose={() => setShowInvite(false)} />
    </div>
  );
}

/* ── Add Staff Form ─────────────────────────────────────────── */
function AddStaffForm({ onClose, onSaved }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ defaultValues:{ role:'staff' } });

  const onSubmit = async (data) => {
    try {
      const res = await api.post('/staff', { name:data.name, email:data.email, role:data.role, salary:data.salary });
      toast.success(res.data.message);
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to create account.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-4">
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
        <Mail size={15} className="text-emerald-600 shrink-0 mt-0.5"/>
        <p className="text-xs text-emerald-700">
          A welcome email with activation link will be sent automatically to the staff member.
        </p>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1.5">Full Name *</label>
        <input {...register('name',{ required:'Name is required' })}
               className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" placeholder="e.g. Hassan Ahmed"/>
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1.5">Email Address * <span className="text-gray-400 font-normal">(activation email sent here)</span></label>
        <input type="email" {...register('email',{ required:'Email is required', pattern:{ value:/^\S+@\S+\.\S+$/, message:'Enter a valid email' } })}
               className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" placeholder="staff@example.com"/>
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1.5">Role</label>
          <select {...register('role')} className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition">
            <option value="staff">Staff</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1.5">Monthly Salary ($)</label>
          <input type="number" min="0" {...register('salary',{ valueAsNumber:true })}
                 className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" placeholder="0"/>
        </div>
      </div>

      <Button
        type="submit"
        variant="primary"
        disabled={isSubmitting}
        className="w-full"
      >
        {isSubmitting && <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"/>}
        Create & Send Invitation
      </Button>
    </form>
  );
}

/* ── Reset Password Form ────────────────────────────────────── */
function ResetPwdForm({ member, onClose, onSaved }) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm();
  const [show, setShow] = useState(false);
  const pwd = watch('newPassword','');

  const onSubmit = async ({ newPassword }) => {
    try {
      await api.patch(`/staff/${member._id}/reset-password`, { newPassword });
      onSaved();
    } catch (e) { toast.error(e?.response?.data?.message||'Failed.'); }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-4">
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1.5">New Password * (min 8 chars)</label>
        <div className="relative">
          <input type={show?'text':'password'} {...register('newPassword',{required:true,minLength:{value:8,message:'Min 8 chars'}})}
                 className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition pr-10" placeholder="Min. 8 characters"/>
          <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {show ? <EyeOff size={16}/> : <Eye size={16}/>}
          </button>
        </div>
        {errors.newPassword && <p className="text-red-500 text-xs mt-1">{errors.newPassword.message}</p>}
        {pwd.length > 0 && (
          <div className="flex gap-1 h-1.5 mt-2">
            {[1,2,3,4,5].map(i => {
              const s = getStrength(pwd);
              const colors = ['','bg-red-400','bg-orange-400','bg-yellow-400','bg-emerald-400','bg-emerald-600'];
              return <div key={i} className={`flex-1 rounded-full ${i<=s ? colors[Math.min(s,5)] : 'bg-gray-200'}`}/>;
            })}
          </div>
        )}
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 flex items-start gap-2">
        <Clock size={14} className="shrink-0 mt-0.5"/>
        <p>This will log the staff member out of all devices immediately.</p>
      </div>
      <Button
        type="submit"
        variant="primary"
        disabled={isSubmitting}
        className="w-full"
      >
        {isSubmitting && <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"/>}
        Reset Password
      </Button>
    </form>
  );
}

/* ── Staff Detail Sheet ─────────────────────────────────────── */
function StaffDetail({ memberId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['staff-detail', memberId],
    queryFn:  async () => { const { data } = await api.get(`/staff/${memberId}`); return data.data; }
  });
  const m = data?.member; const sales = data?.recentSales||[]; const ms = data?.monthStats;
  return (
    <div className="px-5 py-4 space-y-4">
      {isLoading ? [...Array(4)].map((_,i)=><div key={i} className="h-12 bg-gray-200 rounded-lg animate-pulse"/>) : (
        <>
          {m && (
            <div className="flex items-center gap-2 flex-wrap">
              {m.isVerified
                ? <Badge variant="success" className="flex items-center gap-1"><CheckCircle size={12}/> Activated</Badge>
                : <Badge variant="warning" className="flex items-center gap-1"><Clock size={12}/> Pending Activation</Badge>
              }
              {m.lastLogin && <span className="text-xs text-gray-500">Last login: {new Date(m.lastLogin).toLocaleDateString()}</span>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardBody className="p-4 text-center">
                <div className="text-2xl font-bold text-emerald-600">${(ms?.total||0).toFixed(0)}</div>
                <div className="text-xs text-gray-500 mt-1">This Month</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="p-4 text-center">
                <div className="text-2xl font-bold text-emerald-700">{ms?.count||0}</div>
                <div className="text-xs text-gray-500 mt-1">Sales</div>
              </CardBody>
            </Card>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase mb-3 tracking-wide">Recent Sales</p>
            {sales.length===0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No sales yet.</p>
            ) : (
              <div className="space-y-2">
                {sales.map(inv => (
                  <Card key={inv._id}>
                    <CardBody className="p-3 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-semibold text-gray-900">{inv.invoiceNumber}</p>
                        <p className="text-xs text-gray-400">{new Date(inv.date).toLocaleDateString()}</p>
                      </div>
                      <p className="font-bold text-sm text-emerald-600">${inv.grandTotal.toFixed(2)}</p>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
