import { z } from 'zod';
import { regionOf } from '../../../../shared/world';

// Esquema de un EPISODIO (misterio). Todo el contenido se define como datos:
// añadir un misterio = añadir un JSON válido (archivo en /content/episodes o subida desde el panel admin).

const Id = z.string().regex(/^[a-z0-9_]{2,48}$/, 'ids en minúsculas, números y _');
const Vec3 = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
const Text = (max: number) => z.string().min(1).max(max);

export const ConditionSchema = z.union([
  z.strictObject({ stage: Id }),
  z.strictObject({ stageIn: z.array(Id).min(1) }),
  z.strictObject({ hasItem: Id }),
  z.strictObject({ notHasItem: Id }),
  z.strictObject({ hasClue: Id }),
  z.strictObject({ notHasClue: Id }),
  z.strictObject({ flag: Id }),
  z.strictObject({ notFlag: Id }),
  z.strictObject({ night: z.boolean() }),
  z.strictObject({ status: z.enum(['available', 'active', 'completed']) }),
]);
export type Condition = z.infer<typeof ConditionSchema>;

export const ActionSchema = z.union([
  z.strictObject({ start: z.literal(true) }),
  z.strictObject({ dialogue: z.array(z.strictObject({ speaker: Text(40), text: Text(500) })).min(1) }),
  z.strictObject({ message: Text(400) }),
  z.strictObject({ giveItem: Id, qty: z.number().int().min(1).max(10).optional() }),
  z.strictObject({ takeItem: Id }),
  z.strictObject({ giveClue: Id }),
  z.strictObject({ setFlag: Id }),
  z.strictObject({ clearFlag: Id }),
  z.strictObject({ setStage: Id }),
  z.strictObject({ teleport: Vec3, rotY: z.number().finite().optional() }),
  z.strictObject({ openPuzzle: Id }),
  z.strictObject({ complete: z.literal(true) }),
]);
export type Action = z.infer<typeof ActionSchema>;

const AppearanceSchema = z.strictObject({
  skin: z.string(),
  hair: z.string(),
  coat: z.string(),
  pants: z.string(),
  hat: z.string().nullable().optional(),
  outfit: z.string().nullable().optional(),
  lantern: z.string().nullable().optional(),
  hairStyle: z.enum(['short', 'long', 'bun', 'bald']).optional(),
  beard: z.boolean().optional(),
});

