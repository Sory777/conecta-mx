import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';
interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastCtx {
  toast: (message: string, type?: ToastType) => void;
}

const Ctx = createContext<ToastCtx>({ toast: () => {} });

export function useToast() {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => remove(id), 3500);
  }, [remove]);

  const icon = (type: ToastType) => {
    if (type === 'success') return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    if (type === 'error') return <XCircle className="h-5 w-5 text-rose-500" />;
    return <Info className="h-5 w-5 text-gold" />;
  };

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed right-4 top-4 z-[100] flex flex-col gap-2" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="card animate-toast-in flex items-start gap-3 px-4 py-3 shadow-lg min-w-[260px] max-w-[calc(100vw-2rem)]"
          >
            {icon(t.type)}
            <p className="flex-1 text-sm font-medium">{t.message}</p>
            <button onClick={() => remove(t.id)} className="text-muted hover:text-ink dark:hover:text-ink-invert" aria-label="Cerrar">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
