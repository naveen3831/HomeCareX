import { useState } from 'react';
import { Download } from 'lucide-react';
import { supportApi } from '@/services/supportApi';
import { problem, type Evidence } from '@/features/support/types';

export default function AttachmentDownload({
  file,
  admin = false,
}: {
  file: Evidence;
  admin?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <span className="hcx-support-download">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          setError('');
          try {
            await supportApi.download(file.url, file.name, admin);
          } catch (err) {
            setError(problem(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Download size={15} aria-hidden="true" />
        {busy ? 'Downloading…' : file.name}
      </button>
      {error && <span role="alert">{error}</span>}
    </span>
  );
}
