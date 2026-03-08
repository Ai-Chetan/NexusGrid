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
import SystemDetailPage from '@/pages/system/SystemDetailPage';
import UsersPage from '@/pages/users/UsersPage';
import ProfilePage from '@/pages/profile/ProfilePage';
import AdminControlsPage from '@/pages/admin/AdminControlsPage';
import LoadingScreen from '@/components/common/LoadingScreen';

import type { User } from '@/types';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isInitialized } = useAuthStore();
  if (!isInitialized) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function FeatureRoute({ children, featureCode }: { children: React.ReactNode; featureCode: string }) {
  const { user, isInitialized, isFeatureEnabled } = useAuthStore();
  if (!isInitialized) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isFeatureEnabled(featureCode)) return <Navigate to="/app/dashboard" replace />;
  return <>{children}</>;
}

function PermissionRoute({ children, permissionCode }: { children: React.ReactNode; permissionCode: string }) {
  const { user, isInitialized, hasPermission } = useAuthStore();
  if (!isInitialized) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!hasPermission(permissionCode)) return <Navigate to="/app/dashboard" replace />;
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
          <Route path="dashboard" element={<FeatureRoute featureCode="dashboard"><DashboardPage /></FeatureRoute>} />
          <Route path="layout" element={<FeatureRoute featureCode="layout"><LayoutPage /></FeatureRoute>} />
          <Route path="layout/:id" element={<FeatureRoute featureCode="layout"><LayoutPage /></FeatureRoute>} />
          <Route path="faults" element={<FeatureRoute featureCode="faults"><FaultsPage /></FeatureRoute>} />
          <Route path="resources" element={<FeatureRoute featureCode="resources"><ResourcesPage /></FeatureRoute>} />
          <Route path="reports" element={<FeatureRoute featureCode="reports"><ReportsPage /></FeatureRoute>} />
          <Route path="monitoring" element={<FeatureRoute featureCode="monitoring"><MonitoringPage /></FeatureRoute>} />
          <Route path="system/:itemId" element={<SystemDetailPage />} />
          <Route path="users" element={<FeatureRoute featureCode="users"><PermissionRoute permissionCode="users.manage"><UsersPage /></PermissionRoute></FeatureRoute>} />
          <Route path="admin-controls" element={<FeatureRoute featureCode="rbac"><PermissionRoute permissionCode="rbac.manage"><AdminControlsPage /></PermissionRoute></FeatureRoute>} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        {/* Legacy redirects */}
        <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="/layout" element={<Navigate to="/app/layout" replace />} />
        <Route path="/faults" element={<Navigate to="/app/faults" replace />} />
        <Route path="/resources" element={<Navigate to="/app/resources" replace />} />
        <Route path="/reports" element={<Navigate to="/app/reports" replace />} />
        <Route path="/monitoring" element={<Navigate to="/app/monitoring" replace />} />
        <Route path="/users" element={<Navigate to="/app/users" replace />} />
        <Route path="/admin-controls" element={<Navigate to="/app/admin-controls" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
