import React, { useEffect, useState } from 'react';
import {
  fetchAdminRefunds,
  fetchAdminRefund,
  approveAdminRefund,
  rejectAdminRefund,
  type AdminRefundItem,
  type AdminRefundBooking,
  type AdminRefundCustomer,
  type AdminRefundPayment,
  type AdminRefundSummaryCounts,
} from '@/services/adminRefundApi';
import './index.css';

function formatRupees(amount?: number): string {
  if (amount === undefined || amount === null || Number.isNaN(amount)) return '₹0';
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr?: string | Date): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getBookingRef(item: AdminRefundItem): string {
  if (typeof item.bookingId === 'object' && item.bookingId !== null) {
    const b = item.bookingId as AdminRefundBooking;
    if (b.bookingNumber) return b.bookingNumber;
    if (b._id) return `BK-${b._id.slice(-5).toUpperCase()}`;
  }
  return typeof item.bookingId === 'string' && item.bookingId
    ? `BK-${item.bookingId.slice(-5).toUpperCase()}`
    : '—';
}

function getServiceName(item: AdminRefundItem): string {
  if (typeof item.bookingId === 'object' && item.bookingId !== null) {
    const b = item.bookingId as AdminRefundBooking;
    if (b.serviceName) return b.serviceName;
  }
  return 'Home Service';
}

function getCustomer(item: AdminRefundItem): { name: string; email: string; phone?: string; id: string } {
  if (typeof item.customerId === 'object' && item.customerId !== null) {
    const c = item.customerId as AdminRefundCustomer;
    return {
      name: c.name || 'Customer',
      email: c.email || '',
      phone: c.phone || '',
      id: c._id || '',
    };
  }
  return {
    name: 'Customer',
    email: '',
    phone: '',
    id: typeof item.customerId === 'string' ? item.customerId : '',
  };
}

function getPaymentDetails(item: AdminRefundItem): {
  id: string;
  txnRef: string;
  originalAmount: number;
  status: string;
  method: string;
  paidAt?: string;
} {
  if (typeof item.paymentId === 'object' && item.paymentId !== null) {
    const p = item.paymentId as AdminRefundPayment;
    return {
      id: p._id || '',
      txnRef: p.razorpayPaymentId || p.razorpayOrderId || p._id || '—',
      originalAmount: p.amount || item.amount || 0,
      status: p.status || 'PAID',
      method: p.method || 'Online',
      paidAt: p.paidAt,
    };
  }
  return {
    id: typeof item.paymentId === 'string' ? item.paymentId : '',
    txnRef: '—',
    originalAmount: item.amount || 0,
    status: 'PAID',
    method: 'Online',
  };
}

