import React, { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Inbox, Pencil, Trash2 } from 'lucide-react';

import { ConfirmDialog, DataTable, FilterBar, Modal, PageHeader, SearchInput, StatusBadge } from '@/components/admin';
import type { Column, SortState } from '@/components/admin';
import { FilterButton, FilterPanel, type FilterField } from '@/components/admin/FilterPanel';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { adminCustomerApi } from '@/services/adminCustomerApi';
import type { AdminCustomerRow, CustomerListParams, CustomerSortKey, CustomerStatus } from '@/types/adminCustomer';

import './index.css';

const PAGE_SIZES = [10, 25, 50];

const SORT_KEYS: readonly CustomerSortKey[] = ['name', 'email', 'status', 'bookingsCount', 'ltv', 'lastActivityAt', 'createdAt'];
const isSortKey = (key: string): key is CustomerSortKey => (SORT_KEYS as readonly string[]).includes(key);

/** "" = server default (newest first). */
const SORT_OPTIONS: { value: string; label: string; sort: SortState | null }[] = [
  { value: '', label: 'Newest first', sort: null },
  { value: 'createdAt:asc', label: 'Oldest first', sort: { key: 'createdAt', direction: 'asc' } },
  { value: 'name:asc', label: 'Name A to Z', sort: { key: 'name', direction: 'asc' } },
  { value: 'name:desc', label: 'Name Z to A', sort: { key: 'name', direction: 'desc' } },
  { value: 'bookingsCount:desc', label: 'Most bookings', sort: { key: 'bookingsCount', direction: 'desc' } },
  { value: 'bookingsCount:asc', label: 'Fewest bookings', sort: { key: 'bookingsCount', direction: 'asc' } },
  { value: 'ltv:desc', label: 'Highest LTV', sort: { key: 'ltv', direction: 'desc' } },
  { value: 'ltv:asc', label: 'Lowest LTV', sort: { key: 'ltv', direction: 'asc' } },
  { value: 'lastActivityAt:desc', label: 'Recently active', sort: { key: 'lastActivityAt', direction: 'desc' } },
  { value: 'lastActivityAt:asc', label: 'Least recently active', sort: { key: 'lastActivityAt', direction: 'asc' } },
];

const STATUS_OPTIONS: { label: string; value: '' | CustomerStatus }[] = [
  { label: 'All customers', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Blocked', value: 'blocked' },
];

const FILTER_FIELDS: FilterField[] = [
  { key: 'status', label: 'Status', options: STATUS_OPTIONS },
  { key: 'sort', label: 'Sort by', options: SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label })) },
];

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';

interface RowActions {
  onEdit: (c: AdminCustomerRow) => void;
  onRemove: (c: AdminCustomerRow) => void;
}

/** Edit + Remove (icon only). Clicks are stopped so they never also open the details page. */
const ActionButtons: React.FC<{ c: AdminCustomerRow } & RowActions> = ({ c, onEdit, onRemove }) => (
  <div className="cm-actions" onClick={(e) => e.stopPropagation()}>
    <button type="button" className="hcx-btn" onClick={() => onEdit(c)} aria-label={`Edit ${c.name}`}>
      <Pencil size={14} aria-hidden /> Edit
    </button>
    <button type="button" className="hcx-btn cm-actions__remove" onClick={() => onRemove(c)} aria-label={`Remove ${c.name}`} title="Remove">
      <Trash2 size={14} aria-hidden />
    </button>
  </div>
);

