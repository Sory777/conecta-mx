import "server-only";
import type { StoreRepository } from "./repository";
import { localRepository } from "./local";
import { supabaseRepository } from "./supabase";

export type DataProvider = "local" | "supabase";

export function dataProvider(): DataProvider {
  return process.env.DATA_PROVIDER === "supabase" ? "supabase" : "local";
}

/** Punto único de acceso a datos para páginas, API y panel. */
export function repo(): StoreRepository {
  return dataProvider() === "supabase" ? supabaseRepository : localRepository;
}

export * from "./repository";
