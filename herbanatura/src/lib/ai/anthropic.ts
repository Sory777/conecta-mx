import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod/v4';
import { serverEnv } from '@/lib/env';

let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  client ??= new Anthropic({ maxRetries: 2, timeout: 60_000 });
  return client;
}

/**
 * Structured call with server-side refusal fallback. Returns null when the model
 * declines (stop_reason "refusal") or the output cannot be parsed.
 */
export async function structuredCall<S extends z.ZodType>(opts: {
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[];
  schema: S;
  maxTokens?: number;
  effort?: 'low' | 'medium' | 'high';
}): Promise<{ data: z.infer<S>; model: string } | null> {
  const res = await anthropic().beta.messages.parse({
    model: serverEnv.aiModel,
    max_tokens: opts.maxTokens ?? 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }],
    output_config: { effort: opts.effort ?? 'medium', format: betaZodOutputFormat(opts.schema) },
    messages: [{ role: 'user', content: opts.content }],
  });
  if (res.stop_reason === 'refusal' || !res.parsed_output) return null;
  return { data: res.parsed_output as z.infer<S>, model: res.model };
}
