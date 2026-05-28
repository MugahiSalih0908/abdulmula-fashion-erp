// src/pages/CashbookPage.jsx – daily cashbook and currency settings

import { useState }                    from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm }                     from 'react-hook-form';
import toast                           from 'react-hot-toast';
import api                             from '../services/api';
import useSettingsStore                from '../store/settingsStore';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import CardBody from '../components/ui/CardBody';
import Sheet      from '../components/ui/Sheet';
import KpiCard    from '../components/ui/KpiCard';
import {
  BookOpen, Lock, RefreshCw, TrendingUp,
  TrendingDown, DollarSign, ArrowLeftRight
} from 'lucide-react';

export default function CashbookPage() {
  const [showClose, setShowClose]   = useState(false);
  const [showRate,  setShowRate]    = useState(false);
  const { currency, setCurrency, setRate, usdToSsp, fmt } = useSettingsStore();
  const queryClient = useQueryClient();

  const { data: today, isLoading } = useQuery({
    queryKey: ['cashbook-today'],
    queryFn:  async () => { const { data } = await api.get('/cashbook/today'); return data.data; },
    refetchInterval: 30000,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['cashbook-history'],
    queryFn:  async () => { const { data } = await api.get('/cashbook/history'); return data.data; },
  });

  const { data: rateData } = useQuery({
    queryKey: ['exchange-rate'],
    queryFn:  async () => { const { data } = await api.get('/cashbook/rate'); return data.data; },
    onSuccess: (d) => { if (d?.usdToSsp) setRate(d.usdToSsp); }
  });

  const closeMutation = useMutation({
    mutationFn: (body) => api.post('/cashbook/close', body),
    onSuccess:  (res) => { queryClient.invalidateQueries(['cashbook-today']); queryClient.invalidateQueries(['cashbook-history']); toast.success(res.data.message); setShowClose(false); },
    onError:    (e)   => toast.error(e?.response?.data?.message || 'Failed to close cashbook.')
  });

  const netCash = (today?.openingCash || 0) + (today?.livesCashSales || 0) - (today?.liveExpenses || 0);

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="Daily Cashbook"
        sub={new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
        action={
          <div className="flex gap-2">
            <button onClick={() => setShowRate(true)}
                    className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-600">
              <ArrowLeftRight size={18}/>
            </button>
            {!today?.isClosed && (
              <button onClick={() => setShowClose(true)}
                      className="flex items-center gap-1.5 text-white px-3 py-2.5 rounded-xl font-semibold text-sm"
                      style={{ background: '#111' }}>
                <Lock size={15}/> Close Day
              </button>
            )}
          </div>
        }
      />

      {/* Currency toggle */}
      <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
        {['USD','SSP'].map(c => (
          <button key={c} onClick={() => setCurrency(c)}
                  className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${
                    currency === c ? 'bg-white text-emerald-600 shadow-md' : 'text-gray-600'
                  }`}>
            {c}
          </button>
        ))}
      </div>

      {currency === 'SSP' && (
        <Card className="border-l-4 border-l-amber-500 bg-amber-50">
          <CardBody className="p-3 flex justify-between items-center">
            <span className="text-xs text-amber-700 font-medium">Rate: 1 USD = {usdToSsp.toLocaleString()} SSP</span>
            <button onClick={() => setShowRate(true)} className="text-xs font-bold text-amber-700 hover:underline">
              Change
            </button>
          </CardBody>
        </Card>
      )}

      {/* Today's KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard icon={<BookOpen size={18}/>} label="Opening Cash" loading={isLoading}
                 value={fmt(today?.openingCash || 0)} color="blue"/>
        <KpiCard icon={<TrendingUp size={18}/>} label="Cash Sales Today" loading={isLoading}
                 value={fmt(today?.livesCashSales || 0)} color="green"/>
        <KpiCard icon={<TrendingDown size={18}/>} label="Expenses Today" loading={isLoading}
                 value={fmt(today?.liveExpenses || 0)} color="red"/>
        <KpiCard icon={<DollarSign size={18}/>} label="Net Cash" loading={isLoading}
                 value={fmt(netCash)} color="gold"/>
      </div>

      {/* Status */}
      {today?.isClosed && (
        <Card className="border-l-4 border-l-emerald-500 bg-emerald-50">
          <CardBody className="p-4 flex items-center gap-3">
            <Lock size={18} className="text-emerald-600" />
            <div>
              <p className="font-semibold text-emerald-900 text-sm">Day closed</p>
              <p className="text-xs text-emerald-700">Closing cash: {fmt(today.closingCash)}</p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardBody className="p-0">
          <div className="px-4 pt-4 pb-2 border-b border-gray-100">
            <p className="font-semibold text-sm text-gray-900">Cashbook History</p>
          </div>
          {history.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No history yet</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {history.map(entry => (
                <div key={entry._id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{entry.date}</p>
                    <p className="text-xs text-gray-500">
                      Open: {fmt(entry.openingCash)}
                      {entry.isClosed && ` → Close: ${fmt(entry.closingCash)}`}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    entry.isClosed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {entry.isClosed ? 'Closed' : 'Open'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="h-4"/>

      {/* Close Day Sheet */}
      <Sheet open={showClose} title="Close Day" subtitle="Record closing cash balance" onClose={() => setShowClose(false)}>
        <CloseDayForm onClose={() => setShowClose(false)} onSaved={(d) => closeMutation.mutate(d)} isPending={closeMutation.isPending} openingCash={today?.openingCash} netCash={netCash} fmt={fmt} />
      </Sheet>

      {/* Exchange Rate Sheet */}
      <Sheet open={showRate} title="Exchange Rate" subtitle="Set USD to SSP rate" onClose={() => setShowRate(false)}>
        <ExchangeRateForm currentRate={usdToSsp} onClose={() => setShowRate(false)} onSaved={() => { queryClient.invalidateQueries(['exchange-rate']); setShowRate(false); }} />
      </Sheet>
    </div>
  );
}

function CloseDayForm({ onClose, onSaved, isPending, openingCash, netCash, fmt }) {
  const { register, handleSubmit } = useForm({ defaultValues: { closingCash: netCash?.toFixed(2) || '' } });
  return (
    <form onSubmit={handleSubmit(onSaved)} className="px-5 py-4 space-y-4">
      <Card className="bg-gray-50">
        <CardBody className="p-3 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-gray-600">Opening Cash</span><span className="font-semibold text-gray-900">{fmt(openingCash || 0)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-600">Expected Closing</span><span className="font-bold text-emerald-700">{fmt(netCash || 0)}</span></div>
        </CardBody>
      </Card>
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1.5">Actual Closing Cash ($)</label>
        <input type="number" step="0.01" min="0" {...register('closingCash', { required:true, valueAsNumber:true })}
               className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" placeholder="0.00"/>
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1.5">Note</label>
        <textarea {...register('note')} rows={2} className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition resize-none" placeholder="Any notes for today…"/>
      </div>
      <Button type="submit" variant="primary" disabled={isPending} className="w-full">
        {isPending && <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"/>}
        Close Day
      </Button>
    </form>
  );
}

function ExchangeRateForm({ currentRate, onClose, onSaved }) {
  const setRate = useSettingsStore(s => s.setRate);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({ defaultValues: { usdToSsp: currentRate } });
  const onSubmit = async ({ usdToSsp }) => {
    try {
      await api.post('/cashbook/rate', { usdToSsp });
      setRate(parseFloat(usdToSsp));
      toast.success('Exchange rate updated.');
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed.');
    }
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-4">
      <Card className="bg-amber-50">
        <CardBody className="p-3 text-sm text-amber-700">
          <p className="font-semibold">Current rate</p>
          <p>1 USD = {currentRate?.toLocaleString()} SSP</p>
        </CardBody>
      </Card>
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1.5">New Rate: 1 USD = ? SSP</label>
        <input type="number" step="1" min="1" {...register('usdToSsp', { required:true, valueAsNumber:true })}
               className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" placeholder="e.g. 1300"/>
      </div>
      <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full">
        Set Rate
      </Button>
    </form>
  );
}
