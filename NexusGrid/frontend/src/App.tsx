import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import AppLayout from '@/components/layout/AppLayout';
import LoginPage from '@/pages/auth/LoginPage';
import SignUpPage from '@/pages/auth/SignUpPage';
import LandingPage from '@/pages/landing/LandingPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import LayoutPage from '@/pages/layout/LayoutPage';
import FaultsPage from '@/pages/faults/FaultsPage';
import ResourcesPage from '@/pages/resources/ResourcesPage';
import ReportsPage from '@/pages/reports/ReportsPage';
import MonitoringPage from '@/pages/monitoring/MonitoringPage';
import UsersPage from '@/pages/users/UsersPage';
import LoadingScreen from '@/components/common/LoadingScreen';
import PWAInstallPrompt from '@/components/common/PWAInstallPrompt';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isInitialized } = useAuthStore();
  if (!isInitialized) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { initialize, isInitialized } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!isInitialized) return <LoadingScreen />;

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />

        {/* Protected app */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="layout" element={<LayoutPage />} />
          <Route path="layout/:id" element={<LayoutPage />} />
          <Route path="faults" element={<FaultsPage />} />
          <Route path="resources" element={<ResourcesPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="monitoring" element={<MonitoringPage />} />
          <Route path="users" element={<UsersPage />} />
        </Route>

        {/* Legacy redirects */}
        <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="/layout" element={<Navigate to="/app/layout" replace />} />
        <Route path="/faults" element={<Navigate to="/app/faults" replace />} />
        <Route path="/resources" element={<Navigate to="/app/resources" replace />} />
        <Route path="/reports" element={<Navigate to="/app/reports" replace />} />
        <Route path="/monitoring" element={<Navigate to="/app/monitoring" replace />} />
        <Route path="/users" element={<Navigate to="/app/users" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </BrowserRouter>
  );
}
