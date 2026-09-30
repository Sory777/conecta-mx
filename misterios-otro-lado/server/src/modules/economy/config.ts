import { z } from 'zod';
import type { Db } from '../../db/database';
import { json } from '../../db/database';
import { clock } from '../../lib/clock';
import { badRequest } from '../../lib/errors';

// Parámetros económicos editables en caliente desde el panel de administración.
// Todos los valores monetarios reales se expresan en CENTAVOS de USD para evitar decimales.

const int = (min = 0, max = 1_000_000_000) => z.number().int().min(min).max(max);
const pct = z.number().min(0).max(100);

export const EconomySchema = z.object({
  starter: z.object({ coins: int(0, 100_000), items: z.array(z.string()) }),
  missions: z.object({
    coinMultiplier: z.number().min(0).max(10),
    rpMultiplier: z.number().min(0).max(10),
    xpMultiplier: z.number().min(0).max(10),
    /** Fracción de monedas al repetir un misterio ya completado (0 = nada). Nunca da RP. */
    repeatCoinFactor: z.number().min(0).max(1),
    coopBonusPct: pct,
  }),
  rewardPoints: z.object({
    enabled: z.boolean(),
    dailyCap: int(0, 1_000_000),
    weeklyCap: int(0, 5_000_000),
    /** Valor de referencia: centavos de USD por cada 1000 RP. */
    usdCentsPer1000: int(0, 100_000),
    /** Presupuesto global diario de RP (en centavos). Si se supera, se deja de emitir RP ese día. */
    globalDailyBudgetUsdCents: int(0, 100_000_000),
  }),
  redemption: z.object({
    /** Interruptor administrativo. Además requiere REAL_PAYOUTS_ALLOWED=true y SANDBOX_MODE=false. */
    realRewardsEnabled: z.boolean(),
    minPoints: int(1),
    maxPointsPerRequest: int(1),
    cooldownDays: int(0, 365),
    minAccountAgeDays: int(0, 3650),
    maxFraudScore: int(0, 1000),
    monthlyCapUsdCents: int(0, 10_000_000),
    requireVerifiedEmail: z.boolean(),
    minCompletedMissions: int(0, 1000),
    rewardTypes: z.array(z.string().min(1)).min(1),
  }),
  ads: z.object({
    enabled: z.boolean(),
    /** Estimación de ingreso por cada 1000 anuncios recompensados completados (centavos). */
    estimatedEcpmUsdCents: int(0, 100_000),
    /** Mediación: 'best_ecpm' elige la red que más paga (con exploración); 'weighted' reparte por peso. */
    strategy: z.enum(['best_ecpm', 'weighted']),
    /** % de solicitudes que prueban otras redes para seguir midiendo su eCPM. */
    explorePct: z.number().min(0).max(100),
    /** Intersticial al terminar un misterio (pausa natural): desactivado, opcional (botón) o automático. */
    interstitialAfterMission: z.enum(['off', 'optional', 'auto']),
    /** Redes sin verificación en servidor sólo pagan monedas (nunca puntos de recompensa). */
    unverifiedCoinsOnly: z.boolean(),
  }),
  vip: z.object({
    coinBonusPct: pct,
    dailyGems: int(0, 1000),
    noInterstitials: z.boolean(),
  }),
  telegram: z.object({
    /** Valor neto estimado de 1 Telegram Star para el desarrollador, en centavos de USD. Verifica la tasa vigente. */
    starUsdCents: z.number().min(0).max(100),
  }),
  marketplace: z.object({
    enabled: z.boolean(),
    commissionPct: pct,
    maxActiveListings: int(0, 1000),
    minPrice: int(1),
    maxPrice: int(1),
    dailyPurchaseLimit: int(0, 1000),
    minAccountAgeDays: int(0, 3650),
  }),
  referral: z.object({
    enabled: z.boolean(),
    referrerCoins: int(0, 100_000),
    referrerRp: int(0, 100_000),
    refereeCoins: int(0, 100_000),
    qualifyingMissionId: z.string(),
    minPlayMinutes: int(0, 100_000),
    maxRewardedPerMonth: int(0, 10_000),
  }),
  dropTables: z.record(z.string(), z.array(z.object({ itemId: z.string(), weight: z.number().min(0) }))),
  antifraud: z.object({
    maxAccountsPerDevice: int(1, 100),
    maxRegistrationsPerIpPerDay: int(1, 1000),
    /** fraud_score a partir del cual se retienen recompensas de valor real. */
    holdThreshold: int(1, 1000),
  }),
  estimates: z.object({
    /** Costo estimado de infraestructura por usuario activo diario (centavos, con decimales). */
    infraCostPerDauUsdCents: z.number().min(0).max(1000),
    /** Comisión de tiendas de apps sobre compras (Google/Apple ~15-30%). */
    storeFeePct: pct,
  }),
});

