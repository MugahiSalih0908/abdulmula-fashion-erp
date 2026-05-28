// src/components/layout/AppLayout.jsx – v5 role-based navigation

import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnlineStatus }  from '../../hooks/useOnlineStatus';
import { useRole }          from '../../hooks/useRole';
import useAuthStore         from '../../store/authStore';
import {
  LayoutDashboard, ShoppingCart, Package, Users, MoreHorizontal,
  WifiOff, RefreshCw, Wallet, Truck, BarChart3, UserCog, Settings,
  LogOut, X, ChevronRight, BookOpen, ClipboardList, ShieldCheck
} from 'lucide-react';

export default function AppLayout() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { isOnline, pendingCount, isSyncing } = useOnlineStatus();
  const user     = useAuthStore(s => s.user);
  const logout   = useAuthStore(s => s.logout);
  const navigate = useNavigate();
  const { can, isAdmin, isManager } = useRole();

  const handleLogout = async () => {
    setMoreOpen(false);
    await logout();
    navigate('/login');
  };

  // ── Primary bottom tabs (always visible) ─────────────────────
  const PRIMARY_TABS = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Home'   },
    { to: '/pos',       icon: ShoppingCart,    label: 'POS'    },
    { to: '/products',  icon: Package,         label: 'Stock'  },
    { to: '/customers', icon: Users,           label: 'People' },
    { label: 'More',    icon: MoreHorizontal,  isMore: true    },
  ];

  // ── More menu items filtered by role ─────────────────────────
  const MORE_ITEMS = [
    can.viewExpenses    && { to:'/expenses',        icon:Wallet,        label:'Expenses',        color:'text-red-500',    bg:'bg-red-50'    },
    can.viewSuppliers   && { to:'/suppliers',        icon:Truck,         label:'Suppliers',       color:'text-orange-500', bg:'bg-orange-50' },
    can.viewPOs         && { to:'/purchase-orders',  icon:ClipboardList, label:'Purchase Orders', color:'text-amber-600',  bg:'bg-amber-50'  },
    can.viewCashbook    && { to:'/cashbook',          icon:BookOpen,      label:'Cashbook',        color:'text-teal-600',   bg:'bg-teal-50'   },
    can.viewReports     && { to:'/reports',           icon:BarChart3,     label:'Reports',         color:'text-blue-500',   bg:'bg-blue-50'   },
    can.manageStaff     && { to:'/staff',             icon:UserCog,       label:'Staff',           color:'text-purple-500', bg:'bg-purple-50' },
    can.viewAuditLogs   && { to:'/audit-logs',        icon:ShieldCheck,   label:'Audit Logs',      color:'text-gray-600',   bg:'bg-gray-100'  },
    { to:'/settings', icon:Settings, label:'Settings', color:'text-gray-500', bg:'bg-gray-100' },
  ].filter(Boolean);

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="shrink-0 z-20 shadow-md px-4 py-3 flex items-center justify-between bg-white border-b border-gray-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm bg-green-600 text-white">AF</div>
          <div>
            <p className="text-gray-900 font-bold text-sm leading-tight">Abdulmula Fashion</p>
            <p className="text-xs leading-tight capitalize text-green-600 font-medium">
              {user?.role} · ERP v6
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isOnline && (
            <span className="flex items-center gap-1 bg-red-600 text-white text-xs px-2 py-1 rounded-full font-semibold">
              <WifiOff size={11}/> Offline
            </span>
          )}
          {pendingCount > 0 && (
            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full font-bold bg-green-100 text-green-700">
              {isSyncing && <RefreshCw size={11} className="animate-spin"/>}
              {pendingCount} pending
            </span>
          )}
          <button onClick={() => setMoreOpen(true)}
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-green-600 text-white hover:bg-green-700 transition-colors">
            {user?.name?.charAt(0).toUpperCase()}
          </button>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto pb-20"><Outlet /></main>

      {/* ── Bottom nav ───────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30"
           style={{ paddingBottom:'env(safe-area-inset-bottom, 6px)' }}>
        <div className="flex items-stretch justify-around">
          {PRIMARY_TABS.map(({ to, icon: Icon, label, isMore }) =>
            isMore ? (
              <button key="more" onClick={() => setMoreOpen(true)}
                      className={`flex flex-col items-center py-2 px-3 flex-1 transition-colors ${
                        moreOpen ? 'text-green-600 border-t-2 -mt-px' : 'text-gray-400'
                      }`}>
                <Icon size={22}/><span className="text-xs mt-0.5 font-medium">More</span>
              </button>
            ) : (
              <NavLink key={to} to={to} onClick={() => setMoreOpen(false)}
                       className={({ isActive }) =>
                         `flex flex-col items-center py-2 px-3 flex-1 transition-colors ${isActive?'text-green-600 border-t-2 -mt-px':'text-gray-400'}`
                       }>
                <Icon size={22}/><span className="text-xs mt-0.5 font-medium">{label}</span>
              </NavLink>
            )
          )}
        </div>
      </nav>

      {/* ── More menu ────────────────────────────────────────── */}
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                        className="fixed inset-0 bg-black/40 z-40" onClick={() => setMoreOpen(false)}/>
            <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}}
                        transition={{type:'spring',damping:28,stiffness:320}}
                        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50"
                        style={{paddingBottom:'env(safe-area-inset-bottom,16px)'}}>

              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-300 rounded-full"/>
              </div>

              {/* User info */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
                <div className="w-11 h-11 rounded-full flex items-center justify-center font-black text-base shrink-0 text-white bg-green-600">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-400">{user?.email}</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize inline-block mt-0.5 ${
                    user?.role==='admin'   ? 'bg-red-100 text-red-700' :
                    user?.role==='manager'? 'bg-blue-100 text-blue-700' :
                                            'bg-gray-100 text-gray-600'
                  }`}>{user?.role}</span>
                </div>
              </div>

              {/* Menu */}
              <div className="px-4 py-3 space-y-0.5 max-h-80 overflow-y-auto">
                {MORE_ITEMS.map(({ to, icon: Icon, label, color, bg }) => (
                  <NavLink key={to} to={to} onClick={() => setMoreOpen(false)}
                           className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-gray-50 transition-colors">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color} ${bg} shrink-0`}>
                      <Icon size={18}/>
                    </div>
                    <span className="font-semibold text-gray-800 flex-1">{label}</span>
                    <ChevronRight size={16} className="text-gray-300"/>
                  </NavLink>
                ))}

                <button onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-red-50 transition-colors mt-1">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-red-500 bg-red-50 shrink-0">
                    <LogOut size={18}/>
                  </div>
                  <span className="font-semibold text-red-600 flex-1 text-left">Logout</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
