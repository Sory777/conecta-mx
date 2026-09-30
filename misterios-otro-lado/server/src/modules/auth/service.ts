import type { AppConfig } from '../../config/env';
import type { Db } from '../../db/database';
import { json } from '../../db/database';
import type { Bus } from '../../lib/bus';
import { clock, DAY_MS } from '../../lib/clock';
import { badRequest, conflict, forbidden, tooMany, unauthorized } from '../../lib/errors';
import { newId, randomToken, referralCode, sha256 } from '../../lib/ids';
import type { Logger } from '../../lib/logger';
import { RateLimiter } from '../../lib/rateLimit';
import { USERNAME_RE } from '../../lib/sanitize';
import type { AnalyticsService } from '../analytics/service';
import type { AntiFraudService } from '../antifraud/service';
import type { EconomyConfigService } from '../economy/config';
import type { Economy } from '../economy/ledger';
import type { ReferralService } from '../referrals/service';
import type { VerifiedInitData } from '../telegram/initData';
import type { Mailer } from './mailer';
import { DUMMY_HASH, hashPassword, verifyPassword } from './password';

export type Role = 'player' | 'moderator' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: Role;
  status: string;
  sessionId: string;
}

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

export class AuthService {
  private loginLimiter = new RateLimiter(8, 8 / 300); // 8 intentos / 5 min por clave
  private forgotLimiter = new RateLimiter(3, 3 / 3600);

  constructor(
    private readonly db: Db,
    private readonly config: AppConfig,
    private readonly bus: Bus,
    private readonly log: Logger,
    private readonly mailer: Mailer,
    private readonly economy: Economy,
    private readonly ecoCfg: EconomyConfigService,
    private readonly antifraud: AntiFraudService,
    private readonly analytics: AnalyticsService,
    private readonly referrals: ReferralService,
  ) {}

  async register(input: { email: string; username: string; password: string; referralCode?: string | null; deviceId: string }, ip: string, ua: string) {
    const email = input.email.trim().toLowerCase();
    const username = input.username.trim();
    if (!EMAIL_RE.test(email)) throw badRequest('invalid_email', 'Correo electrónico inválido.');
    if (!USERNAME_RE.test(username)) throw badRequest('invalid_username', 'El usuario debe tener 3-20 caracteres (letras, números o _).');
    if (input.password.length < 8 || input.password.length > 128) throw badRequest('weak_password', 'La contraseña debe tener entre 8 y 128 caracteres.');
    if (!/[A-Za-z]/.test(input.password) || !/[0-9]/.test(input.password)) {
      throw badRequest('weak_password', 'La contraseña debe incluir letras y números.');
    }
    const maxPerIp = this.ecoCfg.get().antifraud.maxRegistrationsPerIpPerDay;
    if (this.antifraud.registrationsFromIp(ip) >= maxPerIp) {
      this.antifraud.flag(null, 'registration_velocity', 0, { ip }, ip);
      throw tooMany('Se han creado demasiadas cuentas desde esta red hoy. Inténtalo mañana.');
    }
    if (this.db.get('SELECT 1 FROM users WHERE email = ?', email)) throw conflict('email_taken', 'Ese correo ya está registrado.');
    if (this.db.get('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE', username)) throw conflict('username_taken', 'Ese nombre de usuario ya existe.');

    const passwordHash = await hashPassword(input.password);
    const id = newId();
    const now = clock.now();
    const verifyToken = randomToken();
    this.db.tx(() => {
      let code = referralCode();
      while (this.db.get('SELECT 1 FROM users WHERE referral_code = ?', code)) code = referralCode();
      this.db.run(
        'INSERT INTO users(id, email, username, password_hash, role, status, referral_code, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        id,
        email,
        username,
        passwordHash,
        'player',
        'active',
        code,
        now,
      );
      this.initAccount(id, input.deviceId, ip, ua, 'register');
      this.db.run(
        'INSERT INTO email_verifications(id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
        newId(),
        id,
        sha256(verifyToken),
        now,
        now + 3 * DAY_MS,
      );
      if (input.referralCode) this.referrals.attach(id, input.referralCode.trim().toUpperCase(), ip);
    });
    this.mailer.send(email, 'Verifica tu correo — Misterios: El Otro Lado', `${this.config.PUBLIC_BASE_URL}/?verify=${verifyToken}`);
    this.analytics.track('user_registered', id, { referred: !!input.referralCode });
    this.log.info('user registered', { userId: id });
    return this.createSession(id, input.deviceId, ip, ua);
  }

