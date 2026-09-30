import { z } from 'zod';
import type { Db } from '../../db/database';
import { json } from '../../db/database';
import { clock, DAY_MS } from '../../lib/clock';
import { newId } from '../../lib/ids';

export const RevenueReportSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  networkId: z.string().max(40),
  format: z.enum(['rewarded', 'interstitial']),
  impressions: z.number().int().min(0).max(100_000_000),
  revenueCents: z.number().int().min(0).max(1_000_000_000),
  notes: z.string().max(200).nullish(),
});

/**
 * ¿Qué me paga más? Cruza lo que ocurre en el juego (solicitudes, relleno, anuncios completados)
 * con los ingresos REALES que reporta cada red (copiados de su panel), y suma el resto de fuentes
 * (Telegram Stars, compras web, patrocinios).
 */
export class MonetizationService {
  constructor(private readonly db: Db) {}

  addReport(r: z.infer<typeof RevenueReportSchema>, actorId: string) {
    this.db.run(
      `INSERT INTO ad_revenue_reports(id, day, network_id, format, impressions, revenue_cents, notes, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(day, network_id, format) DO UPDATE SET impressions = excluded.impressions, revenue_cents = excluded.revenue_cents, notes = excluded.notes,
       created_by = excluded.created_by, created_at = excluded.created_at`,
      newId(),
      r.day,
      r.networkId,
      r.format,
      r.impressions,
      r.revenueCents,
      r.notes ?? null,
      actorId,
      clock.now(),
    );
  }

  /** Importa filas CSV: day,networkId,format,impressions,revenueUsd */
  importCsv(csv: string, actorId: string) {
    let ok = 0;
    const errors: string[] = [];
    for (const [i, line] of csv.split(/\r?\n/).entries()) {
      const t = line.trim();
      if (!t || /^day\s*,/i.test(t)) continue;
      const [day, networkId, format, imp, usd] = t.split(',').map((x) => x.trim());
      const parsed = RevenueReportSchema.safeParse({ day, networkId, format, impressions: Number(imp), revenueCents: Math.round(Number(usd) * 100) });
      if (!parsed.success || !this.db.get('SELECT 1 FROM ad_networks WHERE id = ?', networkId)) {
        errors.push(`Línea ${i + 1}: inválida`);
        continue;
      }
      this.addReport(parsed.data, actorId);
      ok++;
    }
    return { imported: ok, errors };
  }

  reports(limit = 200) {
    return this.db.all('SELECT day, network_id, format, impressions, revenue_cents, notes FROM ad_revenue_reports ORDER BY day DESC LIMIT ?', limit);
  }

