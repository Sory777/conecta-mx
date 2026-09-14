import type { ReactNode } from 'react';
import { SearchX } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  message?: string;
  action?: ReactNode;
}

export function EmptyState({ title = 'Sin resultados', message = 'No encontramos lo que buscabas.', action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded border border-dashed border-line bg-surface px-6 py-16 text-center">
      <div className="rounded-full border border-gold/30 p-4 text-gold">
        <SearchX className="h-8 w-8" />
      </div>
      <h3 className="text-base font-bold">{title}</h3>
      <p className="max-w-sm text-sm text-muted">{message}</p>
      {action}
    </div>
  );
}
