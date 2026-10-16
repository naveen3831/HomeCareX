import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Lock, UserCircle, ChevronRight, FileClock, ShieldCheck } from 'lucide-react';

export const AdminSettingsPage: React.FC = () => {
  return (
    <div className="admin-page-container p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your administrative profile, account security, and system preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Security & Access */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-[#4338ca]">
              <Shield size={22} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Account Security</h2>
              <p className="text-xs text-gray-500">Change password, manage active sessions, and multi-device logouts.</p>
            </div>
          </div>
          <p className="text-xs text-gray-600">
            Keep your administrative credentials safe by updating your password and reviewing which devices are logged into your admin account.
          </p>
          <div>
            <Link
              to="/admin/security"
              className="inline-flex items-center gap-2 rounded-xl bg-[#4338ca] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3730a3] transition-colors"
            >
              <Lock size={16} />
              Open Account Security
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>

        {/* Profile Settings */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
              <UserCircle size={22} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">My Profile</h2>
              <p className="text-xs text-gray-500">Update personal information, contact email, and phone number.</p>
            </div>
          </div>
          <p className="text-xs text-gray-600">
            Edit your administrative display name and personal contact information linked with your staff identity.
          </p>
          <div>
            <Link
              to="/admin/profile"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <UserCircle size={16} />
              Manage Profile
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>

        {/* Roles & Permissions */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Roles & Permissions</h2>
              <p className="text-xs text-gray-500">Configure role-based access control and system permissions.</p>
            </div>
          </div>
          <p className="text-xs text-gray-600">
            View administrative roles and manage operational permissions for staff members.
          </p>
          <div>
            <Link
              to="/admin/roles-permissions"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ShieldCheck size={16} />
              View Roles
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>

        {/* Audit Logs */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <FileClock size={22} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Audit Logs</h2>
              <p className="text-xs text-gray-500">Inspect system access, login history, and security events.</p>
            </div>
          </div>
          <p className="text-xs text-gray-600">
            Review security-critical operations, authentication records, and administrative modifications.
          </p>
          <div>
            <Link
              to="/admin/audit-logs"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <FileClock size={16} />
              Inspect Audit Logs
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsPage;
