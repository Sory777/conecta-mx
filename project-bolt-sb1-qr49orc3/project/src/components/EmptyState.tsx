import type { ReactNode } from 'react';
import { SearchX } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  message?: string;
  action?: ReactNode;
}

export function EmptyState({ title = 'Sin resultados', message = 'No encontramos lo que buscabas.', action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
      <div className="rounded-full bg-slate-100 p-4">
        <SearchX className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="text-base font-bold text-slate-700">{title}</h3>
      <p className="max-w-sm text-sm text-slate-500">{message}</p>
      {action}
    </div>
  );
}
