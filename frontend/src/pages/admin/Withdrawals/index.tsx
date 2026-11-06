import React, { useCallback, useEffect, useRef, useState } from "react";
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

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const msg = (e: unknown, fallback = "Something went wrong.") =>
  e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string"
    ? (e as { message: string }).message
    : fallback;

/* ---------- review dialog ---------- */

const ReviewDialog: React.FC<{ id: string; partnerName: string; onClose: () => void; onChanged: () => void }> = ({
  id,
  partnerName,
  onClose,
  onChanged,
}) => {
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
      ? [["Name", f.accountHolder], ["UPI ID", f.upiId]]
      : [["Name", f.accountHolder], ["Bank", f.bankName], ["Account number", f.accountNumber], ["IFSC", f.ifsc]]
    : [];

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
          <h2>Withdrawal request</h2>
          <button type="button" className="awd-x" onClick={onClose} aria-label="Close" disabled={busy}>
            &times;
          </button>
        </div>

        {!d && !error && <p className="awd-muted">Loading…</p>}
        {error && (
          <p className="awd-error" role="alert">
            {error}
          </p>
        )}

        {d && (
          <>
            <p className="awd-amount">{inr.format(d.amount)}</p>
            <p className="awd-muted">
              {partnerName} · requested {when(d.createdAt)} · <span className={`awd-chip awd-chip-${d.status}`}>{d.status}</span>
            </p>

            <h3 className="awd-sub">Send money to</h3>
            <dl className="awd-dl">
              {lines.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>
                    {v ?? "-"}
                    {v && (
                      <button type="button" className="awd-copy" onClick={() => void copy(k, v)}>
                        {copied === k ? "Copied" : "Copy"}
                      </button>
                    )}
                  </dd>
                </div>
              ))}
            </dl>

            {d.status === "rejected" && d.rejectionReason && <p className="awd-muted">Reason: {d.rejectionReason}</p>}
            {d.status === "paid" && d.transactionId && <p className="awd-muted">Transfer reference: {d.transactionId}</p>}

            {(d.status === "pending" || d.status === "approved") && mode === "none" && (
              <div className="awd-actions">
                {d.status === "pending" && (
                  <button type="button" className="awd-btn" disabled={busy} onClick={() => void act("approve")}>
                    Approve
                  </button>
                )}
                <button type="button" className="awd-btn awd-btn-primary" disabled={busy} onClick={() => setMode("paid")}>
                  Mark as paid
                </button>
                <button type="button" className="awd-btn awd-btn-danger" disabled={busy} onClick={() => setMode("reject")}>
                  Reject
                </button>
              </div>
            )}

            {mode === "paid" && (
              <div className="awd-form">
                <label htmlFor="awd-txn">Bank transfer / UTR reference</label>
                <input id="awd-txn" value={txn} onChange={(e) => setTxn(e.target.value)} autoFocus maxLength={80} />
                <div className="awd-actions">
                  <button type="button" className="awd-btn" disabled={busy} onClick={() => setMode("none")}>
                    Back
                  </button>
                  <button
                    type="button"
                    className="awd-btn awd-btn-primary"
                    disabled={busy || txn.trim().length < 3}
                    onClick={() => void act("paid", { transactionId: txn.trim() })}
                  >
                    {busy ? "Saving…" : "Confirm paid"}
                  </button>
                </div>
              </div>
            )}

            {mode === "reject" && (
              <div className="awd-form">
                <label htmlFor="awd-reason">Reason (the partner will see this)</label>
                <input id="awd-reason" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus maxLength={300} />
                <p className="awd-muted">The amount goes back to the partner's wallet right away.</p>
                <div className="awd-actions">
                  <button type="button" className="awd-btn" disabled={busy} onClick={() => setMode("none")}>
                    Back
                  </button>
                  <button
                    type="button"
                    className="awd-btn awd-btn-danger"
                    disabled={busy || reason.trim().length < 3}
                    onClick={() => void act("reject", { reason: reason.trim() })}
                  >
                    {busy ? "Rejecting…" : "Reject and refund"}
                  </button>
                </div>
              </div>
            )}
          </>
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

  return (
    <div className="awd-page">
      <PageHeader
        title="Withdrawals"
        description="Partners ask to move money from their wallet to their bank or UPI. Review each request, send the money, then mark it paid."
      />

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
            {t.key === "pending" && data && data.pendingCount > 0 && <span className="awd-count">{data.pendingCount}</span>}
          </button>
        ))}
      </div>

      {error && (
        <p className="awd-error" role="alert">
          {error}{" "}
          <button type="button" className="awd-copy" onClick={() => void load()}>
            Try again
          </button>
        </p>
      )}

      {loading && !data && <p className="awd-muted">Loading…</p>}

      {data && data.items.length === 0 && !error && <p className="awd-muted">No requests here.</p>}

      {data && data.items.length > 0 && (
        <ul className="awd-list">
          {data.items.map((r) => (
            <li key={r.id} className="awd-row">
              <div className="awd-row-main">
                <span className="awd-row-name">{r.partner.name}</span>
                <span className="awd-muted">
                  {r.partner.email} · {r.destination.label}
                </span>
                <span className="awd-muted">{when(r.createdAt)}</span>
              </div>
              <div className="awd-row-side">
                <span className="awd-row-amount">{inr.format(r.amount)}</span>
                <span className={`awd-chip awd-chip-${r.status}`}>{r.status}</span>
                <button type="button" className="awd-btn" onClick={() => setOpen(r)}>
                  {r.status === "pending" || r.status === "approved" ? "Review" : "View"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {data && data.pagination.pages > 1 && (
        <div className="awd-pager">
          <button type="button" className="awd-btn" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span className="awd-muted">
            Page {data.pagination.page} of {data.pagination.pages}
          </span>
          <button
            type="button"
            className="awd-btn"
            disabled={page >= data.pagination.pages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}

      {open && <ReviewDialog id={open.id} partnerName={open.partner.name} onClose={() => setOpen(null)} onChanged={() => void load()} />}
    </div>
  );
};

export default AdminWithdrawalsPage;
