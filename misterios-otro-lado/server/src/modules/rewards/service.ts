import type { AppConfig } from '../../config/env';
import type { Db } from '../../db/database';
import { clock, DAY_MS, startOfUtcDay, startOfUtcWeek } from '../../lib/clock';
import { badRequest, forbidden } from '../../lib/errors';
import { newId } from '../../lib/ids';
import type { Logger } from '../../lib/logger';
import type { AnalyticsService } from '../analytics/service';
import type { AntiFraudService } from '../antifraud/service';
import type { EconomyConfigService } from '../economy/config';
import type { Economy } from '../economy/ledger';

export interface RpGrantResult {
  requested: number;
  granted: number;
  note: string | null;
}

/**
 * Puntos de recompensa (RP): pueden llegar a tener valor real, por eso:
 * - Sólo el servidor los emite, siempre por actividades validadas en servidor.
 * - Límites diarios, semanales y presupuesto GLOBAL diario.
 * - Cuentas con fraude/retención no acumulan.
 * - El canje exige requisitos, cooldown, tope mensual y revisión manual.
 * - La conversión real está desactivada por defecto y detrás de dos candados.
 */
export class RewardsService {
  constructor(
    private readonly db: Db,
    private readonly config: AppConfig,
    private readonly ecoCfg: EconomyConfigService,
    private readonly economy: Economy,
    private readonly antifraud: AntiFraudService,
    private readonly analytics: AnalyticsService,
    private readonly log: Logger,
  ) {}

  private earnedSince(userId: string, since: number): number {
    return (
      this.db.get<{ n: number | null }>(
        "SELECT SUM(delta) AS n FROM ledger_entries WHERE user_id = ? AND currency_code = 'rp' AND delta > 0 AND reason <> 'redemption_refund' AND created_at >= ?",
        userId,
        since,
      )?.n ?? 0
    );
  }

  private globalIssuedSince(since: number): number {
    return (
      this.db.get<{ n: number | null }>(
        "SELECT SUM(delta) AS n FROM ledger_entries WHERE currency_code = 'rp' AND delta > 0 AND reason <> 'redemption_refund' AND created_at >= ?",
        since,
      )?.n ?? 0
    );
  }

  limits(userId: string) {
    const cfg = this.ecoCfg.get().rewardPoints;
    const now = clock.now();
    const today = this.earnedSince(userId, startOfUtcDay(now));
    const week = this.earnedSince(userId, startOfUtcWeek(now));
    return {
      enabled: cfg.enabled,
      dailyCap: cfg.dailyCap,
      weeklyCap: cfg.weeklyCap,
      earnedToday: today,
      earnedThisWeek: week,
      remainingToday: Math.max(0, Math.min(cfg.dailyCap - today, cfg.weeklyCap - week)),
    };
  }

  /**
   * Emite RP respetando todos los límites. Debe llamarse DESDE el servidor tras validar la actividad.
   * Idempotente por `idempotencyKey`.
   */
  grant(userId: string, amount: number, reason: string, idempotencyKey: string, details: Record<string, unknown> = {}): RpGrantResult {
    const requested = Math.max(0, Math.floor(amount));
    if (requested === 0) return { requested, granted: 0, note: null };
    const cfg = this.ecoCfg.get().rewardPoints;
    if (!cfg.enabled) return { requested, granted: 0, note: 'Los puntos de recompensa están desactivados.' };

    const risk = this.antifraud.userRisk(userId);
    if (risk.hold) {
      this.antifraud.flag(userId, 'rp_blocked_on_hold', 0, { reason, requested });
      return { requested, granted: 0, note: 'Tu cuenta está en revisión: los puntos se reanudarán tras la revisión.' };
    }

    return this.db.tx(() => {
      const lim = this.limits(userId);
      const now = clock.now();
      const budgetPoints = Math.floor((cfg.globalDailyBudgetUsdCents * 1000) / Math.max(1, cfg.usdCentsPer1000));
      const globalRemaining = Math.max(0, budgetPoints - this.globalIssuedSince(startOfUtcDay(now)));
      const granted = Math.min(requested, lim.remainingToday, globalRemaining);
      let note: string | null = null;
      if (granted < requested) {
        note =
          globalRemaining < requested
            ? 'Se alcanzó el presupuesto global de puntos de hoy. Vuelve mañana.'
            : 'Alcanzaste tu límite de puntos de recompensa por hoy/semana.';
      }
      if (granted > 0) {
        const tx = this.economy.apply({
          userId,
          type: 'reward',
          idempotencyKey,
          details: { ...details, reason, requested },
          currency: [{ code: 'rp', delta: granted, reason }],
        });
        if (tx.duplicate) return { requested, granted: 0, note: null };
        this.analytics.track('rp_granted', userId, { amount: granted, reason });
      }
      return { requested, granted, note };
    });
  }

