import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Banknote,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Inbox,
  Landmark,
  Smartphone,
  X,
} from "lucide-react";
import http, { type ApiResponse } from "@/lib/http";
import { PageHeader } from "@/components/admin";
import "./index.css";

type Status = "pending" | "approved" | "paid" | "rejected" | "cancelled";

interface Row {
  id: string;
  amount: number;
  status: Status;
  destination: { type: "bank" | "upi"; label: string };
  rejectionReason: string | null;
  transactionId: string | null;
  createdAt: string;
  partner: { id: string; name: string; email: string; phone: string };
}

interface ListResponse {
  pendingCount: number;
  items: Row[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

interface Detail extends Omit<Row, "partner"> {
  destinationFull: {
    type: "bank" | "upi";
    accountHolder: string;
    bankName: string | null;
    ifsc: string | null;
    accountNumber: string | null;
    upiId: string | null;
  };
}

const TABS: { key: Status | "all"; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "paid", label: "Paid" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

const STATUS_LABEL: Record<Status, string> = {
  pending: "Pending",
  approved: "Approved",
  paid: "Paid",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const whenShort = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const msg = (e: unknown, fallback = "Something went wrong.") =>
  e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string"
    ? (e as { message: string }).message
    : fallback;
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

const StatusChip: React.FC<{ status: Status }> = ({ status }) => (
  <span className={`awd-chip awd-chip-${status}`}>
    <span className="awd-chip-dot" aria-hidden="true" />
    {STATUS_LABEL[status]}
  </span>
);

const DestIcon: React.FC<{ type: "bank" | "upi"; size?: number }> = ({ type, size = 16 }) =>
  type === "upi" ? <Smartphone size={size} aria-hidden="true" /> : <Landmark size={size} aria-hidden="true" />;

/* ---------- progress steps (requested -> approved -> paid) ---------- */

const Steps: React.FC<{ status: Status }> = ({ status }) => {
  if (status === "rejected" || status === "cancelled") return null;
  const reached = status === "pending" ? 0 : status === "approved" ? 1 : 2;
  const steps = ["Requested", "Approved", "Paid"];
  return (
    <ol className="awd-steps" aria-label="Progress">
      {steps.map((label, i) => (
        <li key={label} className={`awd-step${i <= reached ? " is-done" : ""}${i === reached ? " is-current" : ""}`}>
          <span className="awd-step-dot" aria-hidden="true">
            {i < reached || (i === reached && status === "paid") ? <Check size={12} strokeWidth={3} /> : i + 1}
          </span>
          <span className="awd-step-label">{label}</span>
        </li>
      ))}
    </ol>
  );
};

/* ---------- review dialog ---------- */

const ReviewDialog: React.FC<{ row: Row; onClose: () => void; onChanged: () => void }> = ({ row, onClose, onChanged }) => {
  const id = row.id;
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"none" | "paid" | "reject">("none");
  const [txn, setTxn] = useState("");
  const [reason, setReason] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setD((await http.get<ApiResponse<Detail>>(`/admin/withdrawals/${id}`)).data.data);
    } catch (e) {
      setError(msg(e, "Could not load this request."));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const act = async (path: string, body?: object) => {
    setBusy(true);
    setError(null);
    try {
      await http.post(`/admin/withdrawals/${id}/${path}`, body);
      onChanged();
      onClose();
    } catch (e) {
      setError(msg(e));
      setBusy(false);
    }
  };

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked: the value is still on screen */
    }
  };

  const f = d?.destinationFull;
  const lines: [string, string | null][] = f
    ? f.type === "upi"
      ? [["Account holder", f.accountHolder], ["UPI ID", f.upiId]]
      : [["Account holder", f.accountHolder], ["Bank", f.bankName], ["Account number", f.accountNumber], ["IFSC", f.ifsc]]
    : [];
  const actionable = d && (d.status === "pending" || d.status === "approved");

  return (
    <div className="awd-overlay" onClick={() => !busy && onClose()}>
      <div
        ref={ref}
        tabIndex={-1}
        className="awd-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Review withdrawal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="awd-dialog-head">
          <div>
            <p className="awd-eyebrow">Withdrawal request</p>
            <h2>{row.partner.name}</h2>
          </div>
          <button type="button" className="awd-x" onClick={onClose} aria-label="Close" disabled={busy}>
            <X size={20} />
          </button>
        </div>

        <div className="awd-dialog-body">
          {!d && !error && (
            <div className="awd-skel-stack" aria-busy="true">
              <span className="awd-skel awd-skel-lg" />
              <span className="awd-skel" />
              <span className="awd-skel" />
            </div>
          )}

          {error && (
            <p className="awd-alert" role="alert">
              <AlertCircle size={16} aria-hidden="true" /> {error}
            </p>
          )}

          {d && (
            <>
              <div className="awd-hero">
                <div>
                  <span className="awd-hero-label">Amount</span>
                  <p className="awd-hero-amount">{inr.format(d.amount)}</p>
                </div>
                <StatusChip status={d.status} />
              </div>

              <Steps status={d.status} />

              <dl className="awd-meta">
                <div>
                  <dt>Partner</dt>
                  <dd>
                    {row.partner.name}
                    <span className="awd-sub">{row.partner.email}</span>
                    {row.partner.phone && <span className="awd-sub">{row.partner.phone}</span>}
                  </dd>
                </div>
                <div>
                  <dt>Requested</dt>
                  <dd>{when(d.createdAt)}</dd>
                </div>
              </dl>

              <section className="awd-card" aria-label="Send money to">
                <h3 className="awd-card-title">
                  <DestIcon type={d.destinationFull.type} />
                  Send money to · {d.destinationFull.type === "upi" ? "UPI" : "Bank account"}
                </h3>
                <dl className="awd-dl">
                  {lines.map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>
                        <span className="awd-value">{v ?? "-"}</span>
                        {v && (
                          <button type="button" className="awd-copy" onClick={() => void copy(k, v)} aria-label={`Copy ${k}`}>
                            {copied === k ? <Check size={14} /> : <Copy size={14} />}
                            {copied === k ? "Copied" : "Copy"}
                          </button>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>

              {d.status === "rejected" && d.rejectionReason && (
                <p className="awd-note awd-note-danger">
                  <strong>Rejected:</strong> {d.rejectionReason}
                </p>
              )}
              {d.status === "paid" && d.transactionId && (
                <p className="awd-note awd-note-success">
                  <strong>Transfer reference:</strong> <span className="awd-value">{d.transactionId}</span>
                </p>
              )}

              {mode === "paid" && (
                <div className="awd-form">
                  <label htmlFor="awd-txn">Bank transfer / UTR reference</label>
                  <input
                    id="awd-txn"
                    value={txn}
                    onChange={(e) => setTxn(e.target.value)}
                    placeholder="e.g. UTR123456789"
                    autoFocus
                    maxLength={80}
                  />
                  <p className="awd-hint">Enter this after you have sent the money from your bank.</p>
                </div>
              )}

              {mode === "reject" && (
                <div className="awd-form">
                  <label htmlFor="awd-reason">Reason (the partner will see this)</label>
                  <input
                    id="awd-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Bank details do not match"
                    autoFocus
                    maxLength={300}
                  />
                  <p className="awd-hint">The amount goes back to the partner's wallet right away.</p>
                </div>
              )}
            </>
          )}
        </div>

        {actionable && (
          <div className="awd-dialog-foot">
            {mode === "none" && (
              <>
                <button type="button" className="awd-btn awd-btn-danger-ghost" disabled={busy} onClick={() => setMode("reject")}>
                  Reject
                </button>
                <span className="awd-spacer" />
                {d.status === "pending" && (
                  <button type="button" className="awd-btn" disabled={busy} onClick={() => void act("approve")}>
                    {busy ? "Approving…" : "Approve"}
                  </button>
                )}
                <button type="button" className="awd-btn awd-btn-primary" disabled={busy} onClick={() => setMode("paid")}>
                  Mark as paid
                </button>
              </>
            )}

            {mode === "paid" && (
              <>
                <button type="button" className="awd-btn" disabled={busy} onClick={() => setMode("none")}>
                  Back
                </button>
                <span className="awd-spacer" />
                <button
                  type="button"
                  className="awd-btn awd-btn-primary"
                  disabled={busy || txn.trim().length < 3}
                  onClick={() => void act("paid", { transactionId: txn.trim() })}
                >
                  {busy ? "Saving…" : "Confirm paid"}
                </button>
              </>
            )}

            {mode === "reject" && (
              <>
                <button type="button" className="awd-btn" disabled={busy} onClick={() => setMode("none")}>
                  Back
                </button>
                <span className="awd-spacer" />
                <button
                  type="button"
                  className="awd-btn awd-btn-danger"
                  disabled={busy || reason.trim().length < 3}
                  onClick={() => void act("reject", { reason: reason.trim() })}
                >
                  {busy ? "Rejecting…" : "Reject and refund"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ---------- page ---------- */

const AdminWithdrawalsPage: React.FC = () => {
  const [tab, setTab] = useState<Status | "all">("pending");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Row | null>(null);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await http.get<ApiResponse<ListResponse>>("/admin/withdrawals", {
        params: { page, limit: 20, ...(tab === "all" ? {} : { status: tab }) },
      });
      if (id === reqId.current) setData(res.data.data);
    } catch (e) {
      if (id === reqId.current) setError(msg(e, "Could not load withdrawals."));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [tab, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = data?.items ?? [];
  const pageTotal = items.reduce((sum, r) => sum + r.amount, 0);
  const pending = data?.pendingCount ?? 0;

  return (
    <div className="awd-page admin-page-container">
      <PageHeader
        title="Withdrawals"
        description="Partners ask to move money from their wallet to their bank or UPI. Review each request, send the money, then mark it paid."
      />

      <section className="awd-stats" aria-label="Summary">
        <div className={`awd-stat${pending > 0 ? " is-attention" : ""}`}>
          <span className="awd-stat-icon"><Clock3 size={18} /></span>
          <div>
            <span className="awd-stat-label">Waiting for review</span>
            <strong className="awd-stat-value">{data ? pending : "—"}</strong>
          </div>
        </div>
        <div className="awd-stat">
          <span className="awd-stat-icon"><Banknote size={18} /></span>
          <div>
            <span className="awd-stat-label">Amount on this page</span>
            <strong className="awd-stat-value">{data ? inr.format(pageTotal) : "—"}</strong>
          </div>
        </div>
        <div className="awd-stat">
          <span className="awd-stat-icon"><CheckCircle2 size={18} /></span>
          <div>
            <span className="awd-stat-label">Requests in this view</span>
            <strong className="awd-stat-value">{data ? data.pagination.total : "—"}</strong>
          </div>
        </div>
      </section>

      <div className="awd-tabs" role="tablist" aria-label="Status">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`awd-tab${tab === t.key ? " is-active" : ""}`}
            onClick={() => {
              setTab(t.key);
              setPage(1);
            }}
          >
            {t.label}
            {t.key === "pending" && pending > 0 && <span className="awd-count">{pending}</span>}
          </button>
        ))}
      </div>

      <section className="awd-panel" aria-busy={loading}>
        {error ? (
          <div className="awd-state awd-state-error" role="alert">
            <AlertCircle size={24} />
            <p>{error}</p>
            <button type="button" className="awd-btn" onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : loading && !data ? (
          <ul className="awd-rows" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="awd-row awd-row-skel">
                <span className="awd-skel" />
                <span className="awd-skel" />
                <span className="awd-skel" />
              </li>
            ))}
          </ul>
        ) : items.length === 0 ? (
          <div className="awd-state">
            <span className="awd-state-icon"><Inbox size={26} /></span>
            <p className="awd-state-title">{tab === "pending" ? "You're all caught up" : "No requests here"}</p>
            <p className="awd-muted">
              {tab === "pending" ? "New withdrawal requests from partners will show up here." : "Nothing matches this status yet."}
            </p>
          </div>
        ) : (
          <>
            <div className="awd-head-row" aria-hidden="true">
              <span>Partner</span>
              <span>Destination</span>
              <span>Requested</span>
              <span className="awd-right">Amount</span>
              <span>Status</span>
              <span />
            </div>
            <ul className="awd-rows">
              {items.map((r) => (
                <li key={r.id} className="awd-row">
                  <div className="awd-cell awd-partner">
                    <span className="awd-avatar" aria-hidden="true">{initials(r.partner.name)}</span>
                    <div className="awd-partner-text">
                      <span className="awd-name">{r.partner.name}</span>
                      <span className="awd-sub">{r.partner.email}</span>
                    </div>
                  </div>
                  <div className="awd-cell awd-dest" data-label="Destination">
                    <DestIcon type={r.destination.type} />
                    <span>{r.destination.label}</span>
                  </div>
                  <div className="awd-cell awd-date" data-label="Requested">{whenShort(r.createdAt)}</div>
                  <div className="awd-cell awd-amount" data-label="Amount">{inr.format(r.amount)}</div>
                  <div className="awd-cell" data-label="Status"><StatusChip status={r.status} /></div>
                  <div className="awd-cell awd-action">
                    <button
                      type="button"
                      className={`awd-btn awd-btn-sm${r.status === "pending" || r.status === "approved" ? " awd-btn-primary" : ""}`}
                      onClick={() => setOpen(r)}
                    >
                      {r.status === "pending" || r.status === "approved" ? "Review" : "View"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {data && data.pagination.pages > 1 && (
          <footer className="awd-pager">
            <span className="awd-muted">
              Page {data.pagination.page} of {data.pagination.pages} · {data.pagination.total} requests
            </span>
            <div className="awd-pager-btns">
              <button type="button" className="awd-btn awd-btn-sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft size={15} /> Previous
              </button>
              <button
                type="button"
                className="awd-btn awd-btn-sm"
                disabled={page >= data.pagination.pages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight size={15} />
              </button>
            </div>
          </footer>
        )}
      </section>

      {open && <ReviewDialog row={open} onClose={() => setOpen(null)} onChanged={() => void load()} />}
    </div>
  );
};

export default AdminWithdrawalsPage;
