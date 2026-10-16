import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('@/lib/http', () => ({ default: h }));
vi.mock('@/services/authApi', () => ({ authApi: { me: vi.fn() } }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ logout: vi.fn() }) }));

import AdminRolesPage from '@/pages/admin/Roles';
import RoleFormPage from '@/pages/admin/Roles/RoleFormPage';
import InviteStaffPage from '@/pages/admin/Roles/InviteStaffPage';
import { PermissionGrid } from '@/pages/admin/Roles/PermissionGrid';
import { applyKeys, buildMatrix } from '@/pages/admin/Roles/rbacUtils';
import { Sidebar } from '@/components/admin/Sidebar';
import { authApi } from '@/services/authApi';
import { normalizePermission } from '@/services/adminRbacApi';
import { useAuthStore } from '@/store/useAuthStore';

const PERMS = ['bookings:view', 'bookings:update', 'customers:view', 'customers:delete', 'roles:view', 'staff:view', 'staff:update'];
const ROLES = [
  { id: 'r1', key: 'super_admin', name: 'Super Admin', permissions: ['*'], isSystem: true, memberCount: 1 },
  { id: 'r2', name: 'Support Lead', description: 'Handles tickets', permissions: ['bookings:view'], isSystem: false, memberCount: 2 },
  { id: 'r3', name: 'Auditor', permissions: ['customers:view'], isSystem: false, memberCount: 0 },
];
const STAFF = [
  { id: 'u1', name: 'Asha Admin', email: 'asha@x.com', roleId: 'r1', roleName: 'Super Admin', roleKey: 'super_admin', status: 'active' },
  { id: 'u2', name: 'Ravi Lead', email: 'ravi@x.com', roleId: 'r2', roleName: 'Support Lead', status: 'active' },
];
const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });

const serve = (staff = STAFF) =>
  h.get.mockImplementation((url: string) => {
    if (url === '/admin/permissions') return ok(PERMS);
    if (url === '/admin/roles') return ok(ROLES);
    if (url === '/admin/staff') return ok(staff);
    return ok([]);
  });

const signIn = (permissions: string[], extra: Record<string, unknown> = {}) =>
  useAuthStore.setState({ isAuthenticated: true, user: { id: 'u1', role: 'staff', permissions, ...extra } });

const Where: React.FC = () => {
  const l = useLocation();
  return <div data-testid="where">{l.pathname + l.search}</div>;
};

const renderPage = (url = '/admin/roles') => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Where />
        <Routes>
          <Route path="/admin/roles" element={<AdminRolesPage />} />
          <Route path="/admin/roles/new" element={<RoleFormPage />} />
          <Route path="/admin/roles/staff/new" element={<InviteStaffPage />} />
          <Route path="/admin/roles/:id" element={<RoleFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const ALL = ['roles:view', 'roles:create', 'roles:update', 'roles:delete', 'staff:view', 'staff:create', 'staff:update'];

beforeEach(() => {
  vi.clearAllMocks();
  serve();
  signIn(ALL);
});

describe('permission helpers', () => {
  it('splits keys into resource and action (last segment is the action)', () => {
    expect(normalizePermission('bookings:view')).toMatchObject({ resource: 'bookings', action: 'view' });
    expect(normalizePermission('partner:jobs:read')).toMatchObject({ resource: 'partner:jobs', action: 'read' });
  });

  it('keeps view on when editing and clears the row when view is removed', () => {
    const m = buildMatrix(PERMS.map((p) => normalizePermission(p)));
    expect(applyKeys(m, [], ['bookings:update'], true).sort()).toEqual(['bookings:update', 'bookings:view']);
    expect(applyKeys(m, ['bookings:view', 'bookings:update'], ['bookings:view'], false)).toEqual([]);
  });
});

describe('PermissionGrid', () => {
  const perms = PERMS.map((p) => normalizePermission(p));

  it('toggles a cell and reports the new selection', async () => {
    const onChange = vi.fn();
    render(<PermissionGrid permissions={perms} value={[]} onChange={onChange} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Customers: delete' }));
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining(['customers:delete', 'customers:view']));
  });

  it('is read-only for system roles', () => {
    render(<PermissionGrid permissions={perms} value={['bookings:view']} readOnly />);
    expect(screen.getByRole('checkbox', { name: 'Bookings: view' })).toBeDisabled();
    expect(screen.queryByLabelText('Select all permissions')).not.toBeInTheDocument();
  });
});

describe('Roles tab', () => {
  it('lists roles and protects system roles from edit and delete', async () => {
    renderPage();
    expect(await screen.findByText('Support Lead')).toBeInTheDocument();
    expect(screen.getByLabelText('Delete Super Admin')).toBeDisabled();
    expect(screen.getByLabelText('Edit Super Admin')).toBeInTheDocument();
    // in use -> can't delete; unused custom role -> can
    expect(screen.getByLabelText('Delete Support Lead')).toBeDisabled();
    expect(screen.getByLabelText('Delete Auditor')).toBeEnabled();
  });

  it('has no sort arrows on the tables', async () => {
    renderPage();
    await screen.findByText('Support Lead');
    expect(document.querySelector('[aria-sort]')).toBeNull();
  });

  it('opens a system role on its own page, read-only with no save button', async () => {
    renderPage();
    await userEvent.click(await screen.findByLabelText('Edit Super Admin'));
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/roles/r1');
    expect(await screen.findByText(/protected system role/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/support lead/i)).toBeDisabled();
  });

  it('creates a custom role on a full page and returns to the list', async () => {
    h.post.mockImplementation(() => ok({ ...ROLES[1], id: 'r9', name: 'Finance' }));
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /create role/i }));
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/roles/new');
    await userEvent.type(screen.getByPlaceholderText(/support lead/i), 'Finance');
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Bookings: update' }));
    await userEvent.click(screen.getByRole('button', { name: /create role/i }));
    await waitFor(() =>
      expect(h.post).toHaveBeenCalledWith('/admin/roles', expect.objectContaining({
        name: 'Finance',
        permissions: expect.arrayContaining(['bookings:update', 'bookings:view']),
      })),
    );
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/admin\/roles$/));
    expect(await screen.findByRole('status')).toHaveTextContent(/created/i);
  });

  it('edits a custom role on its own page', async () => {
    h.patch.mockImplementation(() => ok({ ...ROLES[1] }));
    renderPage();
    await userEvent.click(await screen.findByLabelText('Edit Support Lead'));
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/roles/r2');
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Customers: view' }));
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() =>
      expect(h.patch).toHaveBeenCalledWith('/admin/roles/r2', expect.objectContaining({
        permissions: expect.arrayContaining(['bookings:view', 'customers:view']),
      })),
    );
  });

  it('rejects a duplicate role name', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /create role/i }));
    await userEvent.type(await screen.findByPlaceholderText(/support lead/i), 'auditor');
    await userEvent.click(screen.getByRole('button', { name: /create role/i }));
    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
    expect(h.post).not.toHaveBeenCalled();
  });

  it('refreshes the signed-in admin after a role change (permission cache invalidation)', async () => {
    h.delete.mockImplementation(() => Promise.resolve({ data: { success: true } }));
    (authApi.me as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u1', role: 'staff', permissions: ['roles:view'] });
    renderPage();
    await userEvent.click(await screen.findByLabelText('Delete Auditor'));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /delete role/i }));
    await waitFor(() => expect(h.delete).toHaveBeenCalledWith('/admin/roles/r3'));
    await waitFor(() => expect(authApi.me).toHaveBeenCalled());
    await waitFor(() => expect(useAuthStore.getState().user?.permissions).toEqual(['roles:view']));
  });
});

