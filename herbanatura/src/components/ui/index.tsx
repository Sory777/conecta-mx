import type { ReactNode } from 'react';

export function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 ${className}`}>{children}</div>;
}

export function Card({ children, className = '', as: Tag = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'article' | 'section' | 'li' }) {
  return <Tag className={`rounded-2xl border border-border bg-surface p-5 shadow-[0_1px_0_rgb(0_0_0/0.02)] ${className}`}>{children}</Tag>;
}

export function SectionTitle({ children, id, sub }: { children: ReactNode; id?: string; sub?: ReactNode }) {
  return (
    <div className="mb-4 mt-10 first:mt-0">
      <h2 id={id} className="scroll-mt-24 text-2xl font-semibold text-text">
        {children}
      </h2>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
  );
}

const PILL = {
  neutral: 'bg-surface-2 text-text border-border',
  accent: 'bg-accent-soft text-accent-strong border-transparent',
  warn: 'bg-warn-soft text-warn border-transparent',
  danger: 'bg-danger-soft text-danger border-transparent',
  info: 'bg-info-soft text-info border-transparent',
};

export function Pill({ children, tone = 'neutral', title }: { children: ReactNode; tone?: keyof typeof PILL; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${PILL[tone]}`}>
      {children}
    </span>
  );
}

const NOTICE = {
  info: 'border-info/30 bg-info-soft text-text',
  warn: 'border-warn/40 bg-warn-soft text-text',
  danger: 'border-danger/40 bg-danger-soft text-text',
  accent: 'border-accent/30 bg-accent-soft text-text',
};

export function Notice({ children, tone = 'info', title, role }: { children: ReactNode; tone?: keyof typeof NOTICE; title?: ReactNode; role?: 'alert' | 'note' }) {
  return (
    <div role={role ?? (tone === 'danger' ? 'alert' : 'note')} className={`rounded-xl border p-4 text-sm ${NOTICE[tone]}`}>
      {title && <p className="mb-1 font-semibold">{title}</p>}
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return <p className="text-sm italic text-muted">{children}</p>;
}

export function DefinitionRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-border/60 py-2 last:border-0 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-muted">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export function ExternalLink({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`underline decoration-accent/40 underline-offset-2 hover:decoration-accent ${className}`}>
      {children}
      <span aria-hidden> ↗</span>
    </a>
  );
}
