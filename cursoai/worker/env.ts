export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ENVIRONMENT: string; // 'production' | 'development' | 'test'
  AI_PROVIDER: string; // 'anthropic' | 'mock'
  ANTHROPIC_API_KEY?: string;
  MODEL_FAST?: string;
  MODEL_STANDARD?: string;
  MODEL_DEEP?: string;
  AI_DAILY_BUDGET_USD?: string;
  AI_RATE_PER_MIN?: string;
}

export const isProduction = (env: Env) => env.ENVIRONMENT === 'production';
