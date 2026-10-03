'use client';

import { useEffect, useState } from 'react';
import { useI18n } from './Providers';

type Mode = 'general' | 'simple' | 'researcher';
const KEY = 'herbanatura:mode';

/** Inline script run before paint so the chosen mode never flickers. */
export const MODE_BOOTSTRAP = `try{var m=localStorage.getItem('${KEY}');if(m)document.documentElement.dataset.mode=m}catch(e){}`;

export function ModeToggle({ compact = false }: { compact?: boolean }) {
  const { dict } = useI18n();
  const [mode, setMode] = useState<Mode>('general');
  useEffect(() => {
    setMode((document.documentElement.dataset.mode as Mode) || 'general');
  }, []);
  const choose = (m: Mode) => {
    setMode(m);
    document.documentElement.dataset.mode = m;
    try {
      localStorage.setItem(KEY, m);
    } catch {}
  };
  const modes: Mode[] = ['general', 'simple', 'researcher'];
  return (
    <div role="radiogroup" aria-label={dict.modes.label} className="inline-flex rounded-full border border-border bg-surface p-0.5 text-xs">
      {modes.map((m) => (
        <button
          key={m}
          role="radio"
          aria-checked={mode === m}
          onClick={() => choose(m)}
          className={`rounded-full px-3 py-1.5 font-medium transition ${mode === m ? 'bg-accent text-white' : 'text-muted hover:text-text'}`}
        >
          {compact ? dict.modes[m].split(' ')[0] : dict.modes[m]}
        </button>
      ))}
    </div>
  );
}
