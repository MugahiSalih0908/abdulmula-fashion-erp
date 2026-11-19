// Route-level code splitting keeps the first load focused on the screen being opened.
import { lazy, Suspense, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './store/authStore';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import PageLoadingFallback from './components/PageLoadingFallback';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const ActivateAccountPage = lazy(() => import('./pages/ActivateAccountPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const InvitePage = lazy(() => import('./pages/InvitePage'));

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const POSPage = lazy(() => import('./pages/POSPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const OutOfStockPage = lazy(() => import('./pages/OutOfStockPage'));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const SuppliersPage = lazy(() => import('./pages/SuppliersPage'));
const PurchaseOrdersPage = lazy(() => import('./pages/PurchaseOrdersPage'));
const CashClosingPage = lazy(() => import('./pages/CashClosingPage'));
const StaffPage = lazy(() => import('./pages/StaffPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage'));
const EmailCenterPage = lazy(() => import('./pages/EmailCenterPage'));
const InvoicesPage = lazy(() => import('./pages/InvoicesPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true
    },
    mutations: {
      retry: false
    }
  }
});

const GuestRoute = ({ children }) => {
  const token = useAuthStore(state => state.accessToken);

  if (token && token !== 'undefined' && token !== 'null') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default function App() {
  const fetchMe = useAuthStore(state => state.fetchMe);
  const userId = useAuthStore(state => state.user?._id || null);
  const previousUserId = useRef(null);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    if (previousUserId.current !== userId && previousUserId.current !== null) {
      // Avoid showing one staff member's cached protected data to the next.
      queryClient.clear();
    }
    previousUserId.current = userId;
  }, [userId]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoadingFallback />}>
          <Routes>
            {/* Public account and authentication routes */}
            <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
            <Route path="/activate/:token" element={<ActivateAccountPage />} />
            <Route path="/invite/:token" element={<InvitePage />} />
            <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

            {/* Authenticated ERP workspace */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/pos" element={<POSPage />} />
              <Route path="/invoices" element={<InvoicesPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/out-of-stock" element={<OutOfStockPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/settings" element={<SettingsPage />} />

              {/* Manager and administrator */}
              <Route path="/expenses" element={<ProtectedRoute roles={['admin', 'manager']}><ExpensesPage /></ProtectedRoute>} />
              <Route path="/suppliers" element={<ProtectedRoute roles={['admin', 'manager']}><SuppliersPage /></ProtectedRoute>} />
              <Route path="/purchase-orders" element={<ProtectedRoute roles={['admin', 'manager']}><PurchaseOrdersPage /></ProtectedRoute>} />
              <Route path="/cashbook" element={<ProtectedRoute roles={['admin', 'manager']}><CashClosingPage /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute roles={['admin', 'manager']}><ReportsPage /></ProtectedRoute>} />

              {/* Administrator only */}
              <Route path="/staff" element={<ProtectedRoute roles={['admin']}><StaffPage /></ProtectedRoute>} />
              <Route path="/audit-logs" element={<ProtectedRoute roles={['admin']}><AuditLogsPage /></ProtectedRoute>} />
              <Route path="/email-center" element={<ProtectedRoute roles={['admin']}><EmailCenterPage /></ProtectedRoute>} />
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>

      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: '14px',
            fontSize: '14px',
            fontWeight: 500,
            maxWidth: 'min(360px, calc(100vw - 32px))',
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)'
          }
        }}
      />
    </QueryClientProvider>
  );
}