/** One customer on a phone: avatar, contact, status and the three numbers that matter. The card opens the details page; Edit / Remove sit below it. */
const CustomerCard: React.FC<{ c: AdminCustomerRow } & RowActions> = ({ c, onEdit, onRemove }) => (
  <div className="cm-card-wrap">
    <Link to={`/admin/customers/${c.id}`} className="cm-card" aria-label={`View ${c.name}`}>
      <div className="cm-card__head">
        <span className={`cm-avatar${c.status === 'blocked' ? ' is-blocked' : ''}`} aria-hidden>{initials(c.name)}</span>
        <div className="cm-card__who">
          <span className="cm-card__name">{c.name}</span>
          <span className="cm-card__sub">{c.email}</span>
          {c.phone && <span className="cm-card__sub">{c.phone}</span>}
        </div>
        <div className="cm-card__side">
          <StatusBadge status={c.status === 'blocked' ? 'Blocked' : 'Active'} />
          <ChevronRight size={18} aria-hidden className="cm-card__chev" />
        </div>
      </div>
      <dl className="cm-stats">
        <div><dt>Bookings</dt><dd>{c.bookingsCount}</dd></div>
        <div><dt>LTV</dt><dd>{inr.format(c.ltv)}</dd></div>
        <div><dt>Last active</dt><dd>{c.lastActivityAt ? formatDate(c.lastActivityAt) : 'Never'}</dd></div>
      </dl>
    </Link>
    <ActionButtons c={c} onEdit={onEdit} onRemove={onRemove} />
  </div>
);

const errMessage = (e: unknown, fallback: string) => (e as { message?: string } | null)?.message || fallback;

/** Edit name / email / phone. */
const EditCustomerModal: React.FC<{ customer: AdminCustomerRow | null; onClose: () => void; onSaved: () => void }> = ({
  customer, onClose, onSaved,
}) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customer) {
      setName(customer.name);
      setEmail(customer.email);
      setPhone(customer.phone ?? '');
      setError(null);
    }
  }, [customer]);

  const mutation = useMutation({
    mutationFn: () => adminCustomerApi.update(customer!.id, { name: name.trim(), email: email.trim(), phone: phone.trim() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'customers'] });
      onSaved();
    },
    onError: (e) => setError(errMessage(e, 'Could not save the changes. Please try again.')),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError('Name must be at least 2 characters');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email');
    if (phone.trim() && !/^[6-9]\d{9}$/.test(phone.trim())) return setError('Enter a valid 10-digit mobile number');
    setError(null);
    mutation.mutate();
  };

  return (
    <Modal
      open={customer !== null}
      onClose={onClose}
      title="Edit customer"
      size="sm"
      dismissible={!mutation.isPending}
      footer={
        <>
          <button type="button" className="hcx-btn" onClick={onClose} disabled={mutation.isPending}>Cancel</button>
          <button type="submit" form="edit-customer-form" className="hcx-btn hcx-btn--primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <form id="edit-customer-form" className="cm-form" onSubmit={submit} noValidate>
        <label className="hcx-field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" /></label>
        <label className="hcx-field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" /></label>
        <label className="hcx-field"><span>Phone</span><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" placeholder="10-digit mobile (optional)" autoComplete="off" /></label>
        {error && <div role="alert" className="cm-form__error">{error}</div>}
      </form>
    </Modal>
  );
};

