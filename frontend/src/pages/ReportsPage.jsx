// src/pages/ReportsPage.jsx – complete analytics dashboard v3

import { useState }   from 'react';
import { useQuery }   from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import api             from '../services/api';
import useSettingsStore from '../store/settingsStore';
import PageHeader      from '../components/ui/PageHeader';
import KpiCard         from '../components/ui/KpiCard';
import {
  TrendingUp, TrendingDown, DollarSign, Package,
  ShoppingCart, Star, BarChart3
} from 'lucide-react';

const COLORS = ['#d4a017','#111111','#ef4444','#22c55e','#3b82f6','#8b5cf6','#f97316','#06b6d4'];
const MONTHS  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const TABS    = ['Overview','Daily','Monthly','Inventory','Staff','Categories'];

const dateStart = () => { const d=new Date(); d.setDate(1); return d.toISOString().split('T')[0]; };
const dateToday = () => new Date().toISOString().split('T')[0];

export default function ReportsPage() {
  const [tab, setTab]           = useState('Overview');
  const [startDate, setStartDate] = useState(dateStart);
  const [endDate,   setEndDate]   = useState(dateToday);
  const { fmt } = useSettingsStore();

  const { data: summary, isLoading: sumLoading } = useQuery({
    queryKey: ['rpt-summary', startDate, endDate],
    queryFn:  async () => { const { data } = await api.get(`/reports/summary?startDate=${startDate}&endDate=${endDate}`); return data.data; },
  });

  const { data: daily } = useQuery({
    queryKey: ['rpt-daily'],
    queryFn:  async () => { const { data } = await api.get('/reports/daily'); return data.data; },
    enabled:  tab === 'Daily',
  });

  const { data: monthly } = useQuery({
    queryKey: ['rpt-monthly'],
    queryFn:  async () => { const { data } = await api.get('/reports/monthly'); return data.data; },
    enabled:  tab === 'Monthly',
  });

  const { data: inventory } = useQuery({
    queryKey: ['rpt-inventory'],
    queryFn:  async () => { const { data } = await api.get('/reports/inventory'); return data.data; },
    enabled:  tab === 'Inventory',
  });

  const { data: staffData } = useQuery({
    queryKey: ['rpt-staff', startDate, endDate],
    queryFn:  async () => { const { data } = await api.get(`/reports/staff-performance?startDate=${startDate}&endDate=${endDate}`); return data.data; },
    enabled:  tab === 'Staff',
  });

  const { data: categories } = useQuery({
    queryKey: ['rpt-categories', startDate, endDate],
    queryFn:  async () => { const { data } = await api.get(`/reports/categories?startDate=${startDate}&endDate=${endDate}`); return data.data; },
    enabled:  tab === 'Categories',
  });

  const dailyChart = (daily?.salesByDay || []).map(d => {
    const exp = (daily?.expByDay || []).find(e => e._id === d._id);
    return { date: d._id.slice(5), revenue: d.revenue, expenses: exp?.total||0, profit: d.revenue-(exp?.total||0) };
  });

  const monthlyChart = (monthly||[]).map(m => ({
    name: MONTHS[m._id.month-1], revenue: m.revenue, count: m.count
  }));

  const quickRange = (label) => {
    const e = new Date(), s = new Date();
    if (label === 'Today')  { const t=dateToday(); setStartDate(t); setEndDate(t); return; }
    if (label === 'Week')   { s.setDate(s.getDate()-6); }
    if (label === 'Month')  { s.setDate(1); }
    if (label === 'Year')   { s.setMonth(0); s.setDate(1); }
    setStartDate(s.toISOString().split('T')[0]);
    setEndDate(e.toISOString().split('T')[0]);
  };

  return (
    <div className="p-4 space-y-4">
      <PageHeader title="Reports" sub="Business performance" />

      {/* Date range */}
      <div className="bg-white rounded-2xl p-3 shadow-sm">
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-xs text-gray-400 block mb-0.5">From</label>
            <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}
                   className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none"/></div>
          <div><label className="text-xs text-gray-400 block mb-0.5">To</label>
            <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}
                   className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none"/></div>
        </div>
        <div className="flex gap-2 mt-2 overflow-x-auto pb-1 no-scrollbar">
          {['Today','Week','Month','Year'].map(l => (
            <button key={l} onClick={()=>quickRange(l)}
                    className="shrink-0 px-3 py-1 bg-gray-100 rounded-full text-xs font-semibold text-gray-600">{l}</button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-1 no-scrollbar">
        {TABS.map(t => (
          <button key={t} onClick={()=>setTab(t)}
                  className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold ${
                    tab===t ? 'text-black' : 'bg-white text-gray-500 border border-gray-200'
                  }`}
                  style={tab===t ? { background:'#d4a017' } : {}}>
            {t}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'Overview' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <KpiCard icon={<TrendingUp size={18}/>}   label="Revenue"   loading={sumLoading} value={fmt(summary?.revenue||0)}   sub={`${summary?.salesCount||0} sales`} color="green"/>
            <KpiCard icon={<TrendingDown size={18}/>}  label="Expenses"  loading={sumLoading} value={fmt(summary?.expenses||0)}  color="red"/>
            <KpiCard icon={<DollarSign size={18}/>}   label="Profit"    loading={sumLoading} value={fmt(summary?.profit||0)}    color={summary?.profit>=0?'gold':'red'}/>
            <KpiCard icon={<ShoppingCart size={18}/>} label="Avg Sale"  loading={sumLoading}
                     value={fmt(summary?.salesCount>0 ? summary.revenue/summary.salesCount : 0)} color="blue"/>
          </div>

          {(summary?.byPayment||[]).length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="font-bold text-sm text-gray-700 mb-3">By Payment Method</p>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={summary.byPayment} dataKey="total" nameKey="_id" cx="50%" cy="50%" outerRadius={70}
                       label={({_id,percent})=>`${_id} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                    {summary.byPayment.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                  </Pie>
                  <Tooltip formatter={v=>fmt(v)}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {(summary?.topProducts||[]).length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 pt-4 pb-2 border-b flex items-center gap-2">
                <Star size={15} style={{color:'#d4a017'}}/><p className="font-bold text-sm">Top Products</p>
              </div>
              {summary.topProducts.slice(0,8).map((p,i)=>(
                <div key={i} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-gray-400 w-5">#{i+1}</span>
                    <p className="text-sm font-semibold truncate max-w-[160px]">{p.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-green-600">{fmt(p.revenue)}</p>
                    <p className="text-xs text-gray-400">{p.qty} sold</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-red-50 border border-red-100 rounded-2xl p-3">
              <p className="text-xs text-red-600 font-semibold uppercase">Customer Credit</p>
              <p className="font-black text-lg text-red-600">{fmt(summary?.totalCreditOwed||0)}</p>
              <p className="text-xs text-gray-400">customers owe you</p>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-3">
              <p className="text-xs text-orange-600 font-semibold uppercase">Supplier Debt</p>
              <p className="font-black text-lg text-orange-600">{fmt(summary?.totalSupplierDebt||0)}</p>
              <p className="text-xs text-gray-400">you owe suppliers</p>
            </div>
          </div>
        </>
      )}

      {/* DAILY */}
      {tab === 'Daily' && (
        dailyChart.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No data for last 30 days</div>
        ) : (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="font-bold text-sm text-gray-700 mb-3">Revenue vs Expenses (30d)</p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={dailyChart} margin={{top:5,right:5,bottom:0,left:-20}}>
                  <defs>
                    <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#d4a017" stopOpacity={0.3}/><stop offset="95%" stopColor="#d4a017" stopOpacity={0}/></linearGradient>
                    <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                  <Tooltip formatter={(v,n)=>[fmt(v),n]}/>
                  <Area type="monotone" dataKey="revenue"  name="Revenue"  stroke="#d4a017" strokeWidth={2} fill="url(#rg)"/>
                  <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={2} fill="url(#eg)"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="font-bold text-sm text-gray-700 mb-3">Daily Profit</p>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={dailyChart} margin={{top:5,right:5,bottom:0,left:-20}}>
                  <XAxis dataKey="date" tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                  <Tooltip formatter={v=>fmt(v)}/>
                  <Bar dataKey="profit" fill="#d4a017" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )
      )}

      {/* MONTHLY */}
      {tab === 'Monthly' && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="font-bold text-sm text-gray-700 mb-3">Monthly Revenue (12m)</p>
          {monthlyChart.length === 0 ? (
            <div className="text-center py-10 text-gray-400">No monthly data yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyChart} margin={{top:5,right:5,bottom:0,left:-20}}>
                  <XAxis dataKey="name" tick={{fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:11}} axisLine={false} tickLine={false}/>
                  <Tooltip formatter={v=>fmt(v)}/>
                  <Bar dataKey="revenue" fill="#d4a017" radius={[6,6,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {monthlyChart.map(m=>(
                  <div key={m.name} className="flex justify-between text-sm">
                    <span className="text-gray-500 w-8">{m.name}</span>
                    <div className="flex-1 mx-3 flex items-center">
                      <div className="h-1.5 rounded-full" style={{background:'#d4a017', width:`${Math.max(4,(m.revenue/Math.max(...monthlyChart.map(x=>x.revenue)))*100)}%`}}/>
                    </div>
                    <span className="font-semibold">{fmt(m.revenue)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* INVENTORY */}
      {tab === 'Inventory' && inventory && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <KpiCard icon={<Package size={18}/>} label="Total Products" value={inventory.totalProducts} color="blue"/>
            <KpiCard icon={<Package size={18}/>} label="Low Stock" value={inventory.lowStock?.length} color="red"/>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Value at Cost</p>
              <p className="font-black text-lg" style={{color:'#d4a017'}}>{fmt(inventory.inventoryValue?.atCost||0)}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Value at Retail</p>
              <p className="font-black text-lg text-green-600">{fmt(inventory.inventoryValue?.atRetail||0)}</p>
            </div>
          </div>

          {inventory.lowStock?.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 pt-4 pb-2 border-b"><p className="font-bold text-sm text-red-600">⚠ Low Stock</p></div>
              {inventory.lowStock.map(p=>(
                <div key={p._id} className="flex justify-between px-4 py-2.5 border-b border-gray-50 last:border-0">
                  <div><p className="font-semibold text-sm">{p.name}</p><p className="text-xs text-gray-400">{p.category}</p></div>
                  <span className="font-black text-red-500 text-sm">{p.quantity}</span>
                </div>
              ))}
            </div>
          )}

          {inventory.deadStock?.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 pt-4 pb-2 border-b"><p className="font-bold text-sm text-gray-600">💀 Dead Stock</p></div>
              {inventory.deadStock.map(p=>(
                <div key={p._id} className="flex justify-between px-4 py-2.5 border-b border-gray-50 last:border-0">
                  <div><p className="font-semibold text-sm">{p.name}</p><p className="text-xs text-gray-400">Cost: {fmt(p.costPrice)}</p></div>
                  <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-500">0 units</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* STAFF */}
      {tab === 'Staff' && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-2 border-b flex items-center gap-2"><BarChart3 size={16} style={{color:'#d4a017'}}/><p className="font-bold text-sm">Staff Performance</p></div>
          {!staffData?.length ? (
            <div className="text-center py-10 text-gray-400 text-sm">No sales data for this period</div>
          ) : staffData.map((s,i)=>(
            <div key={s._id||i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-black shrink-0" style={{background:'#d4a017'}}>
                {(s.name||'?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{s.name||'Unknown'}</p>
                <p className="text-xs text-gray-400">{s.count} sales · avg {fmt(s.avgSale||0)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-green-600 text-sm">{fmt(s.revenue)}</p>
                <span className="text-xs text-gray-400">#{i+1}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CATEGORIES */}
      {tab === 'Categories' && (
        categories?.length > 0 ? (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="font-bold text-sm text-gray-700 mb-3">Revenue by Category</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={categories} dataKey="revenue" nameKey="_id" cx="50%" cy="50%" outerRadius={75}
                       label={({_id,percent})=>percent>0.05?`${_id} ${(percent*100).toFixed(0)}%`:''} labelLine={false}>
                    {categories.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                  </Pie>
                  <Tooltip formatter={v=>fmt(v)}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {categories.map((c,i)=>(
                <div key={c._id||i} className="flex justify-between px-4 py-3 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{background:COLORS[i%COLORS.length]}}/>
                    <p className="font-semibold text-sm">{c._id||'Unknown'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-green-600">{fmt(c.revenue)}</p>
                    <p className="text-xs text-gray-400">{c.qty} items</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-gray-400"><BarChart3 size={40} className="mx-auto mb-2 opacity-25"/><p>No category data for this period</p></div>
        )
      )}

      <div className="h-4"/>
    </div>
  );
}
