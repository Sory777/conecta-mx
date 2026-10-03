'use client';

import { useSyncExternalStore } from 'react';
import type { EntityType } from '@/lib/domain/types';

/**
 * Local-first user data. Everything lives in this browser by default — including
 * the health profile, which never leaves the device unless the user opts in to
 * cloud sync. All access is wrapped: storage may be unavailable (private mode).
 */

export interface SavedEntity {
  slug: string;
  type: EntityType;
  name: string;
  savedAt: string;
}

export interface HealthProfile {
  ageBand?: '<18' | '18-39' | '40-64' | '65+';
  sex?: 'female' | 'male' | 'intersex' | 'undisclosed';
  pregnant: boolean;
  breastfeeding: boolean;
  /** Medication entity slugs. */
  medications: string[];
  conditionFlags: ConditionFlag[];
  allergies: string;
}

export const CONDITION_FLAGS = [
  'liver_disease',
  'kidney_disease',
  'bleeding_disorder',
  'diabetes',
  'upcoming_surgery',
  'cancer_treatment',
  'asteraceae_allergy',
  'transplant',
] as const;
export type ConditionFlag = (typeof CONDITION_FLAGS)[number];

export interface Collection {
  id: string;
  name: string;
  items: SavedEntity[];
}

export interface SavedStudy {
  ref: string; // pmid:123 | nct:NCT00000000
  title: string;
  url: string;
  savedAt: string;
}

export interface UserData {
  favorites: SavedEntity[];
  history: { query: string; at: string }[];
  viewed: SavedEntity[];
  collections: Collection[];
  savedStudies: SavedStudy[];
  health: HealthProfile | null;
  historyEnabled: boolean;
}

const KEY = 'herbanatura:user:v1';
const EMPTY: UserData = { favorites: [], history: [], viewed: [], collections: [], savedStudies: [], health: null, historyEnabled: true };

let cache: UserData | null = null;
const listeners = new Set<() => void>();

function read(): UserData {
  if (cache) return cache;
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(KEY) : null;
    cache = raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache!;
}

function write(next: UserData) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage unavailable: keep in memory for this session
  }
  listeners.forEach((l) => l());
}

export const userStore = {
  get: read,
  update(fn: (d: UserData) => UserData) {
    write(fn(read()));
  },
  toggleFavorite(e: Omit<SavedEntity, 'savedAt'>) {
    this.update((d) => ({
      ...d,
      favorites: d.favorites.some((f) => f.slug === e.slug)
        ? d.favorites.filter((f) => f.slug !== e.slug)
        : [{ ...e, savedAt: new Date().toISOString() }, ...d.favorites],
    }));
  },
  recordSearch(query: string) {
    const q = query.trim().slice(0, 200);
    if (!q) return;
    this.update((d) => (d.historyEnabled ? { ...d, history: [{ query: q, at: new Date().toISOString() }, ...d.history.filter((h) => h.query !== q)].slice(0, 50) } : d));
  },
  recordView(e: Omit<SavedEntity, 'savedAt'>) {
    this.update((d) => (d.historyEnabled ? { ...d, viewed: [{ ...e, savedAt: new Date().toISOString() }, ...d.viewed.filter((v) => v.slug !== e.slug)].slice(0, 50) } : d));
  },
  setHealth(h: HealthProfile | null) {
    this.update((d) => ({ ...d, health: h }));
  },
  toggleStudy(s: Omit<SavedStudy, 'savedAt'>) {
    this.update((d) => ({
      ...d,
      savedStudies: d.savedStudies.some((x) => x.ref === s.ref) ? d.savedStudies.filter((x) => x.ref !== s.ref) : [{ ...s, savedAt: new Date().toISOString() }, ...d.savedStudies],
    }));
  },
  export(): string {
    return JSON.stringify({ exportedAt: new Date().toISOString(), app: 'HerbaNatura', data: read() }, null, 2);
  },
  clear() {
    try {
      window.localStorage.removeItem(KEY);
    } catch {}
    write(EMPTY);
  },
};

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

export function useUserData(): UserData {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
