// src/App.jsx – v6 with activation, forgot-password, reset-password, and invitation routes

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider }        from '@tanstack/react-query';
import { Toaster }             from 'react-hot-toast';
import useAuthStore            from './store/authStore';
import ProtectedRoute          from './components/ProtectedRoute';
import AppLayout               from './components/layout/AppLayout';
import { useEffect } from 'react';


// Auth pages (public — no login required)
import LoginPage               from './pages/LoginPage';
import ActivateAccountPage     from './pages/ActivateAccountPage';
import ForgotPasswordPage      from './pages/ForgotPasswordPage';
import ResetPasswordPage       from './pages/ResetPasswordPage';
import InvitePage              from './pages/InvitePage';

// App pages
import DashboardPage           from './pages/DashboardPage';
import POSPage                 from './pages/POSPage';
import ProductsPage            from './pages/ProductsPage';
import CustomersPage           from './pages/CustomersPage';
import ExpensesPage            from './pages/ExpensesPage';
import ReportsPage             from './pages/ReportsPage';
import SuppliersPage           from './pages/SuppliersPage';
import PurchaseOrdersPage      from './pages/PurchaseOrdersPage';
import CashClosingPage         from './pages/CashClosingPage';
import StaffPage               from './pages/StaffPage';
import SettingsPage            from './pages/SettingsPage';
import AuditLogsPage           from './pages/AuditLogsPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry:1, staleTime:1000*60*2, refetchOnWindowFocus:false } }
});

const GuestRoute = ({ children }) => {

  const token = useAuthStore((state) => state.accessToken);

  if (token && token !== 'undefined' && token !== 'null') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe);

useEffect(() => {
  fetchMe();
}, []);
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>

          {/* ── Public auth pages ──────────────────────────── */}
          <Route path="/login"           element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/activate/:token" element={<ActivateAccountPage />} />
          <Route path="/invite/:token"   element={<InvitePage />} />
          <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

          {/* ── Authenticated app ──────────────────────────── */}
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index                   element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"       element={<DashboardPage />} />
            <Route path="/pos"             element={<POSPage />} />
            <Route path="/products"        element={<ProductsPage />} />
            <Route path="/customers"       element={<CustomersPage />} />
            <Route path="/settings"        element={<SettingsPage />} />

            {/* Manager + Admin */}
            <Route path="/expenses"        element={<ProtectedRoute roles={['admin','manager']}><ExpensesPage /></ProtectedRoute>} />
            <Route path="/suppliers"       element={<ProtectedRoute roles={['admin','manager']}><SuppliersPage /></ProtectedRoute>} />
            <Route path="/purchase-orders" element={<ProtectedRoute roles={['admin','manager']}><PurchaseOrdersPage /></ProtectedRoute>} />
            <Route path="/cashbook"        element={<ProtectedRoute roles={['admin','manager']}><CashClosingPage /></ProtectedRoute>} />
            <Route path="/reports"         element={<ProtectedRoute roles={['admin','manager']}><ReportsPage /></ProtectedRoute>} />

            {/* Admin only */}
            <Route path="/staff"           element={<ProtectedRoute roles={['admin']}><StaffPage /></ProtectedRoute>} />
            <Route path="/audit-logs"      element={<ProtectedRoute roles={['admin']}><AuditLogsPage /></ProtectedRoute>} />
          </Route>

     <Route
  path="*"
  element={<Navigate to="/login" replace />}
/>
        </Routes>
      </BrowserRouter>

      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius:'14px', fontSize:'14px', fontWeight:500,
            maxWidth:'360px', boxShadow:'0 4px 20px rgba(0,0,0,0.12)'
          }
        }}
      />
    </QueryClientProvider>
  );
}
