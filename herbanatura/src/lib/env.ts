/**
 * Central access to configuration. Public values (NEXT_PUBLIC_*) are safe in the
 * browser; everything else must only be read on the server.
 */
export const env = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
};

export function isSupabaseConfigured(): boolean {
  return !!(env.supabaseUrl && env.supabaseAnonKey);
}

/** Server-only secrets. Never import this object from a client component. */
export const serverEnv = {
  get supabaseServiceRoleKey() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  },
  get aiProvider(): 'anthropic' | 'none' {
    if (process.env.AI_PROVIDER === 'none') return 'none';
    return process.env.ANTHROPIC_API_KEY || process.env.AI_PROVIDER === 'anthropic' ? 'anthropic' : 'none';
  },
  get aiModel() {
    return process.env.AI_MODEL ?? 'claude-opus-5-5';
  },
  get identifyProvider(): 'anthropic' | 'plantnet' | 'none' {
    const p = process.env.IDENTIFY_PROVIDER;
    if (p === 'plantnet' && process.env.PLANTNET_API_KEY) return 'plantnet';
    if (p === 'none') return 'none';
    return this.aiProvider === 'anthropic' ? 'anthropic' : 'none';
  },
  get plantnetApiKey() {
    return process.env.PLANTNET_API_KEY ?? '';
  },
  get ncbiApiKey() {
    return process.env.NCBI_API_KEY ?? '';
  },
  get ncbiEmail() {
    return process.env.NCBI_EMAIL ?? '';
  },
  get cronSecret() {
    return process.env.CRON_SECRET ?? '';
  },
  /** When false (demo), premium features are unlocked and labelled as such. */
  get premiumEnforced() {
    return process.env.PREMIUM_ENFORCED === 'true';
  },
};
