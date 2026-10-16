import { useCallback, useEffect, useRef, useState } from 'react';

type ToastState = { text: string; tone: 'success' | 'error' } | null;

/** Small status toast (announced to screen readers) like the other admin pages use. */
export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<number>();

  const show = useCallback((text: string, tone: 'success' | 'error' = 'success') => {
    setToast({ text, tone });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 5500);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const node = toast ? (
    <div className={`rbac-toast rbac-toast--${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
      {toast.text}
    </div>
  ) : null;

  return { show, node };
}
