import { useId, useState } from 'react';
import { FILE_ACCEPT, validateFiles } from '@/features/support/attachments';

export default function AttachmentPicker({
  files,
  onChange,
  disabled = false,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="hcx-support-files">
      <label htmlFor={id}>
        Attachments <span className="hcx-support-muted">(optional)</span>
      </label>
      <input
        id={id}
        type="file"
        accept={FILE_ACCEPT}
        multiple
        disabled={disabled}
        aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
        aria-invalid={Boolean(error)}
        onChange={(event) => {
          const next = [...files, ...Array.from(event.target.files ?? [])];
          const issue = validateFiles(next);
          setError(issue);
          if (!issue) onChange(next);
          event.target.value = '';
        }}
      />
      <p id={`${id}-hint`} className="hcx-support-muted">
        Up to 3 images or PDFs. Maximum 5 MB each.
      </p>
      {error && (
        <p id={`${id}-error`} role="alert" className="hcx-support-error">
          {error}
        </p>
      )}
      {files.length > 0 && (
        <ul className="hcx-support-file-list">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`}>
              <span>
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </span>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove ${file.name}`}
                onClick={() => {
                  onChange(files.filter((_, i) => i !== index));
                  setError(null);
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
