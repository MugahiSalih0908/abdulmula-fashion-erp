// src/pages/SettingsPage.jsx – v3 with currency selector

import { useState }    from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm }     from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import toast           from 'react-hot-toast';
import api             from '../services/api';
import useAuthStore    from '../store/authStore';
import useSettingsStore from '../store/settingsStore';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import PageHeader from '../components/ui/PageHeader';
import {
  User, Lock, Wifi, WifiOff, ChevronRight, X,
  Eye, EyeOff, AlertCircle, LogOut, RefreshCw,
  DollarSign, ArrowLeftRight, Info
} from 'lucide-react';

function Sheet({ title, onClose, children }) {
  return (
    <AnimatePresence>
      <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                  className="fixed inset-0 bg-black/50 z-40" onClick={onClose}/>
      <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}}
                  transition={{type:'spring',damping:26,stiffness:300}}
                  className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b">
          <h2 className="font-bold text-lg">{title}</h2>
          <button onClick={onClose} className="p-1 bg-gray-100 rounded-full"><X size={18}/></button>
        </div>
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

function Row({ icon, label, sub, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors">
      <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">{icon}</div>
      <div className="flex-1 text-left">
        <p className="font-semibold text-sm text-gray-800">{label}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
      <ChevronRight size={16} className="text-gray-300"/>
    </button>
  );
}