  async login(input: { login: string; password: string; deviceId: string }, ip: string, ua: string) {
    const login = input.login.trim().toLowerCase();
    if (!this.loginLimiter.take(`ip:${ip}`) || !this.loginLimiter.take(`acct:${login}`)) {
      throw tooMany('Demasiados intentos de inicio de sesión. Espera unos minutos.');
    }
    const u = this.db.get<{ id: string; password_hash: string; status: string; status_reason: string | null }>(
      'SELECT id, password_hash, status, status_reason FROM users WHERE email = ? OR username = ? COLLATE NOCASE',
      login,
      login,
    );
    const ok = await verifyPassword(input.password, u?.password_hash ?? DUMMY_HASH);
    if (!u || !ok) {
      if (u) this.analytics.track('login_failed', u.id, {});
      throw unauthorized('Usuario o contraseña incorrectos.');
    }
    if (u.status === 'banned') throw forbidden(`Cuenta bloqueada${u.status_reason ? ': ' + u.status_reason : ''}.`);
    if (u.status === 'suspended') throw forbidden(`Cuenta suspendida${u.status_reason ? ': ' + u.status_reason : ''}.`);
    this.antifraud.registerDevice(u.id, input.deviceId, ip);
    this.db.run('UPDATE users SET last_login_at = ? WHERE id = ?', clock.now(), u.id);
    this.analytics.track('login', u.id, {});
    return this.createSession(u.id, input.deviceId, ip, ua);
  }

  /** Billetera, kit inicial, dispositivo y auditoría de una cuenta nueva (dentro de una transacción). */
  private initAccount(id: string, deviceId: string, ip: string, ua: string, action: string) {
    const eco = this.ecoCfg.get();
    const now = clock.now();
    this.economy.ensureWallets(id);
    this.economy.apply({
      userId: id,
      type: 'starter',
      idempotencyKey: `starter:${id}`,
      currency: eco.starter.coins > 0 ? [{ code: 'coins', delta: eco.starter.coins, reason: 'starter_pack' }] : [],
      grantItems: eco.starter.items.map((itemId) => ({ itemId, qty: 1 })),
      source: 'starter',
    });
    this.antifraud.registerDevice(id, deviceId, ip);
    this.db.run(
      'INSERT INTO audit_log(id, actor_id, action, target_type, target_id, details, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      newId(),
      id,
      action,
      'user',
      id,
      json.str({ ua: ua.slice(0, 200) }),
      ip,
      now,
    );
  }

  /**
   * Acceso desde una Telegram Mini App. `tg` ya fue verificado criptográficamente (initData).
   * Crea la cuenta la primera vez (una cuenta de Telegram = una cuenta de juego).
   */
  async loginWithTelegram(tg: VerifiedInitData, input: { deviceId: string; referralCode?: string | null }, ip: string, ua: string) {
    const tgId = String(tg.user.id);
    const now = clock.now();
    const link = this.db.get<{ user_id: string }>('SELECT user_id FROM telegram_accounts WHERE telegram_id = ?', tgId);
    let userId = link?.user_id;
    let created = false;
    if (!userId) {
      const maxPerIp = this.ecoCfg.get().antifraud.maxRegistrationsPerIpPerDay;
      if (this.antifraud.registrationsFromIp(ip) >= maxPerIp) throw tooMany('Se han creado demasiadas cuentas desde esta red hoy.');
      const base = (tg.user.username ?? `tg${tgId}`).replace(/[^A-Za-z0-9_]/g, '').slice(0, 16) || `tg${tgId}`.slice(0, 16);
      let username = base.length >= 3 ? base : `tg_${base}`;
      for (let i = 2; this.db.get('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE', username); i++) username = `${base.slice(0, 16)}_${i}`;
      const passwordHash = await hashPassword(randomToken(24)); // inutilizable: se entra sólo por Telegram
      const id = newId();
      this.db.tx(() => {
        let code = referralCode();
        while (this.db.get('SELECT 1 FROM users WHERE referral_code = ?', code)) code = referralCode();
        // La identidad la verifica Telegram; el correo es un marcador interno no entregable.
        this.db.run(
          'INSERT INTO users(id, email, username, password_hash, role, status, email_verified, referral_code, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)',
          id,
          `tg${tgId}@telegram.invalid`,
          username,
          passwordHash,
          'player',
          'active',
          code,
          now,
        );
        this.db.run(
          'INSERT INTO telegram_accounts(telegram_id, user_id, username, first_name, language_code, is_premium, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          tgId,
          id,
          tg.user.username ?? null,
          tg.user.first_name?.slice(0, 64) ?? null,
          tg.user.language_code ?? null,
          tg.user.is_premium ? 1 : 0,
          now,
          now,
        );
        this.initAccount(id, input.deviceId, ip, ua, 'register');
        const ref = (input.referralCode ?? tg.startParam ?? '').trim().toUpperCase();
        if (/^[A-Z0-9]{6,12}$/.test(ref)) this.referrals.attach(id, ref, ip);
      });
      userId = id;
      created = true;
      this.analytics.track('user_registered', id, { via: 'telegram', referred: !!(input.referralCode ?? tg.startParam) });
    } else {
      const u = this.db.get<{ status: string; status_reason: string | null }>('SELECT status, status_reason FROM users WHERE id = ?', userId)!;
      if (u.status !== 'active') throw forbidden(`Cuenta ${u.status === 'banned' ? 'bloqueada' : 'suspendida'}${u.status_reason ? ': ' + u.status_reason : ''}.`);
      this.db.run('UPDATE telegram_accounts SET last_seen = ?, username = ?, is_premium = ? WHERE telegram_id = ?', now, tg.user.username ?? null, tg.user.is_premium ? 1 : 0, tgId);
      this.antifraud.registerDevice(userId, input.deviceId, ip);
      this.db.run('UPDATE users SET last_login_at = ? WHERE id = ?', now, userId);
      this.analytics.track('login', userId, { via: 'telegram' });
    }
    return { ...this.createSession(userId, input.deviceId, ip, ua), created, firstName: tg.user.first_name ?? null };
  }

