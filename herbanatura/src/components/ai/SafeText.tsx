import { Fragment, type ReactNode } from 'react';

/** Minimal, injection-proof renderer: paragraphs, "- " bullets, **bold**, and [Dn] citation chips. No HTML is ever interpreted. */
function inline(text: string, onCite?: (k: string) => void): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\[D\d{1,3}\])/g);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i}>{p.slice(2, -2)}</strong>;
    const m = p.match(/^\[(D\d{1,3})\]$/);
    if (m)
      return (
        <button key={i} type="button" onClick={() => onCite?.(m[1])} className="mx-0.5 rounded bg-accent-soft px-1 align-super text-[10px] font-semibold text-accent-strong hover:underline">
          {m[1]}
        </button>
      );
    return <Fragment key={i}>{p}</Fragment>;
  });
}

export function SafeText({ text, onCite }: { text: string; onCite?: (k: string) => void }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-3">
      {blocks.map((b, i) => {
        const lines = b.split('\n');
        if (lines.every((l) => /^\s*[-•]\s+/.test(l)))
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-•]\s+/, ''), onCite)}</li>)}
            </ul>
          );
        return (
          <div key={i} className="space-y-1">
            {lines.map((l, j) => (/^\s*[-•]\s+/.test(l) ? <p key={j} className="pl-4">• {inline(l.replace(/^\s*[-•]\s+/, ''), onCite)}</p> : <p key={j}>{inline(l, onCite)}</p>))}
          </div>
        );
      })}
    </div>
  );
}
