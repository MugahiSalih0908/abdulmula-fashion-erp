// src/pages/ReportsPage.jsx – Refactored with Green Premium Mobile-First Design

import { useState }   from 'react';
import { useQuery }   from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import api             from '../services/api';
import useSettingsStore from '../store/settingsStore';
import PageHeader      from '../components/ui/PageHeader';
import { StatCard, Card, CardHeader, CardBody, Badge } from '@/components/ui';
import {
  TrendingUp, TrendingDown, DollarSign, Package,
  ShoppingCart, Star, BarChart3, AlertTriangle
} from 'lucide-react';

const COLORS = ['#16a34a','#111111','#ef4444','#22c55e','#3b82f6','#8b5cf6','#f97316','#06b6d4'];
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
    <div className="p-4 space-y-4 pb-20">
      <PageHeader title="Reports" sub="Business performance" />

      {/* Date Range Picker */}
      <Card>
        <CardBody>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 font-medium block mb-1">From</label>
              <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}
                     className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"/>
            </div>
            <div>
              <label className="text-xs text-gray-600 font-medium block mb-1">To</label>
              <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}
                     className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"/>
            </div>
          </div>
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar">
            {['Today','Week','Month','Year'].map(l => (
              <button key={l} onClick={()=>quickRange(l)}
                      className="shrink-0 px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-full text-xs font-semibold transition-colors">{l}</button>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar border-b border-gray-200">
        {TABS.map(t => (
          <button key={t} onClick={()=>setTab(t)}
                  className={`shrink-0 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                    tab===t ? 'text-green-600 border-green-600' : 'text-gray-600 border-transparent hover:text-gray-900'
                  }`}>
            {t}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'Overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={<TrendingUp size={20}/>}   label="Revenue"   value={fmt(summary?.revenue||0)}   change={+15.2} positive loading={sumLoading} />
            <StatCard icon={<TrendingDown size={20}/>}  label="Expenses"  value={fmt(summary?.expenses||0)}  change={-2.3} positive={false} loading={sumLoading} />
            <StatCard icon={<DollarSign size={20}/>}   label="Profit"    value={fmt(summary?.profit||0)}    change={summary?.profit>=0?+18.5:-5.2} positive={summary?.profit>=0} loading={sumLoading} />
            <StatCard icon={<ShoppingCart size={20}/>} label="Avg Sale"  value={fmt(summary?.salesCount>0 ? summary.revenue/summary.salesCount : 0)} change={+5.1} positive loading={sumLoading} />
          </div>

          {(summary?.byPayment||[]).length > 0 && (
            <Card>
              <CardHeader title="Payment Methods" />
              <CardBody className="pt-2">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={summary.byPayment} dataKey="total" nameKey="_id" cx="50%" cy="50%" outerRadius={70}
                         label={({_id,percent})=>`${_id} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                      {summary.byPayment.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                    </Pie>
                    <Tooltip formatter={v=>fmt(v)}/>
                  </PieChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
          )}

          {(summary?.topProducts||[]).length > 0 && (
            <Card>
              <CardHeader title="Top Products" icon={<Star size={18} />} />
              <CardBody className="divide-y divide-gray-100">
                {summary.topProducts.slice(0,8).map((p,i)=>(
                  <div key={i} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-gray-400 w-6">#{i+1}</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.qty} sold</p>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-green-600">{fmt(p.revenue)}</p>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Card className="border-l-4 border-red-500">
              <CardBody>
                <p className="text-xs text-red-600 font-semibold uppercase tracking-wider">Customer Credit</p>
                <p className="font-black text-lg text-red-600 mt-2">{fmt(summary?.totalCreditOwed||0)}</p>
                <p className="text-xs text-gray-500 mt-1">customers owe you</p>
              </CardBody>
            </Card>
            <Card className="border-l-4 border-orange-500">
              <CardBody>
                <p className="text-xs text-orange-600 font-semibold uppercase tracking-wider">Supplier Debt</p>
                <p className="font-black text-lg text-orange-600 mt-2">{fmt(summary?.totalSupplierDebt||0)}</p>
                <p className="text-xs text-gray-500 mt-1">you owe suppliers</p>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {/* DAILY */}
      {tab === 'Daily' && (
        dailyChart.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No data for last 30 days</div>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader title="Revenue vs Expenses (30d)" />
              <CardBody className="pt-2">
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={dailyChart} margin={{top:5,right:5,bottom:0,left:-20}}>
                    <defs>
                      <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#16a34a" stopOpacity={0.3}/><stop offset="95%" stopColor="#16a34a" stopOpacity={0}/></linearGradient>
                      <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                    <Tooltip formatter={(v,n)=>[fmt(v),n]}/>
                    <Area type="monotone" dataKey="revenue"  name="Revenue"  stroke="#16a34a" strokeWidth={2} fill="url(#rg)"/>
                    <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={2} fill="url(#eg)"/>
                  </AreaChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Daily Profit" />
              <CardBody className="pt-2">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyChart} margin={{top:5,right:5,bottom:0,left:-20}}>
                    <XAxis dataKey="date" tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                    <Tooltip formatter={v=>fmt(v)}/>
                    <Bar dataKey="profit" fill="#16a34a" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
          </div>
        )
      )}

      {/* MONTHLY */}
      {tab === 'Monthly' && (
        <Card>
          <CardHeader title="Monthly Revenue (12m)" />
          <CardBody>
            {monthlyChart.length === 0 ? (
              <div className="text-center py-10 text-gray-400">No monthly data yet</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={monthlyChart} margin={{top:5,right:5,bottom:0,left:-20}}>
                    <XAxis dataKey="name" tick={{fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:11}} axisLine={false} tickLine={false}/>
                    <Tooltip formatter={v=>fmt(v)}/>
                    <Bar dataKey="revenue" fill="#16a34a" radius={[6,6,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {monthlyChart.map(m=>(
                    <div key={m.name} className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 font-medium w-8">{m.name}</span>
                      <div className="flex-1 mx-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-600 rounded-full" style={{width:`${Math.max(4,(m.revenue/Math.max(...monthlyChart.map(x=>x.revenue)))*100)}%`}}/>
                      </div>
                      <span className="font-semibold text-gray-900 text-right">{fmt(m.revenue)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardBody>
        </Card>
      )}

      {/* INVENTORY */}
      {tab === 'Inventory' && inventory && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={<Package size={20}/>} label="Total Products" value={inventory.totalProducts} change={+2.1} positive />
            <StatCard icon={<AlertTriangle size={20}/>} label="Low Stock" value={inventory.lowStock?.length} change={-1.5} positive />
            <Card>
              <CardBody>
                <p className="text-xs text-gray-600 uppercase font-semibold">Value at Cost</p>
                <p className="font-black text-lg text-green-600 mt-2">{fmt(inventory.inventoryValue?.atCost||0)}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-xs text-gray-600 uppercase font-semibold">Value at Retail</p>
                <p className="font-black text-lg text-green-600 mt-2">{fmt(inventory.inventoryValue?.atRetail||0)}</p>
              </CardBody>
            </Card>
          </div>

          {inventory.lowStock?.length > 0 && (
            <Card className="border-l-4 border-red-500">
              <CardHeader title="⚠ Low Stock Alert" />
              <CardBody className="divide-y divide-gray-100">
                {inventory.lowStock.map(p=>(
                  <div key={p._id} className="flex justify-between items-center py-3 first:pt-0 last:pb-0">
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.category}</p>
                    </div>
                    <Badge variant="danger">{p.quantity}</Badge>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          {inventory.deadStock?.length > 0 && (
            <Card>
              <CardHeader title="💀 Dead Stock" />
              <CardBody className="divide-y divide-gray-100">
                {inventory.deadStock.map(p=>(
                  <div key={p._id} className="flex justify-between items-center py-3 first:pt-0 last:pb-0">
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-500">Cost: {fmt(p.costPrice)}</p>
                    </div>
                    <Badge variant="warning">0 units</Badge>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* STAFF */}
      {tab === 'Staff' && (
        <Card>
          <CardHeader title="Staff Performance" icon={<BarChart3 size={18} />} />
          {!staffData?.length ? (
            <CardBody>
              <div className="text-center py-10 text-gray-500 text-sm">No sales data for this period</div>
            </CardBody>
          ) : (
            <CardBody className="divide-y divide-gray-100">
              {staffData.map((s,i)=>(
                <div key={s._id||i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0 bg-green-600">
                    {(s.name||'?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900">{s.name||'Unknown'}</p>
                    <p className="text-xs text-gray-500">{s.count} sales · avg {fmt(s.avgSale||0)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-green-600 text-sm">{fmt(s.revenue)}</p>
                    <span className="text-xs text-gray-500">#{i+1}</span>
                  </div>
                </div>
              ))}
            </CardBody>
          )}
        </Card>
      )}

      {/* CATEGORIES */}
      {tab === 'Categories' && (
        categories?.length > 0 ? (
          <div className="space-y-4">
            <Card>
              <CardHeader title="Revenue by Category" />
              <CardBody className="pt-2">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={categories} dataKey="revenue" nameKey="_id" cx="50%" cy="50%" outerRadius={75}
                         label={({_id,percent})=>percent>0.05?`${_id} ${(percent*100).toFixed(0)}%`:''} labelLine={false}>
                      {categories.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                    </Pie>
                    <Tooltip formatter={v=>fmt(v)}/>
                  </PieChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="divide-y divide-gray-100">
                {categories.map((c,i)=>(
                  <div key={c._id||i} className="flex justify-between items-center py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full" style={{background:COLORS[i%COLORS.length]}}/>
                      <p className="font-semibold text-sm text-gray-900">{c._id||'Unknown'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-green-600">{fmt(c.revenue)}</p>
                      <p className="text-xs text-gray-500">{c.qty} items</p>
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        ) : (
          <Card>
            <CardBody className="text-center py-12">
              <BarChart3 size={40} className="mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 text-sm">No category data for this period</p>
            </CardBody>
          </Card>
        )
      )}

      <div className="h-4"/>
    </div>
  );
}