  dashboard(days = 30) {
    const now = clock.now();
    const since = now - days * DAY_MS;
    const sinceDay = new Date(since).toISOString().slice(0, 10);
    const dau = Math.max(
      1,
      (this.db.get<{ n: number }>("SELECT COUNT(DISTINCT user_id || '_' || (started_at / 86400000)) AS n FROM play_sessions WHERE started_at >= ?", since)?.n ?? 0) / days,
    );
    const nets = this.db.all<{ id: string; name: string; kind: string; enabled: number; est_ecpm: string }>('SELECT id, name, kind, enabled, est_ecpm FROM ad_networks');

    // Rendimiento por red y formato
    const perf = this.db.all<{ network_id: string | null; format: string | null; requests: number; no_fill: number; errors: number; completed: number; verified: number }>(
      `SELECT network_id, format, COUNT(*) AS requests,
         SUM(CASE WHEN result = 'no_fill' THEN 1 ELSE 0 END) AS no_fill,
         SUM(CASE WHEN result = 'error' THEN 1 ELSE 0 END) AS errors,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
         SUM(verified) AS verified
       FROM ad_views WHERE started_at >= ? GROUP BY network_id, format`,
      since,
    );
    const reported = this.db.all<{ network_id: string; format: string; impressions: number; revenue: number }>(
      'SELECT network_id, format, SUM(impressions) AS impressions, SUM(revenue_cents) AS revenue FROM ad_revenue_reports WHERE day >= ? GROUP BY network_id, format',
      sinceDay,
    );
    const keys = new Set<string>([...perf.map((p) => `${p.network_id ?? 'sandbox'}|${p.format ?? 'rewarded'}`), ...reported.map((r) => `${r.network_id}|${r.format}`)]);
    const ranking = [...keys].map((k) => {
      const [networkId, format] = k.split('|');
      const p = perf.find((x) => (x.network_id ?? 'sandbox') === networkId && (x.format ?? 'rewarded') === format);
      const r = reported.find((x) => x.network_id === networkId && x.format === format);
      const net = nets.find((n) => n.id === networkId);
      const est = json.parse<Record<string, number>>(net?.est_ecpm, {})[format] ?? 0;
      const requests = p?.requests ?? 0;
      const fills = requests - (p?.no_fill ?? 0) - (p?.errors ?? 0);
      const realEcpm = r && r.impressions > 0 ? (r.revenue / r.impressions) * 1000 : null;
      const revenue = r ? r.revenue : Math.round(((p?.completed ?? 0) * est) / 1000);
      return {
        networkId,
        name: net?.name ?? networkId,
        kind: net?.kind ?? 'unknown',
        enabled: !!net?.enabled,
        format,
        requests,
        fillRate: requests ? Math.round((fills / requests) * 1000) / 10 : null,
        completed: p?.completed ?? 0,
        completionRate: fills > 0 ? Math.round(((p?.completed ?? 0) / fills) * 1000) / 10 : null,
        verified: p?.verified ?? 0,
        reportedImpressions: r?.impressions ?? 0,
        revenueCents: revenue,
        revenueSource: r ? 'reportado' : 'estimado',
        ecpmCents: realEcpm ?? est,
        ecpmSource: realEcpm !== null ? 'real' : 'estimado',
        // Lo que de verdad importa: ingreso por cada solicitud (combina eCPM, relleno y finalización)
        revenuePer1000RequestsCents: requests ? Math.round((revenue / requests) * 1000) : null,
      };
    });
    ranking.sort((a, b) => (b.revenuePer1000RequestsCents ?? b.ecpmCents) - (a.revenuePer1000RequestsCents ?? a.ecpmCents));

    const bestByFormat: Record<string, string | null> = {};
    for (const f of ['rewarded', 'interstitial']) {
      const best = ranking.filter((r) => r.format === f && r.kind !== 'sandbox' && r.ecpmSource === 'real')[0];
      bestByFormat[f] = best ? `${best.name} (${(best.ecpmCents / 100).toFixed(2)} USD eCPM)` : null;
    }

    // Todas las fuentes de ingreso
    const q = (sql: string, ...p: (string | number)[]) => this.db.get<{ n: number | null }>(sql, ...p)?.n ?? 0;
    const adsReported = reported.reduce((s, r) => s + r.revenue, 0);
    const adsEstimated = ranking.filter((r) => r.revenueSource === 'estimado' && r.kind !== 'sandbox').reduce((s, r) => s + r.revenueCents, 0);
    const stars = q("SELECT SUM(amount_stars) AS n FROM purchases WHERE provider = 'telegram_stars' AND status = 'completed' AND created_at >= ?", since);
    const starsUsd = q("SELECT SUM(amount_cents) AS n FROM purchases WHERE provider = 'telegram_stars' AND status = 'completed' AND created_at >= ?", since);
    const otherIap = q("SELECT SUM(amount_cents) AS n FROM purchases WHERE sandbox = 0 AND provider NOT IN ('telegram_stars') AND status = 'completed' AND created_at >= ?", since);
    const sandboxIap = q("SELECT SUM(amount_cents) AS n FROM purchases WHERE sandbox = 1 AND status = 'completed' AND created_at >= ?", since);
    const sponsors = q('SELECT SUM(contract_value_cents) AS n FROM sponsor_campaigns WHERE starts_at < ? AND ends_at >= ?', now, since);
    const bySku = this.db.all(
      "SELECT sku, provider, COUNT(*) AS purchases, SUM(amount_cents) AS usd_cents, SUM(amount_stars) AS stars FROM purchases WHERE status = 'completed' AND sandbox = 0 AND created_at >= ? GROUP BY sku, provider ORDER BY usd_cents DESC",
      since,
    );
    const payers = q("SELECT COUNT(DISTINCT user_id) AS n FROM purchases WHERE status = 'completed' AND sandbox = 0 AND created_at >= ?", since);
    const active = q('SELECT COUNT(DISTINCT user_id) AS n FROM play_sessions WHERE started_at >= ?', since);
    const sources = [
      { source: 'Anuncios (reportado por las redes)', cents: adsReported },
      { source: 'Anuncios (estimado, sin reporte)', cents: adsEstimated },
      { source: `Telegram Stars (${stars} ⭐)`, cents: starsUsd },
      { source: 'Otras compras reales', cents: otherIap },
      { source: 'Patrocinios (contratos vigentes)', cents: sponsors },
    ].sort((a, b) => b.cents - a.cents);
    const total = sources.reduce((s, x) => s + x.cents, 0);
    const sponsorPerf = this.db.all(
      'SELECT id, sponsor_name, slot_id, impressions, clicks, contract_value_cents, CASE WHEN impressions > 0 THEN ROUND(clicks * 100.0 / impressions, 2) ELSE NULL END AS ctr FROM sponsor_campaigns ORDER BY created_at DESC LIMIT 50',
    );
    return {
      days,
      dauAvg: Math.round(dau * 10) / 10,
      totalCents: total,
      arpdauCents: Math.round((total / (dau * days)) * 100) / 100,
      payers,
      payerConversionPct: active ? Math.round((payers / active) * 1000) / 10 : null,
      sources,
      sandboxIapCents: sandboxIap,
      ranking,
      bestByFormat,
      bySku,
      sponsors: sponsorPerf,
    };
  }
}
