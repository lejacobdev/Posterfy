/** Lightweight toast system: a provider, a hook and the rendered stack. */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { uid } from '@/lib/utils/misc';
import { Icon, type IconName } from './Icon';
import './Toast.css';

export type ToastTone = 'info' | 'success' | 'error';

export interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
  duration: number;
}

interface ToastContextValue {
  toasts: Toast[];
  notify: (message: string, tone?: ToastTone, duration?: number) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_ICONS: Record<ToastTone, IconName> = {
  info: 'info',
  success: 'checkCircle',
  error: 'alert',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const notify = useCallback(
    (message: string, tone: ToastTone = 'info', duration = 4000) => {
      const id = uid('toast');
      // Cap the stack so a burst of errors can't cover the whole screen.
      setToasts((current) => [...current.slice(-2), { id, message, tone, duration }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      );
      return id;
    },
    [dismiss],
  );

  // Clear pending timers if the provider unmounts mid-flight.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const value = useMemo(() => ({ toasts, notify, dismiss }), [toasts, notify, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="toast-viewport" role="region" aria-live="polite" aria-label="Notifications">
      {toasts.map((toast) => (
        <output key={toast.id} className={`toast glass toast--${toast.tone}`}>
          <Icon name={TONE_ICONS[toast.tone]} size={18} className="toast__icon" />
          <span className="toast__message">{toast.message}</span>
          <button
            type="button"
            className="toast__close"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss"
          >
            <Icon name="close" size={16} />
          </button>
        </output>
      ))}
    </div>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside a ToastProvider');
  return context;
}
