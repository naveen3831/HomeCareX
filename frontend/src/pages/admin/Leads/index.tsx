import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Inbox,
  LoaderCircle,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  RefreshCw,
  Search,
  UsersRound,
  X,
} from 'lucide-react';

import type { LeadSource, LeadStatus } from '@/features/public/leads';
import { fetchLead, fetchLeads, updateLeadStatus, type AdminLead } from '@/services/leadsApi';
import { Link } from 'react-router-dom';
import HelpTabs from '@/components/admin/HelpTabs';
import { FilterButton, FilterPanel, type FilterField } from '@/components/admin/FilterPanel';
import './Leads.css';

const dateTime = (value: string) =>
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

const dateShort = (value: string) =>
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));

const getErrorMessage = (error: unknown): string => {
  const status = typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
    ? error.status
    : undefined;
  if (status === 401 || status === 403) return 'Your admin session may have expired. Sign in again to continue.';
  if (status === 404) return 'This lead is no longer available. Refresh the list and try again.';
  if (status && status >= 500) return 'Something went wrong on our side. Please try again.';
  if (!status) return 'We couldn’t connect to HomeCareX. Check your connection and try again.';
  return 'We couldn’t complete that request. Please review your selection and try again.';
};

const isAuthError = (error: unknown) =>
  typeof error === 'object' && error !== null && 'status' in error && (error.status === 401 || error.status === 403);

const LeadSourceLabel: React.FC<{ source: LeadSource }> = ({ source }) => (
  <span className={`leads-source ${source === 'contact' ? 'leads-source--contact' : ''}`}>
    {source === 'partner' ? <BriefcaseBusiness aria-hidden="true" size={12} /> : <MessageSquareText aria-hidden="true" size={12} />}
    {source}
  </span>
);

const LeadStatusBadge: React.FC<{ status: LeadStatus }> = ({ status }) => {
  const icon = status === 'new'
    ? <CircleDot aria-hidden="true" size={11} />
    : status === 'contacted'
      ? <Clock3 aria-hidden="true" size={11} />
      : <CheckCircle2 aria-hidden="true" size={11} />;
  return <span className={`leads-status leads-status--${status}`}>{icon}{status}</span>;
};

const LeadAvatar: React.FC<{ name: string; source: LeadSource }> = ({ name, source }) => (
  <span aria-hidden="true" className={`leads-person__avatar ${source === 'partner' ? 'leads-person__avatar--partner' : ''}`}>
    {name.trim().slice(0, 1).toLocaleUpperCase() || <UsersRound size={14} />}
  </span>
);

const LEAD_FILTERS: FilterField[] = [
  { key: 'source', label: 'Type', options: [{ value: '', label: 'All types' }, { value: 'contact', label: 'Contact' }, { value: 'partner', label: 'Partner' }] },
  { key: 'status', label: 'Status', options: [{ value: '', label: 'All statuses' }, { value: 'new', label: 'New' }, { value: 'contacted', label: 'Contacted' }, { value: 'closed', label: 'Closed' }] },
];

