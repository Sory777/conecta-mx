import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, ShieldAlert, Sparkles, X, XCircle } from 'lucide-react';
import type { MasteryState } from '../../shared/types';
import { MASTERY_LABEL } from '../lib/format';
import { ApiError } from '../lib/api';
import { navigate as navigateTo } from '../lib/router';

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

/** Progress state for AI generation, with messages that explain what is happening. */
export function Generating({ steps }: { steps: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, steps.length - 1)), 3500);
    return () => clearInterval(t);
  }, [steps.length]);
  return (
    <div role="status" aria-live="polite" className="card mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-10 text-center">
      <div className="relative">
        <div className="h-14 w-14 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
        <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-brand-600" aria-hidden />
      </div>
      <p className="text-lg font-semibold text-slate-900">{steps[i]}</p>
      <p className="text-sm text-slate-500">Esto puede tardar unos segundos.</p>
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof ApiError ? error.message : 'Ocurrió un error inesperado.';
  const code = error instanceof ApiError ? error.code : '';
  return (
    <div role="alert" className="card mx-auto flex max-w-lg flex-col items-center gap-3 px-6 py-8 text-center">
      <AlertTriangle className="h-8 w-8 text-amber-500" aria-hidden />
      <p className="font-medium text-slate-900">{message}</p>
      {code === 'ai_not_configured' && (
        <p className="text-sm text-slate-500">El administrador debe configurar la clave del proveedor de IA en el servidor.</p>
      )}
      {onRetry && (
        <button className="btn-secondary" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
      <div className="rounded-2xl bg-brand-50 p-3 text-brand-600">{icon}</div>
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="max-w-sm text-sm text-slate-500">{text}</p>
      {action}
    </div>
  );
}

const MASTERY_STYLE: Record<MasteryState, string> = {
  not_started: 'bg-slate-100 text-slate-600',
  learning: 'bg-sky-100 text-sky-800',
  needs_reinforcement: 'bg-amber-100 text-amber-900',
  mastered: 'bg-emerald-100 text-emerald-800',
};

export function MasteryBadge({ state }: { state: MasteryState }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${MASTERY_STYLE[state]}`}>
      {MASTERY_LABEL[state]}
    </span>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span className="font-semibold text-slate-700">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function Disclaimer({ text }: { text: string }) {
  return (
    <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{text}</span>
    </div>
  );
}

// ── Toasts ──
type ToastType = 'success' | 'error' | 'info';
const ToastCtx = createContext<(msg: string, type?: ToastType) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: ToastType }[]>([]);
  const idRef = useRef(0);
  const toast = useCallback((msg: string, type: ToastType = 'success') => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  const Icon = { success: CheckCircle2, error: XCircle, info: Info };
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((t) => {
          const I = Icon[t.type];
          return (
            <div key={t.id} className="pointer-events-auto flex max-w-md items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
              <I className={`h-4 w-4 shrink-0 ${t.type === 'error' ? 'text-rose-400' : t.type === 'success' ? 'text-emerald-400' : 'text-sky-300'}`} aria-hidden />
              <span>{t.msg}</span>
              <button aria-label="Cerrar" className="ml-1 text-slate-400 hover:text-white" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

// ── Dialog ──
export function Dialog({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="w-[calc(100%-2rem)] max-w-md rounded-2xl p-0 shadow-xl backdrop:bg-slate-900/40"
      aria-labelledby="dialog-title"
    >
      <div className="p-5">
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 id="dialog-title" className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          <button className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

/** Client-side redirect performed after render (never during it). */
export function Redirect({ to }: { to: string }) {
  useEffect(() => {
    navigateTo(to, true);
  }, [to]);
  return null;
}
