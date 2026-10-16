import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/admin/Modal';
import type { InviteStaffInput, Role } from '@/types/adminRbac';

interface InviteStaffDialogProps {
  open: boolean;
  roles: Role[];
  saving?: boolean;
  serverError?: string | null;
  onInvite: (input: InviteStaffInput) => void;
  onClose: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const InviteStaffDialog: React.FC<InviteStaffDialogProps> = ({
  open, roles, saving, serverError, onInvite, onClose,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setEmail('');
    setRoleId('');
    setTouched(false);
  }, [open]);

  const errors = {
    name: name.trim().length < 2 ? 'Enter the person’s full name.' : null,
    email: EMAIL_RE.test(email.trim()) ? null : 'Enter a valid email address.',
    role: roleId ? null : 'Choose a role.',
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (errors.name || errors.email || errors.role) return;
    onInvite({ name: name.trim(), email: email.trim().toLowerCase(), roleId });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite staff"
      description="They’ll get an email with a link to set up their account."
      size="sm"
      dismissible={!saving}
      footer={
        <>
          <button type="button" className="hcx-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="rbac-invite-form" className="hcx-btn hcx-btn--primary" disabled={saving}>
            {saving ? 'Sending…' : 'Send invite'}
          </button>
        </>
      }
    >
      <form id="rbac-invite-form" onSubmit={submit} noValidate>
        <label className="hcx-field">
          <span>Full name *</span>
          <input
            className="rbac-input"
            value={name}
            autoComplete="off"
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
            value={email}
            autoComplete="off"
            aria-invalid={touched && Boolean(errors.email)}
            onChange={(e) => setEmail(e.target.value)}
          />
          {touched && errors.email && <span className="hcx-field__error">{errors.email}</span>}
        </label>
        <label className="hcx-field">
          <span>Role *</span>
          <select
            className="rbac-input"
            value={roleId}
            aria-invalid={touched && Boolean(errors.role)}
            onChange={(e) => setRoleId(e.target.value)}
          >
            <option value="">Select a role…</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.isSystem ? ' (system)' : ''}
              </option>
            ))}
          </select>
          {touched && errors.role && <span className="hcx-field__error">{errors.role}</span>}
        </label>
        {serverError && (
          <p className="hcx-field__error" role="alert">
            {serverError}
          </p>
        )}
      </form>
    </Modal>
  );
};

export default InviteStaffDialog;
