import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Save, Shield } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

// Basic editable profile form. Starts read-only; "Edit" unlocks the fields,
// "Save" locks them again (wire this up to an API call when one exists).
export const AdminProfilePage: React.FC = () => {
  const user = useAuthStore((state) => state.user);

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    name: (user?.name as string) ?? 'Admin',
    email: (user?.email as string) ?? 'admin@homecarex.com',
    phone: (user?.phone as string) ?? '+91 90000 00000',
    role: (user?.role as string) ?? 'Administrator',
  });

  const handleChange = (field: keyof typeof form) => (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    // Persist to the backend here when the API is ready.
    setIsEditing(false);
  };

  return (
    <div className="admin-page-container p-6">
      <div className="profile-page__header flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Profile</h1>
        <div className="flex items-center gap-3">
          <Link
            to="/admin/security"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca]"
          >
            <Shield size={16} />
            Account Security
          </Link>
          {!isEditing && (
            <button type="button" className="profile-edit-btn" onClick={() => setIsEditing(true)}>
              <Pencil size={16} />
              Edit Profile
            </button>
          )}
        </div>
      </div>

      <form className="profile-card" onSubmit={handleSubmit}>
        <div className="profile-card__avatar">
          {form.name.charAt(0).toUpperCase()}
        </div>

        <div className="profile-form-grid">
          <label className="profile-field">
            <span>Full Name</span>
            <input
              type="text"
              value={form.name}
              onChange={handleChange('name')}
              disabled={!isEditing}
              required
            />
          </label>

          <label className="profile-field">
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={handleChange('email')}
              disabled={!isEditing}
              required
            />
          </label>

          <label className="profile-field">
            <span>Phone</span>
            <input
              type="tel"
              value={form.phone}
              onChange={handleChange('phone')}
              disabled={!isEditing}
            />
          </label>

          <label className="profile-field">
            <span>Role</span>
            <input type="text" value={form.role} disabled />
          </label>
        </div>

        {isEditing && (
          <div className="profile-card__actions">
            <button
              type="button"
              className="profile-cancel-btn"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </button>
            <button type="submit" className="profile-save-btn">
              <Save size={16} />
              Save Changes
            </button>
          </div>
        )}
      </form>

      {/* Security Quick Access Card */}
      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-[#4338ca]">
              <Shield size={24} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Account Security & Active Sessions</h2>
              <p className="text-xs text-gray-500">
                Change your password, review active admin login sessions, and log out from all devices.
              </p>
            </div>
          </div>
          <Link
            to="/admin/security"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4338ca] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3730a3] transition-colors"
          >
            Manage Security
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminProfilePage;
