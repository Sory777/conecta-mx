'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { userStore } from '@/lib/user/local-store';
import { useI18n } from '@/components/layout/Providers';

export function SearchBox({ initial = '', size = 'md', autoFocus = false }: { initial?: string; size?: 'md' | 'lg'; autoFocus?: boolean }) {
  const { dict, locale } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const lg = size === 'lg';
  return (
    <form
      role="search"
      action={`/${locale}/buscar`}
      onSubmit={(e) => {
        e.preventDefault();
        const query = q.trim();
        if (!query) return;
        userStore.recordSearch(query);
        router.push(`/${locale}/buscar?q=${encodeURIComponent(query)}`);
      }}
      className={`flex w-full items-center gap-2 rounded-full border border-border bg-surface shadow-sm focus-within:ring-2 focus-within:ring-accent ${lg ? 'p-2 pl-5' : 'p-1 pl-4'}`}
    >
      <span aria-hidden className={lg ? 'text-xl' : ''}>
        🔎
      </span>
      <label className="sr-only" htmlFor="hn-q">
        {dict.search.placeholder}
      </label>
      <input
        id="hn-q"
        name="q"
        value={q}
        autoFocus={autoFocus}
        maxLength={500}
        onChange={(e) => setQ(e.target.value)}
        placeholder={dict.search.placeholder}
        className={`min-w-0 flex-1 bg-transparent text-text placeholder:text-muted focus:outline-none ${lg ? 'py-2 text-base sm:text-lg' : 'py-1.5 text-sm'}`}
      />
      <button type="submit" className={`rounded-full bg-accent font-semibold text-white hover:bg-accent-strong ${lg ? 'px-5 py-2.5' : 'px-4 py-1.5 text-sm'}`}>
        {dict.search.button}
      </button>
    </form>
  );
}
