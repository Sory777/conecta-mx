import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: string;
}

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    // Focus the modal container on open
    setTimeout(() => modalRef.current?.focus(), 50);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Diálogo'}
        className={`card relative z-10 w-full ${maxWidth} max-h-[92vh] overflow-y-auto rounded-t sm:rounded shadow-2xl animate-fade-up focus:outline-none`}
      >
        {title && (
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/95 px-5 py-3.5 backdrop-blur">
            <h3 className="text-base font-bold">{title}</h3>
            <button onClick={onClose} className="rounded p-1.5 text-muted hover:bg-surface-soft hover:text-ink dark:hover:text-ink-invert" aria-label="Cerrar">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        {!title && (
          <button onClick={onClose} className="absolute right-3 top-3 z-10 rounded p-1.5 text-muted hover:bg-surface-soft hover:text-ink dark:hover:text-ink-invert" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