export const EpisodeSchema = z
  .strictObject({
    id: Id,
    version: z.number().int().min(1),
    order: z.number().int().min(0).default(100),
    enabled: z.boolean().default(true),
    repeatable: z.boolean().default(false),
    title: Text(80),
    synopsis: Text(600),
    seasonId: Id.nullable().default(null),
    prerequisites: z.array(Id).default([]),
    availability: z
      .strictObject({ startsAt: z.string().nullable().default(null), endsAt: z.string().nullable().default(null) })
      .default({ startsAt: null, endsAt: null }),
    location: z.strictObject({ label: Text(60), p: Vec3 }),
    start: z.strictObject({ target: Id, objective: Text(200), hint: Text(300) }),
    npcs: z
      .array(z.strictObject({ id: Id, name: Text(40), p: Vec3, rotY: z.number().finite().default(0), appearance: AppearanceSchema }))
      .default([]),
    clues: z.array(z.strictObject({ id: Id, title: Text(80), text: Text(800), shareable: z.boolean().default(true) })).default([]),
    entities: z
      .array(
        z.strictObject({
          id: Id,
          kind: z.enum(['inspect', 'pickup', 'door', 'puzzle', 'exit', 'trigger']),
          label: Text(60),
          model: z.string().max(40).default('none'),
          p: Vec3,
          rotY: z.number().finite().default(0),
          radius: z.number().min(0.5).max(10).default(2.5),
          blockSize: z.tuple([z.number().positive(), z.number().positive()]).optional(),
          visibleWhen: z.array(ConditionSchema).default([]),
          blockingWhen: z.array(ConditionSchema).optional(),
          highlightWhen: z.array(ConditionSchema).default([]),
          idleText: Text(300).optional(),
        }),
      )
      .default([]),
    puzzles: z
      .array(
        z.strictObject({
          id: Id,
          entityId: Id,
          title: Text(60),
          prompt: Text(400),
          inputHint: Text(40),
          answers: z.array(z.string().min(1).max(40)).min(1),
          maxAttemptsPerMinute: z.number().int().min(1).max(30).default(5),
          requires: z.array(ConditionSchema).default([]),
          onSolve: z.array(ActionSchema).min(1),
          coop: z.boolean().default(false),
        }),
      )
      .default([]),
    stages: z
      .array(z.strictObject({ id: Id, title: Text(60), objective: Text(200), hint: Text(300), marker: z.union([Id, Vec3]).nullable().default(null) }))
      .min(1),
    interactions: z
      .array(
        z.strictObject({
          target: Id,
          whenStatus: z.enum(['available', 'active', 'completed', 'any']).default('active'),
          when: z.array(ConditionSchema).default([]),
          do: z.array(ActionSchema).min(1),
          coop: z.boolean().default(false),
        }),
      )
      .min(1),
    rewards: z.strictObject({
      coins: z.number().int().min(0).max(10_000),
      rp: z.number().int().min(0).max(5_000),
      xp: z.number().int().min(0).max(100_000),
      seasonXp: z.number().int().min(0).max(100_000),
      items: z.array(z.strictObject({ itemId: Id, qty: z.number().int().min(1).max(10) })).default([]),
      dropTable: z.string().nullable().default(null),
    }),
  })
  .superRefine((ep, ctx) => {
    const err = (message: string) => ctx.addIssue({ code: 'custom', message });
    const uniq = (label: string, ids: string[]) => {
      const seen = new Set<string>();
      for (const id of ids) {
        if (seen.has(id)) err(`${label} duplicado: ${id}`);
        seen.add(id);
      }
      return seen;
    };
    const stages = uniq('stage', ep.stages.map((s) => s.id));
    const clues = uniq('clue', ep.clues.map((c) => c.id));
    const puzzles = uniq('puzzle', ep.puzzles.map((p) => p.id));
    const targets = uniq('entity/npc', [...ep.entities.map((e) => e.id), ...ep.npcs.map((n) => n.id)]);
    if (!targets.has(ep.start.target)) err(`start.target desconocido: ${ep.start.target}`);
    for (const s of ep.stages) {
      if (typeof s.marker === 'string' && !targets.has(s.marker)) err(`marker desconocido en ${s.id}: ${s.marker}`);
    }
    for (const p of ep.puzzles) if (!targets.has(p.entityId)) err(`puzzle ${p.id}: entidad desconocida ${p.entityId}`);
    for (const e of [...ep.entities, ...ep.npcs]) {
      if (!regionOf(e.p[0], e.p[2])) err(`${e.id} está fuera del mapa`);
    }
    const checkConds = (conds: Condition[], where: string) => {
      for (const c of conds) {
        if ('stage' in c && !stages.has(c.stage)) err(`${where}: etapa desconocida ${c.stage}`);
        if ('stageIn' in c) for (const s of c.stageIn) if (!stages.has(s)) err(`${where}: etapa desconocida ${s}`);
        if ('hasClue' in c && !clues.has(c.hasClue)) err(`${where}: pista desconocida ${c.hasClue}`);
        if ('notHasClue' in c && !clues.has(c.notHasClue)) err(`${where}: pista desconocida ${c.notHasClue}`);
      }
    };
    const checkActions = (actions: Action[], where: string) => {
      for (const a of actions) {
        if ('setStage' in a && !stages.has(a.setStage)) err(`${where}: etapa desconocida ${a.setStage}`);
        if ('giveClue' in a && !clues.has(a.giveClue)) err(`${where}: pista desconocida ${a.giveClue}`);
        if ('openPuzzle' in a && !puzzles.has(a.openPuzzle)) err(`${where}: acertijo desconocido ${a.openPuzzle}`);
        if ('teleport' in a && !regionOf(a.teleport[0], a.teleport[2])) err(`${where}: teletransporte fuera del mapa`);
      }
    };
    ep.interactions.forEach((r, i) => {
      if (!targets.has(r.target)) err(`interaction[${i}]: objetivo desconocido ${r.target}`);
      checkConds(r.when, `interaction[${i}]`);
      checkActions(r.do, `interaction[${i}]`);
    });
    ep.puzzles.forEach((p) => {
      checkConds(p.requires, `puzzle ${p.id}`);
      checkActions(p.onSolve, `puzzle ${p.id}`);
    });
    ep.entities.forEach((e) => {
      checkConds([...e.visibleWhen, ...(e.blockingWhen ?? []), ...e.highlightWhen], `entity ${e.id}`);
      if (e.blockingWhen && !e.blockSize) err(`entity ${e.id}: blockingWhen requiere blockSize`);
    });
    if (!ep.interactions.some((r) => r.do.some((a) => 'complete' in a)) && !ep.puzzles.some((p) => p.onSolve.some((a) => 'complete' in a))) {
      err('El episodio no tiene ninguna acción "complete".');
    }
    if (!ep.interactions.some((r) => r.do.some((a) => 'start' in a))) err('El episodio no tiene ninguna acción "start".');
  });

export type EpisodeDef = z.infer<typeof EpisodeSchema>;

/** Ids de objeto referenciados (se validan contra el catálogo al cargar). */
export function referencedItems(ep: EpisodeDef): string[] {
  const out = new Set<string>();
  const scan = (actions: Action[]) => {
    for (const a of actions) {
      if ('giveItem' in a) out.add(a.giveItem);
      if ('takeItem' in a) out.add(a.takeItem);
    }
  };
  ep.interactions.forEach((r) => scan(r.do));
  ep.puzzles.forEach((p) => scan(p.onSolve));
  for (const r of ep.rewards.items) out.add(r.itemId);
  const conds = [...ep.interactions.flatMap((r) => r.when), ...ep.entities.flatMap((e) => [...e.visibleWhen, ...(e.blockingWhen ?? [])])];
  for (const c of conds) {
    if ('hasItem' in c) out.add(c.hasItem);
    if ('notHasItem' in c) out.add(c.notHasItem);
  }
  return [...out];
}