export const AdminCustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useMediaQuery('(max-width: 767px)');

  // Every filter change goes back to page 1, otherwise you can land on a page that no longer exists.
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | CustomerStatus>('');
  const [sort, setSort] = useState<SortState | null>(null); // null = server default (newest first)
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [editing, setEditing] = useState<AdminCustomerRow | null>(null);
  const [removing, setRemoving] = useState<AdminCustomerRow | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const params: CustomerListParams = {
    search,
    status,
    sortBy: sort && isSortKey(sort.key) ? sort.key : undefined,
    sortDir: sort?.direction,
    page,
    limit: pageSize,
  };

  const query = useQuery({
    queryKey: ['admin', 'customers', params],
    queryFn: ({ signal }) => adminCustomerApi.list(params, signal),
    placeholderData: keepPreviousData,
  });

  const activeFilters = (search.trim() ? 1 : 0) + (status ? 1 : 0) + (sort ? 1 : 0);
  const resetFilters = () => {
    setSearch('');
    setStatus('');
    setSort(null);
    setPage(1);
  };
  const sortValue = sort ? `${sort.key}:${sort.direction}` : '';
  const changeSort = (value: string) => {
    setSort(SORT_OPTIONS.find((o) => o.value === value)?.sort ?? null);
    setPage(1);
  };
  const changeStatus = (v: '' | CustomerStatus) => {
    setStatus(v);
    setPage(1);
  };

  const removeMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminCustomerApi.remove(id, reason),
    onSuccess: async () => {
      const name = removing?.name;
      // Removing the last row of a page would leave us on an empty page.
      if ((query.data?.items.length ?? 0) <= 1 && page > 1) setPage(page - 1);
      setRemoving(null);
      setRemoveError(null);
      setNotice(`${name ?? 'Customer'} was removed.`);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'customers'] });
    },
    onError: (e) => setRemoveError(errMessage(e, 'Could not remove the customer. Please try again.')),
  });

  const openEdit = (c: AdminCustomerRow) => { setNotice(null); setEditing(c); };
  const openRemove = (c: AdminCustomerRow) => { setNotice(null); setRemoveError(null); setRemoving(c); };

  const columns = useMemo<Column<AdminCustomerRow>[]>(
    () => [
      {
        key: 'name',
        header: 'Customer',
        cell: (c) => (
          <div className="customers-cell">
            <span className="customers-cell__main">{c.name}</span>
          </div>
        ),
      },
      {
        key: 'email',
        header: 'Email / phone',
        hideOnMobile: true,
        cell: (c) => (
          <div className="customers-cell">
            <span>{c.email}</span>
            <span className="customers-cell__sub">{c.phone ?? '—'}</span>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        cell: (c) => <StatusBadge status={c.status === 'blocked' ? 'Blocked' : 'Active'} />,
      },
      {
        key: 'bookingsCount',
        header: 'Bookings',
        align: 'right',
        cell: (c) => <span className="customers-num">{c.bookingsCount}</span>,
      },
      {
        key: 'ltv',
        header: 'LTV',
        align: 'right',
        cell: (c) => <span className="customers-num">{inr.format(c.ltv)}</span>,
      },
      {
        key: 'lastActivityAt',
        header: 'Last activity',
        hideOnMobile: true,
        cell: (c) =>
          c.lastActivityAt ? formatDate(c.lastActivityAt) : <span className="customers-muted">Never</span>,
      },
      {
        key: 'createdAt',
        header: 'Created',
        hideOnMobile: true,
        cell: (c) => formatDate(c.createdAt),
      },
      {
        key: 'actions',
        header: 'Actions',
        align: 'right',
        cell: (c) => <ActionButtons c={c} onEdit={openEdit} onRemove={openRemove} />,
      },
    ],
    [],
  );

  const errorMessage = query.isError
    ? (query.error as { message?: string } | null)?.message ?? 'Unable to load customers. Please try again.'
    : null;

  const dialogs = (
    <>
      <EditCustomerModal
        customer={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setNotice(`${editing?.name ?? 'Customer'} was updated.`);
          setEditing(null);
        }}
      />
      <ConfirmDialog
        open={removing !== null}
        tone="danger"
        title={`Remove ${removing?.name ?? 'customer'}?`}
        confirmLabel="Remove customer"
        loading={removeMutation.isPending}
        reason={{ label: 'Reason', required: true, placeholder: 'Why is this customer being removed?' }}
        message={
          <>
            This permanently deletes the customer and their saved addresses. Customers with bookings can't be removed; block them instead.
            {removeError && <div role="alert" style={{ marginTop: 8, color: 'var(--hcx-danger)' }}>{removeError}</div>}
          </>
        }
        onCancel={() => { if (!removeMutation.isPending) { setRemoving(null); setRemoveError(null); } }}
        onConfirm={(reason) => { if (removing && reason) removeMutation.mutate({ id: removing.id, reason }); }}
      />
    </>
  );

  if (isMobile) {
    const totalPages = query.data?.totalPages ?? 1;
    const items = query.data?.items ?? [];
    return (
      <div className="admin-page-container customers-page cm-mobile">
        <PageHeader
          title="Customers"
          description="Bookings and lifetime value for everyone who signed up."
          meta={query.data ? <span className="hcx-chip">{query.data.total}</span> : undefined}
        />

        <div className="cm-searchrow">
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(1); }}
            placeholder="Search name, email or phone"
          />
          <FilterButton count={(status ? 1 : 0) + (sort ? 1 : 0)} open={filterOpen} onClick={() => setFilterOpen((o) => !o)} />
        </div>

        <FilterPanel
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          fields={FILTER_FIELDS}
          values={{ status, sort: sortValue }}
          onApply={(v) => {
            changeStatus(v.status === 'active' || v.status === 'blocked' ? v.status : '');
            changeSort(v.sort ?? '');
          }}
        />

        {notice && <div className="cm-notice" role="status">{notice}</div>}

        <div className={query.isPlaceholderData ? 'customers-table--stale' : undefined} aria-busy={query.isFetching}>
          {query.isPending ? (
            <ul className="cm-list" aria-label="Loading customers">
              {[0, 1, 2, 3].map((n) => <li key={n} className="cm-card cm-card--skeleton"><span className="hcx-skeleton hcx-skeleton--block" style={{ height: 96 }} /></li>)}
            </ul>
          ) : errorMessage ? (
            <div className="cm-state" role="alert">
              <p>{errorMessage}</p>
              <button type="button" className="hcx-btn" onClick={() => void query.refetch()}>Try again</button>
            </div>
          ) : items.length === 0 ? (
            <div className="cm-state">
              <Inbox size={28} aria-hidden />
              <strong>No customers found</strong>
              <p>{activeFilters > 0 ? 'No customers match your filters.' : 'Customers will appear here once they sign up.'}</p>
              {activeFilters > 0 && <button type="button" className="hcx-btn" onClick={resetFilters}>Clear filters</button>}
            </div>
          ) : (
            <ul className="cm-list" aria-label="Customers">
              {items.map((c) => <li key={c.id}><CustomerCard c={c} onEdit={openEdit} onRemove={openRemove} /></li>)}
            </ul>
          )}
        </div>

        {!errorMessage && (query.data?.total ?? 0) > 0 && (
          <nav className="cm-pager" aria-label="Pagination">
            <button type="button" className="hcx-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft size={16} aria-hidden /> Prev
            </button>
            <span aria-live="polite">Page {Math.min(page, totalPages)} of {totalPages}</span>
            <button type="button" className="hcx-btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              Next <ChevronRight size={16} aria-hidden />
            </button>
          </nav>
        )}
        {dialogs}
      </div>
    );
  }

  return (
    <div className="admin-page-container customers-page">
      <PageHeader
        title="Customers"
        description="Everyone who has signed up, with their bookings and lifetime value."
        meta={query.data ? <span className="hcx-chip">{query.data.total} total</span> : undefined}
      />

      <FilterBar
        search={{
          value: search,
          onChange: (v) => {
            setSearch(v);
            setPage(1);
          },
          placeholder: 'Search name, email or phone',
        }}
        activeCount={activeFilters}
        onReset={resetFilters}
      >
        <FilterButton count={(status ? 1 : 0) + (sort ? 1 : 0)} open={filterOpen} onClick={() => setFilterOpen((o) => !o)} />
      </FilterBar>

      <FilterPanel
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        fields={FILTER_FIELDS}
        values={{ status, sort: sortValue }}
        onApply={(v) => {
          changeStatus(v.status === 'active' || v.status === 'blocked' ? v.status : '');
          changeSort(v.sort ?? '');
        }}
      />

      {notice && <div className="cm-notice" role="status">{notice}</div>}

      <div className={query.isPlaceholderData ? 'customers-table--stale' : undefined} aria-busy={query.isFetching}>
        <DataTable<AdminCustomerRow>
          label="Customers"
          columns={columns}
          data={query.data?.items ?? []}
          rowKey={(c) => c.id}
          manual
          total={query.data?.total ?? 0}
          loading={query.isPending}
          error={errorMessage}
          onRetry={() => void query.refetch()}
          emptyTitle="No customers found"
          emptyMessage={
            activeFilters > 0 ? 'No customers match your filters.' : 'Customers will appear here once they sign up.'
          }
          onRowClick={(c) => navigate(`/admin/customers/${c.id}`)}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZES}
        />
      </div>
      {dialogs}
    </div>
  );
};

export default AdminCustomersPage;
