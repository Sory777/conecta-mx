/** Single place that decides which features each plan unlocks. Evidence content is never gated by payment tier. */
export const FEATURES = ['advanced_research', 'compare', 'unlimited_history', 'personal_library', 'ai_advanced', 'image_identification', 'interaction_alerts', 'offline'] as const;
export type Feature = (typeof FEATURES)[number];
export type Plan = 'free' | 'premium';

const PREMIUM_ONLY = new Set<Feature>(FEATURES);

export function canUse(feature: Feature, plan: Plan, enforced: boolean): boolean {
  if (!enforced) return true;
  return plan === 'premium' || !PREMIUM_ONLY.has(feature);
}

/** Free limits that still apply when premium is enforced. */
export const FREE_LIMITS = { aiQuestionsPerDay: 5, historyItems: 20 } as const;
