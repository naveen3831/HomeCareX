import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Pencil, Save, ShieldCheck } from 'lucide-react';
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
      <div className="profile-page__header">
        <h1 className="text-2xl font-bold">My Profile</h1>
        {!isEditing && (
          <button type="button" className="profile-edit-btn" onClick={() => setIsEditing(true)}>
            <Pencil size={16} />
            Edit Profile
          </button>
        )}
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

      <div className="profile-card mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Account Security</h2>
              <p className="text-xs text-slate-500">Change password, manage active sessions & logout all devices</p>
            </div>
          </div>
          <Link
            to="/admin/security"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-indigo-600 shadow-sm hover:bg-slate-50 transition-colors"
          >
            Manage Security
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminProfilePage;
