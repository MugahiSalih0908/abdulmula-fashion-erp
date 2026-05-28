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
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import CardBody from '../components/ui/CardBody';
import Badge from '../components/ui/Badge';
import Sheet from '../components/ui/Sheet';
import {
  User, Lock, Wifi, WifiOff, ChevronRight, X,
  Eye, EyeOff, AlertCircle, LogOut, RefreshCw,
  DollarSign, ArrowLeftRight, Info
} from 'lucide-react';

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
    <div className="p-4 space-y-5">
      <PageHeader title="Settings" sub="Account & app configuration"/>

      {/* Profile */}
      <Card>
        <CardBody className="p-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl shrink-0 text-white bg-emerald-600">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900">{user?.name}</p>
            <p className="text-sm text-gray-600 truncate">{user?.email}</p>
            <Badge variant="info" className="mt-1">
              {user?.role}
            </Badge>
          </div>
        </CardBody>
      </Card>

      {/* Currency toggle */}
      <Card>
        <CardBody className="p-4">
          <p className="text-xs font-semibold text-gray-600 uppercase mb-3 flex items-center gap-1.5">
            <DollarSign size={14}/> Currency Display
          </p>
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1 mb-3">
            {['USD','SSP'].map(c => (
              <button key={c} onClick={() => setCurrency(c)}
                      className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${
                        currency===c ? 'text-white bg-emerald-600 shadow-md' : 'text-gray-600'
                      }`}>{c}</button>
            ))}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Rate: 1 USD = <strong className="text-gray-900">{usdToSsp?.toLocaleString()} SSP</strong></span>
            <button onClick={() => setSheet('rate')} className="text-xs font-bold text-emerald-700 hover:text-emerald-800">
              Change
            </button>
          </div>
        </CardBody>
      </Card>

      {/* Connection */}
      <Card className={`border-l-4 ${isOnline ? 'border-l-emerald-500 bg-emerald-50' : 'border-l-red-500 bg-red-50'}`}>
        <CardBody className="p-4 flex items-center gap-3">
          {isOnline ? <Wifi size={20} className="text-emerald-600 shrink-0"/> : <WifiOff size={20} className="text-red-600 shrink-0"/>}
          <div className="flex-1">
            <p className={`font-semibold text-sm ${isOnline ? 'text-emerald-900' : 'text-red-900'}`}>
              {isOnline ? 'Connected' : 'Offline Mode'}
            </p>
            <p className="text-xs text-gray-600">
              {isOnline ? 'Data syncing in real-time' : 'Sales saved locally, sync on reconnect'}
            </p>
          </div>
          {isSyncing && <RefreshCw size={16} className="animate-spin text-emerald-600 shrink-0"/>}
        </CardBody>
      </Card>

      {pendingCount > 0 && (
        <Card className="bg-amber-50">
          <CardBody className="p-3">
            <p className="text-amber-700 text-sm font-semibold">{pendingCount} sale(s) awaiting sync</p>
          </CardBody>
        </Card>
      )}

      {/* Account settings */}
      <Card>
        <CardBody className="p-0">
          <SettingRow icon={<User size={18} className="text-emerald-600"/>} label="Edit Profile" sub="Name and email" onClick={() => setSheet('profile')}/>
          <SettingRow icon={<Lock size={18} className="text-blue-600"/>} label="Change Password" sub="Update your password" onClick={() => setSheet('password')}/>
          <SettingRow icon={<Info size={18} className="text-gray-500"/>} label="About" sub="Version & business" onClick={() => setSheet('about')}/>
        </CardBody>
      </Card>

      {/* Logout */}
      <Card>
        <CardBody className="p-0">
          <button onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-red-600 hover:bg-red-50 transition-colors rounded-lg">
            <AlertCircle size={18}/>
            <span className="font-semibold text-sm flex-1 text-left">Logout</span>
            <ChevronRight size={16} className="text-red-300"/>
          </button>
        </CardBody>
      </Card>

      <p className="text-center text-xs text-gray-400 pb-4">Abdulmula Fashion ERP v3.0 · Juba, South Sudan</p>

      {/* Sheets */}
      {sheet === 'profile'  && <Sheet open={true} title="Edit Profile"   onClose={() => setSheet(null)}><EditProfileForm  onClose={() => setSheet(null)}/></Sheet>}
      {sheet === 'password' && <Sheet open={true} title="Change Password" onClose={() => setSheet(null)}><ChangePasswordForm onClose={() => setSheet(null)}/></Sheet>}
      {sheet === 'rate'     && <Sheet open={true} title="Exchange Rate"   onClose={() => setSheet(null)}><RateForm onClose={() => setSheet(null)}/></Sheet>}
      {sheet === 'about'    && <Sheet open={true} title="About"           onClose={() => setSheet(null)}><AboutContent/></Sheet>}
    </div>
  );
}

function SettingRow({ icon, label, sub, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0">
      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">{icon}</div>
      <div className="flex-1 text-left">
        <p className="font-semibold text-sm text-gray-900">{label}</p>
        {sub && <p className="text-xs text-gray-600">{sub}</p>}
      </div>
      <ChevronRight size={16} className="text-gray-400"/>
    </button>
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
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1.5">Full Name</label>
        <input {...register('name',{required:true})} className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"/>
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1.5">Email</label>
        <input type="email" {...register('email',{required:true})} className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"/>
      </div>
      <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full">Save Changes</Button>
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
                 className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition pr-10" placeholder="Min. 6 chars"/>
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
               className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"/>
        {errors.confirm && <p className="text-red-500 text-xs mt-1">{errors.confirm.message}</p>}
      </div>
      <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full">Update Password</Button>
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
      <Card className="bg-amber-50">
        <CardBody className="p-3 text-sm text-amber-700 font-medium">
          Current: 1 USD = {usdToSsp?.toLocaleString()} SSP
        </CardBody>
      </Card>
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1.5">1 USD = ? SSP</label>
        <input type="number" step="1" min="1" {...register('usdToSsp',{required:true,valueAsNumber:true})}
               className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" placeholder="e.g. 1300"/>
      </div>
      <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full">Set Rate</Button>
    </form>
  );
}

function AboutContent() {
  return (
    <div className="px-5 py-6 text-center space-y-4">
      <div className="w-20 h-20 rounded-xl flex items-center justify-center font-bold text-3xl text-white mx-auto shadow-lg bg-emerald-600">AF</div>
      <div>
        <h2 className="font-bold text-xl text-gray-900">Abdulmula Fashion ERP</h2>
        <p className="text-sm text-gray-600 mt-1">Version 3.0.0</p>
      </div>
      <Card className="bg-gray-50">
        <CardBody className="p-4 text-left space-y-2">
          {[['Business','Abdulmula Fashion'],['Location','Konyo-Konyo Market, Juba'],['Country','South Sudan'],['Type','Wholesale & Retail Fashion'],['Offline','Full offline support (IndexedDB)'],['PWA','Installable on Android & iOS'],['Currency','USD / SSP (dual currency)']].map(([k,v]) => (
            <div key={k} className="flex justify-between text-sm">
              <span className="text-gray-600">{k}</span><span className="font-semibold text-gray-900">{v}</span>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
