// src/pages/CashClosingPage.jsx – daily cash closing with approval workflow

import { useState }                    from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm }                     from 'react-hook-form';
import toast                           from 'react-hot-toast';
import api                             from '../services/api';
import { useRole }                     from '../hooks/useRole';
import useSettingsStore                from '../store/settingsStore';
import PageHeader  from '../components/ui/PageHeader';
import Sheet       from '../components/ui/Sheet';
import KpiCard     from '../components/ui/KpiCard';
import {
  BookOpen, CheckCircle, Clock, AlertTriangle,
  Lock, TrendingUp, TrendingDown, DollarSign
} from 'lucide-react';

const STATUS_STYLES = {
  pending_approval: 'bg-amber-100 text-amber-700',
  approved:         'bg-green-100 text-green-700',
  disputed:         'bg-red-100 text-red-700',
};

export default function CashClosingPage() {
  const [showClose,  setShowClose]  = useState(false);
  const [showRate,   setShowRate]   = useState(false);
  const { can, isAdmin } = useRole();
  const { fmt, setCurrency, currency, usdToSsp, setRate } = useSettingsStore();
  const queryClient = useQueryClient();

  const { data: today, isLoading } = useQuery({
    queryKey: ['cashbook-today'],
    queryFn:  async () => { const { data } = await api.get('/cashbook/today'); return data.data; },
    refetchInterval: 30000,
  });

  const { data: closings = [] } = useQuery({
    queryKey: ['cash-closings'],
    queryFn:  async () => { const { data } = await api.get('/cashbook/closings'); return data.data; },
  });

  const { data: rateData } = useQuery({
    queryKey: ['exchange-rate'],
    queryFn:  async () => { const { data } = await api.get('/cashbook/rate'); return data.data; },
    onSuccess: (d) => { if (d?.usdToSsp) setRate(d.usdToSsp); },
  });

  const approveMutation = useMutation({
    mutationFn: (id) => api.post(`/cashbook/approve/${id}`),
    onSuccess:  (res) => { queryClient.invalidateQueries(['cash-closings']); queryClient.invalidateQueries(['cashbook-today']); toast.success(res.data.message); },
    onError:    (e)   => toast.error(e?.response?.data?.message || 'Approval failed.'),
  });

  const netCash = (today?.openingCash||0) + (today?.livesCashSales||0) - (today?.liveExpenses||0);
  const todayClosing = closings.find(c => c.date === new Date().toISOString().split('T')[0]);

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="Cashbook"
        sub={new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
        action={
          <div className="flex gap-2">
            <button onClick={() => setShowRate(true)}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-600">
              Rate: 1 USD = {usdToSsp?.toLocaleString()} SSP
            </button>
            {can.closeCashbook && !today?.isClosed && (
              <button onClick={() => setShowClose(true)}
                      className="flex items-center gap-1.5 text-white px-3 py-2.5 rounded-xl font-semibold text-sm"
                      style={{ background:'#111' }}>
                <Lock size={14}/> Close Day
              </button>
            )}
          </div>
        }
      />

      {/* Currency toggle */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        {['USD','SSP'].map(c => (
          <button key={c} onClick={() => setCurrency(c)}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold ${currency===c?'bg-white text-gray-900 shadow-sm':'text-gray-500'}`}>
            {c}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard icon={<BookOpen size={18}/>}     label="Opening Cash"   loading={isLoading} value={fmt(today?.openingCash||0)}     color="blue"/>
        <KpiCard icon={<TrendingUp size={18}/>}   label="Cash Sales"     loading={isLoading} value={fmt(today?.livesCashSales||0)}  color="green"/>
        <KpiCard icon={<TrendingDown size={18}/>} label="Expenses"       loading={isLoading} value={fmt(today?.liveExpenses||0)}    color="red"/>
        <KpiCard icon={<DollarSign size={18}/>}   label="Expected Close" loading={isLoading} value={fmt(netCash)}                  color="gold"/>
      </div>

      {/* Today's closing status */}
      {todayClosing && (
        <div className={`rounded-2xl p-4 border ${
          todayClosing.status==='approved' ? 'bg-green-50 border-green-200' :
          todayClosing.status==='disputed' ? 'bg-red-50 border-red-200' :
                                             'bg-amber-50 border-amber-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {todayClosing.status==='approved'         ? <CheckCircle size={18} className="text-green-600"/> :
               todayClosing.status==='pending_approval' ? <Clock size={18} className="text-amber-600"/> :
                                                          <AlertTriangle size={18} className="text-red-600"/>}
              <p className="font-bold text-sm">
                {todayClosing.status==='approved' ? 'Day Closed & Approved' :
                 todayClosing.status==='pending_approval' ? 'Pending Admin Approval' : 'Disputed'}
              </p>
            </div>
            {isAdmin && todayClosing.status==='pending_approval' && (
              <button onClick={() => approveMutation.mutate(todayClosing._id)}
                      disabled={approveMutation.isPending}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-xl text-xs font-bold disabled:opacity-50">
                Approve
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="text-center">
              <p className="text-xs text-gray-500">Expected</p>
              <p className="font-bold text-sm">{fmt(todayClosing.expectedCash)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Actual</p>
              <p className="font-bold text-sm">{fmt(todayClosing.actualCash)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">{todayClosing.shortage>0?'Shortage':'Excess'}</p>
              <p className={`font-bold text-sm ${todayClosing.shortage>0?'text-red-600':'text-green-600'}`}>
                {todayClosing.shortage>0 ? `-${fmt(todayClosing.shortage)}` : `+${fmt(todayClosing.excess)}`}
              </p>
            </div>
          </div>
          {todayClosing.notes && <p className="text-xs text-gray-500 mt-2 italic">{todayClosing.notes}</p>}
        </div>
      )}

      {/* Pending approvals (admin only) */}
      {isAdmin && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-2 border-b flex items-center gap-2">
            <Clock size={15} className="text-amber-600"/>
            <p className="font-bold text-sm">All Closing Records</p>
          </div>
          {closings.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No closing records yet</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {closings.map(c => (
                <div key={c._id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{c.date}</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[c.status]||'bg-gray-100 text-gray-600'}`}>
                        {c.status.replace('_',' ')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      By: {c.closedByName}
                      {c.shortage>0 && <span className="text-red-500 ml-2">Shortage: {fmt(c.shortage)}</span>}
                      {c.excess>0   && <span className="text-green-600 ml-2">Excess: {fmt(c.excess)}</span>}
                    </p>
                  </div>
                  {isAdmin && c.status === 'pending_approval' && (
                    <button onClick={() => approveMutation.mutate(c._id)}
                            disabled={approveMutation.isPending}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-xl text-xs font-bold disabled:opacity-50 shrink-0">
                      Approve
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="h-4"/>

      {/* Close Day Sheet */}
      <Sheet open={showClose} title="Close Day" subtitle="Enter actual cash in register" onClose={() => setShowClose(false)}>
        <CloseDayForm netCash={netCash} fmt={fmt} openingCash={today?.openingCash}
                      onClose={() => setShowClose(false)}
                      onSaved={() => { queryClient.invalidateQueries(['cashbook-today']); queryClient.invalidateQueries(['cash-closings']); setShowClose(false); }} />
      </Sheet>

      {/* Rate Sheet */}
      <Sheet open={showRate} title="Exchange Rate" subtitle="Set today's USD to SSP rate" onClose={() => setShowRate(false)}>
        <RateForm currentRate={usdToSsp} onClose={() => setShowRate(false)}
                  onSaved={(rate) => { setRate(rate); queryClient.invalidateQueries(['exchange-rate']); setShowRate(false); }} />
      </Sheet>
    </div>
  );
}

function CloseDayForm({ netCash, fmt, openingCash, onClose, onSaved }) {
  const { register, handleSubmit, watch, formState:{isSubmitting} } = useForm({ defaultValues:{ actualCash: netCash?.toFixed(2)||'' } });
  const actualVal  = parseFloat(watch('actualCash')) || 0;
  const diff       = actualVal - netCash;

  const onSubmit = async (data) => {
    try {
      await api.post('/cashbook/close', { actualCash: parseFloat(data.actualCash), notes: data.notes });
      toast.success('Cash closing submitted for approval.');
      onSaved();
    } catch (e) { toast.error(e?.response?.data?.message || 'Failed.'); }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-4">
      <div className="bg-gray-50 rounded-xl p-3 space-y-1">
        <div className="flex justify-between text-sm"><span className="text-gray-500">Opening Cash</span><span className="font-semibold">{fmt(openingCash||0)}</span></div>
        <div className="flex justify-between text-sm"><span className="text-gray-500">Expected Closing</span><span className="font-bold">{fmt(netCash||0)}</span></div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1.5">Actual Cash Count ($) *</label>
        <input type="number" step="0.01" min="0"
               {...register('actualCash',{required:'Required',valueAsNumber:true})}
               className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg font-bold focus:outline-none"
               style={{ borderColor: Math.abs(diff) < 1 ? '#d4a017' : diff < 0 ? '#ef4444' : '#22c55e' }}
               placeholder={netCash?.toFixed(2)}/>
      </div>

      {!isNaN(diff) && (
        <div className={`rounded-xl p-3 flex justify-between items-center ${
          Math.abs(diff) < 0.01 ? 'bg-green-50' : diff < 0 ? 'bg-red-50' : 'bg-amber-50'
        }`}>
          <span className="text-sm font-semibold">{diff < 0 ? '⚠ Shortage' : diff > 0 ? '✓ Excess' : '✓ Balanced'}</span>
          <span className={`font-black text-lg ${diff<0?'text-red-600':diff>0?'text-green-600':'text-green-600'}`}>
            {diff >= 0 ? '+' : ''}{fmt(diff)}
          </span>
        </div>
      )}

      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1.5">Notes</label>
        <textarea {...register('notes')} rows={2}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none resize-none"
                  placeholder="Any notes for the admin…"/>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-700">
        ⚠ Submission requires admin approval before the day is officially closed.
      </div>

      <button type="submit" disabled={isSubmitting}
              className="w-full py-4 rounded-2xl font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background:'#111' }}>
        {isSubmitting && <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
        Submit for Approval
      </button>
    </form>
  );
}

function RateForm({ currentRate, onClose, onSaved }) {
  const { register, handleSubmit, formState:{isSubmitting} } = useForm({ defaultValues:{ usdToSsp: currentRate } });
  const onSubmit = async ({ usdToSsp }) => {
    try {
      await api.post('/cashbook/rate', { usdToSsp });
      toast.success('Exchange rate updated.');
      onSaved(parseFloat(usdToSsp));
    } catch (e) { toast.error(e?.response?.data?.message||'Failed.'); }
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-4">
      <div className="bg-amber-50 rounded-xl p-3 text-sm text-amber-700">
        Current: 1 USD = {currentRate?.toLocaleString()} SSP
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1.5">New Rate: 1 USD = ? SSP</label>
        <input type="number" step="1" min="1" {...register('usdToSsp',{required:true,valueAsNumber:true})}
               className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none" placeholder="e.g. 1300"/>
      </div>
      <button type="submit" disabled={isSubmitting}
              className="w-full py-4 rounded-2xl font-bold text-black disabled:opacity-60"
              style={{ background:'#d4a017' }}>
        Set Rate
      </button>
    </form>
  );
}
