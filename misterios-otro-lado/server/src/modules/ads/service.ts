import type { AppConfig } from '../../config/env';
import type { Db } from '../../db/database';
import { clock, startOfUtcDay } from '../../lib/clock';
import { badRequest, forbidden, notFound, tooMany } from '../../lib/errors';
import { newId, randomToken, sha256 } from '../../lib/ids';
import type { AnalyticsService } from '../analytics/service';
import type { AntiFraudService } from '../antifraud/service';
import type { EconomyConfigService } from '../economy/config';
import type { Economy } from '../economy/ledger';
import type { RewardsService } from '../rewards/service';

/**
 * Capa de anuncios. En el MVP el proveedor es SANDBOX: el cliente muestra un "anuncio de prueba"
 * claramente rotulado. El flujo ya es el de producción con verificación en servidor:
 *   1) /ads/start  -> el servidor emite un token de un solo uso (límite diario + cooldown).
 *   2) /ads/complete -> el servidor valida token, usuario y tiempo mínimo; entonces recompensa.
 * Con AdMob real, el paso 2 lo hace el callback SSV (Server-Side Verification) firmado por Google,
 * no el cliente. Ver README > Publicidad.
 */
export class AdsService {
  constructor(
    private readonly db: Db,
    private readonly config: AppConfig,
    private readonly ecoCfg: EconomyConfigService,
    private readonly economy: Economy,
    private readonly rewards: RewardsService,
    private readonly antifraud: AntiFraudService,
    private readonly analytics: AnalyticsService,
  ) {}

  seed() {
    this.db.run(
      `INSERT OR IGNORE INTO ad_placements(id, name, type, provider, enabled, reward_coins, reward_rp, daily_cap, cooldown_sec, min_watch_sec)
       VALUES ('rewarded_coins', 'Anuncio recompensado (monedas + puntos)', 'rewarded', 'sandbox', 1, 25, 5, 5, 180, 5)`,
    );
    this.db.run(
      `INSERT OR IGNORE INTO ad_placements(id, name, type, provider, enabled, reward_coins, reward_rp, daily_cap, cooldown_sec, min_watch_sec)
       VALUES ('optional_after_mission', 'Anuncio opcional tras completar misterio', 'optional_interstitial', 'sandbox', 1, 10, 0, 3, 600, 5)`,
    );
  }

