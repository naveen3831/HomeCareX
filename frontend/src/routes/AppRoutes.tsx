import React, { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import PublicRoutes from './PublicRoutes';
import ProtectedRoute from '@/components/ProtectedRoute';
import AuthLayout from '@/layouts/AuthLayout';
import PageLoader from '@/components/common/PageLoader';
import { ADMIN_ROLES } from '@/types/auth';

// Lazy-load route modules (PublicRoutes is imported directly above
// so the public site and Home page load without extra round trips)
const AdminRoutes = lazy(() => import('./AdminRoutes'));
const PartnerRoutes = lazy(() => import('./PartnerRoutes'));
const CustomerRoutes = lazy(() => import('./CustomerRoutes'));

// Lazy-load authentication pages
const LoginPage = lazy(() => import('@/pages/public/Login'));
const RegisterPage = lazy(() => import('@/pages/public/Register'));
const PartnerRegisterPage = lazy(() => import('@/pages/public/PartnerRegister'));
const ForgotPasswordPage = lazy(
  () => import('@/pages/public/ForgotPassword'),
);
const VerifyOtpPage = lazy(() => import('@/pages/public/VerifyOtp'));
const ResetPasswordPage = lazy(
  () => import('@/pages/public/ResetPassword'),
);
const UnauthorizedPage = lazy(
  () => import('@/pages/public/Unauthorized'),
);
const AccountSecurityPage = lazy(() => import('@/pages/shared/AccountSecurity'));

const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Authentication screens */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/register/partner" element={<PartnerRegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/verify-otp" element={<VerifyOtpPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>

        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* Role-protected dashboards */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute allowedRoles={ADMIN_ROLES}>
              <AdminRoutes />
            </ProtectedRoute>
          }
        />

        <Route
          path="/partner/*"
          element={
            <ProtectedRoute allowedRoles={['partner']}>
              <PartnerRoutes />
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/*"
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <CustomerRoutes />
            </ProtectedRoute>
          }
        />

        {/* Central Account Security route accessible to all authenticated roles */}
        <Route
          path="/account/security"
          element={
            <ProtectedRoute allowedRoles={['customer', 'partner', 'admin']}>
              <AccountSecurityPage />
            </ProtectedRoute>
          }
        />

        {/* Public site */}
        <Route path="/*" element={<PublicRoutes />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;