const AdminLeadsPage: React.FC = () => {
  const [searchValue, setSearchValue] = useState('');
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<LeadSource | ''>('');
  const [status, setStatus] = useState<LeadStatus | ''>('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const queryClient = useQueryClient();
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchValue.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchValue]);

  const leadsQuery = useQuery({
    queryKey: ['admin-leads', { page, search, source, status }],
    queryFn: () => fetchLeads({ page, search, source, status }),
  });
  const detailQuery = useQuery({
    queryKey: ['admin-lead', selectedId],
    queryFn: () => fetchLead(selectedId ?? ''),
    enabled: Boolean(selectedId),
  });
  const statusMutation = useMutation({
    mutationFn: updateLeadStatus,
    onSuccess: async (updatedLead) => {
      setNotice('Lead status updated.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-leads'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-lead', updatedLead._id] }),
      ]);
    },
    onError: () => setNotice('Unable to update lead status. Please try again.'),
  });

  useEffect(() => {
    if (!selectedId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedId(null);
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable.item(0);
      const last = focusable.item(focusable.length - 1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      openerRef.current?.focus();
    };
  }, [selectedId]);

  const data = leadsQuery.data;
  const stats = data?.stats;
  const selectedLead = detailQuery.data;
  const hasFilters = Boolean(searchValue.trim() || source || status);
  const openLead = (id: string, opener: HTMLElement) => {
    openerRef.current = opener;
    setSelectedId(id);
  };
  const clearFilters = () => {
    setSearchValue('');
    setSearch('');
    setSource('');
    setStatus('');
    setPage(1);
  };
  const applyPanel = (values: Record<string, string>) => {
    setSource(values.source === 'contact' || values.source === 'partner' ? values.source : '');
    setStatus(values.status === 'new' || values.status === 'contacted' || values.status === 'closed' ? values.status : '');
    setPage(1);
  };
  const applied: { key: 'source' | 'status'; label: string }[] = [
    ...(source ? [{ key: 'source' as const, label: `Type: ${source === 'partner' ? 'Partner' : 'Contact'}` }] : []),
    ...(status ? [{ key: 'status' as const, label: `Status: ${status.charAt(0).toUpperCase()}${status.slice(1)}` }] : []),
  ];
  const removeFilter = (key: 'source' | 'status') => {
    if (key === 'source') setSource('');
    else setStatus('');
    setPage(1);
  };

  const leads = data?.leads ?? [];

  return (
    <div className="admin-page-container leads-page">
      <HelpTabs />

      <header className="leads-head">
        <h1 className="leads-head__title">Leads</h1>
        <p className="leads-head__desc">Customer enquiries and partner opportunities, with their progress.</p>
      </header>

      {stats ? (
        <section aria-label="Lead statistics" className="leads-totals">
          <Metric label="Total leads" value={stats.total} icon={<UsersRound size={20} />} />
          <Metric label="New" value={stats.new} icon={<CircleDot size={20} />} />
          <Metric label="Contacted" value={stats.contacted} icon={<MessageSquareText size={20} />} />
          <Metric label="Closed" value={stats.closed} icon={<CheckCircle2 size={20} />} />
          <Metric label="Partner interests" value={stats.partnerInterests} icon={<BriefcaseBusiness size={20} />} />
        </section>
      ) : leadsQuery.isLoading ? (
        <section aria-label="Loading lead statistics" className="leads-totals">
          {Array.from({ length: 5 }, (_, index) => <div key={index} className="leads-total leads-total--skeleton" />)}
        </section>
      ) : null}

      <div className="leads-toolbar">
        <label className="leads-search">
          <Search size={16} aria-hidden="true" />
          <input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search name, email, phone or city"
            spellCheck={false}
            aria-label="Search leads"
          />
          {searchValue && (
            <button type="button" className="leads-search__clear" onClick={() => setSearchValue('')} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </label>
        <FilterButton count={applied.length} open={panelOpen} onClick={() => setPanelOpen((o) => !o)} />
      </div>

      <FilterPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        fields={LEAD_FILTERS}
        values={{ source, status }}
        onApply={applyPanel}
      />

      {applied.length > 0 && (
        <div className="leads-applied" aria-label="Applied filters">
          {applied.map((item) => (
            <span key={item.key} className="leads-tag">
              {item.label}
              <button type="button" onClick={() => removeFilter(item.key)} aria-label={`Remove ${item.label}`}><X size={12} /></button>
            </span>
          ))}
          <button type="button" className="leads-linkbtn" onClick={clearFilters}>Clear all</button>
        </div>
      )}

      {notice && (
        <div role="status" className="leads-notice">
          <span><Check aria-hidden="true" size={15} />{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notification" className="leads-focus"><X size={15} /></button>
        </div>
      )}

      <section aria-label="Lead list" className="leads-card" aria-busy={leadsQuery.isFetching}>
        {leadsQuery.isLoading ? (
          <LoadingLeads />
        ) : leadsQuery.isError ? (
          <div className="leads-state leads-state--error" role="alert">
            <span className="leads-state__icon"><AlertCircle aria-hidden="true" size={22} /></span>
            <h2>We couldn’t load your leads</h2>
            <p>{getErrorMessage(leadsQuery.error)}</p>
            {isAuthError(leadsQuery.error) ? (
              <Link to="/login?returnUrl=%2Fadmin%2Fleads" className="leads-state__link leads-focus">Sign in as an admin</Link>
            ) : (
              <button type="button" onClick={() => void leadsQuery.refetch()} className="leads-focus"><RefreshCw aria-hidden="true" size={13} /> Try again</button>
            )}
          </div>
        ) : data && leads.length > 0 ? (
          <>
            <div className="leads-scroll">
              <table className="leads-table">
                <thead>
                  <tr>
                    <th scope="col">Contact</th>
                    <th scope="col">Details</th>
                    <th scope="col">Enquiry</th>
                    <th scope="col">Type</th>
                    <th scope="col">Received</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr
                      key={lead._id}
                      className="leads-row"
                      tabIndex={0}
                      aria-label={`View lead ${lead.name}`}
                      onClick={(event) => openLead(lead._id, event.currentTarget)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openLead(lead._id, event.currentTarget);
                        }
                      }}
                    >
                      <td>
                        <div className="leads-person">
                          <LeadAvatar name={lead.name} source={lead.source} />
                          <div>
                            <span className="leads-person__name">{lead.name}</span>
                            <span className="leads-person__type">{lead.source === 'partner' ? 'Service partner' : 'Customer'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="leads-table__contact">
                        {lead.email && <a href={`mailto:${lead.email}`} onClick={(event) => event.stopPropagation()}>{lead.email}</a>}
                        <a href={`tel:${lead.phone}`} onClick={(event) => event.stopPropagation()}>{lead.phone}</a>
                        <span>{lead.city}</span>
                      </td>
                      <td className="leads-table__inquiry"><span>{lead.message ?? lead.skills?.join(', ') ?? 'Partner interest'}</span></td>
                      <td><LeadSourceLabel source={lead.source} /></td>
                      <td className="leads-date">{dateShort(lead.createdAt)}</td>
                      <td><LeadStatusBadge status={lead.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <footer className="leads-pager">
              <span className="leads-muted">
                Page {data.pagination.page} of {Math.max(data.pagination.pages, 1)} · {data.pagination.total.toLocaleString('en-IN')} {data.pagination.total === 1 ? 'lead' : 'leads'}
              </span>
              <div className="leads-pager__btns">
                <button type="button" className="leads-btn" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft aria-hidden="true" size={16} /> Previous</button>
                <button type="button" className="leads-btn" disabled={page >= data.pagination.pages} onClick={() => setPage((current) => current + 1)}>Next <ChevronRight aria-hidden="true" size={16} /></button>
              </div>
            </footer>
          </>
        ) : (
          <div className="leads-state" role="status">
            <span className="leads-state__icon"><Inbox aria-hidden="true" size={22} /></span>
            <h2>{hasFilters ? 'No matching leads' : 'Your inbox is ready'}</h2>
            <p>{hasFilters ? 'Try a different search or clear your filters to see more enquiries.' : 'New contact messages and partner interests will appear here when they come in.'}</p>
            {hasFilters && <button type="button" onClick={clearFilters} className="leads-focus">Clear filters</button>}
          </div>
        )}
      </section>

      {selectedId && (
        <div className="leads-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }}>
          <aside ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="lead-detail-title" className="leads-drawer">
            <header className="leads-drawer__header">
              <div>
                <p className="leads-drawer__eyebrow">Lead details</p>
                <h2 id="lead-detail-title">{selectedLead?.name ?? (detailQuery.isError ? 'Lead unavailable' : 'Loading lead')}</h2>
                {selectedLead && <div className="mt-2"><LeadSourceLabel source={selectedLead.source} /></div>}
              </div>
              <button ref={closeButtonRef} type="button" onClick={() => setSelectedId(null)} aria-label="Close lead details" className="leads-drawer__close leads-focus"><X aria-hidden="true" size={18} /></button>
            </header>
            <div className="leads-drawer__body">
              {detailQuery.isLoading ? (
                <div aria-label="Loading lead details" className="grid gap-3">
                  <div className="h-24 animate-pulse bg-slate-100" /><div className="h-32 animate-pulse bg-slate-100" /><div className="h-24 animate-pulse bg-slate-100" />
                </div>
              ) : detailQuery.isError ? (
                <div className="leads-state leads-state--error" role="alert">
                  <span className="leads-state__icon"><AlertCircle aria-hidden="true" size={22} /></span>
                  <h2>Unable to load lead details</h2>
                  <p>{getErrorMessage(detailQuery.error)}</p>
                  <button type="button" onClick={() => void detailQuery.refetch()} className="leads-focus">Try again</button>
                </div>
              ) : selectedLead ? (
                <LeadDetails
                  lead={selectedLead}
                  busy={statusMutation.isPending}
                  onStatusChange={(nextStatus) => statusMutation.mutate({ id: selectedLead._id, status: nextStatus })}
                />
              ) : null}
              {statusMutation.isError && <p role="alert" className="leads-error-notice">Unable to update lead status. Please try again.</p>}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: number; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <article className="leads-total">
    <span className="leads-total__icon">{icon}</span>
    <div className="leads-total__body">
      <p className="leads-total__label" style={{ margin: 0 }}>{label}</p>
      <p className="leads-total__value" style={{ margin: 0 }}>{value.toLocaleString('en-IN')}</p>
    </div>
  </article>
);

const LoadingLeads: React.FC = () => (
  <div className="leads-state" aria-label="Loading leads">
    <span className="leads-state__icon"><LoaderCircle aria-hidden="true" size={22} className="leads-spin" /></span>
    <h2>Loading enquiries</h2>
    <p>Fetching the latest lead activity.</p>
  </div>
);

const LeadDetails: React.FC<{ lead: AdminLead; busy: boolean; onStatusChange: (status: LeadStatus) => void }> = ({ lead, busy, onStatusChange }) => (
  <div className="leads-detail">
    <section className="leads-detail__section" aria-labelledby="lead-contact-heading">
      <h3 id="lead-contact-heading" className="leads-detail__label">Contact information</h3>
      <div className="leads-detail__contact">
        {lead.email && <a href={`mailto:${lead.email}`}><Mail aria-hidden="true" size={15} />{lead.email}</a>}
        <a href={`tel:${lead.phone}`}><Phone aria-hidden="true" size={15} />{lead.phone}</a>
        <p><MapPin aria-hidden="true" size={15} />{lead.city}</p>
      </div>
      <p className="leads-detail__date"><CalendarDays aria-hidden="true" size={13} /> Received {dateTime(lead.createdAt)}</p>
    </section>

    <section className="leads-detail__section" aria-labelledby="lead-interest-heading">
      <h3 id="lead-interest-heading" className="leads-detail__label">Enquiry type</h3>
      <div className="leads-detail__interest">
        <b>{lead.source === 'partner' ? 'Partner opportunity' : 'Customer enquiry'}</b>
        <p>{lead.source === 'partner' ? 'Interested in working with the HomeCareX network.' : 'Request for help from the HomeCareX team.'}</p>
      </div>
      {lead.skills?.length ? <div className="leads-detail__skills">{lead.skills.map((skill) => <span key={skill}>{skill}</span>)}</div> : null}
    </section>

    {lead.message && (
      <section className="leads-detail__section" aria-labelledby="lead-message-heading">
        <h3 id="lead-message-heading" className="leads-detail__label">Message</h3>
        <p className="leads-detail__message">{lead.message}</p>
      </section>
    )}

    <section className="leads-detail__section" aria-labelledby="lead-status-heading">
      <div className="leads-detail__status-head">
        <h3 id="lead-status-heading" className="leads-detail__label">Lead status</h3>
        <LeadStatusBadge status={lead.status} />
      </div>
      <div className="leads-detail__actions">
        <button type="button" onClick={() => onStatusChange('contacted')} disabled={busy || lead.status === 'contacted'} className="leads-focus">
          {busy ? <LoaderCircle aria-hidden="true" size={13} className="leads-spin" /> : <Phone aria-hidden="true" size={13} />} Mark contacted
        </button>
        <button type="button" onClick={() => onStatusChange(lead.status === 'closed' ? 'new' : 'closed')} disabled={busy} className="leads-focus">
          {lead.status === 'closed' ? 'Reopen lead' : 'Close lead'}
        </button>
      </div>
    </section>
  </div>
);

export default AdminLeadsPage;