export const AdminRefundsPage: React.FC = () => {
  const [items, setItems] = useState<AdminRefundItem[]>([]);
  const [summaryCounts, setSummaryCounts] = useState<AdminRefundSummaryCounts>({
    pendingApproval: 0,
    credited: 0,
    rejected: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Selected for review detail drawer
  const [selectedRefund, setSelectedRefund] = useState<AdminRefundItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Action modals
  const [approveModalItem, setApproveModalItem] = useState<AdminRefundItem | null>(null);
  const [rejectModalItem, setRejectModalItem] = useState<AdminRefundItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = async (targetPage = page, targetStatus = statusFilter, targetSearch = searchQuery) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchAdminRefunds({
        status: targetStatus,
        search: targetSearch.trim() || undefined,
        page: targetPage,
        limit: 15,
      });

      setItems(res.items);
      setSummaryCounts(res.summaryCounts);
      setPage(res.pagination?.page || 1);
      setTotalPages(res.pagination?.pages || 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load refund requests';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(page, statusFilter, searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData(1, statusFilter, searchQuery);
  };

  const openDetail = async (refund: AdminRefundItem) => {
    setSelectedRefund(refund);
    setDetailLoading(true);
    try {
      const full = await fetchAdminRefund(refund._id || refund.id || '');
      setSelectedRefund(full);
    } catch (err) {
      console.error('Failed to load full refund detail', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApproveConfirm = async () => {
    if (!approveModalItem) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const refundId = approveModalItem._id || approveModalItem.id || '';
      const updated = await approveAdminRefund(refundId);
      setSuccessMessage(
        `Refund for ${getBookingRef(approveModalItem)} was approved! ${formatRupees(
          approveModalItem.amount,
        )} has been credited to the customer's HomeCareX Wallet.`,
      );
      setApproveModalItem(null);
      if (selectedRefund && (selectedRefund._id === refundId || selectedRefund.id === refundId)) {
        setSelectedRefund(updated);
      }
      loadData(page, statusFilter, searchQuery);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to approve refund';
      setActionError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalItem) return;
    if (!rejectionReason.trim() || rejectionReason.trim().length < 3) {
      setActionError('A valid rejection reason (minimum 3 characters) is required.');
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      const refundId = rejectModalItem._id || rejectModalItem.id || '';
      const updated = await rejectAdminRefund(refundId, rejectionReason.trim());
      setSuccessMessage(`Refund for ${getBookingRef(rejectModalItem)} has been rejected.`);
      setRejectModalItem(null);
      setRejectionReason('');
      if (selectedRefund && (selectedRefund._id === refundId || selectedRefund.id === refundId)) {
        setSelectedRefund(updated);
      }
      loadData(page, statusFilter, searchQuery);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reject refund';
      setActionError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'PENDING_APPROVAL' || s === 'REQUESTED') {
      return (
        <span className="refund-status refund-status--pending">
          <span className="refund-status__dot" />
          Pending Approval
        </span>
      );
    }
    if (s === 'CREDITED' || s === 'PROCESSED') {
      return (
        <span className="refund-status refund-status--completed">
          <span className="refund-status__dot" />
          Credited
        </span>
      );
    }
    if (s === 'REJECTED') {
      return (
        <span className="refund-status refund-status--rejected">
          <span className="refund-status__dot" />
          Rejected
        </span>
      );
    }
    if (s === 'PROCESSING') {
      return (
        <span className="refund-status refund-status--processing">
          <span className="refund-status__dot" />
          Processing
        </span>
      );
    }
    if (s === 'CREDIT_FAILED') {
      return (
        <span className="refund-status refund-status--failed">
          <span className="refund-status__dot" />
          Credit Failed
        </span>
      );
    }
    return (
      <span className="refund-status refund-status--pending">
        <span className="refund-status__dot" />
        {status}
      </span>
    );
  };

  return (
    <div className="refunds-page">
      {/* Page Header */}
      <div className="refunds-page__header">
        <div className="refunds-page__heading-copy">
          <h1 className="refunds-page__title">Refund Requests</h1>
          <p className="refunds-page__subtitle">
            Review cancelled booking refund requests. When approved, eligible amounts are credited directly
            and atomically to the customer's HomeCareX Wallet.
          </p>
        </div>
      </div>

      {/* Success Notification Alert */}
      {successMessage && (
        <div className="refunds-alert refunds-alert--success">
          <span>{successMessage}</span>
          <button
            type="button"
            className="refunds-button--text"
            onClick={() => setSuccessMessage(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="refunds-alert refunds-alert--error">
          <span>{error}</span>
          <button
            type="button"
            className="refunds-button--text"
            onClick={() => loadData(page, statusFilter, searchQuery)}
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="refunds-stats">
        <div className="refunds-stat-card refunds-stat-card--pending">
          <div className="refunds-stat-card__top">
            <span className="refunds-stat-card__label">Pending Approval</span>
            <span className="refunds-stat-card__icon">⏳</span>
          </div>
          <div className="refunds-stat-card__value">{summaryCounts.pendingApproval}</div>
          <div className="refunds-stat-card__hint">Requires administrative review</div>
        </div>

        <div className="refunds-stat-card refunds-stat-card--completed">
          <div className="refunds-stat-card__top">
            <span className="refunds-stat-card__label">Wallet Credited</span>
            <span className="refunds-stat-card__icon">✓</span>
          </div>
          <div className="refunds-stat-card__value">{summaryCounts.credited}</div>
          <div className="refunds-stat-card__hint">Credited to customer wallet</div>
        </div>

        <div className="refunds-stat-card refunds-stat-card--failed">
          <div className="refunds-stat-card__top">
            <span className="refunds-stat-card__label">Rejected</span>
            <span className="refunds-stat-card__icon">✕</span>
          </div>
          <div className="refunds-stat-card__value">{summaryCounts.rejected}</div>
          <div className="refunds-stat-card__hint">Declined with recorded reason</div>
        </div>

        <div className="refunds-stat-card">
          <div className="refunds-stat-card__top">
            <span className="refunds-stat-card__label">Total Requests</span>
            <span className="refunds-stat-card__icon">📋</span>
          </div>
          <div className="refunds-stat-card__value">{summaryCounts.total}</div>
          <div className="refunds-stat-card__hint">From cancelled paid bookings</div>
        </div>
      </div>

      {/* Filter and Table Panel */}
      <div className="refunds-panel">
        <div className="refunds-panel__heading">
          <div>
            <h2>Refund History & Queue</h2>
            <p>Showing paid cancelled bookings with requested, approved, or rejected wallet refunds</p>
          </div>
          <div className="refunds-result-count">
            Total: <strong>{items.length}</strong> items displayed
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="refunds-filters">
          <form className="refunds-search" onSubmit={handleSearchSubmit}>
            <span>🔍</span>
            <input
              type="text"
              placeholder="Search by booking #, customer, txn ref..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>

          <div className="refunds-filter">
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All Statuses</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="CREDITED">Credited</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="refunds-loading">
            <div className="refunds-loading__spinner" />
            <p>Loading refund requests...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="refunds-empty">
            <div className="refunds-empty-icon">📭</div>
            <h3>No Refund Requests Found</h3>
            <p>
              {statusFilter !== 'all'
                ? `There are currently no refund requests matching status "${statusFilter}".`
                : 'No refund requests have been submitted yet.'}
            </p>
            {statusFilter !== 'all' && (
              <button
                type="button"
                className="refunds-button refunds-button--secondary"
                onClick={() => {
                  setStatusFilter('all');
                  setSearchQuery('');
                  setPage(1);
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="refunds-table-wrap">
            <table className="refunds-table">
              <thead>
                <tr>
                  <th>Booking Ref</th>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Cancellation Date</th>
                  <th>Paid Amount</th>
                  <th>Transaction Ref</th>
                  <th>Refund Amount</th>
                  <th>Status</th>
                  <th>Request Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const bRef = getBookingRef(item);
                  const cust = getCustomer(item);
                  const sName = getServiceName(item);
                  const pay = getPaymentDetails(item);
                  const isPending =
                    item.status === 'PENDING_APPROVAL' ||
                    item.status === 'requested' ||
                    item.status === 'CREDIT_FAILED';

                  const cancelDate =
                    typeof item.bookingId === 'object' && item.bookingId !== null
                      ? (item.bookingId as AdminRefundBooking).createdAt
                      : undefined;

                  return (
                    <tr key={item._id || item.id}>
                      <td>
                        <strong className="refunds-id">{bRef}</strong>
                        <span className="refunds-secondary-text">
                          ID: {(item._id || item.id || '').slice(-6).toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div className="refunds-customer">
                          <span className="refunds-avatar">
                            {(cust.name || 'C').charAt(0).toUpperCase()}
                          </span>
                          <div className="refunds-customer__info">
                            <strong>{cust.name}</strong>
                            <span className="refunds-secondary-text">{cust.email || cust.phone || '—'}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong>{sName}</strong>
                      </td>
                      <td className="refunds-date">{formatDate(cancelDate || item.createdAt)}</td>
                      <td className="refunds-amount">{formatRupees(pay.originalAmount)}</td>
                      <td>
                        <span className="refunds-mono text-xs">{pay.txnRef}</span>
                      </td>
                      <td className="refunds-amount">
                        <strong style={{ color: '#15803d' }}>{formatRupees(item.amount)}</strong>
                        <span className="refunds-secondary-text">Wallet Credit</span>
                      </td>
                      <td>{renderStatusBadge(item.status)}</td>
                      <td className="refunds-date">{formatDate(item.requestedAt || item.createdAt)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="refunds-review-button"
                            onClick={() => openDetail(item)}
                          >
                            Review Details →
                          </button>
                          {isPending && (
                            <>
                              <button
                                type="button"
                                className="refunds-button refunds-button--primary"
                                style={{ minHeight: '30px', padding: '0 10px', fontSize: '11px' }}
                                onClick={() => {
                                  setActionError(null);
                                  setApproveModalItem(item);
                                }}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="refunds-button refunds-button--danger"
                                style={{ minHeight: '30px', padding: '0 10px', fontSize: '11px' }}
                                onClick={() => {
                                  setActionError(null);
                                  setRejectionReason('');
                                  setRejectModalItem(item);
                                }}
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="refunds-pagination">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="refunds-pagination__actions">
              <button
                type="button"
                className="refunds-button refunds-button--secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="refunds-button refunds-button--secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Review Details Drawer / Modal */}
      {selectedRefund && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedRefund(null);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '650px',
              height: '100%',
              backgroundColor: '#fff',
              overflowY: 'auto',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: '24px',
                borderBottom: '1px solid #e5e9f1',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 750, color: '#172033' }}>
                  Refund Request Details
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#68768b' }}>
                  Booking: <strong>{getBookingRef(selectedRefund)}</strong>
                </p>
              </div>
              <button
                type="button"
                className="refunds-button refunds-button--secondary"
                style={{ minHeight: '34px', padding: '0 12px' }}
                onClick={() => setSelectedRefund(null)}
              >
                ✕ Close
              </button>
            </div>

            {/* Drawer Content */}
            {detailLoading && (
              <div style={{ padding: '12px 24px', backgroundColor: '#f0f9ff', color: '#0369a1', fontSize: '12px' }}>
                Fetching latest refund and payment records from server...
              </div>
            )}
            <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Amounts summary cards */}
              <div className="refunds-detail-summary">
                <div className="refunds-detail-amount-card refunds-detail-amount-card--highlight">
                  <span>Refund Amount</span>
                  <strong style={{ color: '#15803d' }}>{formatRupees(selectedRefund.amount)}</strong>
                  <small>Destination: HomeCareX Wallet</small>
                </div>

                <div className="refunds-detail-amount-card">
                  <span>Original Paid</span>
                  <strong>{formatRupees(getPaymentDetails(selectedRefund).originalAmount)}</strong>
                  <small>Payment Captured</small>
                </div>

                <div className="refunds-detail-amount-card">
                  <span>Current Status</span>
                  <div style={{ marginTop: '4px' }}>{renderStatusBadge(selectedRefund.status)}</div>
                  <small>Updated {formatDate(selectedRefund.updatedAt)}</small>
                </div>
              </div>

              {/* Customer & Booking Details */}
              <div
                style={{
                  border: '1px solid #e5e9f1',
                  borderRadius: '12px',
                  padding: '16px',
                  backgroundColor: '#fbfcfd',
                }}
              >
                <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 700, color: '#172033' }}>
                  Customer Information
                </h3>
                <div className="refunds-detail-customer">
                  <span className="refunds-avatar refunds-avatar--large">
                    {(getCustomer(selectedRefund).name || 'C').charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <strong>{getCustomer(selectedRefund).name}</strong>
                    <p>{getCustomer(selectedRefund).email}</p>
                    {getCustomer(selectedRefund).phone && (
                      <p style={{ fontSize: '11px', color: '#68768b' }}>
                        Phone: {getCustomer(selectedRefund).phone}
                      </p>
                    )}
                    <span className="refunds-secondary-text">
                      Customer ID: {getCustomer(selectedRefund).id}
                    </span>
                  </div>
                </div>
              </div>

              {/* Booking & Cancellation Info */}
              <div
                style={{
                  border: '1px solid #e5e9f1',
                  borderRadius: '12px',
                  padding: '16px',
                  backgroundColor: '#fbfcfd',
                }}
              >
                <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 700, color: '#172033' }}>
                  Booking & Cancellation
                </h3>
                <div className="refunds-detail-row">
                  <span>Service Name</span>
                  <strong>{getServiceName(selectedRefund)}</strong>
                </div>
                <div className="refunds-detail-row">
                  <span>Booking Reference</span>
                  <strong className="refunds-id">{getBookingRef(selectedRefund)}</strong>
                </div>
                {typeof selectedRefund.bookingId === 'object' && selectedRefund.bookingId !== null && (
                  <>
                    <div className="refunds-detail-row">
                      <span>Booking Status</span>
                      <strong>{(selectedRefund.bookingId as AdminRefundBooking).status || 'Cancelled'}</strong>
                    </div>
                    {(selectedRefund.bookingId as AdminRefundBooking).cancellationReason && (
                      <div className="refunds-detail-row">
                        <span>Cancellation Reason</span>
                        <strong>{(selectedRefund.bookingId as AdminRefundBooking).cancellationReason}</strong>
                      </div>
                    )}
                  </>
                )}
                {selectedRefund.reason && (
                  <div className="refunds-detail-row">
                    <span>Refund Request Reason</span>
                    <strong>{selectedRefund.reason}</strong>
                  </div>
                )}
              </div>

              {/* Payment Details */}
              <div
                style={{
                  border: '1px solid #e5e9f1',
                  borderRadius: '12px',
                  padding: '16px',
                  backgroundColor: '#fbfcfd',
                }}
              >
                <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 700, color: '#172033' }}>
                  Payment Transaction
                </h3>
                <div className="refunds-detail-row">
                  <span>Payment Record ID</span>
                  <strong className="refunds-mono">{getPaymentDetails(selectedRefund).id}</strong>
                </div>
                <div className="refunds-detail-row">
                  <span>Transaction Reference</span>
                  <strong className="refunds-mono">{getPaymentDetails(selectedRefund).txnRef}</strong>
                </div>
                <div className="refunds-detail-row">
                  <span>Original Paid Amount</span>
                  <strong>{formatRupees(getPaymentDetails(selectedRefund).originalAmount)}</strong>
                </div>
                <div className="refunds-detail-row">
                  <span>Payment Status</span>
                  <strong>{getPaymentDetails(selectedRefund).status}</strong>
                </div>
                {getPaymentDetails(selectedRefund).paidAt && (
                  <div className="refunds-detail-row">
                    <span>Paid At</span>
                    <strong>{formatDate(getPaymentDetails(selectedRefund).paidAt)}</strong>
                  </div>
                )}
              </div>

              {/* Wallet Credit or Rejection Info */}
              {selectedRefund.status === 'CREDITED' && (
                <div
                  style={{
                    border: '1px solid #bbf7d0',
                    borderRadius: '12px',
                    padding: '16px',
                    backgroundColor: '#f0fdf4',
                  }}
                >
                  <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700, color: '#166534' }}>
                    ✓ Wallet Credit Details
                  </h3>
                  <div className="refunds-detail-row">
                    <span>Credited Amount</span>
                    <strong style={{ color: '#166534' }}>{formatRupees(selectedRefund.amount)}</strong>
                  </div>
                  <div className="refunds-detail-row">
                    <span>Destination</span>
                    <strong>HomeCareX Wallet</strong>
                  </div>
                  {selectedRefund.walletTransactionId && (
                    <div className="refunds-detail-row">
                      <span>Wallet Transaction Reference</span>
                      <strong className="refunds-mono">{selectedRefund.walletTransactionId}</strong>
                    </div>
                  )}
                  {selectedRefund.processedAt && (
                    <div className="refunds-detail-row">
                      <span>Processed At</span>
                      <strong>{formatDate(selectedRefund.processedAt)}</strong>
                    </div>
                  )}
                </div>
              )}

              {selectedRefund.status === 'REJECTED' && (
                <div
                  style={{
                    border: '1px solid #fecaca',
                    borderRadius: '12px',
                    padding: '16px',
                    backgroundColor: '#fef2f2',
                  }}
                >
                  <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700, color: '#991b1b' }}>
                    ✕ Refund Rejected
                  </h3>
                  <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#7f1d1d' }}>
                    <strong>Reason:</strong> {selectedRefund.rejectionReason || 'No reason provided.'}
                  </p>
                  {selectedRefund.rejectedAt && (
                    <span style={{ fontSize: '11px', color: '#991b1b' }}>
                      Rejected on {formatDate(selectedRefund.rejectedAt)}
                    </span>
                  )}
                </div>
              )}

              {/* Action Buttons inside Drawer if Pending */}
              {(selectedRefund.status === 'PENDING_APPROVAL' ||
                selectedRefund.status === 'requested' ||
                selectedRefund.status === 'CREDIT_FAILED') && (
                <div
                  style={{
                    marginTop: 'auto',
                    paddingTop: '20px',
                    borderTop: '1px solid #e5e9f1',
                    display: 'flex',
                    gap: '12px',
                  }}
                >
                  <button
                    type="button"
                    className="refunds-button refunds-button--primary"
                    style={{ flex: 1, minHeight: '44px' }}
                    onClick={() => {
                      setActionError(null);
                      setApproveModalItem(selectedRefund);
                    }}
                  >
                    ✓ Approve Refund ({formatRupees(selectedRefund.amount)})
                  </button>
                  <button
                    type="button"
                    className="refunds-button refunds-button--danger"
                    style={{ flex: 1, minHeight: '44px' }}
                    onClick={() => {
                      setActionError(null);
                      setRejectionReason('');
                      setRejectModalItem(selectedRefund);
                    }}
                  >
                    ✕ Reject Refund
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approve Confirmation Modal */}
      {approveModalItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(3px)',
            zIndex: 1100,
            display: 'grid',
            placeItems: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: '#fff',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h3 style={{ margin: '0 0 10px', fontSize: '18px', fontWeight: 750, color: '#172033' }}>
              Confirm Refund Approval
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#68768b', lineHeight: 1.6 }}>
              Are you sure you want to approve this refund request for booking{' '}
              <strong>{getBookingRef(approveModalItem)}</strong>?
            </p>

            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px',
                marginBottom: '16px',
                fontSize: '13px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748b' }}>Customer:</span>
                <strong>{getCustomer(approveModalItem).name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748b' }}>Refund Amount:</span>
                <strong style={{ color: '#15803d', fontSize: '15px' }}>
                  {formatRupees(approveModalItem.amount)}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Destination:</span>
                <strong>HomeCareX Wallet</strong>
              </div>
            </div>

            <p style={{ margin: '0 0 20px', fontSize: '12px', color: '#a16207' }}>
              ⚠️ Upon confirmation, the backend will atomically credit{' '}
              {formatRupees(approveModalItem.amount)} directly to the customer's HomeCareX Wallet and update
              the refund status to CREDITED.
            </p>

            {actionError && (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '10px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  color: '#991b1b',
                  fontSize: '12px',
                }}
              >
                {actionError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="refunds-button refunds-button--secondary"
                disabled={actionLoading}
                onClick={() => setApproveModalItem(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="refunds-button refunds-button--primary"
                disabled={actionLoading}
                onClick={handleApproveConfirm}
              >
                {actionLoading ? 'Processing Credit...' : 'Yes, Approve & Credit Wallet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Confirmation Modal */}
      {rejectModalItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(3px)',
            zIndex: 1100,
            display: 'grid',
            placeItems: 'center',
            padding: '20px',
          }}
        >
          <form
            onSubmit={handleRejectConfirm}
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: '#fff',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h3 style={{ margin: '0 0 10px', fontSize: '18px', fontWeight: 750, color: '#172033' }}>
              Reject Refund Request
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#68768b', lineHeight: 1.6 }}>
              Reject refund of {formatRupees(rejectModalItem.amount)} for booking{' '}
              <strong>{getBookingRef(rejectModalItem)}</strong>. Please provide a clear explanation for the
              customer.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="rejectionReason"
                style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}
              >
                Rejection Reason (Required)
              </label>
              <textarea
                id="rejectionReason"
                rows={3}
                placeholder="E.g., Booking cancelled outside the refundable window per policy..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                }}
                required
              />
            </div>

            {actionError && (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '10px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  color: '#991b1b',
                  fontSize: '12px',
                }}
              >
                {actionError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="refunds-button refunds-button--secondary"
                disabled={actionLoading}
                onClick={() => setRejectModalItem(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="refunds-button refunds-button--danger"
                disabled={actionLoading || rejectionReason.trim().length < 3}
              >
                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminRefundsPage;
