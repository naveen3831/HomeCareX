import { useEffect, useRef, useState } from "react";

interface Props {
  title: string;
  /** Short lines shown under the title, e.g. "3 cities · 25 km radius". */
  details: string[];
  onClose: () => void;
}

/** Success pop-up. Focus moves to the button, Esc / backdrop / button close it, and focus returns afterwards. */
export default function SavedDialog({ title, details, onClose }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    buttonRef.current?.focus();
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => {
      cancelAnimationFrame(raf);
      previous?.focus?.();
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 transition-opacity duration-200 motion-reduce:transition-none ${
        entered ? "opacity-100" : "opacity-0"
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        // single focusable control: keep Tab inside the dialog
        if (e.key === "Tab") {
          e.preventDefault();
          buttonRef.current?.focus();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-dialog-title"
        aria-describedby="saved-dialog-desc"
        className={`w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl transition duration-200 motion-reduce:transition-none ${
          entered ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg
            viewBox="0 0 24 24"
            className="h-9 w-9 text-green-600"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2
          id="saved-dialog-title"
          className="text-lg font-semibold text-brand"
        >
          {title}
        </h2>
        <div
          id="saved-dialog-desc"
          className="mt-2 space-y-1 text-sm text-muted"
        >
          {details.map((d) => (
            <p key={d} className="break-words">
              {d}
            </p>
          ))}
        </div>
        <button
          ref={buttonRef}
          type="button"
          onClick={onClose}
          className="mt-6 min-h-[44px] w-full rounded-lg bg-brand-500 px-5 text-sm font-medium text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          Done
        </button>
      </div>
    </div>
  );
}