  private createSession(userId: string, deviceId: string, ip: string, ua: string) {
    const token = randomToken(32);
    const now = clock.now();
    this.db.run(
      'INSERT INTO sessions(id, user_id, token_hash, device_id, ip, user_agent, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      newId(),
      userId,
      sha256(token),
      this.antifraud.hashDevice(deviceId),
      ip,
      ua.slice(0, 200),
      now,
      now + this.config.SESSION_TTL_HOURS * 3600_000,
    );
    return { token, userId };
  }

  /** Valida un token de sesión. Devuelve null si es inválido, expiró o la cuenta no está activa. */
  authenticate(token: string | undefined | null): AuthUser | null {
    if (!token || token.length > 200) return null;
    const row = this.db.get<{ sid: string; id: string; email: string; username: string; role: Role; status: string; expires_at: number; revoked_at: number | null }>(
      `SELECT s.id AS sid, s.expires_at, s.revoked_at, u.id, u.email, u.username, u.role, u.status
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
      sha256(token),
    );
    if (!row || row.revoked_at || row.expires_at < clock.now() || row.status !== 'active') return null;
    return { id: row.id, email: row.email, username: row.username, role: row.role, status: row.status, sessionId: row.sid };
  }

  logout(sessionId: string) {
    this.db.run('UPDATE sessions SET revoked_at = ? WHERE id = ?', clock.now(), sessionId);
  }

  revokeAll(userId: string) {
    this.db.run('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', clock.now(), userId);
  }

  /** Siempre responde igual exista o no la cuenta (evita enumeración de correos). */
  forgotPassword(emailRaw: string, ip: string) {
    const email = emailRaw.trim().toLowerCase();
    if (!this.forgotLimiter.take(`ip:${ip}`) || !this.forgotLimiter.take(`e:${email}`)) return;
    const u = this.db.get<{ id: string }>('SELECT id FROM users WHERE email = ?', email);
    if (!u) return;
    const token = randomToken();
    const now = clock.now();
    this.db.run(
      'INSERT INTO password_resets(id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
      newId(),
      u.id,
      sha256(token),
      now,
      now + 3600_000,
    );
    this.mailer.send(email, 'Recupera tu contraseña — Misterios: El Otro Lado', `${this.config.PUBLIC_BASE_URL}/?reset=${token}`);
  }

  async resetPassword(token: string, newPassword: string) {
    if (newPassword.length < 8 || newPassword.length > 128 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      throw badRequest('weak_password', 'La contraseña debe tener 8-128 caracteres con letras y números.');
    }
    const r = this.db.get<{ id: string; user_id: string; expires_at: number; used_at: number | null }>(
      'SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?',
      sha256(token),
    );
    if (!r || r.used_at || r.expires_at < clock.now()) throw badRequest('invalid_token', 'El enlace no es válido o expiró.');
    const hash = await hashPassword(newPassword);
    this.db.tx(() => {
      this.db.run('UPDATE users SET password_hash = ? WHERE id = ?', hash, r.user_id);
      this.db.run('UPDATE password_resets SET used_at = ? WHERE id = ?', clock.now(), r.id);
      this.revokeAll(r.user_id);
    });
  }

  verifyEmail(token: string) {
    const r = this.db.get<{ id: string; user_id: string; expires_at: number; used_at: number | null }>(
      'SELECT id, user_id, expires_at, used_at FROM email_verifications WHERE token_hash = ?',
      sha256(token),
    );
    if (!r || r.used_at || r.expires_at < clock.now()) throw badRequest('invalid_token', 'El enlace no es válido o expiró.');
    this.db.tx(() => {
      this.db.run('UPDATE users SET email_verified = 1 WHERE id = ?', r.user_id);
      this.db.run('UPDATE email_verifications SET used_at = ? WHERE id = ?', clock.now(), r.id);
    });
  }

  setStatus(userId: string, status: 'active' | 'suspended' | 'banned', reason: string | null) {
    this.db.run('UPDATE users SET status = ?, status_reason = ? WHERE id = ?', status, reason, userId);
    if (status !== 'active') this.revokeAll(userId);
    this.bus.emit('user.status', { userId, status, reason });
  }
}
