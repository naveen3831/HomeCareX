import React, { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { Modal } from '@/components/admin/Modal';
import type { Permission, Role, RoleInput } from '@/types/adminRbac';
import { PermissionGrid } from './PermissionGrid';

interface RoleEditorProps {
  open: boolean;
  /** Role being edited / viewed. Undefined creates a new one. */
  role?: Role;
  /** Pre-fill for "Duplicate". */
  template?: Pick<Role, 'name' | 'description' | 'permissions'>;
  /** False when the admin may look but not change (no roles:update). */
  canEdit?: boolean;
  permissions: Permission[];
  loadingPermissions?: boolean;
  /** Names already taken (lower-cased), excluding the role being edited. */
  takenNames: string[];
  saving?: boolean;
  serverError?: string | null;
  onSave: (input: RoleInput) => void;
  onClose: () => void;
}

const NAME_MAX = 40;

export const RoleEditor: React.FC<RoleEditorProps> = ({
  open, role, template, canEdit = true, permissions, loadingPermissions, takenNames, saving, serverError, onSave, onClose,
}) => {
  const source = role ?? template;
  const isSystem = Boolean(role?.isSystem);
  const readOnly = isSystem || !canEdit;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(source?.name ?? '');
    setDescription(source?.description ?? '');
    setSelected(source?.permissions ?? []);
    setTouched(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, role?.id]);

  const trimmed = name.trim();
  const nameError =
    trimmed.length < 2
      ? 'Enter a role name (at least 2 characters).'
      : trimmed.length > NAME_MAX
        ? `Keep the name under ${NAME_MAX} characters.`
        : takenNames.includes(trimmed.toLowerCase())
          ? 'A role with this name already exists.'
          : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (readOnly || nameError) return;
    onSave({ name: trimmed, description: description.trim() || undefined, permissions: selected });
  };

  const title = !role ? 'Create role' : readOnly ? role.name : `Edit ${role.name}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      dismissible={!saving}
      description={
        isSystem
          ? 'System roles are protected. Their name and permissions can’t be changed.'
          : readOnly
            ? 'You can view this role but don’t have permission to change it.'
            : 'Choose what people in this role can see and do.'
      }
      footer={
        <>
          <button type="button" className="hcx-btn" onClick={onClose} disabled={saving}>
            {readOnly ? 'Close' : 'Cancel'}
          </button>
          {!readOnly && (
            <button type="submit" form="rbac-role-form" className="hcx-btn hcx-btn--primary" disabled={saving}>
              {saving ? 'Saving…' : role ? 'Save changes' : 'Create role'}
            </button>
          )}
        </>
      }
    >
      <form id="rbac-role-form" onSubmit={submit} noValidate>
        {isSystem && (
          <p className="rbac-note">
            <Lock size={14} aria-hidden /> Protected system role
          </p>
        )}
        <label className="hcx-field">
          <span>Role name *</span>
          <input
            className="rbac-input"
            value={name}
            maxLength={NAME_MAX + 10}
            disabled={readOnly}
            aria-invalid={touched && Boolean(nameError)}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Support Lead"
          />
          {touched && nameError && <span className="hcx-field__error">{nameError}</span>}
        </label>
        <label className="hcx-field">
          <span>Description</span>
          <textarea
            rows={2}
            value={description}
            disabled={readOnly}
            maxLength={200}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this role for?"
          />
        </label>

        <div className="rbac-section-title">Permissions</div>
        {loadingPermissions ? (
          <p className="rbac-muted">Loading permissions…</p>
        ) : (
          <PermissionGrid permissions={permissions} value={selected} onChange={setSelected} readOnly={readOnly} />
        )}

        {serverError && (
          <p className="hcx-field__error" role="alert">
            {serverError}
          </p>
        )}
      </form>
    </Modal>
  );
};

export default RoleEditor;
