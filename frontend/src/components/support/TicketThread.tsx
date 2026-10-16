import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { TicketMessage } from '@/types/adminTicket';
import AttachmentDownload from './AttachmentDownload';

interface Props {
  messages: TicketMessage[];
  loading?: boolean;
  /** Set when the thread could not be loaded. */
  error?: string | null;
  onRetry?: () => void;
}

const ROLE_LABEL: Record<TicketMessage['sender']['role'], string> = {
  customer: 'Customer',
  partner: 'Partner',
  admin: 'Support',
};

const formatWhen = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
};

/** Only http(s) and same-site links are rendered as links; anything else (javascript:, data:) is dropped. */
const safeHref = (url: string): string | undefined =>
  /^(https?:\/\/|\/)/i.test(url) ? url : undefined;

/**
 * Read-only conversation for one ticket, oldest first. Shared: it only needs a message list, so the
 * customer and partner support screens can use it as well. Support (admin) messages sit on the right.
 */
export const TicketThread: React.FC<Props> = ({
  messages,
  loading,
  error,
  onRetry,
}) => {
  if (loading) {
    return (
      <div className="sup-state" role="status" aria-live="polite">
        <Loader2 size={20} className="sup-spin" aria-hidden />
        <p className="sup-muted">Loading conversation…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="sup-state sup-state--error" role="alert">
        <AlertCircle size={20} aria-hidden />
        <p>{error}</p>
        {onRetry && (
          <button type="button" className="sup-btn" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    );
  }
  if (messages.length === 0) {
    return (
      <div className="sup-state">
        <p className="sup-state__title">No messages yet</p>
        <p className="sup-muted">The conversation will appear here.</p>
      </div>
    );
  }
  return (
    <ol
      className="sup-thread"
      style={{ listStyle: 'none', margin: 0 }}
      aria-label="Conversation"
    >
      {messages.map((m) => (
        <li
          key={m.id}
          className={`sup-msg${m.sender.role === 'admin' ? ' sup-msg--admin' : ''}`}
        >
          <div className="sup-msg__meta">
            <span className="sup-msg__who">
              {m.sender.name || ROLE_LABEL[m.sender.role]}
            </span>
            <span>{ROLE_LABEL[m.sender.role]}</span>
            <time dateTime={m.createdAt}>{formatWhen(m.createdAt)}</time>
          </div>
          <div className="sup-msg__bubble">{m.body}</div>
          {m.attachments.length > 0 && (
            <div className="sup-msg__files">
              {m.attachments.map((a, i) => {
                if (/^\/api\/v1\/tickets\//.test(a.url))
                  return <AttachmentDownload key={i} file={a} admin />;
                const href = safeHref(a.url);
                return href ? (
                  <a
                    key={i}
                    className="sup-msg__file"
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {a.name}
                  </a>
                ) : (
                  <span key={i} className="sup-msg__file">
                    {a.name}
                  </span>
                );
              })}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
};

export default TicketThread;
