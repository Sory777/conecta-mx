import type { Db } from '../../db/database';
import { json } from '../../db/database';
import { clock, DAY_MS, startOfUtcDay } from '../../lib/clock';
import { newId } from '../../lib/ids';
import type { EconomyConfigService } from '../economy/config';

/** Eventos que el CLIENTE puede enviar (baja confianza, sólo UX). Todo lo económico se registra en servidor. */
export const CLIENT_EVENT_WHITELIST = new Set([
  'ui_open_panel',
  'tutorial_step',
  'settings_changed',
  'client_error',
  'fps_sample',
  'sponsor_impression',
]);

export class AnalyticsService {
  constructor(
    private readonly db: Db,
    private readonly economyCfg: EconomyConfigService,
  ) {}

  track(type: string, userId: string | null, props: Record<string, unknown> = {}, sessionId: string | null = null) {
    this.db.run(
      'INSERT INTO analytics_events(id, user_id, session_id, type, props, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      newId(),
      userId,
      sessionId,
      type,
      json.str(props),
      clock.now(),
    );
  }

  startSession(userId: string): string {
    const id = newId();
    this.db.run('INSERT INTO play_sessions(id, user_id, started_at) VALUES (?, ?, ?)', id, userId, clock.now());
    return id;
  }

  endSession(sessionId: string) {
    const s = this.db.get<{ started_at: number; user_id: string }>('SELECT started_at, user_id FROM play_sessions WHERE id = ?', sessionId);
    if (!s) return;
    const now = clock.now();
    const dur = Math.max(0, Math.round((now - s.started_at) / 1000));
    this.db.run('UPDATE play_sessions SET ended_at = ?, duration_sec = ? WHERE id = ?', now, dur, sessionId);
    this.db.run('UPDATE characters SET play_seconds = play_seconds + ? WHERE user_id = ?', dur, s.user_id);
  }

  private count(sql: string, ...p: (string | number)[]): number {
    return this.db.get<{ n: number | null }>(sql, ...p)?.n ?? 0;
  }

