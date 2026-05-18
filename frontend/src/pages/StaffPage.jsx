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
import {
  Plus, ChevronRight, X, UserCheck, UserX,
  KeyRound, BarChart3, ShieldCheck, Eye, EyeOff,
  Mail, RefreshCw, Clock, CheckCircle
} from 'lucide-react';

const ROLE_COLORS = {
  admin:   'bg-red-100 text-red-700',
  manager: 'bg-blue-100 text-blue-700',
  staff:   'bg-gray-100 text-gray-600',
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
    <div className="p-4 space-y-4">
      <PageHeader
        title="Staff Management"
        sub={`${activeCount} active · ${verifiedCnt} activated`}
        action={
          <button onClick={() => setShowAdd(true)}
                  className="flex items-center gap-1.5 text-black px-4 py-2.5 rounded-xl font-semibold text-sm"
                  style={{ background:'#d4a017' }}>
            <Plus size={16}/> Add Staff
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
          <p className="font-black text-xl text-gray-900">{staff.length}</p>
          <p className="text-xs text-gray-400">Total</p>
        </div>
        <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
          <p className="font-black text-xl text-green-600">{verifiedCnt}</p>
          <p className="text-xs text-gray-400">Activated</p>
        </div>
        <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
          <p className="font-black text-lg" style={{ color:'#d4a017' }}>${totalSales.toFixed(0)}</p>
          <p className="text-xs text-gray-400">Team Sales</p>
        </div>
      </div>

      {/* Staff list */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_,i)=><div key={i} className="h-24 bg-gray-200 rounded-2xl animate-pulse"/>)}</div>
      ) : staff.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">👥</p><p className="font-semibold">No staff accounts yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {staff.map(member => (
            <div key={member._id}
                 className={`bg-white rounded-2xl p-4 shadow-sm ${!member.isActive ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-11 h-11 rounded-full flex items-center justify-center font-black text-base shrink-0 text-black relative"
                     style={{ background: member.isActive ? '#d4a017' : '#e5e7eb' }}>
                  {member.name?.charAt(0).toUpperCase()}
                  {/* Verification dot */}
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                    member.isVerified ? 'bg-green-500' : 'bg-amber-400'
                  }`} title={member.isVerified ? 'Activated' : 'Pending activation'}/>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm text-gray-900">{member.name}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${ROLE_COLORS[member.role]}`}>
                      {member.role}
                    </span>
                    {!member.isActive && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Disabled</span>}
                    {!member.isVerified && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-0.5"><Clock size={10}/> Pending</span>}
                    {member._id === currentUser?._id && <span className="text-xs text-gray-400">(You)</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{member.email}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-gray-500">{member.salesCount||0} sales · ${(member.salesTotal||0).toFixed(0)}</span>
                    {member.salary > 0 && <span className="text-xs text-gray-500">Salary: ${member.salary}/mo</span>}
                  </div>
                </div>

                {/* Actions (not for self) */}
                {member._id !== currentUser?._id && (
                  <div className="flex gap-1 shrink-0">
                    {/* Resend activation for unverified */}
                    {!member.isVerified && (
                      <button onClick={() => resendMutation.mutate(member._id)}
                              disabled={resendMutation.isPending}
                              className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg" title="Resend activation email">
                        <RefreshCw size={15} className={resendMutation.isPending ? 'animate-spin' : ''}/>
                      </button>
                    )}
                    <button onClick={() => setResetFor(member)} className="p-2 text-gray-400 hover:text-blue-500 rounded-lg" title="Reset password">
                      <KeyRound size={15}/>
                    </button>
                    <button onClick={() => toggleMutation.mutate(member._id)} disabled={toggleMutation.isPending}
                            className={`p-2 rounded-lg ${member.isActive?'text-gray-400 hover:text-red-500':'text-gray-400 hover:text-green-600'}`}
                            title={member.isActive?'Disable account':'Enable account'}>
                      {member.isActive ? <UserX size={15}/> : <UserCheck size={15}/>}
                    </button>
                    <button onClick={() => setSelected(member)} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg">
                      <ChevronRight size={15}/>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="h-4"/>

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
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
        <Mail size={15} className="text-amber-600 shrink-0 mt-0.5"/>
        <p className="text-xs text-amber-700">
          A welcome email with activation link will be sent automatically to the staff member.
        </p>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1.5">Full Name *</label>
        <input {...register('name',{ required:'Name is required' })}
               className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none" placeholder="e.g. Hassan Ahmed"/>
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1.5">Email Address * <span className="text-gray-400 font-normal">(activation email sent here)</span></label>
        <input type="email" {...register('email',{ required:'Email is required', pattern:{ value:/^\S+@\S+\.\S+$/, message:'Enter a valid email' } })}
               className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none" placeholder="staff@example.com"/>
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1.5">Role</label>
          <select {...register('role')} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none">
            <option value="staff">Staff</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1.5">Monthly Salary ($)</label>
          <input type="number" min="0" {...register('salary',{ valueAsNumber:true })}
                 className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none" placeholder="0"/>
        </div>
      </div>

      <button type="submit" disabled={isSubmitting}
              className="w-full py-4 rounded-2xl font-bold text-black disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background:'#d4a017' }}>
        {isSubmitting && <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"/>}
        Create & Send Invitation
      </button>
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
                 className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none pr-10" placeholder="Min. 8 characters"/>
          <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            {show ? <EyeOff size={16}/> : <Eye size={16}/>}
          </button>
        </div>
        {errors.newPassword && <p className="text-red-500 text-xs mt-1">{errors.newPassword.message}</p>}
        {pwd.length > 0 && (
          <div className="flex gap-1 h-1.5 mt-2">
            {[1,2,3,4,5].map(i => {
              const s = getStrength(pwd);
              const colors = ['','bg-red-400','bg-orange-400','bg-yellow-400','bg-green-400','bg-emerald-500'];
              return <div key={i} className={`flex-1 rounded-full ${i<=s ? colors[Math.min(s,5)] : 'bg-gray-200'}`}/>;
            })}
          </div>
        )}
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-700">
        ⚠ This will log the staff member out of all devices immediately.
      </div>
      <button type="submit" disabled={isSubmitting}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold disabled:opacity-60 flex items-center justify-center gap-2">
        {isSubmitting && <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
        Reset Password
      </button>
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
      {isLoading ? [...Array(4)].map((_,i)=><div key={i} className="h-14 bg-gray-200 rounded-xl animate-pulse"/>) : (
        <>
          {m && (
            <div className="flex items-center gap-2">
              {m.isVerified
                ? <span className="flex items-center gap-1 text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full"><CheckCircle size={12}/> Activated</span>
                : <span className="flex items-center gap-1 text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full"><Clock size={12}/> Pending Activation</span>
              }
              {m.lastLogin && <span className="text-xs text-gray-400">Last login: {new Date(m.lastLogin).toLocaleDateString()}</span>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-2xl p-3 text-center"><p className="font-black text-lg text-green-600">${(ms?.total||0).toFixed(0)}</p><p className="text-xs text-gray-500">This Month</p></div>
            <div className="bg-blue-50 rounded-2xl p-3 text-center"><p className="font-black text-lg text-blue-600">{ms?.count||0}</p><p className="text-xs text-gray-500">Sales This Month</p></div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Recent Sales</p>
            {sales.length===0 ? <p className="text-sm text-gray-400 text-center py-4">No sales yet.</p> : (
              <div className="space-y-2">
                {sales.map(inv => (
                  <div key={inv._id} className="flex justify-between bg-gray-50 rounded-xl px-3 py-2.5">
                    <div><p className="text-xs font-semibold">{inv.invoiceNumber}</p><p className="text-xs text-gray-400">{new Date(inv.date).toLocaleDateString()}</p></div>
                    <p className="font-bold text-sm text-green-600">${inv.grandTotal.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
