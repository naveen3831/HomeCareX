import { useRef, useState, type FormEvent } from 'react';
import AttachmentPicker from './AttachmentPicker';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { problem } from '@/features/support/types';
import { validateFiles } from '@/features/support/attachments';

export default function TicketReplyForm({
  onSend,
  closed = false,
}: {
  onSend: (body: string, files: File[]) => Promise<void>;
  closed?: boolean;
}) {
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const locked = useRef(false);
  const online = useOnlineStatus();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current || !online || closed) return;
    const issue = validateFiles(files);
    if (issue || !body.trim()) {
      setError(issue ?? 'Enter a message.');
      return;
    }
    locked.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await onSend(body.trim(), files);
      setBody('');
      setFiles([]);
      setNotice('Reply sent.');
    } catch (err) {
      setError(problem(err));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  if (closed)
    return (
      <p className="hcx-support-notice">
        This ticket is resolved or closed. You can create a new ticket if you
        need more help.
      </p>
    );
  return (
    <form
      className="hcx-support-form hcx-support-reply"
      onSubmit={(event) => void submit(event)}
    >
      <label htmlFor="support-reply">Your reply</label>
      <textarea
        id="support-reply"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={4000}
        rows={4}
        required
        disabled={busy}
      />
      <AttachmentPicker
        files={files}
        onChange={setFiles}
        disabled={busy || !online}
      />
      {error && (
        <p className="hcx-support-error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!online && (
        <p role="status">
          You’re offline. Your reply stays here until you reconnect.
        </p>
      )}
      <button
        className="hcx-support-primary"
        type="submit"
        disabled={busy || !online || !body.trim()}
      >
        {busy ? 'Sending…' : 'Send reply'}
      </button>
    </form>
  );
}
