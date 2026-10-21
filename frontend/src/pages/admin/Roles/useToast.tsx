import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

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

/**
 * A form page (create role, invite staff) sends its success message back through navigation
 * state. Show it once, then clear it so a refresh doesn't repeat it.
 */
export function useFlashToast(show: (text: string, tone?: 'success' | 'error') => void) {
  const location = useLocation();
  const navigate = useNavigate();
  const flash = (location.state as { toast?: string } | null)?.toast;
  useEffect(() => {
    if (!flash) return;
    show(flash);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash]);
}