  private viewsToday(userId: string, placementId: string) {
    return this.db.get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM ad_views WHERE user_id = ? AND placement_id = ? AND status = 'completed' AND completed_at >= ?",
      userId,
      placementId,
      startOfUtcDay(clock.now()),
    )!.n;
  }

  placements(userId: string) {
    const enabled = this.ecoCfg.get().ads.enabled && this.config.AD_PROVIDER !== 'none';
    return this.db
      .all<{ id: string; name: string; type: string; provider: string; enabled: number; reward_coins: number; reward_rp: number; daily_cap: number; cooldown_sec: number; min_watch_sec: number }>(
        'SELECT * FROM ad_placements ORDER BY id',
      )
      .map((p) => {
        const last = this.db.get<{ t: number | null }>(
          "SELECT MAX(completed_at) AS t FROM ad_views WHERE user_id = ? AND placement_id = ? AND status = 'completed'",
          userId,
          p.id,
        )?.t;
        const cooldownLeft = last ? Math.max(0, Math.ceil((last + p.cooldown_sec * 1000 - clock.now()) / 1000)) : 0;
        const used = this.viewsToday(userId, p.id);
        return {
          id: p.id,
          name: p.name,
          type: p.type,
          sandbox: p.provider === 'sandbox',
          available: enabled && !!p.enabled && used < p.daily_cap && cooldownLeft === 0,
          rewardCoins: p.reward_coins,
          rewardRp: p.reward_rp,
          usedToday: used,
          dailyCap: p.daily_cap,
          cooldownLeftSec: cooldownLeft,
          minWatchSec: p.min_watch_sec,
        };
      });
  }

  start(userId: string, placementId: string, ip: string, deviceId: string | null) {
    if (!this.ecoCfg.get().ads.enabled || this.config.AD_PROVIDER === 'none') throw forbidden('Los anuncios están desactivados.');
    const p = this.db.get<{ id: string; enabled: number; daily_cap: number; cooldown_sec: number; min_watch_sec: number; provider: string }>(
      'SELECT id, enabled, daily_cap, cooldown_sec, min_watch_sec, provider FROM ad_placements WHERE id = ?',
      placementId,
    );
    if (!p || !p.enabled) throw notFound('Anuncio no disponible.');
    const info = this.placements(userId).find((x) => x.id === placementId)!;
    if (info.usedToday >= p.daily_cap) throw tooMany('Ya viste todos los anuncios recompensados de hoy. ¡Gracias!');
    if (info.cooldownLeftSec > 0) throw tooMany(`Espera ${info.cooldownLeftSec} s para el siguiente anuncio.`);
    // Evita abrir muchas sesiones de anuncio en paralelo
    this.db.run(
      "UPDATE ad_views SET status = 'expired' WHERE user_id = ? AND status = 'started'",
      userId,
    );
    const token = randomToken(24);
    this.db.run(
      'INSERT INTO ad_views(id, user_id, placement_id, token_hash, status, sandbox, ip, device_id, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      newId(),
      userId,
      placementId,
      sha256(token),
      'started',
      p.provider === 'sandbox' ? 1 : 0,
      ip,
      deviceId,
      clock.now(),
    );
    return { token, minWatchSec: p.min_watch_sec, sandbox: p.provider === 'sandbox' };
  }

  complete(userId: string, token: string) {
    const v = this.db.get<{ id: string; placement_id: string; status: string; started_at: number; user_id: string }>(
      'SELECT id, placement_id, status, started_at, user_id FROM ad_views WHERE token_hash = ?',
      sha256(token),
    );
    if (!v || v.user_id !== userId) throw badRequest('invalid_token', 'Token de anuncio inválido.');
    if (v.status !== 'started') throw badRequest('already_used', 'Este anuncio ya se procesó.');
    const p = this.db.get<{ reward_coins: number; reward_rp: number; min_watch_sec: number }>(
      'SELECT reward_coins, reward_rp, min_watch_sec FROM ad_placements WHERE id = ?',
      v.placement_id,
    )!;
    const elapsed = (clock.now() - v.started_at) / 1000;
    if (elapsed < p.min_watch_sec - 0.25) {
      this.db.run("UPDATE ad_views SET status = 'rejected', reject_reason = 'too_fast', completed_at = ? WHERE id = ?", clock.now(), v.id);
      this.antifraud.flag(userId, 'ad_completed_too_fast', 3, { elapsed });
      throw badRequest('too_fast', 'El anuncio no se completó.');
    }
    if (elapsed > 15 * 60) {
      this.db.run("UPDATE ad_views SET status = 'expired' WHERE id = ?", v.id);
      throw badRequest('expired', 'El anuncio expiró.');
    }
    return this.db.tx(() => {
      this.db.run("UPDATE ad_views SET status = 'completed', completed_at = ? WHERE id = ?", clock.now(), v.id);
      if (p.reward_coins > 0) {
        this.economy.apply({
          userId,
          type: 'ad_reward',
          idempotencyKey: `ad:${v.id}`,
          details: { placementId: v.placement_id },
          currency: [{ code: 'coins', delta: p.reward_coins, reason: 'ad_reward' }],
        });
      }
      const rp = p.reward_rp > 0 ? this.rewards.grant(userId, p.reward_rp, 'ad_reward', `ad_rp:${v.id}`) : { granted: 0, note: null };
      this.analytics.track('ad_completed', userId, { placementId: v.placement_id });
      return { coins: p.reward_coins, rp: rp.granted, note: rp.note };
    });
  }
}
