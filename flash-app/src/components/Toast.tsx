import { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';

/** Global toast, mirroring the prototype's #toast + toast(msg). */
export default function Toast() {
  const toast = useAppStore((s) => s.toast);
  const hideToast = useAppStore((s) => s.hideToast);

  useEffect(() => {
    if (!toast) return;
    const { id } = toast;
    const timer = window.setTimeout(() => {
      hideToast(id);
    }, 2200);
    return () => {
      window.clearTimeout(timer);
    };
  }, [toast, hideToast]);

  return (
    <div className={`toast${toast ? ' show' : ''}`} data-testid="toast" role="status" aria-live="polite">
      {toast?.msg ?? ''}
    </div>
  );
}
