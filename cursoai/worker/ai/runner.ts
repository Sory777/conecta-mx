import type { z } from 'zod';
import type { Env } from '../env';
import { isProduction } from '../env';
import { HttpError } from '../http';
import { assertAiQuota, type Plan } from '../guard';
import { newId, sha256Hex } from '../util';
import { AnthropicProvider } from './anthropic';
import { MockProvider } from './mock';
import {
  AIOutputError,
  AIRefusalError,
  estimateCostMicroUsd,
  type AIProvider,
  type Effort,
  type ModelTier,
  type ResearchResult,
  type Usage,
} from './provider';
import { BASE_POLICY, leaksInstructions } from './safety';

export interface AIContext {
  env: Env;
  provider: AIProvider;
  userId: string;
  plan: Plan;
}

export function getProvider(env: Env): AIProvider {
  if (env.AI_PROVIDER === 'mock') {
    if (isProduction(env)) throw new HttpError(503, 'ai_misconfigured', 'El proveedor de IA de pruebas no puede usarse en producción.');
    return new MockProvider();
  }
  if (env.AI_PROVIDER === 'anthropic') {
    if (!env.ANTHROPIC_API_KEY) {
      throw new HttpError(
        503,
        'ai_not_configured',
        'Falta configurar ANTHROPIC_API_KEY en el servidor. La IA no está disponible todavía.',
      );
    }
    return new AnthropicProvider(env.ANTHROPIC_API_KEY);
  }
  throw new HttpError(503, 'ai_misconfigured', `Proveedor de IA desconocido: ${env.AI_PROVIDER}`);
}

export function modelFor(env: Env, tier: ModelTier): string {
  if (tier === 'fast') return env.MODEL_FAST || 'claude-haiku-4-5';
  if (tier === 'deep') return env.MODEL_DEEP || 'claude-opus-5';
  return env.MODEL_STANDARD || 'claude-sonnet-5';
}

