import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import AppLayout from '@/components/layout/AppLayout';
import LoginPage from '@/pages/auth/LoginPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import LayoutPage from '@/pages/layout/LayoutPage';
import FaultsPage from '@/pages/faults/FaultsPage';
import ResourcesPage from '@/pages/resources/ResourcesPage';
import ReportsPage from '@/pages/reports/ReportsPage';
import MonitoringPage from '@/pages/monitoring/MonitoringPage';
import UsersPage from '@/pages/users/UsersPage';
import LoadingScreen from '@/components/common/LoadingScreen';

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
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="layout" element={<LayoutPage />} />
          <Route path="layout/:id" element={<LayoutPage />} />
          <Route path="faults" element={<FaultsPage />} />
          <Route path="resources" element={<ResourcesPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="monitoring" element={<MonitoringPage />} />
          <Route path="users" element={<UsersPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
