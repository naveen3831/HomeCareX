import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/admin/PageHeader';
import { usePermissions } from '@/hooks/usePermissions';
import type { Role, RoleInput } from '@/types/adminRbac';
import { PermissionGrid } from './PermissionGrid';
import { RBAC_PERMISSIONS } from './rbacPermissions';
import { errorMessage } from './rbacUtils';
import { usePermissionCatalog, useRbacMutations, useRoles } from './useRbac';
import './index.css';

const NAME_MAX = 40;

interface RoleFormProps {
  role?: Role;
  template?: Pick<Role, 'name' | 'description' | 'permissions'>;
  readOnly: boolean;
  takenNames: string[];
}

const RoleForm: React.FC<RoleFormProps> = ({ role, template, readOnly, takenNames }) => {
  const navigate = useNavigate();
  const catalog = usePermissionCatalog();
  const { create, update } = useRbacMutations();
  const source = role ?? template;

  const [name, setName] = useState(source?.name ?? '');
  const [description, setDescription] = useState(source?.description ?? '');
  const [selected, setSelected] = useState<string[]>(source?.permissions ?? []);
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const trimmed = name.trim();
  const nameError =
    trimmed.length < 2
      ? 'Enter a role name (at least 2 characters).'
      : trimmed.length > NAME_MAX
        ? `Keep the name under ${NAME_MAX} characters.`
        : takenNames.includes(trimmed.toLowerCase())
          ? 'A role with this name already exists.'
          : null;

  const saving = create.isPending || update.isPending;
  const back = (toast?: string) => navigate('/admin/roles', { state: toast ? { toast } : undefined });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setServerError(null);
    if (readOnly || nameError) return;
    const input: RoleInput = { name: trimmed, description: description.trim() || undefined, permissions: selected };
    const onError = (err: unknown) => setServerError(errorMessage(err));
    if (role) {
      update.mutate({ id: role.id, input }, { onSuccess: () => back(`Role “${trimmed}” updated. Changes apply right away.`), onError });
    } else {
      create.mutate(input, { onSuccess: () => back(`Role “${trimmed}” created.`), onError });
    }
  };

  return (
    <form className="hcx-card rbac-form-card" onSubmit={submit} noValidate>
      {role?.isSystem && (
        <p className="rbac-note">
          <Lock size={14} aria-hidden /> Protected system role. Its name and permissions can’t be changed.
        </p>
      )}
      {!role?.isSystem && readOnly && (
        <p className="rbac-note">You can view this role but don’t have permission to change it.</p>
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
      {catalog.isLoading ? (
        <p className="rbac-muted">Loading permissions…</p>
      ) : catalog.isError ? (
        <p className="hcx-field__error" role="alert">{errorMessage(catalog.error, 'Couldn’t load permissions.')}</p>
      ) : (
        <PermissionGrid permissions={catalog.data ?? []} value={selected} onChange={setSelected} readOnly={readOnly} />
      )}

      {serverError && <p className="hcx-field__error" role="alert">{serverError}</p>}

      <div className="rbac-form-actions">
        <button type="button" className="hcx-btn" onClick={() => back()} disabled={saving}>
          {readOnly ? 'Back' : 'Cancel'}
        </button>
        {!readOnly && (
          <button type="submit" className="hcx-btn hcx-btn--primary" disabled={saving}>
            {saving ? 'Saving…' : role ? 'Save changes' : 'Create role'}
          </button>
        )}
      </div>
    </form>
  );
};

/**
 * Full page for creating, editing or viewing a role.
 *   /admin/roles/new            create (add ?from=<roleId> to duplicate)
 *   /admin/roles/:id            edit (read-only for system roles)
 */
export const RoleFormPage: React.FC = () => {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { can } = usePermissions();
  const rolesQuery = useRoles();
  const roles = rolesQuery.data ?? [];

  const fromId = params.get('from');
  const role = id ? roles.find((r) => r.id === id) : undefined;
  const source = fromId ? roles.find((r) => r.id === fromId) : undefined;
  const template = source ? { name: `${source.name} copy`, description: source.description, permissions: source.permissions } : undefined;

  const waiting = rolesQuery.isLoading;
  const missing = !waiting && Boolean(id) && !role;
  const readOnly = id ? Boolean(role?.isSystem) || !can(RBAC_PERMISSIONS.rolesUpdate) : !can(RBAC_PERMISSIONS.rolesCreate);

  const title = !id ? 'Create role' : role ? (role.isSystem || readOnly ? role.name : `Edit ${role.name}`) : 'Role';

  return (
    <div className="admin-page-container rbac-page">
      <PageHeader
        back="/admin/roles"
        title={title}
        description="Choose what people in this role can see and do."
      />
      {waiting ? (
        <p className="rbac-muted">Loading…</p>
      ) : rolesQuery.isError ? (
        <p className="hcx-field__error" role="alert">{errorMessage(rolesQuery.error, 'Couldn’t load roles.')}</p>
      ) : missing ? (
        <p className="rbac-muted">This role doesn’t exist or was deleted.</p>
      ) : (
        <RoleForm
          key={role?.id ?? source?.id ?? 'new'}
          role={role}
          template={template}
          readOnly={readOnly}
          takenNames={roles.filter((r) => r.id !== role?.id).map((r) => r.name.trim().toLowerCase())}
        />
      )}
    </div>
  );
};

export default RoleFormPage;
