import React, { useState } from 'react';
import { Loader2, Lock, Send } from 'lucide-react';

export const MAX_REPLY_LENGTH = 4000;

interface Props {
  /** Closed tickets take no more messages. */
  disabled?: boolean;
  disabledReason?: string;
  /** Rejects on failure; the box keeps the text so nothing the agent typed is lost. */
  onSend: (input: { body: string; internal: boolean }) => Promise<void>;
}

/** Reply to the requester, or leave an internal note the requester never sees. Ctrl/Cmd+Enter sends. */
export const TicketReplyBox: React.FC<Props> = ({ disabled, disabledReason, onSend }) => {
  const [mode, setMode] = useState<'reply' | 'note'>('reply');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const internal = mode === 'note';
  const trimmed = text.trim();
  const canSend = !disabled && !sending && trimmed.length > 0 && trimmed.length <= MAX_REPLY_LENGTH;

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      await onSend({ body: trimmed, internal });
      setText('');
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setError(err?.response?.data?.message || err?.message || 'Could not send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (disabled) {
    return <p className="sup-reply__closed" role="status">{disabledReason ?? 'This ticket is closed.'}</p>;
  }

  return (
    <div className={`sup-reply${internal ? ' sup-reply--note' : ''}`}>
      <div className="sup-reply__tabs" role="tablist" aria-label="Message type">
        <button type="button" role="tab" aria-selected={!internal} className="sup-reply__tab" onClick={() => setMode('reply')}>
          Reply to requester
        </button>
        <button type="button" role="tab" aria-selected={internal} className="sup-reply__tab" onClick={() => setMode('note')}>
          <Lock size={13} aria-hidden /> Internal note
        </button>
      </div>
      <textarea
        className="sup-reply__input"
        rows={4}
        value={text}
        maxLength={MAX_REPLY_LENGTH}
        placeholder={internal ? 'Only agents can see this note…' : 'Write a reply. The requester sees it right away…'}
        aria-label={internal ? 'Internal note' : 'Reply to requester'}
        disabled={sending}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void send();
          }
        }}
      />
      {error && <p className="sup-reply__error" role="alert">{error}</p>}
      <div className="sup-reply__bar">
        <span className="sup-muted">{internal ? 'Not visible to the requester' : 'Visible to the requester'} · Ctrl+Enter to send</span>
        <button type="button" className="sup-btn sup-btn--primary" disabled={!canSend} onClick={() => void send()}>
          {sending ? <Loader2 size={16} className="sup-spin" aria-hidden /> : <Send size={16} aria-hidden />}
          {internal ? 'Add note' : 'Send reply'}
        </button>
      </div>
    </div>
  );
};

export default TicketReplyBox;