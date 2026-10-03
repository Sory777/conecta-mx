import 'server-only';
import { SEED } from '@/data/seed';
import type { KnowledgeRepository } from './repository';
import { SeedRepository } from './seed-repository';
import { SupabaseRepository } from './supabase-repository';
import { isSupabaseConfigured } from '@/lib/env';

let seedRepo: SeedRepository | null = null;

/** Returns the Supabase-backed repository when configured, the demo dataset otherwise. */
export function getRepository(): KnowledgeRepository {
  if (isSupabaseConfigured()) return new SupabaseRepository();
  seedRepo ??= new SeedRepository(SEED);
  return seedRepo;
}

export type { KnowledgeRepository } from './repository';