  realRedemptionsActive(): boolean {
    return this.ecoCfg.get().redemption.realRewardsEnabled && this.config.REAL_PAYOUTS_ALLOWED && !this.config.SANDBOX_MODE;
  }

  summary(userId: string) {
    const eco = this.ecoCfg.get();
    const bal = this.economy.balances(userId);
    const redemptions = this.db.all(
      'SELECT id, points, value_usd_cents, reward_type, status, sandbox, created_at, notes FROM reward_redemptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      userId,
    );
    const history = this.db.all(
      "SELECT delta, reason, created_at FROM ledger_entries WHERE user_id = ? AND currency_code = 'rp' ORDER BY created_at DESC, rowid DESC LIMIT 30",
      userId,
    );
    return {
      balance: bal.rp,
      valueUsdCents: this.ecoCfg.rpToUsdCents(bal.rp),
      limits: this.limits(userId),
      redemption: {
        realActive: this.realRedemptionsActive(),
        sandbox: !this.realRedemptionsActive(),
        minPoints: eco.redemption.minPoints,
        maxPointsPerRequest: eco.redemption.maxPointsPerRequest,
        cooldownDays: eco.redemption.cooldownDays,
        minAccountAgeDays: eco.redemption.minAccountAgeDays,
        monthlyCapUsdCents: eco.redemption.monthlyCapUsdCents,
        requireVerifiedEmail: eco.redemption.requireVerifiedEmail,
        rewardTypes: eco.redemption.rewardTypes,
        usdCentsPer1000: eco.rewardPoints.usdCentsPer1000,
      },
      redemptions,
      history,
    };
  }

