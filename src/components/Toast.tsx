import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

type ToastProps = {
  message: string;
  /** Ação opcional (ex.: "Desfazer"). */
  actionLabel?: string;
  onAction?: () => void;
  dismissLabel: string;
  onDismiss: () => void;
  /** Some sozinho depois disso (ms). */
  duration?: number;
};

/**
 * Aviso efêmero, um por vez, no canto inferior. `role="status"` anuncia sem
 * roubar o foco; Esc dispensa. Usado pro "Desfazer" depois de apagar o
 * conteúdo do projeto.
 */
export default function Toast({
  message,
  actionLabel,
  onAction,
  dismissLabel,
  onDismiss,
  duration = 10000,
}: ToastProps) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const timer = window.setTimeout(() => onDismissRef.current(), duration);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismissRef.current();
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [duration]);

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-md border border-line-strong bg-ink-raised py-2 pl-4 pr-2 text-sm text-chalk shadow-overlay"
    >
      <span>{message}</span>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={() => {
            onAction();
            onDismiss();
          }}
          className="btn btn-secondary btn-sm"
        >
          {actionLabel}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label={dismissLabel}
        title={dismissLabel}
        className="btn btn-ghost btn-sm btn-icon"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>,
    document.body,
  );
}
