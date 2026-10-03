import 'server-only';
import { getRepository } from '@/lib/data';
import type { EntityType } from '@/lib/domain/types';

export async function entityOptions(types?: EntityType[]): Promise<[string, string][]> {
  const { items } = await getRepository().listEntities({ limit: 10000 });
  return items.filter((i) => !types || types.includes(i.type)).map((i) => [i.id, `${i.name.es} (${i.type})`]);
}

export async function sourceOptions(): Promise<[string, string][]> {
  return (await getRepository().listSources()).map((s) => [s.id, `${s.title} — ${s.publisher}`]);
}
