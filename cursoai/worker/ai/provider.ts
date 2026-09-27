import type { z } from 'zod';

/**
 * Provider-independent AI interface. The app only talks to this; swapping
 * Anthropic for another vendor means adding one class and changing AI_PROVIDER.
 */
export type ModelTier = 'fast' | 'standard' | 'deep';
export type Effort = 'low' | 'medium' | 'high';

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
}

export interface JSONRequest<T> {
  task: string;
  model: string;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxTokens: number;
  effort?: Effort;
  /** Structured input for providers that synthesize output locally (mock). */
  mockInput?: unknown;
}

export interface TextRequest {
  task: string;
  model: string;
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  maxTokens: number;
  effort?: Effort;
  mockInput?: unknown;
}

export interface ResearchRequest {
  model: string;
  system: string;
  query: string;
  maxSearches: number;
}

export interface ResearchSource {
  url: string;
  title: string;
  page_age: string | null;
}

export interface ResearchResult {
  brief: string;
  sources: ResearchSource[];
}

export interface ProviderResult<T> {
  data: T;
  usage: Usage;
  model: string;
}

export interface AIProvider {
  readonly name: string;
  generateJSON<T>(req: JSONRequest<T>): Promise<ProviderResult<T>>;
  generateText(req: TextRequest): Promise<ProviderResult<string>>;
  /** Web-grounded research. Returns null when the provider has no search capability. */
  research(req: ResearchRequest): Promise<ProviderResult<ResearchResult> | null>;
}

export class AIRefusalError extends Error {}
export class AIOutputError extends Error {}

// USD per million tokens (input, output). Used for cost tracking and budgets.
const PRICES: Record<string, [number, number]> = {
  'claude-opus-5': [5, 25],
  'claude-sonnet-5': [2, 10],
  'claude-haiku-4-5': [1, 5],
};

export function estimateCostMicroUsd(model: string, usage: Usage): number {
  const [pin, pout] = PRICES[model] ?? [5, 25];
  const uncachedInput = Math.max(0, usage.input_tokens);
  const dollars =
    (uncachedInput * pin + usage.cache_read_tokens * pin * 0.1 + usage.output_tokens * pout) / 1_000_000;
  return Math.round(dollars * 1_000_000);
}
