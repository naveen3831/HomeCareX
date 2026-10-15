import React, { useEffect, useRef } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { TicketMessage } from '@/types/adminTicket';

interface Props {
  messages: TicketMessage[];
  loading?: boolean;
  /** Set when the thread could not be loaded. */
  error?: string | null;
  onRetry?: () => void;
  /** Scroll to the newest message when the list grows (live conversations). Off by default. */
  autoScroll?: boolean;
}

const ROLE_LABEL: Record<TicketMessage['sender']['role'], string> = {
  customer: 'Customer',
  partner: 'Partner',
  admin: 'Support',
};

const formatWhen = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
};

/** Only http(s) and same-site links are rendered as links; anything else (javascript:, data:) is dropped. */
const safeHref = (url: string): string | undefined => (/^(https?:\/\/|\/)/i.test(url) ? url : undefined);

/**
 * Read-only conversation for one ticket, oldest first. Shared: it only needs a message list, so the
 * customer and partner support screens can use it as well. Support (admin) messages sit on the right.
 */
export const TicketThread: React.FC<Props> = ({ messages, loading, error, onRetry, autoScroll }) => {
  const endRef = useRef<HTMLLIElement>(null);
  const count = messages.length;
  useEffect(() => {
    if (autoScroll && count > 0) endRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [autoScroll, count]);

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
        {onRetry && <button type="button" className="sup-btn" onClick={onRetry}>Try again</button>}
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
    <ol className="sup-thread" style={{ listStyle: 'none', margin: 0 }} aria-label="Conversation" aria-live="polite" aria-relevant="additions">
      {messages.map((m) => (
        <li key={m.id} className={`sup-msg${m.sender.role === 'admin' ? ' sup-msg--admin' : ''}${m.internal ? ' sup-msg--internal' : ''}`}>
          <div className="sup-msg__meta">
            <span className="sup-msg__who">{m.sender.name || ROLE_LABEL[m.sender.role]}</span>
            <span>{ROLE_LABEL[m.sender.role]}</span>
            {m.internal && <span className="sup-msg__tag">Internal note · not visible to the customer</span>}
            <time dateTime={m.createdAt}>{formatWhen(m.createdAt)}</time>
          </div>
          <div className="sup-msg__bubble">{m.body}</div>
          {m.attachments.length > 0 && (
            <div className="sup-msg__files">
              {m.attachments.map((a, i) => {
                const href = safeHref(a.url);
                return href ? (
                  <a key={i} className="sup-msg__file" href={href} target="_blank" rel="noopener noreferrer">{a.name}</a>
                ) : (
                  <span key={i} className="sup-msg__file">{a.name}</span>
                );
              })}
            </div>
          )}
        </li>
      ))}
      <li ref={endRef} aria-hidden style={{ height: 0 }} />
    </ol>
  );
};

export default TicketThread;