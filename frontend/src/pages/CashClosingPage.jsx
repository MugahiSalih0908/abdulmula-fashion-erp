// src/pages/CashClosingPage.jsx – daily cash closing with approval workflow

import { useState }                    from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm }                     from 'react-hook-form';
import toast                           from 'react-hot-toast';
import api                             from '../services/api';
import { useRole }                     from '../hooks/useRole';
import useSettingsStore                from '../store/settingsStore';
import PageHeader  from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import CardBody from '../components/ui/CardBody';
import Badge from '../components/ui/Badge';
import Sheet       from '../components/ui/Sheet';
import KpiCard     from '../components/ui/KpiCard';
import {
  BookOpen, CheckCircle, Clock, AlertTriangle,
  Lock, TrendingUp, TrendingDown, DollarSign
} from 'lucide-react';

const STATUS_STYLES = {
  pending_approval: { badge: 'warning', label: 'Pending Approval' },
  approved:         { badge: 'success', label: 'Approved' },
  disputed:         { badge: 'danger', label: 'Disputed' },
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
      <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
        {['USD','SSP'].map(c => (
          <button key={c} onClick={() => setCurrency(c)}
                  className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${currency===c?'bg-white text-emerald-600 shadow-md':'text-gray-600'}`}>
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
        <Card className={`border-l-4 ${
          todayClosing.status==='approved' ? 'border-l-emerald-500 bg-emerald-50' :
          todayClosing.status==='disputed' ? 'border-l-red-500 bg-red-50' :
                                              'border-l-amber-500 bg-amber-50'
        }`}>
          <CardBody className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {todayClosing.status==='approved'         ? <CheckCircle size={18} className="text-emerald-600"/> :
                 todayClosing.status==='pending_approval' ? <Clock size={18} className="text-amber-600"/> :
                                                            <AlertTriangle size={18} className="text-red-600"/>}
                <p className="font-bold text-sm text-gray-900">
                  {todayClosing.status==='approved' ? 'Day Closed & Approved' :
                   todayClosing.status==='pending_approval' ? 'Pending Admin Approval' : 'Disputed'}
                </p>
              </div>
              {isAdmin && todayClosing.status==='pending_approval' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => approveMutation.mutate(todayClosing._id)}
                  disabled={approveMutation.isPending}
                >
                  Approve
                </Button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <p className="text-xs text-gray-600 mb-1">Expected</p>
                <p className="font-bold text-sm text-gray-900">{fmt(todayClosing.expectedCash)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-600 mb-1">Actual</p>
                <p className="font-bold text-sm text-gray-900">{fmt(todayClosing.actualCash)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-600 mb-1">{todayClosing.shortage>0?'Shortage':'Excess'}</p>
                <p className={`font-bold text-sm ${todayClosing.shortage>0?'text-red-600':'text-emerald-600'}`}>
                  {todayClosing.shortage>0 ? `-${fmt(todayClosing.shortage)}` : `+${fmt(todayClosing.excess)}`}
                </p>
              </div>
            </div>
            {todayClosing.notes && <p className="text-xs text-gray-600 mt-3 italic">{todayClosing.notes}</p>}
          </CardBody>
        </Card>
      )}

      {/* Pending approvals (admin only) */}
      {isAdmin && (
        <Card>
          <CardBody className="p-0">
            <div className="px-4 pt-4 pb-2 border-b border-gray-100 flex items-center gap-2">
              <Clock size={16} className="text-amber-600"/>
              <p className="font-semibold text-sm text-gray-900">All Closing Records</p>
            </div>
            {closings.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">No closing records yet</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {closings.map(c => (
                  <div key={c._id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 transition">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-gray-900">{c.date}</p>
                        <Badge variant={STATUS_STYLES[c.status]?.badge || 'secondary'}>
                          {STATUS_STYLES[c.status]?.label || c.status.replace('_',' ')}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        By: {c.closedByName}
                        {c.shortage>0 && <span className="text-red-600 ml-2">Shortage: {fmt(c.shortage)}</span>}
                        {c.excess>0   && <span className="text-emerald-700 ml-2">Excess: {fmt(c.excess)}</span>}
                      </p>
                    </div>
                    {isAdmin && c.status === 'pending_approval' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => approveMutation.mutate(c._id)}
                        disabled={approveMutation.isPending}
                      >
                        Approve
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
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
      <Card className="bg-gray-50">
        <CardBody className="p-3 space-y-1">
          <div className="flex justify-between text-sm"><span className="text-gray-600">Opening Cash</span><span className="font-semibold text-gray-900">{fmt(openingCash||0)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-600">Expected Closing</span><span className="font-bold text-emerald-700">{fmt(netCash||0)}</span></div>
        </CardBody>
      </Card>

      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1.5">Actual Cash Count ($) *</label>
        <input type="number" step="0.01" min="0"
               {...register('actualCash',{required:'Required',valueAsNumber:true})}
               className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-lg font-bold focus:outline-none transition"
               style={{ borderColor: Math.abs(diff) < 1 ? '#06b6d4' : diff < 0 ? '#ef4444' : '#22c55e' }}
               placeholder={netCash?.toFixed(2)}/>
      </div>

      {!isNaN(diff) && (
        <Card className={`${
          Math.abs(diff) < 0.01 ? 'bg-emerald-50' : diff < 0 ? 'bg-red-50' : 'bg-amber-50'
        }`}>
          <CardBody className="p-3 flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-900">{diff < 0 ? '⚠ Shortage' : diff > 0 ? '✓ Excess' : '✓ Balanced'}</span>
            <span className={`font-bold text-lg ${diff<0?'text-red-600':diff>0?'text-emerald-600':'text-emerald-600'}`}>
              {diff >= 0 ? '+' : ''}{fmt(diff)}
            </span>
          </CardBody>
        </Card>
      )}

      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1.5">Notes</label>
        <textarea {...register('notes')} rows={2}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition resize-none"
                  placeholder="Any notes for the admin…"/>
      </div>

      <Card className="bg-amber-50">
        <CardBody className="p-2.5">
          <p className="text-xs text-amber-700 font-medium">⚠ Submission requires admin approval before the day is officially closed.</p>
        </CardBody>
      </Card>

      <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full">
        {isSubmitting && <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"/>}
        Submit for Approval
      </Button>
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
      <Card className="bg-amber-50">
        <CardBody className="p-3 text-sm text-amber-700 font-medium">
          Current: 1 USD = {currentRate?.toLocaleString()} SSP
        </CardBody>
      </Card>
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1.5">New Rate: 1 USD = ? SSP</label>
        <input type="number" step="1" min="1" {...register('usdToSsp',{required:true,valueAsNumber:true})}
               className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" placeholder="e.g. 1300"/>
      </div>
      <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full">
        Set Rate
      </Button>
    </form>
  );
}