  /** Solicitud de canje. Siempre queda pendiente de revisión manual. */
  redeem(userId: string, points: number, rewardType: string, idempotencyKey: string) {
    const eco = this.ecoCfg.get();
    const r = eco.redemption;
    const real = this.realRedemptionsActive();
    if (!real && !this.config.SANDBOX_MODE) {
      throw forbidden('Los canjes de puntos por recompensas reales están desactivados en este momento.');
    }
    if (!Number.isInteger(points) || points < r.minPoints) throw badRequest('below_minimum', `El mínimo para canjear es ${r.minPoints} puntos.`);
    if (points > r.maxPointsPerRequest) throw badRequest('above_maximum', `El máximo por solicitud es ${r.maxPointsPerRequest} puntos.`);
    if (!r.rewardTypes.includes(rewardType)) throw badRequest('invalid_reward_type', 'Tipo de recompensa no disponible.');

    const user = this.db.get<{ status: string; created_at: number; email_verified: number; fraud_score: number; rewards_hold: number }>(
      'SELECT status, created_at, email_verified, fraud_score, rewards_hold FROM users WHERE id = ?',
      userId,
    );
    if (!user || user.status !== 'active') throw forbidden('Cuenta no activa.');
    const now = clock.now();
    const reasons: string[] = [];
    if (user.rewards_hold) reasons.push('La cuenta está en revisión antifraude.');
    if (user.fraud_score > r.maxFraudScore) reasons.push('La cuenta tiene actividad sospechosa pendiente de revisión.');
    if (now - user.created_at < r.minAccountAgeDays * DAY_MS) reasons.push(`La cuenta debe tener al menos ${r.minAccountAgeDays} días.`);
    if (r.requireVerifiedEmail && !user.email_verified) reasons.push('Debes verificar tu correo electrónico.');
    const completed = this.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM mission_progress WHERE user_id = ? AND completions > 0", userId)?.n ?? 0;
    if (completed < r.minCompletedMissions) reasons.push(`Debes completar al menos ${r.minCompletedMissions} misterio(s).`);
    const last = this.db.get<{ created_at: number }>(
      "SELECT created_at FROM reward_redemptions WHERE user_id = ? AND status <> 'rejected' ORDER BY created_at DESC LIMIT 1",
      userId,
    );
    if (last && now - last.created_at < r.cooldownDays * DAY_MS) reasons.push(`Sólo puedes canjear una vez cada ${r.cooldownDays} días.`);
    const valueCents = this.ecoCfg.rpToUsdCents(points);
    const monthUsed =
      this.db.get<{ n: number | null }>(
        "SELECT SUM(value_usd_cents) AS n FROM reward_redemptions WHERE user_id = ? AND status <> 'rejected' AND created_at >= ?",
        userId,
        now - 30 * DAY_MS,
      )?.n ?? 0;
    if (monthUsed + valueCents > r.monthlyCapUsdCents) reasons.push('Superarías el tope mensual de canjes.');
    if (reasons.length) throw badRequest('redemption_not_allowed', reasons.join(' '), reasons);

    return this.db.tx(() => {
      const tx = this.economy.apply({
        userId,
        type: 'redemption',
        idempotencyKey,
        details: { points, rewardType, sandbox: !real },
        currency: [{ code: 'rp', delta: -points, reason: 'redemption' }],
      });
      if (tx.duplicate) throw badRequest('duplicate', 'Solicitud duplicada.');
      const id = newId();
      this.db.run(
        'INSERT INTO reward_redemptions(id, user_id, transaction_id, points, value_usd_cents, reward_type, status, sandbox, fraud_score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        id,
        userId,
        tx.txId,
        points,
        valueCents,
        rewardType,
        'pending_review',
        real ? 0 : 1,
        user.fraud_score,
        now,
      );
      this.analytics.track('redemption_requested', userId, { points, valueCents, sandbox: !real });
      this.log.info('redemption requested', { userId, points, sandbox: !real });
      return { id, status: 'pending_review', sandbox: !real, valueUsdCents: valueCents };
    });
  }

  /** Revisión manual por un administrador. Rechazar devuelve los puntos. */
  review(redemptionId: string, decision: 'approve' | 'reject' | 'mark_paid', reviewerId: string, notes: string | null) {
    return this.db.tx(() => {
      const red = this.db.get<{ id: string; user_id: string; points: number; status: string; sandbox: number }>(
        'SELECT id, user_id, points, status, sandbox FROM reward_redemptions WHERE id = ?',
        redemptionId,
      );
      if (!red) throw badRequest('not_found', 'Solicitud no encontrada');
      const now = clock.now();
      let status: string;
      if (decision === 'reject') {
        if (!['pending_review', 'approved', 'sandbox_approved'].includes(red.status)) throw badRequest('invalid_state', 'Estado no válido');
        this.economy.apply({
          userId: red.user_id,
          type: 'redemption',
          idempotencyKey: `redemption_refund:${red.id}`,
          details: { redemptionId: red.id },
          currency: [{ code: 'rp', delta: red.points, reason: 'redemption_refund' }],
        });
        status = 'rejected';
      } else if (decision === 'approve') {
        if (red.status !== 'pending_review') throw badRequest('invalid_state', 'Estado no válido');
        // No hay proveedor de pagos integrado: la aprobación NO mueve dinero.
        status = red.sandbox ? 'sandbox_approved' : 'approved';
      } else {
        if (red.sandbox) throw badRequest('sandbox', 'Una solicitud sandbox no puede marcarse como pagada.');
        if (red.status !== 'approved') throw badRequest('invalid_state', 'Sólo se pueden marcar como pagadas las aprobadas.');
        status = 'paid';
      }
      this.db.run(
        'UPDATE reward_redemptions SET status = ?, reviewed_by = ?, reviewed_at = ?, notes = ? WHERE id = ?',
        status,
        reviewerId,
        now,
        notes,
        red.id,
      );
      return { id: red.id, status };
    });
  }
}