  /** Panel de métricas (admin). */
  dashboard() {
    const now = clock.now();
    const today = startOfUtcDay(now);
    const eco = this.economyCfg.get();
    const days = 14;

    const series: { day: string; dau: number; newUsers: number; sessions: number; missionsCompleted: number; adViews: number; rpIssued: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const from = today - i * DAY_MS;
      const to = from + DAY_MS;
      series.push({
        day: new Date(from).toISOString().slice(0, 10),
        dau: this.count('SELECT COUNT(DISTINCT user_id) AS n FROM play_sessions WHERE started_at >= ? AND started_at < ?', from, to),
        newUsers: this.count('SELECT COUNT(*) AS n FROM users WHERE created_at >= ? AND created_at < ?', from, to),
        sessions: this.count('SELECT COUNT(*) AS n FROM play_sessions WHERE started_at >= ? AND started_at < ?', from, to),
        missionsCompleted: this.count("SELECT COUNT(*) AS n FROM analytics_events WHERE type = 'mission_completed' AND created_at >= ? AND created_at < ?", from, to),
        adViews: this.count("SELECT COUNT(*) AS n FROM ad_views WHERE status = 'completed' AND completed_at >= ? AND completed_at < ?", from, to),
        rpIssued: this.count("SELECT SUM(delta) AS n FROM ledger_entries WHERE currency_code = 'rp' AND delta > 0 AND reason <> 'redemption_refund' AND created_at >= ? AND created_at < ?", from, to),
      });
    }

    const totals = {
      users: this.count('SELECT COUNT(*) AS n FROM users'),
      dau: this.count('SELECT COUNT(DISTINCT user_id) AS n FROM play_sessions WHERE started_at >= ?', today),
      wau: this.count('SELECT COUNT(DISTINCT user_id) AS n FROM play_sessions WHERE started_at >= ?', now - 7 * DAY_MS),
      mau: this.count('SELECT COUNT(DISTINCT user_id) AS n FROM play_sessions WHERE started_at >= ?', now - 30 * DAY_MS),
      sessions: this.count('SELECT COUNT(*) AS n FROM play_sessions'),
      avgSessionSec: Math.round(this.db.get<{ n: number | null }>('SELECT AVG(duration_sec) AS n FROM play_sessions WHERE duration_sec IS NOT NULL')?.n ?? 0),
      missionsStarted: this.count("SELECT COUNT(*) AS n FROM analytics_events WHERE type = 'mission_started'"),
      missionsCompleted: this.count("SELECT COUNT(*) AS n FROM analytics_events WHERE type = 'mission_completed'"),
      adViews: this.count("SELECT COUNT(*) AS n FROM ad_views WHERE status = 'completed'"),
      adRejected: this.count("SELECT COUNT(*) AS n FROM ad_views WHERE status = 'rejected'"),
      purchasesSandbox: this.count("SELECT COUNT(*) AS n FROM purchases WHERE status = 'completed' AND sandbox = 1"),
      purchasesReal: this.count("SELECT COUNT(*) AS n FROM purchases WHERE status = 'completed' AND sandbox = 0"),
      revenueRealCents: this.count("SELECT SUM(amount_cents) AS n FROM purchases WHERE status = 'completed' AND sandbox = 0"),
      revenueSandboxCents: this.count("SELECT SUM(amount_cents) AS n FROM purchases WHERE status = 'completed' AND sandbox = 1"),
      storePurchases: this.count("SELECT COUNT(*) AS n FROM transactions WHERE type = 'purchase'"),
      redemptions: this.count('SELECT COUNT(*) AS n FROM reward_redemptions'),
      openReports: this.count("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'"),
      suspiciousUnreviewed: this.count('SELECT COUNT(*) AS n FROM suspicious_activity WHERE reviewed = 0'),
      trades: this.count("SELECT COUNT(*) AS n FROM marketplace_listings WHERE status = 'sold'"),
    };

    // Embudo / abandono por misión
    const funnel = this.db.all<{ mission_id: string; status: string; stage_id: string | null; n: number }>(
      'SELECT mission_id, status, stage_id, COUNT(*) AS n FROM mission_progress GROUP BY mission_id, status, stage_id ORDER BY mission_id',
    );

    // Retención D1 / D7 (cohortes de los últimos 30 días)
    const retention = (d: number) => {
      const cohort = this.db.all<{ id: string; created_at: number }>(
        'SELECT id, created_at FROM users WHERE created_at < ? AND created_at >= ?',
        now - d * DAY_MS,
        now - 30 * DAY_MS,
      );
      if (cohort.length === 0) return null;
      let retained = 0;
      for (const u of cohort) {
        const from = startOfUtcDay(u.created_at) + d * DAY_MS;
        const hit = this.db.get('SELECT 1 FROM play_sessions WHERE user_id = ? AND started_at >= ? AND started_at < ? LIMIT 1', u.id, from, from + DAY_MS);
        if (hit) retained++;
      }
      return Math.round((retained / cohort.length) * 1000) / 10;
    };

    // Salud económica: ¿las recompensas generan pérdidas?
    const rpIssued30 = this.count(
      "SELECT SUM(delta) AS n FROM ledger_entries WHERE currency_code = 'rp' AND delta > 0 AND reason <> 'redemption_refund' AND created_at >= ?",
      now - 30 * DAY_MS,
    );
    const rpOutstanding = this.count("SELECT SUM(balance) AS n FROM wallets WHERE currency_code = 'rp'");
    const rpRedeemedCents = this.count("SELECT SUM(value_usd_cents) AS n FROM reward_redemptions WHERE status IN ('approved','paid') AND sandbox = 0");
    const adViews30 = this.count("SELECT COUNT(*) AS n FROM ad_views WHERE status = 'completed' AND sandbox = 0 AND completed_at >= ?", now - 30 * DAY_MS);
    const adViews30Sandbox = this.count("SELECT COUNT(*) AS n FROM ad_views WHERE status = 'completed' AND sandbox = 1 AND completed_at >= ?", now - 30 * DAY_MS);
    const iap30 = this.count("SELECT SUM(amount_cents) AS n FROM purchases WHERE status = 'completed' AND sandbox = 0 AND created_at >= ?", now - 30 * DAY_MS);
    const dauAvg30 =
      this.count('SELECT COUNT(DISTINCT user_id || \'_\' || (started_at / 86400000)) AS n FROM play_sessions WHERE started_at >= ?', now - 30 * DAY_MS) / 30;

    const adRevenueCents = Math.round((adViews30 * eco.ads.estimatedEcpmUsdCents) / 1000);
    const adRevenueSandboxCents = Math.round((adViews30Sandbox * eco.ads.estimatedEcpmUsdCents) / 1000);
    const iapNetCents = Math.round(iap30 * (1 - eco.estimates.storeFeePct / 100));
    const rpLiabilityCents = this.economyCfg.rpToUsdCents(rpIssued30);
    const infraCents = Math.round(dauAvg30 * 30 * eco.estimates.infraCostPerDauUsdCents);
    const economy = {
      window: '30d',
      rpIssued: rpIssued30,
      rpIssuedUsdCents: rpLiabilityCents,
      rpOutstanding,
      rpOutstandingUsdCents: this.economyCfg.rpToUsdCents(rpOutstanding),
      rpRedeemedRealUsdCents: rpRedeemedCents,
      estAdRevenueUsdCents: adRevenueCents,
      estAdRevenueSandboxUsdCents: adRevenueSandboxCents,
      iapNetRevenueUsdCents: iapNetCents,
      estInfraCostUsdCents: infraCents,
      estMarginUsdCents: adRevenueCents + iapNetCents - rpLiabilityCents - infraCents,
      rewardToRevenueRatio: adRevenueCents + iapNetCents > 0 ? Math.round((rpLiabilityCents / (adRevenueCents + iapNetCents)) * 1000) / 1000 : null,
      coinsInCirculation: this.count("SELECT SUM(balance) AS n FROM wallets WHERE currency_code = 'coins'"),
      gemsInCirculation: this.count("SELECT SUM(balance) AS n FROM wallets WHERE currency_code = 'gems'"),
      warning: null as string | null,
    };
    if (economy.rewardToRevenueRatio !== null && economy.rewardToRevenueRatio > 0.5) {
      economy.warning = 'Las recompensas superan el 50% del ingreso estimado: revisa tasas y límites.';
    } else if (economy.rewardToRevenueRatio === null && rpLiabilityCents > 0) {
      economy.warning = 'Se emiten puntos pero no hay ingresos reales registrados (modo sandbox).';
    }

    return { totals, series, funnel, retention: { d1: retention(1), d7: retention(7) }, economy };
  }
}
