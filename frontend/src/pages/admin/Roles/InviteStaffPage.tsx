import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ShieldCheck, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { errorMessage } from './rbacUtils';
import { useRbacMutations, useRoles } from './useRbac';
import './index.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Full page: /admin/staff/new. Sends an invite and returns to the Staff page. */
export const InviteStaffPage: React.FC = () => {
  const navigate = useNavigate();
  const rolesQuery = useRoles();
  const { invite } = useRbacMutations();
  const roles = rolesQuery.data ?? [];

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const selected = roles.find((r) => r.id === roleId);

  const errors = {
    name: name.trim().length < 2 ? 'Enter the person’s full name.' : null,
    email: EMAIL_RE.test(email.trim()) ? null : 'Enter a valid email address.',
    role: roleId ? null : 'Choose a role.',
  };

  const backToStaff = (toast?: string) =>
    navigate('/admin/staff', { state: toast ? { toast } : undefined });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setServerError(null);
    if (errors.name || errors.email || errors.role) return;
    const input = { name: name.trim(), email: email.trim().toLowerCase(), roleId };
    invite.mutate(input, {
      onSuccess: (member) => {
        if (member.emailSent === false) {
          backToStaff(`Invite created for ${input.email}, but the email could not be sent. Check the SMTP settings in backend/.env and the backend console.`);
          return;
        }
        backToStaff(`Invite sent to ${input.email}. They’ll get an email to set their password.`);
      },
      onError: (err) => setServerError(errorMessage(err)),
    });
  };

  return (
    <div className="admin-page-container rbac-page">
      <PageHeader
        back="/admin/staff"
        title="Invite staff"
        description="They’ll get an email with a link to set up their account."
      />

      <div className="rbac-inv">
        <form className="rbac-inv__card" onSubmit={submit} noValidate>
          <div className="rbac-inv__head">
            <span className="rbac-inv__badge" aria-hidden><UserPlus size={20} /></span>
            <div className="rbac-inv__headtext">
              <h2 className="rbac-inv__title">Who are you inviting?</h2>
              <p className="rbac-inv__sub">Use the email they’ll sign in with.</p>
            </div>
          </div>

          <div className="rbac-inv__grid">
            <label className="hcx-field">
              <span>Full name *</span>
              <input
                className="rbac-input"
                value={name}
                autoComplete="off"
                placeholder="e.g. Priya Sharma"
                aria-invalid={touched && Boolean(errors.name)}
                onChange={(e) => setName(e.target.value)}
              />
              {touched && errors.name && <span className="hcx-field__error">{errors.name}</span>}
            </label>
            <label className="hcx-field">
              <span>Work email *</span>
              <input
                className="rbac-input"
                type="email"
                inputMode="email"
                value={email}
                autoComplete="off"
                placeholder="name@company.com"
                aria-invalid={touched && Boolean(errors.email)}
                onChange={(e) => setEmail(e.target.value)}
              />
              {touched && errors.email && <span className="hcx-field__error">{errors.email}</span>}
            </label>
          </div>

          <label className="hcx-field">
            <span>Role *</span>
            <select
              className="rbac-input"
              value={roleId}
              aria-invalid={touched && Boolean(errors.role)}
              onChange={(e) => setRoleId(e.target.value)}
            >
              <option value="">{rolesQuery.isLoading ? 'Loading roles…' : 'Select a role…'}</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.isSystem ? ' (system)' : ''}
                </option>
              ))}
            </select>
            {touched && errors.role && <span className="hcx-field__error">{errors.role}</span>}
          </label>

          {/* Access summary sits right under the Role field, so it is never a separate card to scroll past. */}
          <div className="rbac-inv__role" aria-live="polite">
            {selected ? (
              <div className="rbac-rolecard">
                <div className="rbac-rolecard__head">
                  <span className="rbac-rolecard__icon" aria-hidden><ShieldCheck size={18} /></span>
                  <div className="rbac-rolecard__name">
                    {selected.name}
                    {selected.isSystem && (
                      <span className="rbac-system-chip"><Lock size={12} aria-hidden /> System</span>
                    )}
                  </div>
                </div>
                <p className="rbac-rolecard__desc">
                  {selected.description || 'No description for this role yet.'}
                </p>
                <dl className="rbac-rolecard__facts">
                  <div className="rbac-rolecard__fact">
                    <dt>Access</dt>
                    <dd>{selected.permissions.includes('*') ? 'Full access' : `${selected.permissions.length} permissions`}</dd>
                  </div>
                  <div className="rbac-rolecard__fact">
                    <dt>Already assigned</dt>
                    <dd>{selected.memberCount} {selected.memberCount === 1 ? 'person' : 'people'}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <p className="rbac-inv__rolehint">Pick a role to see what this person will be able to access.</p>
            )}
          </div>

          {serverError && <p className="hcx-field__error" role="alert">{serverError}</p>}

          <div className="rbac-inv__actions">
            <button type="button" className="hcx-btn" onClick={() => backToStaff()} disabled={invite.isPending}>
              Cancel
            </button>
            <button type="submit" className="hcx-btn hcx-btn--primary" disabled={invite.isPending}>
              {invite.isPending ? 'Sending…' : 'Send invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InviteStaffPage;