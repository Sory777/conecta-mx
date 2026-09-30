import type { AppConfig } from '../../config/env';
import type { Db } from '../../db/database';
import { json } from '../../db/database';
import { clock, DAY_MS } from '../../lib/clock';
import { hmac, newId } from '../../lib/ids';
import type { Logger } from '../../lib/logger';
import type { EconomyConfigService } from '../economy/config';

/**
 * Antifraude: registra actividad sospechosa, acumula un fraud_score por cuenta y
 * retiene recompensas de valor real cuando supera el umbral. Nunca decide con datos del cliente
 * sin verificarlos: el dispositivo se usa como SEÑAL (se puede falsificar), no como prueba.
 */
export class AntiFraudService {
  constructor(
    private readonly db: Db,
    private readonly config: AppConfig,
    private readonly economy: EconomyConfigService,
    private readonly log: Logger,
  ) {}

  hashDevice(rawDeviceId: string): string {
    return hmac(this.config.serverSecret, `device:${rawDeviceId.slice(0, 128)}`).slice(0, 40);
  }

  flag(userId: string | null, type: string, severity: number, details: Record<string, unknown> = {}, ip?: string | null, deviceId?: string | null) {
    const now = clock.now();
    this.db.run(
      'INSERT INTO suspicious_activity(id, user_id, type, severity, details, ip, device_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      newId(),
      userId,
      type,
      severity,
      json.str(details),
      ip ?? null,
      deviceId ?? null,
      now,
    );
    if (!userId || severity <= 0) return;
    this.db.run('UPDATE users SET fraud_score = fraud_score + ? WHERE id = ?', severity, userId);
    const u = this.db.get<{ fraud_score: number; rewards_hold: number }>('SELECT fraud_score, rewards_hold FROM users WHERE id = ?', userId);
    const threshold = this.economy.get().antifraud.holdThreshold;
    if (u && !u.rewards_hold && u.fraud_score >= threshold) {
      this.db.run('UPDATE users SET rewards_hold = 1 WHERE id = ?', userId);
      this.db.run(
        'INSERT INTO audit_log(id, actor_id, action, target_type, target_id, details, created_at) VALUES (?, NULL, ?, ?, ?, ?, ?)',
        newId(),
        'auto_rewards_hold',
        'user',
        userId,
        json.str({ fraudScore: u.fraud_score, trigger: type }),
        now,
      );
      this.log.warn('rewards hold applied', { userId, fraudScore: u.fraud_score, trigger: type });
    }
  }

  /** Registra el dispositivo para la cuenta y detecta multicuentas. Devuelve el hash del dispositivo. */
  registerDevice(userId: string, rawDeviceId: string, ip: string | null): string {
    const deviceId = this.hashDevice(rawDeviceId || 'unknown');
    const now = clock.now();
    this.db.run(
      'INSERT INTO devices(id, first_seen, last_seen) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET last_seen = excluded.last_seen',
      deviceId,
      now,
      now,
    );
    const existing = this.db.get('SELECT 1 FROM user_devices WHERE user_id = ? AND device_id = ?', userId, deviceId);
    this.db.run(
      `INSERT INTO user_devices(user_id, device_id, first_seen, last_seen, last_ip) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, device_id) DO UPDATE SET last_seen = excluded.last_seen, last_ip = excluded.last_ip`,
      userId,
      deviceId,
      now,
      now,
      ip,
    );
    if (!existing) {
      const n = this.db.get<{ n: number }>('SELECT COUNT(DISTINCT user_id) AS n FROM user_devices WHERE device_id = ?', deviceId)?.n ?? 0;
      const max = this.economy.get().antifraud.maxAccountsPerDevice;
      if (n > max) {
        this.flag(userId, 'multi_account_device', 15, { accountsOnDevice: n, max }, ip, deviceId);
      }
    }
    return deviceId;
  }

  devicesOf(userId: string): Set<string> {
    return new Set(
      this.db.all<{ device_id: string }>('SELECT device_id FROM user_devices WHERE user_id = ?', userId).map((r) => r.device_id),
    );
  }

  sharesDevice(a: string, b: string): boolean {
    const r = this.db.get(
      'SELECT 1 FROM user_devices x JOIN user_devices y ON x.device_id = y.device_id WHERE x.user_id = ? AND y.user_id = ? LIMIT 1',
      a,
      b,
    );
    return !!r;
  }

  sharesIp(a: string, b: string): boolean {
    const r = this.db.get(
      'SELECT 1 FROM user_devices x JOIN user_devices y ON x.last_ip = y.last_ip WHERE x.user_id = ? AND y.user_id = ? AND x.last_ip IS NOT NULL LIMIT 1',
      a,
      b,
    );
    return !!r;
  }

  /** Registros desde la misma IP en las últimas 24 h (limita granjas de cuentas). */
  registrationsFromIp(ip: string): number {
    return (
      this.db.get<{ n: number }>(
        "SELECT COUNT(*) AS n FROM audit_log WHERE action = 'register' AND ip = ? AND created_at > ?",
        ip,
        clock.now() - DAY_MS,
      )?.n ?? 0
    );
  }

  userRisk(userId: string): { fraudScore: number; hold: boolean } {
    const u = this.db.get<{ fraud_score: number; rewards_hold: number }>('SELECT fraud_score, rewards_hold FROM users WHERE id = ?', userId);
    return { fraudScore: u?.fraud_score ?? 0, hold: !!u?.rewards_hold };
  }
}