describe('Staff tab', () => {
  it('opens from ?tab=staff', async () => {
    renderPage('/admin/roles?tab=staff');
    expect(await screen.findByText('Ravi Lead')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Staff' })).toHaveAttribute('aria-selected', 'true');
  });

  it('blocks demoting or deactivating the last super admin', async () => {
    renderPage('/admin/roles?tab=staff');
    await screen.findByText('Asha Admin');
    expect(screen.queryByLabelText('Role for Asha Admin')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Deactivate Asha Admin')).toBeDisabled();
    expect(screen.getByLabelText('Deactivate Ravi Lead')).toBeEnabled();
  });

  it('confirms before changing a role, then calls the API', async () => {
    h.patch.mockImplementation(() => Promise.resolve({ data: { success: true } }));
    (authApi.me as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u1', role: 'staff', permissions: ALL });
    renderPage('/admin/roles?tab=staff');
    await userEvent.selectOptions(await screen.findByLabelText('Role for Ravi Lead'), 'r3');
    expect(h.patch).not.toHaveBeenCalled();
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /change role/i }));
    await waitFor(() => expect(h.patch).toHaveBeenCalledWith('/admin/users/u2/role', { roleId: 'r3' }));
  });

  it('shows the server message when the API refuses the last-super-admin change', async () => {
    h.patch.mockImplementation(() => Promise.reject({ response: { data: { code: 'LAST_SUPER_ADMIN', message: 'x' } } }));
    serve([STAFF[0], { ...STAFF[1], roleId: 'r1', roleName: 'Super Admin', roleKey: 'super_admin' }]);
    renderPage('/admin/roles?tab=staff');
    await userEvent.click(await screen.findByLabelText('Deactivate Ravi Lead'));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /^deactivate$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/last active super admin/i);
  });

  it('invites staff on a full page, then returns to the Staff tab', async () => {
    h.post.mockImplementation(() => ok({ ...STAFF[1], id: 'u9', status: 'invited' }));
    renderPage('/admin/roles?tab=staff');
    await userEvent.click(await screen.findByRole('button', { name: /invite staff/i }));
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/roles/staff/new');
    await userEvent.click(screen.getByRole('button', { name: /send invite/i }));
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/full name/i), 'New Person');
    await userEvent.type(screen.getByLabelText(/work email/i), 'New@X.com');
    await userEvent.selectOptions(await screen.findByLabelText(/role/i), 'r2');
    await userEvent.click(screen.getByRole('button', { name: /send invite/i }));
    await waitFor(() =>
      expect(h.post).toHaveBeenCalledWith('/admin/staff', { name: 'New Person', email: 'new@x.com', roleId: 'r2' }),
    );
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/admin/roles?tab=staff'));
    expect(await screen.findByRole('status')).toHaveTextContent(/invite sent/i);
  });

  it('hides write actions without staff:update', async () => {
    signIn(['roles:view', 'staff:view']);
    renderPage('/admin/roles?tab=staff');
    await screen.findByText('Ravi Lead');
    expect(screen.queryByRole('button', { name: /invite staff/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Deactivate Ravi Lead')).not.toBeInTheDocument();
  });
});

describe('Sidebar with a custom role', () => {
  const renderSidebar = () =>
    render(<MemoryRouter initialEntries={['/admin/bookings']}><Sidebar /></MemoryRouter>);

  it('shows only the pages the role allows', () => {
    window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })) as never;
    signIn(['bookings:view', 'customers:view']);
    renderSidebar();
    expect(screen.getByRole('link', { name: 'Bookings' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Payments' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /roles & staff/i })).not.toBeInTheDocument();
  });

  it('shows everything to a super admin', () => {
    signIn([], { role: 'staff', roleKey: 'super_admin' });
    renderSidebar();
    expect(screen.getByRole('link', { name: 'Bookings' })).toBeInTheDocument();
  });
});
