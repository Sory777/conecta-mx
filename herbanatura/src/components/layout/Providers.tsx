'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Locale } from '@/lib/domain/types';
import type { Dictionary } from '@/lib/i18n/dictionaries';

const Ctx = createContext<{ locale: Locale; dict: Dictionary } | null>(null);

export function I18nProvider({ locale, dict, children }: { locale: Locale; dict: Dictionary; children: ReactNode }) {
  return <Ctx.Provider value={{ locale, dict }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside I18nProvider');
  return v;
}
