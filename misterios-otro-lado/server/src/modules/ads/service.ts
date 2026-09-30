import { randomInt, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { AppConfig } from '../../config/env';
import type { Db } from '../../db/database';
import { json } from '../../db/database';
import type { Bus } from '../../lib/bus';
import { clock, DAY_MS, startOfUtcDay } from '../../lib/clock';
import { badRequest, forbidden, notFound, tooMany } from '../../lib/errors';
import { hmac, newId, randomToken, sha256 } from '../../lib/ids';
import type { AnalyticsService } from '../analytics/service';
import type { AntiFraudService } from '../antifraud/service';
import type { EconomyConfigService } from '../economy/config';
import type { Economy } from '../economy/ledger';
import type { RewardsService } from '../rewards/service';

export type AdFormat = 'rewarded' | 'interstitial';
export type AdEnv = 'telegram' | 'web';
export type AdResult = 'completed' | 'closed' | 'no_fill' | 'error';

export const NetworkSchema = z.object({
  name: z.string().min(1).max(60),
  enabled: z.boolean(),
  env: z.enum(['any', 'telegram', 'web']),
  formats: z.array(z.enum(['rewarded', 'interstitial'])).min(1),
  config: z.record(z.string(), z.string().max(200)),
  estEcpm: z.record(z.string(), z.number().int().min(0).max(100_000)),
  weight: z.number().int().min(0).max(1000),
  serverVerified: z.boolean(),
});

interface NetworkRow {
  id: string;
  name: string;
  kind: 'sandbox' | 'adsgram' | 'monetag' | 'adsense_h5';
  enabled: number;
  env: 'any' | 'telegram' | 'web';
  formats: string;
  config: string;
  est_ecpm: string;
  weight: number;
  server_verified: number;
}

const FORMAT_OF: Record<string, AdFormat> = { rewarded: 'rewarded', optional_interstitial: 'interstitial' };

/**
 * Capa de anuncios con MEDIACIÓN entre redes.
 *  1) /ads/start: límites (tope diario, espera), elección de red (la que más paga según datos reales,
 *     con un % de exploración) y emisión de un token de un solo uso.
 *  2) El cliente muestra el anuncio con el SDK de esa red y reporta el resultado.
 *  3) Recompensa:
 *     - Redes con verificación en servidor (Adsgram «Reward URL», Monetag postback): se paga cuando la RED
 *       llama a /api/ads/callback/:red (firmado con ADS_CALLBACK_SECRET). El cliente sólo consulta el estado.
 *     - Redes sin verificación (AdSense H5, sandbox): se paga al reporte del cliente con tiempo mínimo,
 *       y por defecto SÓLO monedas (nunca puntos de recompensa).
 */
export class AdsService {
  constructor(
    private readonly db: Db,
    private readonly config: AppConfig,
    private readonly bus: Bus,
    private readonly ecoCfg: EconomyConfigService,
    private readonly economy: Economy,
    private readonly rewards: RewardsService,
    private readonly antifraud: AntiFraudService,
    private readonly analytics: AnalyticsService,
    private readonly isVip: (userId: string) => boolean,
  ) {}

  seed() {
    this.db.run(
      `INSERT OR IGNORE INTO ad_placements(id, name, type, provider, enabled, reward_coins, reward_rp, daily_cap, cooldown_sec, min_watch_sec)
       VALUES ('rewarded_coins', 'Anuncio recompensado (monedas + puntos)', 'rewarded', 'mediation', 1, 25, 5, 5, 180, 5)`,
    );
    this.db.run(
      `INSERT OR IGNORE INTO ad_placements(id, name, type, provider, enabled, reward_coins, reward_rp, daily_cap, cooldown_sec, min_watch_sec)
       VALUES ('optional_after_mission', 'Anuncio tras completar misterio', 'optional_interstitial', 'mediation', 1, 10, 0, 3, 600, 5)`,
    );
    const now = clock.now();
    const nets: [string, string, NetworkRow['kind'], number, NetworkRow['env'], AdFormat[], Record<string, string>, Record<string, number>, number][] = [
      ['sandbox', 'Sandbox (pruebas)', 'sandbox', 1, 'any', ['rewarded', 'interstitial'], {}, { rewarded: 0, interstitial: 0 }, 0],
      ['adsgram', 'Adsgram (Telegram)', 'adsgram', 0, 'telegram', ['rewarded', 'interstitial'], { rewardedBlockId: '', interstitialBlockId: '' }, { rewarded: 300, interstitial: 150 }, 1],
      ['monetag', 'Monetag (Telegram y web)', 'monetag', 0, 'any', ['rewarded', 'interstitial'], { zoneId: '' }, { rewarded: 250, interstitial: 120 }, 0],
      ['adsense_h5', 'Google AdSense H5 Games (web)', 'adsense_h5', 0, 'web', ['rewarded', 'interstitial'], { client: '' }, { rewarded: 400, interstitial: 200 }, 0],
    ];
    for (const [id, name, kind, enabled, env, formats, cfg, ecpm, verified] of nets) {
      this.db.run(
        'INSERT OR IGNORE INTO ad_networks(id, name, kind, enabled, env, formats, config, est_ecpm, weight, server_verified, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
        id,
        name,
        kind,
        enabled,
        env,
        json.str(formats),
        json.str(cfg),
        json.str(ecpm),
        verified,
        now,
      );
    }
  }

  // ------------------------------------------------------------------ redes

  networks() {
    return this.db.all<NetworkRow>('SELECT * FROM ad_networks ORDER BY id').map((n) => ({
      id: n.id,
      name: n.name,
      kind: n.kind,
      enabled: !!n.enabled,
      env: n.env,
      formats: json.parse<AdFormat[]>(n.formats, []),
      config: json.parse<Record<string, string>>(n.config, {}),
      estEcpm: json.parse<Record<string, number>>(n.est_ecpm, {}),
      weight: n.weight,
      serverVerified: !!n.server_verified,
      callbackUrl: this.callbackUrl(n.id),
    }));
  }

  updateNetwork(id: string, input: z.infer<typeof NetworkSchema>) {
    const r = this.db.run(
      'UPDATE ad_networks SET name = ?, enabled = ?, env = ?, formats = ?, config = ?, est_ecpm = ?, weight = ?, server_verified = ?, updated_at = ? WHERE id = ?',
      input.name,
      input.enabled ? 1 : 0,
      input.env,
      json.str(input.formats),
      json.str(input.config),
      json.str(input.estEcpm),
      input.weight,
      input.serverVerified ? 1 : 0,
      clock.now(),
      id,
    );
    if (!r.changes) throw notFound('Red no encontrada');
    if (input.serverVerified && !this.config.ADS_CALLBACK_SECRET) {
      return { warning: 'Define ADS_CALLBACK_SECRET en el servidor para poder recibir las confirmaciones de esta red.' };
    }
    return {};
  }

  /** Firma por red: cada red tiene una URL de recompensa distinta y no adivinable. */
  private callbackSig(networkId: string) {
    return this.config.ADS_CALLBACK_SECRET ? hmac(this.config.ADS_CALLBACK_SECRET, `ads-callback:${networkId}`).slice(0, 40) : null;
  }

  callbackUrl(networkId: string): string | null {
    const sig = this.callbackSig(networkId);
    if (!sig) return null;
    const base = `${this.config.PUBLIC_BASE_URL.replace(/\/$/, '')}/api/ads/callback/${networkId}?sig=${sig}`;
    // Marcadores que cada red sustituye (verifica el nombre exacto en el panel de la red):
    if (networkId === 'adsgram') return `${base}&userid=[userId]`;
    if (networkId === 'monetag') return `${base}&token={ymid}`;
    return base;
  }

  /** Eficiencia real por red/formato a partir de los ingresos reportados (últimos 30 días). */
  realEcpm(networkId: string, format: AdFormat): number | null {
    const since = new Date(clock.now() - 30 * DAY_MS).toISOString().slice(0, 10);
    const r = this.db.get<{ imp: number | null; rev: number | null }>(
      'SELECT SUM(impressions) AS imp, SUM(revenue_cents) AS rev FROM ad_revenue_reports WHERE network_id = ? AND format = ? AND day >= ?',
      networkId,
      format,
      since,
    );
    if (!r?.imp || r.imp < 200) return null; // muestra insuficiente
    return ((r.rev ?? 0) / r.imp) * 1000;
  }

  private pickNetwork(format: AdFormat, env: AdEnv): NetworkRow | null {
    const all = this.db.all<NetworkRow>('SELECT * FROM ad_networks WHERE enabled = 1');
    const eligible = all.filter((n) => (n.env === 'any' || n.env === env) && json.parse<string[]>(n.formats, []).includes(format) && this.configured(n, format));
    if (!eligible.length) return null;
    const real = eligible.filter((n) => n.kind !== 'sandbox');
    const pool = real.length ? real : eligible; // la sandbox sólo si no hay redes reales activas
    const cfg = this.ecoCfg.get().ads;
    if (cfg.strategy === 'weighted' || randomInt(0, 100) < cfg.explorePct) {
      const total = pool.reduce((s, n) => s + Math.max(0, n.weight), 0);
      if (total <= 0) return pool[randomInt(0, pool.length)];
      let r = randomInt(0, total);
      for (const n of pool) {
        r -= Math.max(0, n.weight);
        if (r < 0) return n;
      }
      return pool[0];
    }
    const score = (n: NetworkRow) => this.realEcpm(n.id, format) ?? json.parse<Record<string, number>>(n.est_ecpm, {})[format] ?? 0;
    return [...pool].sort((a, b) => score(b) - score(a))[0];
  }

  private configured(n: NetworkRow, format: AdFormat) {
    const c = json.parse<Record<string, string>>(n.config, {});
    if (n.kind === 'adsgram') return !!(format === 'rewarded' ? c.rewardedBlockId : c.interstitialBlockId);
    if (n.kind === 'monetag') return !!c.zoneId;
    if (n.kind === 'adsense_h5') return /^ca-pub-\d+$/.test(c.client ?? '');
    return true;
  }

  // ------------------------------------------------------------------ ubicaciones

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
    const vip = this.isVip(userId);
    return this.db
      .all<{ id: string; name: string; type: string; enabled: number; reward_coins: number; reward_rp: number; daily_cap: number; cooldown_sec: number; min_watch_sec: number }>(
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
        const skippedByVip = vip && p.type === 'optional_interstitial' && this.ecoCfg.get().vip.noInterstitials;
        return {
          id: p.id,
          name: p.name,
          type: p.type,
          format: FORMAT_OF[p.type] ?? 'rewarded',
          sandbox: this.config.AD_PROVIDER === 'sandbox',
          available: enabled && !!p.enabled && used < p.daily_cap && cooldownLeft === 0 && !skippedByVip,
          rewardCoins: p.reward_coins,
          rewardRp: p.reward_rp,
          usedToday: used,
          dailyCap: p.daily_cap,
          cooldownLeftSec: cooldownLeft,
          minWatchSec: p.min_watch_sec,
        };
      });
  }

  start(userId: string, placementId: string, ip: string, deviceId: string | null, env: AdEnv = 'web') {
    if (!this.ecoCfg.get().ads.enabled || this.config.AD_PROVIDER === 'none') throw forbidden('Los anuncios están desactivados.');
    const p = this.db.get<{ id: string; type: string; enabled: number; daily_cap: number; cooldown_sec: number; min_watch_sec: number }>(
      'SELECT id, type, enabled, daily_cap, cooldown_sec, min_watch_sec FROM ad_placements WHERE id = ?',
      placementId,
    );
    if (!p || !p.enabled) throw notFound('Anuncio no disponible.');
    const info = this.placements(userId).find((x) => x.id === placementId)!;
    if (info.usedToday >= p.daily_cap) throw tooMany('Ya viste todos los anuncios de hoy. ¡Gracias!');
    if (info.cooldownLeftSec > 0) throw tooMany(`Espera ${info.cooldownLeftSec} s para el siguiente anuncio.`);
    const format = FORMAT_OF[p.type] ?? 'rewarded';
    const net = this.pickNetwork(format, env);
    if (!net) throw notFound('No hay anuncios disponibles ahora mismo.');
    this.db.run("UPDATE ad_views SET status = 'expired', result = COALESCE(result, 'abandoned') WHERE user_id = ? AND status = 'started'", userId);
    const token = randomToken(24);
    this.db.run(
      'INSERT INTO ad_views(id, user_id, placement_id, token_hash, status, sandbox, ip, device_id, started_at, network_id, format, env) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      newId(),
      userId,
      placementId,
      sha256(token),
      'started',
      net.kind === 'sandbox' ? 1 : 0,
      ip,
      deviceId,
      clock.now(),
      net.id,
      format,
      env,
    );
    return {
      token,
      format,
      minWatchSec: net.kind === 'sandbox' ? p.min_watch_sec : 0,
      sandbox: net.kind === 'sandbox',
      network: { id: net.id, kind: net.kind, config: json.parse<Record<string, string>>(net.config, {}), serverVerified: !!net.server_verified },
    };
  }

  private view(tokenOrHash: { token?: string; hash?: string }) {
    return this.db.get<{ id: string; user_id: string; placement_id: string; status: string; started_at: number; network_id: string | null; verified: number; result: string | null }>(
      'SELECT id, user_id, placement_id, status, started_at, network_id, verified, result FROM ad_views WHERE token_hash = ?',
      tokenOrHash.hash ?? sha256(tokenOrHash.token ?? ''),
    );
  }

  private network(id: string | null) {
    return this.db.get<NetworkRow>('SELECT * FROM ad_networks WHERE id = ?', id ?? 'sandbox');
  }

  /** Reporte del cliente al terminar el anuncio. */
  complete(userId: string, token: string, result: AdResult = 'completed') {
    const v = this.view({ token });
    if (!v || v.user_id !== userId) throw badRequest('invalid_token', 'Token de anuncio inválido.');
    if (v.status === 'completed') return { status: 'completed' as const, ...this.rewardOf(v.placement_id, v.network_id) };
    if (v.status !== 'started') throw badRequest('already_used', 'Este anuncio ya se procesó.');
    const net = this.network(v.network_id);
    if (result !== 'completed') {
      this.db.run("UPDATE ad_views SET status = 'rejected', result = ?, completed_at = ? WHERE id = ?", result, clock.now(), v.id);
      return { status: result, coins: 0, rp: 0, note: result === 'no_fill' ? 'No había anuncios disponibles. Inténtalo más tarde.' : null };
    }
    if (net?.server_verified) {
      // La recompensa llega cuando la red confirma la vista a nuestro servidor.
      this.db.run("UPDATE ad_views SET result = 'client_completed' WHERE id = ?", v.id);
      if (v.verified) return this.grant(v.id);
      return { status: 'pending' as const, coins: 0, rp: 0, note: 'Verificando el anuncio…' };
    }
    const p = this.db.get<{ min_watch_sec: number }>('SELECT min_watch_sec FROM ad_placements WHERE id = ?', v.placement_id)!;
    const minSec = net?.kind === 'sandbox' ? p.min_watch_sec : 3;
    const elapsed = (clock.now() - v.started_at) / 1000;
    if (elapsed < minSec - 0.25) {
      this.db.run("UPDATE ad_views SET status = 'rejected', result = 'too_fast', reject_reason = 'too_fast', completed_at = ? WHERE id = ?", clock.now(), v.id);
      this.antifraud.flag(userId, 'ad_completed_too_fast', 3, { elapsed, network: v.network_id });
      throw badRequest('too_fast', 'El anuncio no se completó.');
    }
    if (elapsed > 15 * 60) {
      this.db.run("UPDATE ad_views SET status = 'expired', result = 'expired' WHERE id = ?", v.id);
      throw badRequest('expired', 'El anuncio expiró.');
    }
    return this.grant(v.id);
  }

  status(userId: string, token: string) {
    const v = this.view({ token });
    if (!v || v.user_id !== userId) throw notFound('Anuncio no encontrado.');
    if (v.status === 'completed') return { status: 'completed', ...this.rewardOf(v.placement_id, v.network_id) };
    return { status: v.status === 'started' ? 'pending' : v.status, coins: 0, rp: 0 };
  }

  private rewardOf(placementId: string, networkId: string | null) {
    const p = this.db.get<{ reward_coins: number; reward_rp: number }>('SELECT reward_coins, reward_rp FROM ad_placements WHERE id = ?', placementId)!;
    const net = this.network(networkId);
    const rpAllowed = !!net?.server_verified || net?.kind === 'sandbox' || !this.ecoCfg.get().ads.unverifiedCoinsOnly;
    return { coins: p.reward_coins, rp: rpAllowed ? p.reward_rp : 0 };
  }

  private grant(viewId: string) {
    return this.db.tx(() => {
      const v = this.db.get<{ id: string; user_id: string; placement_id: string; status: string; network_id: string | null }>(
        'SELECT id, user_id, placement_id, status, network_id FROM ad_views WHERE id = ?',
        viewId,
      )!;
      if (v.status === 'completed') return { status: 'completed' as const, ...this.rewardOf(v.placement_id, v.network_id), note: null };
      this.db.run("UPDATE ad_views SET status = 'completed', completed_at = ?, result = COALESCE(result, 'completed') WHERE id = ?", clock.now(), v.id);
      const r = this.rewardOf(v.placement_id, v.network_id);
      if (r.coins > 0) {
        this.economy.apply({
          userId: v.user_id,
          type: 'ad_reward',
          idempotencyKey: `ad:${v.id}`,
          details: { placementId: v.placement_id, network: v.network_id },
          currency: [{ code: 'coins', delta: r.coins, reason: 'ad_reward' }],
        });
      }
      const rp = r.rp > 0 ? this.rewards.grant(v.user_id, r.rp, 'ad_reward', `ad_rp:${v.id}`) : { granted: 0, note: null };
      this.analytics.track('ad_completed', v.user_id, { placementId: v.placement_id, network: v.network_id });
      return { status: 'completed' as const, coins: r.coins, rp: rp.granted, note: rp.note };
    });
  }

  /**
   * Confirmación servidor-a-servidor de una red (Reward URL / postback).
   * Identifica la vista por nuestro token (si la red lo reenvía) o por el ID de Telegram del jugador.
   */
  callback(networkId: string, sig: string, q: { token?: string; userid?: string }) {
    const expected = this.callbackSig(networkId);
    if (!expected || !sig || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      this.antifraud.flag(null, 'ad_callback_bad_signature', 0, { networkId });
      throw forbidden('Firma inválida');
    }
    let viewId: string | undefined;
    if (q.token && /^[A-Za-z0-9_-]{16,64}$/.test(q.token)) {
      const v = this.view({ token: q.token });
      if (v && v.network_id === networkId) viewId = v.id;
    } else if (q.userid && /^\d{1,20}$/.test(q.userid)) {
      const link = this.db.get<{ user_id: string }>('SELECT user_id FROM telegram_accounts WHERE telegram_id = ?', q.userid);
      if (link) {
        viewId = this.db.get<{ id: string }>(
          "SELECT id FROM ad_views WHERE user_id = ? AND network_id = ? AND status = 'started' AND started_at > ? ORDER BY started_at DESC LIMIT 1",
          link.user_id,
          networkId,
          clock.now() - 15 * 60_000,
        )?.id;
      }
    }
    if (!viewId) return { ok: false, reason: 'no_matching_view' };
    this.db.run('UPDATE ad_views SET verified = 1 WHERE id = ?', viewId);
    const r = this.grant(viewId);
    const userId = this.db.get<{ user_id: string }>('SELECT user_id FROM ad_views WHERE id = ?', viewId)!.user_id;
    this.bus.emit('notice', { userId, level: 'success', text: `Anuncio verificado: +${r.coins} monedas${r.rp ? ` y +${r.rp} puntos` : ''}.` });
    return { ok: true };
  }
}
