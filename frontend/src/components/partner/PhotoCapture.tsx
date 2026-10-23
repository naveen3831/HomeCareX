import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { validatePhoto } from '@/lib/photoValidation';
import './jobVerification.css';

interface Props {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  /** Error from the server (for example "too large"), shown with the same style as local errors. */
  error?: string | null;
  label?: string;
  /** id of the element that describes this field, for screen readers. */
  describedBy?: string;
}

const formatSize = (bytes: number): string =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/**
 * Take a photo with the camera or pick one from the gallery. The file is checked here first
 * (JPG/PNG, not empty, 5 MB or less) so the partner finds out before uploading, but the server
 * checks again and has the final say.
 */
export default function PhotoCapture({
  file,
  onChange,
  disabled = false,
  error = null,
  label = 'Start photo',
  describedBy,
}: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Preview URL lives only as long as the file, and is always released.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handlePick = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const picked = e.target.files?.[0] ?? null;
    e.target.value = ''; // lets the same file be chosen again after an error
    if (!picked) return;
    const problem = await validatePhoto(picked);
    setLocalError(problem);
    onChange(problem ? null : picked);
  };

  const remove = (): void => {
    setLocalError(null);
    onChange(null);
  };

  const shownError = error ?? localError;
  const errorId = shownError ? 'photo-capture-error' : undefined;
  const describedIds = [describedBy, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="photo-cap" role="group" aria-label={label} aria-describedby={describedIds}>
      {previewUrl && file ? (
        <figure className="photo-cap-preview">
          <img src={previewUrl} alt={`${label} preview`} className="photo-cap-img" />
          <figcaption className="photo-cap-meta">
            {file.name} · {formatSize(file.size)}
          </figcaption>
        </figure>
      ) : (
        <p className="photo-cap-empty">No photo yet. JPG or PNG, up to 5 MB.</p>
      )}

      <div className="photo-cap-actions">
        <button type="button" className="photo-cap-btn photo-cap-btn-primary" disabled={disabled} onClick={() => cameraRef.current?.click()}>
          {file ? 'Retake photo' : 'Take photo'}
        </button>
        <button
          type="button"
          className="photo-cap-btn"
          disabled={disabled}
          onClick={() => galleryRef.current?.click()}
        >
          Choose from gallery
        </button>
        {file && (
          <button type="button" className="photo-cap-btn" disabled={disabled} onClick={remove}>
            Remove
          </button>
        )}
      </div>

      {/* Visually hidden file inputs: the buttons above are the keyboard-reachable controls. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        className="photo-cap-input"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="photo-camera-input"
        onChange={(e) => void handlePick(e)}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png"
        className="photo-cap-input"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="photo-gallery-input"
        onChange={(e) => void handlePick(e)}
      />

      {shownError && (
        <p id="photo-capture-error" className="photo-cap-error" role="alert">
          {shownError}
        </p>
      )}
    </div>
  );
}
