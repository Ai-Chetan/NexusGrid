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
import AdminSettingsPage from '@/pages/admin/AdminSettingsPage';
import ProfilePage from '@/pages/profile/ProfilePage';
import LoadingScreen from '@/components/common/LoadingScreen';

import type { User } from '@/types';

type Role = User['role'];

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isInitialized } = useAuthStore();
  if (!isInitialized) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RoleRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: Role[] }) {
  const { user, isInitialized } = useAuthStore();
  if (!isInitialized) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/app/dashboard" replace />;
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
          <Route path="reports" element={<RoleRoute allowedRoles={['Administrator', 'Lab Assistant']}><ReportsPage /></RoleRoute>} />
          <Route path="monitoring" element={<RoleRoute allowedRoles={['Administrator', 'Lab Assistant']}><MonitoringPage /></RoleRoute>} />
          <Route path="system/:itemId" element={<SystemDetailPage />} />
          <Route path="users" element={<RoleRoute allowedRoles={['Administrator']}><UsersPage /></RoleRoute>} />
          <Route path="admin" element={<RoleRoute allowedRoles={['Administrator']}><AdminSettingsPage /></RoleRoute>} />
          {/* Admin Controls removed (broadcast lives in notifications); oversight merged into Reports */}
          <Route path="admin-controls" element={<Navigate to="/app/admin" replace />} />
          <Route path="admin-oversight" element={<Navigate to="/app/reports" replace />} />
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
        <Route path="/admin-oversight" element={<Navigate to="/app/admin-oversight" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
