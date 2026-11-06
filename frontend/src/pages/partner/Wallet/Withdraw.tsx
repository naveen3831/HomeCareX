import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  withdrawApi,
  errorMessage,
  type AccountType,
  type BankAccount,
  type NewAccountInput,
  type Withdrawal,
  type WithdrawalStatus,
} from './withdraw.api';
import './Withdraw.css';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
export const fmtINR = (n: number) => money.format(n);

const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UPI = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z]{2,32}$/;

export const STATUS_LABEL: Record<WithdrawalStatus, string> = {
  pending: 'Waiting for approval',
  approved: 'Approved',
  paid: 'Paid',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/* ------------------------------------------------------------------ */
/* Withdrawals list (shown on the wallet page)                          */
/* ------------------------------------------------------------------ */

export const WithdrawalsSection: React.FC<{
  items: Withdrawal[];
  onCancel: (w: Withdrawal) => void;
  cancellingId: string | null;
}> = ({ items, onCancel, cancellingId }) => {
  if (items.length === 0) return null;
  return (
    <section className="wd-section" aria-label="Withdrawals">
      <h2 className="wl-section-title">Withdrawals</h2>
      <ul className="wd-list">
        {items.slice(0, 5).map((w) => (
          <li key={w.id} className="wd-item">
            <div className="wd-item-main">
              <span className="wd-item-amount">{fmtINR(w.amount)}</span>
              <span className="wd-item-sub">
                {w.destination.label} · {fmtDate(w.createdAt)}
              </span>
              {w.status === 'rejected' && w.rejectionReason && (
                <span className="wd-item-note">Reason: {w.rejectionReason}</span>
              )}
              {w.status === 'paid' && w.transactionId && (
                <span className="wd-item-note">Ref: {w.transactionId}</span>
              )}
            </div>
            <div className="wd-item-side">
              <span className={`wd-chip wd-chip-${w.status}`}>{STATUS_LABEL[w.status]}</span>
              {w.status === 'pending' && (
                <button
                  type="button"
                  className="wd-link"
                  disabled={cancellingId === w.id}
                  onClick={() => onCancel(w)}
                >
                  {cancellingId === w.id ? 'Cancelling…' : 'Cancel request'}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Withdraw sheet                                                       */
/* ------------------------------------------------------------------ */

type View = 'form' | 'add' | 'done';

interface SheetProps {
  available: number;
  minAmount: number;
  maxAmount: number;
  onClose: () => void;
  /** Called after a request was created, so the page can refresh. */
  onRequested: () => void;
}

export const WithdrawSheet: React.FC<SheetProps> = ({ available, minAmount, maxAmount, onClose, onRequested }) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>('form');
  const [accounts, setAccounts] = useState<BankAccount[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [sent, setSent] = useState<Withdrawal | null>(null);

  const limit = Math.min(available, maxAmount);

  /* modal behaviour: Esc, scroll lock, focus return */
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
      if (e.key === 'Tab' && sheetRef.current) {
        const f = sheetRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      opener?.focus?.();
    };
  }, [onClose, submitting]);

  const loadAccounts = useCallback(async () => {
    setLoadError(null);
    try {
      const list = await withdrawApi.accounts();
      setAccounts(list);
      setSelectedId((cur) => (cur && list.some((a) => a.id === cur) ? cur : (list.find((a) => a.isDefault) ?? list[0])?.id ?? null));
    } catch (e) {
      setLoadError(errorMessage(e, "We couldn't load your saved accounts."));
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  /* amount */
  const amount = Number(amountText);
  const amountError = useMemo(() => {
    if (!amountText.trim()) return 'Enter an amount';
    if (!Number.isFinite(amount) || amount <= 0) return 'Enter a valid amount';
    if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) return 'Use at most 2 decimal places';
    if (amount < minAmount) return `Minimum withdrawal is ${fmtINR(minAmount)}`;
    if (amount > available) return `You can withdraw up to ${fmtINR(limit)}`;
    if (amount > maxAmount) return `Maximum per request is ${fmtINR(maxAmount)}`;
    return null;
  }, [amountText, amount, minAmount, maxAmount, available, limit]);

  const selected = accounts?.find((a) => a.id === selectedId) ?? null;
  const canSubmit = !amountError && !!selected && !submitting;

  const submit = async () => {
    setTouched(true);
    setError(null);
    if (!canSubmit || !selected) return;
    setSubmitting(true);
    try {
      const w = await withdrawApi.create(Math.round(amount * 100) / 100, selected.id);
      setSent(w);
      setView('done');
      onRequested();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    setError(null);
    try {
      const list = await withdrawApi.removeAccount(id);
      setAccounts(list);
      setSelectedId((cur) => (cur === id ? (list.find((a) => a.isDefault) ?? list[0])?.id ?? null : cur));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setConfirmRemove(null);
    }
  };

  return (
    <div className="wl-overlay" onClick={() => !submitting && onClose()}>
      <div
        ref={sheetRef}
        className="wl-sheet wd-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Withdraw money"
        onClick={(e) => e.stopPropagation()}
      >
        {view === 'done' && sent ? (
          <div className="wd-done">
            <span className="wd-done-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
            <h2 className="wd-title">Request sent</h2>
            <p className="wd-done-amount">{fmtINR(sent.amount)}</p>
            <p className="wd-muted">
              to {sent.destination.label}. Our team will review it. The amount is already set aside from your wallet,
              and it comes back if the request is rejected or cancelled.
            </p>
            <button type="button" className="wl-btn wl-btn-block" onClick={onClose} autoFocus>
              Done
            </button>
          </div>
        ) : view === 'add' ? (
          <AddAccountForm
            onBack={() => setView('form')}
            onSaved={async (acc) => {
              await loadAccounts();
              setSelectedId(acc.id);
              setView('form');
            }}
          />
        ) : (
          <>
            <div className="wl-sheet-top">
              <h2 className="wd-title">Withdraw money</h2>
              <button type="button" className="wl-close" onClick={onClose} aria-label="Close">
                &times;
              </button>
            </div>
            <p className="wd-muted wd-avail">
              Available to withdraw: <strong>{fmtINR(available)}</strong>
            </p>

            <label className="wd-label" htmlFor="wd-amount">
              Amount
            </label>
            <div className={`wd-amount${touched && amountError ? ' has-error' : ''}`}>
              <span aria-hidden="true">₹</span>
              <input
                id="wd-amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={amountText}
                aria-invalid={touched && !!amountError}
                aria-describedby="wd-amount-msg"
                onChange={(e) => setAmountText(e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'))}
                onBlur={() => setTouched(true)}
                autoFocus
              />
              <button
                type="button"
                className="wd-link"
                onClick={() => {
                  setAmountText(String(Math.floor(limit * 100) / 100));
                  setTouched(true);
                }}
              >
                Withdraw all
              </button>
            </div>
            <p id="wd-amount-msg" className={touched && amountError ? 'wd-field-error' : 'wd-hint'} role={touched && amountError ? 'alert' : undefined}>
              {touched && amountError ? amountError : `Minimum ${fmtINR(minAmount)}`}
            </p>

            <span className="wd-label">Send to</span>
            {loadError ? (
              <div className="wl-error" role="alert">
                {loadError}{' '}
                <button type="button" className="wd-link" onClick={() => void loadAccounts()}>
                  Try again
                </button>
              </div>
            ) : accounts === null ? (
              <div className="wl-skel wd-skel" aria-busy="true" />
            ) : (
              <ul className="wd-accounts" role="radiogroup" aria-label="Send to">
                {accounts.map((a) => (
                  <li key={a.id}>
                    <label className={`wd-account${selectedId === a.id ? ' is-selected' : ''}`}>
                      <input
                        type="radio"
                        name="wd-account"
                        checked={selectedId === a.id}
                        onChange={() => setSelectedId(a.id)}
                      />
                      <span className="wd-account-icon" aria-hidden="true">
                        {a.type === 'upi' ? 'UPI' : 'BANK'}
                      </span>
                      <span className="wd-account-main">
                        <span className="wd-account-label">{a.label}</span>
                        <span className="wd-account-sub">
                          {a.accountHolder}
                          {a.type === 'bank' && a.ifsc ? ` · ${a.ifsc}` : ''}
                          {a.isDefault ? ' · Default' : ''}
                        </span>
                      </span>
                    </label>
                    {confirmRemove === a.id ? (
                      <span className="wd-remove-confirm">
                        Remove this account?{' '}
                        <button type="button" className="wd-link wd-danger" onClick={() => void remove(a.id)}>
                          Yes, remove
                        </button>{' '}
                        <button type="button" className="wd-link" onClick={() => setConfirmRemove(null)}>
                          Keep
                        </button>
                      </span>
                    ) : (
                      <button type="button" className="wd-link wd-remove" onClick={() => setConfirmRemove(a.id)}>
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {accounts && accounts.length === 0 && (
              <p className="wd-hint">You have no saved account yet. Add one to continue.</p>
            )}
            {accounts && accounts.length < 5 && (
              <button type="button" className="wd-add" onClick={() => setView('add')}>
                <span aria-hidden="true">+</span> Add new bank account or UPI
              </button>
            )}

            <p className="wd-note">
              Withdrawals are checked by our team before money is sent. The amount leaves your wallet now and returns
              if the request is rejected or cancelled.
            </p>

            {error && (
              <p className="wl-error" role="alert">
                {error}
              </p>
            )}

            <button type="button" className="wl-btn wl-btn-block" disabled={!canSubmit && touched} onClick={() => void submit()}>
              {submitting ? 'Sending request…' : amount > 0 && !amountError ? `Request ${fmtINR(amount)}` : 'Request withdrawal'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Add account form                                                     */
/* ------------------------------------------------------------------ */

const AddAccountForm: React.FC<{ onBack: () => void; onSaved: (a: BankAccount) => void | Promise<void> }> = ({ onBack, onSaved }) => {
  const [type, setType] = useState<AccountType>('bank');
  const [f, setF] = useState({ holder: '', bank: '', number: '', confirm: '', ifsc: '', upi: '' });
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  const errors = useMemo(() => {
    const e: Partial<Record<keyof typeof f, string>> = {};
    if (f.holder.trim().length < 2) e.holder = 'Enter the name on the account';
    if (type === 'bank') {
      if (f.bank.trim().length < 2) e.bank = 'Enter the bank name';
      if (!/^\d{9,18}$/.test(f.number.trim())) e.number = 'Account number must be 9 to 18 digits';
      if (f.confirm.trim() !== f.number.trim()) e.confirm = 'Account numbers do not match';
      if (!IFSC.test(f.ifsc.trim().toUpperCase())) e.ifsc = 'Enter a valid IFSC (e.g. HDFC0001234)';
    } else if (!UPI.test(f.upi.trim())) {
      e.upi = 'Enter a valid UPI ID (e.g. name@bank)';
    }
    return e;
  }, [f, type]);

  const save = async () => {
    setShowErrors(true);
    setServerError(null);
    if (Object.keys(errors).length) return;
    const input: NewAccountInput =
      type === 'bank'
        ? {
            type: 'bank',
            accountHolder: f.holder.trim(),
            bankName: f.bank.trim(),
            accountNumber: f.number.trim(),
            confirmAccountNumber: f.confirm.trim(),
            ifsc: f.ifsc.trim().toUpperCase(),
          }
        : { type: 'upi', accountHolder: f.holder.trim(), upiId: f.upi.trim() };
    setSaving(true);
    try {
      await onSaved(await withdrawApi.addAccount(input));
    } catch (e) {
      setServerError(errorMessage(e));
      setSaving(false);
    }
  };

  const field = (
    k: keyof typeof f,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <div className="wd-field">
      <label className="wd-label" htmlFor={`wd-${k}`}>
        {label}
      </label>
      <input
        id={`wd-${k}`}
        className={`wd-input${showErrors && errors[k] ? ' has-error' : ''}`}
        value={f[k]}
        onChange={set(k)}
        aria-invalid={showErrors && !!errors[k]}
        aria-describedby={`wd-${k}-err`}
        autoComplete="off"
        {...props}
      />
      {showErrors && errors[k] && (
        <p id={`wd-${k}-err`} className="wd-field-error" role="alert">
          {errors[k]}
        </p>
      )}
    </div>
  );

  return (
    <>
      <div className="wl-sheet-top">
        <button type="button" className="wd-back" onClick={onBack} disabled={saving}>
          ← Back
        </button>
      </div>
      <h2 className="wd-title">Add account</h2>

      <div className="wd-tabs" role="tablist" aria-label="Account type">
        {(['bank', 'upi'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={type === t}
            className={`wd-tab${type === t ? ' is-active' : ''}`}
            onClick={() => setType(t)}
          >
            {t === 'bank' ? 'Bank account' : 'UPI ID'}
          </button>
        ))}
      </div>

      {field('holder', 'Name on account', { autoCapitalize: 'words', placeholder: 'As shown in your bank' })}
      {type === 'bank' ? (
        <>
          {field('bank', 'Bank name', { placeholder: 'e.g. HDFC Bank' })}
          {field('number', 'Account number', { inputMode: 'numeric', maxLength: 18 })}
          {field('confirm', 'Confirm account number', { inputMode: 'numeric', maxLength: 18, onPaste: (e) => e.preventDefault() })}
          {field('ifsc', 'IFSC code', { autoCapitalize: 'characters', maxLength: 11, placeholder: 'HDFC0001234' })}
        </>
      ) : (
        field('upi', 'UPI ID', { placeholder: 'name@bank', autoCapitalize: 'none', inputMode: 'email' })
      )}

      <p className="wd-note">Only the last 4 digits of your account number are shown after you save it.</p>

      {serverError && (
        <p className="wl-error" role="alert">
          {serverError}
        </p>
      )}

      <button type="button" className="wl-btn wl-btn-block" onClick={() => void save()} disabled={saving}>
        {saving ? 'Saving…' : 'Save and use this account'}
      </button>
    </>
  );
};
