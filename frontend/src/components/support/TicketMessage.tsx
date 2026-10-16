import AttachmentDownload from './AttachmentDownload';
import { when, type CustomerMessage } from '@/features/support/types';

export default function TicketMessage({
  message,
}: {
  message: CustomerMessage;
}) {
  const support = message.senderRole === 'admin';
  return (
    <li
      className={`hcx-support-message${support ? ' hcx-support-message--staff' : ''}`}
    >
      <div className="hcx-support-message-meta">
        <strong>{support ? 'HomeCareX support' : 'You'}</strong>
        <time dateTime={message.createdAt}>{when(message.createdAt)}</time>
      </div>
      <p>{message.body}</p>
      {message.attachments.map((file, index) => (
        <AttachmentDownload key={`${file.url}-${index}`} file={file} />
      ))}
    </li>
  );
}