export default function SettingsPage() {
  const user     = useAuthStore(s => s.user);
  const logout   = useAuthStore(s => s.logout);
  const navigate = useNavigate();
  const { isOnline, pendingCount, isSyncing } = useOnlineStatus();
  const { currency, setCurrency, usdToSsp, fmt } = useSettingsStore();
  const [sheet, setSheet] = useState(null);

  const handleLogout = async () => {
    if (!window.confirm('Log out of Abdulmula Fashion ERP?')) return;
    await logout();
    navigate('/login');
  };

  return (
    <div className="p-4 space-y-4">
      <PageHeader title="Settings" sub="Account & app configuration"/>

      {/* Profile */}
      <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4">
        <div className="w-14 h-14 rounded-full flex items-center justify-center font-black text-xl shrink-0 text-black"
             style={{background:'#d4a017'}}>
          {user?.name?.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900">{user?.name}</p>
          <p className="text-sm text-gray-400 truncate">{user?.email}</p>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize mt-1 inline-block"
                style={{background:'#fff8e1',color:'#d4a017'}}>{user?.role}</span>
        </div>
      </div>

      {/* Currency toggle */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-1.5">
          <DollarSign size={13}/> Currency Display
        </p>
        <div className="flex bg-gray-100 rounded-xl p-1 mb-3">
          {['USD','SSP'].map(c => (
            <button key={c} onClick={() => setCurrency(c)}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                      currency===c ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                    }`}>{c}</button>
          ))}
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Rate: 1 USD = <strong>{usdToSsp?.toLocaleString()} SSP</strong></span>
          <button onClick={() => setSheet('rate')} className="text-xs font-bold"
                  style={{color:'#d4a017'}}>Change Rate</button>
        </div>
      </div>

      {/* Connection */}
      <div className={`rounded-2xl p-4 shadow-sm flex items-center gap-3 ${isOnline?'bg-green-50 border border-green-100':'bg-red-50 border border-red-100'}`}>
        {isOnline ? <Wifi size={20} className="text-green-600 shrink-0"/> : <WifiOff size={20} className="text-red-500 shrink-0"/>}
        <div className="flex-1">
          <p className={`font-semibold text-sm ${isOnline?'text-green-800':'text-red-700'}`}>
            {isOnline?'Connected':'Offline Mode'}
          </p>
          <p className="text-xs text-gray-500">
            {isOnline?'Data syncing in real-time':'Sales saved locally, sync on reconnect'}
          </p>
        </div>
        {isSyncing && <RefreshCw size={16} className="animate-spin text-blue-500 shrink-0"/>}
      </div>

      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center gap-2">
          <span className="text-amber-700 text-sm font-semibold">{pendingCount} sale(s) awaiting sync</span>
        </div>
      )}

      {/* Account settings */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
        <Row icon={<User size={18} className="text-blue-500"/>}   label="Edit Profile"     sub="Name and email"      onClick={() => setSheet('profile')}/>
        <Row icon={<Lock size={18} className="text-purple-500"/>} label="Change Password"  sub="Update your password" onClick={() => setSheet('password')}/>
        <Row icon={<Info size={18} className="text-gray-400"/>}   label="About"            sub="Version & business"   onClick={() => setSheet('about')}/>
      </div>

      {/* Logout */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <button onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-red-500 hover:bg-red-50 transition-colors">
          <AlertCircle size={18}/>
          <span className="font-semibold text-sm flex-1 text-left">Logout</span>
          <ChevronRight size={16} className="text-red-300"/>
        </button>
      </div>

      <p className="text-center text-xs text-gray-300 pb-4">Abdulmula Fashion ERP v3.0 · Juba, South Sudan</p>

      {/* Sheets */}
      {sheet === 'profile'  && <Sheet title="Edit Profile"   onClose={() => setSheet(null)}><EditProfileForm  onClose={() => setSheet(null)}/></Sheet>}
      {sheet === 'password' && <Sheet title="Change Password" onClose={() => setSheet(null)}><ChangePasswordForm onClose={() => setSheet(null)}/></Sheet>}
      {sheet === 'rate'     && <Sheet title="Exchange Rate"   onClose={() => setSheet(null)}><RateForm onClose={() => setSheet(null)}/></Sheet>}
      {sheet === 'about'    && <Sheet title="About"           onClose={() => setSheet(null)}><AboutContent/></Sheet>}
    </div>
  );
}

function EditProfileForm({ onClose }) {
  const user = useAuthStore(s => s.user);
  const { register, handleSubmit, formState:{isSubmitting} } = useForm({ defaultValues: { name:user?.name, email:user?.email } });
  const onSubmit = async (data) => {
    try { await api.put(`/staff/${user?.id}`, data); toast.success('Profile updated.'); onClose(); }
    catch (e) { toast.error(e?.response?.data?.message||'Update failed.'); }
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-4">
      <div><label className="text-xs font-semibold text-gray-600 block mb-1.5">Full Name</label>
        <input {...register('name',{required:true})} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none"/></div>
      <div><label className="text-xs font-semibold text-gray-600 block mb-1.5">Email</label>
        <input type="email" {...register('email',{required:true})} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none"/></div>
      <button type="submit" disabled={isSubmitting} className="w-full py-4 rounded-2xl font-bold text-black disabled:opacity-60" style={{background:'#d4a017'}}>Save Changes</button>
    </form>
  );
}

function ChangePasswordForm({ onClose }) {
  const user = useAuthStore(s => s.user);
  const { register, handleSubmit, watch, formState:{errors,isSubmitting} } = useForm();
  const [show, setShow] = useState(false);
  const onSubmit = async ({ newPassword }) => {
    try { await api.patch(`/staff/${user?.id}/reset-password`, { newPassword }); toast.success('Password changed.'); onClose(); }
    catch (e) { toast.error(e?.response?.data?.message||'Failed.'); }
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-4">
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1.5">New Password *</label>
        <div className="relative">
          <input type={show?'text':'password'} {...register('newPassword',{required:true,minLength:{value:6,message:'Min 6 chars'}})}
                 className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none pr-10" placeholder="Min. 6 chars"/>
          <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            {show?<EyeOff size={16}/>:<Eye size={16}/>}
          </button>
        </div>
        {errors.newPassword && <p className="text-red-500 text-xs mt-1">{errors.newPassword.message}</p>}
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1.5">Confirm Password *</label>
        <input type={show?'text':'password'}
               {...register('confirm',{validate:v=>v===watch('newPassword')||'Passwords do not match'})}
               className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none"/>
        {errors.confirm && <p className="text-red-500 text-xs mt-1">{errors.confirm.message}</p>}
      </div>
      <button type="submit" disabled={isSubmitting} className="w-full py-4 rounded-2xl font-bold text-white disabled:opacity-60" style={{background:'#111'}}>Update Password</button>
    </form>
  );
}

function RateForm({ onClose }) {
  const { usdToSsp, setRate } = useSettingsStore();
  const { register, handleSubmit, formState:{isSubmitting} } = useForm({ defaultValues:{ usdToSsp } });
  const onSubmit = async ({ usdToSsp: rate }) => {
    try { await api.post('/cashbook/rate', { usdToSsp: rate }); setRate(parseFloat(rate)); toast.success('Exchange rate updated.'); onClose(); }
    catch (e) { toast.error(e?.response?.data?.message||'Failed.'); }
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-4">
      <div className="bg-amber-50 rounded-xl p-3 text-sm text-amber-700">Current: 1 USD = {usdToSsp?.toLocaleString()} SSP</div>
      <div><label className="text-xs font-semibold text-gray-600 block mb-1.5">1 USD = ? SSP</label>
        <input type="number" step="1" min="1" {...register('usdToSsp',{required:true,valueAsNumber:true})}
               className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none" placeholder="e.g. 1300"/></div>
      <button type="submit" disabled={isSubmitting} className="w-full py-4 rounded-2xl font-bold text-black disabled:opacity-60" style={{background:'#d4a017'}}>Set Rate</button>
    </form>
  );
}

function AboutContent() {
  return (
    <div className="px-5 py-6 text-center space-y-4">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center font-black text-3xl text-black mx-auto shadow-lg" style={{background:'#d4a017'}}>AF</div>
      <div><h2 className="font-black text-xl text-gray-900">Abdulmula Fashion ERP</h2><p className="text-sm text-gray-500 mt-1">Version 3.0.0</p></div>
      <div className="bg-gray-50 rounded-2xl p-4 text-left space-y-2">
        {[['Business','Abdulmula Fashion'],['Location','Konyo-Konyo Market, Juba'],['Country','South Sudan'],['Type','Wholesale & Retail Fashion'],['Offline','Full offline support (IndexedDB)'],['PWA','Installable on Android & iOS'],['Currency','USD / SSP (dual currency)']].map(([k,v]) => (
          <div key={k} className="flex justify-between text-sm">
            <span className="text-gray-400">{k}</span><span className="font-semibold text-gray-700">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