async function logUsage(ctx: AIContext, task: string, model: string, usage: Usage | null, cached: boolean) {
  const u = usage ?? { input_tokens: 0, output_tokens: 0, cache_read_tokens: 0 };
  await ctx.env.DB.prepare(
    `INSERT INTO usage_events (id, user_id, task, model, input_tokens, output_tokens, cache_read_tokens, cost_micro_usd, cached)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      newId('ue_'),
      ctx.userId,
      task,
      model,
      u.input_tokens,
      u.output_tokens,
      u.cache_read_tokens,
      cached ? 0 : estimateCostMicroUsd(model, u),
      cached ? 1 : 0,
    )
    .run();
}

function mapProviderError(err: unknown, task: string): never {
  if (err instanceof HttpError) throw err;
  if (err instanceof AIRefusalError) {
    throw new HttpError(422, 'ai_refused', 'La IA no pudo generar este contenido por motivos de seguridad. Reformula tu solicitud.');
  }
  const status = (err as { status?: number })?.status;
  if (status === 401 || status === 403) {
    throw new HttpError(503, 'ai_not_configured', 'La clave de API de IA del servidor no es válida.');
  }
  if (status === 429) throw new HttpError(503, 'ai_busy', 'El servicio de IA está saturado. Inténtalo en un momento.');
  console.error(`AI task ${task} failed`, err);
  throw new HttpError(502, 'ai_unavailable', 'El servicio de IA no respondió correctamente. Inténtalo de nuevo.');
}

export interface JSONSpec<T> {
  task: string;
  tier: ModelTier;
  effort?: Effort;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxTokens: number;
  /** Reuse identical past results (content that does not depend on who asks). */
  cache?: boolean;
  mockInput?: unknown;
}

export async function runJSON<T>(ctx: AIContext, spec: JSONSpec<T>): Promise<T> {
  const model = modelFor(ctx.env, spec.tier);
  const system = `${BASE_POLICY}\n\n${spec.system}`;
  const key = spec.cache
    ? await sha256Hex([spec.task, ctx.provider.name, model, system, spec.user].join('\u0000'))
    : null;

  if (key) {
    const hit = await ctx.env.DB.prepare('SELECT value_json FROM ai_cache WHERE key = ?').bind(key).first<{ value_json: string }>();
    if (hit) {
      const parsed = spec.schema.safeParse(JSON.parse(hit.value_json));
      if (parsed.success) {
        await ctx.env.DB.prepare('UPDATE ai_cache SET hits = hits + 1 WHERE key = ?').bind(key).run();
        await logUsage(ctx, spec.task, model, null, true);
        return parsed.data;
      }
    }
  }

  await assertAiQuota(ctx.env, ctx.userId, ctx.plan, spec.task);

  let data: T | undefined;
  let usage: Usage | null = null;
  for (let attempt = 0; attempt < 2 && data === undefined; attempt++) {
    try {
      const res = await ctx.provider.generateJSON({
        task: spec.task,
        model,
        system,
        user: spec.user,
        schema: spec.schema,
        maxTokens: spec.maxTokens,
        effort: spec.effort,
        mockInput: spec.mockInput,
      });
      usage = res.usage;
      const parsed = spec.schema.safeParse(res.data);
      if (!parsed.success) throw new AIOutputError(`schema mismatch in ${spec.task}`);
      if (leaksInstructions(JSON.stringify(parsed.data))) throw new AIOutputError(`instruction leak in ${spec.task}`);
      data = parsed.data;
    } catch (err) {
      if (err instanceof AIOutputError && attempt === 0) continue;
      mapProviderError(err, spec.task);
    }
  }
  if (data === undefined) mapProviderError(new AIOutputError('no output'), spec.task);

  await logUsage(ctx, spec.task, model, usage, false);
  if (key) {
    await ctx.env.DB.prepare('INSERT OR REPLACE INTO ai_cache (key, task, value_json) VALUES (?, ?, ?)')
      .bind(key, spec.task, JSON.stringify(data))
      .run();
  }
  return data;
}

export interface TextSpec {
  task: string;
  tier: ModelTier;
  effort?: Effort;
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  maxTokens: number;
  mockInput?: unknown;
}

export async function runText(ctx: AIContext, spec: TextSpec): Promise<string> {
  const model = modelFor(ctx.env, spec.tier);
  await assertAiQuota(ctx.env, ctx.userId, ctx.plan, spec.task);
  try {
    const res = await ctx.provider.generateText({
      task: spec.task,
      model,
      system: `${BASE_POLICY}\n\n${spec.system}`,
      messages: spec.messages,
      maxTokens: spec.maxTokens,
      effort: spec.effort,
      mockInput: spec.mockInput,
    });
    await logUsage(ctx, spec.task, model, res.usage, false);
    if (leaksInstructions(res.data)) {
      return 'No puedo compartir mis instrucciones internas, pero con gusto te ayudo con el curso. ¿Qué parte quieres repasar?';
    }
    return res.data;
  } catch (err) {
    mapProviderError(err, spec.task);
  }
}

/**
 * Web-grounded research for topics whose facts change. Returns null (and the
 * caller labels the content as unverified) if search is unavailable or fails —
 * a failed verification must never block learning or be papered over.
 */
export async function runResearch(ctx: AIContext, query: string): Promise<ResearchResult | null> {
  const model = modelFor(ctx.env, 'standard');
  const key = await sha256Hex(['research', ctx.provider.name, model, query, new Date().toISOString().slice(0, 7)].join('\u0000'));
  const hit = await ctx.env.DB.prepare('SELECT value_json FROM ai_cache WHERE key = ?').bind(key).first<{ value_json: string }>();
  if (hit) {
    await logUsage(ctx, 'research', model, null, true);
    return JSON.parse(hit.value_json) as ResearchResult;
  }
  await assertAiQuota(ctx.env, ctx.userId, ctx.plan, 'research');
  try {
    const res = await ctx.provider.research({
      model,
      system: `${BASE_POLICY}\n\nInvestiga con la herramienta de búsqueda y redacta un informe breve (máx. 250 palabras) con los datos vigentes y verificables relevantes para enseñar el tema. Incluye fechas cuando existan. Si las fuentes no coinciden, dilo. No incluyas recomendaciones personalizadas.`,
      query,
      maxSearches: 3,
    });
    if (!res) return null;
    await logUsage(ctx, 'research', model, res.usage, false);
    if (!res.data.brief || res.data.sources.length === 0 || leaksInstructions(res.data.brief)) return null;
    await ctx.env.DB.prepare('INSERT OR REPLACE INTO ai_cache (key, task, value_json) VALUES (?, ?, ?)')
      .bind(key, 'research', JSON.stringify(res.data))
      .run();
    return res.data;
  } catch (err) {
    console.error('research failed', err);
    return null;
  }
}