export type EconomyConfig = z.infer<typeof EconomySchema>;

export const DEFAULT_ECONOMY: EconomyConfig = {
  starter: { coins: 100, items: ['linterna_basica'] },
  missions: { coinMultiplier: 1, rpMultiplier: 1, xpMultiplier: 1, repeatCoinFactor: 0.2, coopBonusPct: 10 },
  rewardPoints: { enabled: true, dailyCap: 300, weeklyCap: 1200, usdCentsPer1000: 10, globalDailyBudgetUsdCents: 5000 },
  redemption: {
    realRewardsEnabled: false,
    minPoints: 10_000,
    maxPointsPerRequest: 50_000,
    cooldownDays: 7,
    minAccountAgeDays: 14,
    maxFraudScore: 25,
    monthlyCapUsdCents: 500,
    requireVerifiedEmail: true,
    minCompletedMissions: 1,
    rewardTypes: ['tarjeta_regalo'],
  },
  ads: { enabled: true, estimatedEcpmUsdCents: 600, strategy: 'best_ecpm', explorePct: 10, interstitialAfterMission: 'optional', unverifiedCoinsOnly: true },
  vip: { coinBonusPct: 10, dailyGems: 10, noInterstitials: true },
  telegram: { starUsdCents: 1.3 },
  marketplace: {
    enabled: false,
    commissionPct: 10,
    maxActiveListings: 5,
    minPrice: 10,
    maxPrice: 50_000,
    dailyPurchaseLimit: 10,
    minAccountAgeDays: 3,
  },
  referral: {
    enabled: true,
    referrerCoins: 300,
    referrerRp: 50,
    refereeCoins: 150,
    qualifyingMissionId: 'ep01_casa_abandonada',
    minPlayMinutes: 20,
    maxRewardedPerMonth: 10,
  },
  dropTables: {
    episode_complete: [
      { itemId: 'boton_antiguo', weight: 600 },
      { itemId: 'moneda_1920', weight: 280 },
      { itemId: 'medalla_militar', weight: 90 },
      { itemId: 'reloj_bolsillo', weight: 27 },
      { itemId: 'camafeo_morales', weight: 3 },
    ],
  },
  antifraud: { maxAccountsPerDevice: 2, maxRegistrationsPerIpPerDay: 5, holdThreshold: 40 },
  estimates: { infraCostPerDauUsdCents: 0.3, storeFeePct: 30 },
};

function deepMerge(base: any, over: any): any {
  if (Array.isArray(base) || Array.isArray(over) || typeof base !== 'object' || typeof over !== 'object' || !base || !over) {
    return over === undefined ? base : over;
  }
  const out: any = { ...base };
  for (const k of Object.keys(over)) out[k] = deepMerge(base[k], over[k]);
  return out;
}

export class EconomyConfigService {
  private cache: EconomyConfig | null = null;

  constructor(private readonly db: Db) {}

  get(): EconomyConfig {
    if (this.cache) return this.cache;
    const row = this.db.get<{ value: string }>("SELECT value FROM economy_config WHERE key = 'economy'");
    const stored = json.parse<Partial<EconomyConfig>>(row?.value, {});
    const merged = deepMerge(DEFAULT_ECONOMY, stored);
    const parsed = EconomySchema.safeParse(merged);
    this.cache = parsed.success ? parsed.data : DEFAULT_ECONOMY;
    return this.cache;
  }

  /** Reemplaza (parcialmente) la configuración. Valida antes de guardar. */
  update(patch: unknown, actorId: string | null): EconomyConfig {
    const merged = deepMerge(this.get(), patch);
    const parsed = EconomySchema.safeParse(merged);
    if (!parsed.success) {
      throw badRequest('invalid_economy', 'Configuración económica inválida', parsed.error.issues);
    }
    const cfg = parsed.data;
    if (cfg.redemption.maxPointsPerRequest < cfg.redemption.minPoints) {
      throw badRequest('invalid_economy', 'maxPointsPerRequest debe ser >= minPoints');
    }
    if (cfg.marketplace.maxPrice < cfg.marketplace.minPrice) {
      throw badRequest('invalid_economy', 'maxPrice debe ser >= minPrice');
    }
    this.db.run(
      `INSERT INTO economy_config(key, value, updated_at, updated_by) VALUES ('economy', ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
      json.str(cfg),
      clock.now(),
      actorId,
    );
    this.cache = cfg;
    return cfg;
  }

  /** Valor en centavos de USD de una cantidad de RP. */
  rpToUsdCents(points: number): number {
    return Math.floor((points * this.get().rewardPoints.usdCentsPer1000) / 1000);
  }
}
