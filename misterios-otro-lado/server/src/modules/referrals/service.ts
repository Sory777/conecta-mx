import type { Db } from '../../db/database';
import type { Bus } from '../../lib/bus';
import { clock, DAY_MS } from '../../lib/clock';
import { newId } from '../../lib/ids';
import type { Logger } from '../../lib/logger';
import type { AntiFraudService } from '../antifraud/service';
import type { EconomyConfigService } from '../economy/config';
import type { Economy } from '../economy/ledger';
import type { RewardsService } from '../rewards/service';

/**
 * Referidos: crear una cuenta NO da recompensa. Sólo cuando el invitado demuestra actividad
 * legítima (completa el misterio de calificación y acumula tiempo de juego) y no comparte
 * dispositivo con quien lo invitó.
 */
export class ReferralService {
  constructor(
    private readonly db: Db,
    private readonly bus: Bus,
    private readonly log: Logger,
    private readonly economy: Economy,
    private readonly ecoCfg: EconomyConfigService,
    private readonly rewards: () => RewardsService,
    private readonly antifraud: AntiFraudService,
  ) {
    bus.on('mission.completed', ({ userId, missionId, firstTime }) => {
      if (firstTime && missionId === this.ecoCfg.get().referral.qualifyingMissionId) {
        try {
          this.tryQualify(userId);
        } catch (e) {
          this.log.error('referral qualify failed', { userId, err: String(e) });
        }
      }
    });
  }

  attach(refereeId: string, code: string, ip: string) {
    const cfg = this.ecoCfg.get().referral;
    if (!cfg.enabled) return;
    const referrer = this.db.get<{ id: string }>('SELECT id FROM users WHERE referral_code = ?', code);
    if (!referrer) return;
    let status: 'pending' | 'rejected' = 'pending';
    let reason: string | null = null;
    if (referrer.id === refereeId) {
      status = 'rejected';
      reason = 'self_referral';
    } else if (this.antifraud.sharesDevice(referrer.id, refereeId)) {
      status = 'rejected';
      reason = 'same_device';
      this.antifraud.flag(referrer.id, 'referral_same_device', 10, { refereeId }, ip);
    }
    this.db.run(
      'INSERT INTO referrals(id, referrer_id, referee_id, status, reject_reason, created_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      newId(),
      referrer.id,
      refereeId,
      status,
      reason,
      clock.now(),
      status === 'rejected' ? clock.now() : null,
    );
  }

  tryQualify(refereeId: string) {
    const cfg = this.ecoCfg.get().referral;
    const ref = this.db.get<{ id: string; referrer_id: string; status: string }>(
      "SELECT id, referrer_id, status FROM referrals WHERE referee_id = ? AND status = 'pending'",
      refereeId,
    );
    if (!ref || !cfg.enabled) return;
    const play = this.db.get<{ s: number | null }>('SELECT SUM(duration_sec) AS s FROM play_sessions WHERE user_id = ?', refereeId)?.s ?? 0;
    const character = this.db.get<{ play_seconds: number }>('SELECT play_seconds FROM characters WHERE user_id = ?', refereeId);
    const seconds = Math.max(play, character?.play_seconds ?? 0);
    if (seconds < cfg.minPlayMinutes * 60) return; // se reintenta en el próximo cierre de sesión

    const reject = (reason: string) => {
      this.db.run("UPDATE referrals SET status = 'rejected', reject_reason = ?, resolved_at = ? WHERE id = ?", reason, clock.now(), ref.id);
    };
    if (this.antifraud.sharesDevice(ref.referrer_id, refereeId)) {
      this.antifraud.flag(ref.referrer_id, 'referral_same_device', 10, { refereeId });
      return reject('same_device');
    }
    if (this.antifraud.userRisk(refereeId).hold || this.antifraud.userRisk(ref.referrer_id).hold) return reject('fraud_hold');
    const sameIp = this.antifraud.sharesIp(ref.referrer_id, refereeId);
    if (sameIp) this.antifraud.flag(ref.referrer_id, 'referral_same_ip', 3, { refereeId });
    const monthCount =
      this.db.get<{ n: number }>(
        "SELECT COUNT(*) AS n FROM referrals WHERE referrer_id = ? AND status = 'rewarded' AND resolved_at > ?",
        ref.referrer_id,
        clock.now() - 30 * DAY_MS,
      )?.n ?? 0;
    if (monthCount >= cfg.maxRewardedPerMonth) return reject('monthly_cap');

    this.db.tx(() => {
      this.economy.apply({
        userId: ref.referrer_id,
        type: 'referral',
        idempotencyKey: `referral_referrer:${ref.id}`,
        details: { refereeId },
        currency: [{ code: 'coins', delta: cfg.referrerCoins, reason: 'referral' }],
      });
      this.economy.apply({
        userId: refereeId,
        type: 'referral',
        idempotencyKey: `referral_referee:${ref.id}`,
        details: { referrerId: ref.referrer_id },
        currency: [{ code: 'coins', delta: cfg.refereeCoins, reason: 'referral_welcome' }],
      });
      // Si comparten IP (p. ej. misma casa) se paga en monedas pero NO en puntos de recompensa.
      if (!sameIp && cfg.referrerRp > 0) this.rewards().grant(ref.referrer_id, cfg.referrerRp, 'referral', `referral_rp:${ref.id}`);
      this.db.run("UPDATE referrals SET status = 'rewarded', resolved_at = ? WHERE id = ?", clock.now(), ref.id);
    });
    this.bus.emit('notice', { userId: ref.referrer_id, level: 'success', text: '¡Un amigo que invitaste completó su primer misterio! Recibiste tu recompensa de referido.' });
  }

  summary(userId: string) {
    const code = this.db.get<{ referral_code: string }>('SELECT referral_code FROM users WHERE id = ?', userId)?.referral_code;
    const rows = this.db.all<{ status: string; n: number }>('SELECT status, COUNT(*) AS n FROM referrals WHERE referrer_id = ? GROUP BY status', userId);
    const cfg = this.ecoCfg.get().referral;
    return {
      code,
      enabled: cfg.enabled,
      stats: Object.fromEntries(rows.map((r) => [r.status, r.n])),
      rules: `Tu amigo debe completar «Los desaparecidos de la casa abandonada» y jugar al menos ${cfg.minPlayMinutes} minutos. Recibes ${cfg.referrerCoins} monedas (+${cfg.referrerRp} puntos) y tu amigo ${cfg.refereeCoins} monedas. No cuentan cuentas del mismo dispositivo.`,
    };
  }
}
