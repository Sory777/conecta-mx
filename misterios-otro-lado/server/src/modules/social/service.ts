import type { Db } from '../../db/database';
import { json } from '../../db/database';
import { clock, DAY_MS } from '../../lib/clock';
import { badRequest, notFound, tooMany } from '../../lib/errors';
import { newId } from '../../lib/ids';
import { cleanText } from '../../lib/sanitize';

export const REPORT_REASONS = ['acoso', 'lenguaje_ofensivo', 'trampas', 'spam', 'nombre_inapropiado', 'estafa', 'otro'] as const;

export class SocialService {
  /** Proveedor de "¿está en línea?" (lo aporta el gateway multijugador). */
  isOnline: (userId: string) => boolean = () => false;

  constructor(private readonly db: Db) {}

  findUser(username: string) {
    return this.db.get<{ id: string; username: string }>('SELECT id, username FROM users WHERE username = ? COLLATE NOCASE', username.trim());
  }

  findUserById(id: string) {
    return this.db.get<{ id: string; username: string }>('SELECT id, username FROM users WHERE id = ?', id);
  }

  isBlockedEither(a: string, b: string): boolean {
    return !!this.db.get('SELECT 1 FROM blocks WHERE (user_id = ? AND blocked_id = ?) OR (user_id = ? AND blocked_id = ?)', a, b, b, a);
  }

  blockedBy(userId: string): Set<string> {
    // Usuarios que `userId` bloqueó + usuarios que bloquearon a `userId`
    const rows = this.db.all<{ other: string }>(
      'SELECT blocked_id AS other FROM blocks WHERE user_id = ? UNION SELECT user_id AS other FROM blocks WHERE blocked_id = ?',
      userId,
      userId,
    );
    return new Set(rows.map((r) => r.other));
  }

  friends(userId: string) {
    const rows = this.db.all<{ id: string; username: string; status: string; direction: string; name: string | null }>(
      `SELECT u.id, u.username, f.status, 'out' AS direction, c.name FROM friendships f JOIN users u ON u.id = f.friend_id LEFT JOIN characters c ON c.user_id = u.id WHERE f.user_id = ?
       UNION ALL
       SELECT u.id, u.username, f.status, 'in' AS direction, c.name FROM friendships f JOIN users u ON u.id = f.user_id LEFT JOIN characters c ON c.user_id = u.id WHERE f.friend_id = ? AND f.status = 'pending'`,
      userId,
      userId,
    );
    return rows.map((r) => ({
      userId: r.id,
      username: r.username,
      characterName: r.name,
      status: r.status === 'accepted' ? 'accepted' : r.direction === 'in' ? 'incoming' : 'outgoing',
      online: r.status === 'accepted' ? this.isOnline(r.id) : false,
    }));
  }

  requestFriend(userId: string, username: string | null, targetId?: string | null) {
    const target = targetId ? this.findUserById(targetId) : username ? this.findUser(username) : undefined;
    if (!target) throw notFound('Jugador no encontrado.');
    if (target.id === userId) throw badRequest('self', 'No puedes agregarte a ti mismo.');
    if (this.isBlockedEither(userId, target.id)) throw badRequest('blocked', 'No puedes enviar solicitud a este jugador.');
    const count = this.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM friendships WHERE user_id = ? AND status = 'accepted'", userId)!.n;
    if (count >= 200) throw badRequest('limit', 'Alcanzaste el máximo de amigos.');
    const reverse = this.db.get<{ status: string }>('SELECT status FROM friendships WHERE user_id = ? AND friend_id = ?', target.id, userId);
    const now = clock.now();
    if (reverse) {
      // Ya había solicitud en sentido contrario: se acepta
      this.acceptFriend(userId, target.id);
      return { status: 'accepted' };
    }
    this.db.run('INSERT OR IGNORE INTO friendships(user_id, friend_id, status, created_at) VALUES (?, ?, ?, ?)', userId, target.id, 'pending', now);
    return { status: 'pending', targetId: target.id };
  }

  acceptFriend(userId: string, fromId: string) {
    const req = this.db.get('SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ? AND status = ?', fromId, userId, 'pending');
    const existing = this.db.get('SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?', fromId, userId);
    if (!req && !existing) throw notFound('No hay solicitud pendiente.');
    const now = clock.now();
    this.db.tx(() => {
      this.db.run("UPDATE friendships SET status = 'accepted' WHERE user_id = ? AND friend_id = ?", fromId, userId);
      this.db.run(
        "INSERT INTO friendships(user_id, friend_id, status, created_at) VALUES (?, ?, 'accepted', ?) ON CONFLICT(user_id, friend_id) DO UPDATE SET status = 'accepted'",
        userId,
        fromId,
        now,
      );
    });
  }

  removeFriend(userId: string, otherId: string) {
    this.db.run('DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)', userId, otherId, otherId, userId);
  }

  block(userId: string, targetId: string) {
    if (userId === targetId) throw badRequest('self', 'No puedes bloquearte a ti mismo.');
    if (!this.db.get('SELECT 1 FROM users WHERE id = ?', targetId)) throw notFound('Jugador no encontrado.');
    this.db.tx(() => {
      this.db.run('INSERT OR IGNORE INTO blocks(user_id, blocked_id, created_at) VALUES (?, ?, ?)', userId, targetId, clock.now());
      this.removeFriend(userId, targetId);
    });
  }

  unblock(userId: string, targetId: string) {
    this.db.run('DELETE FROM blocks WHERE user_id = ? AND blocked_id = ?', userId, targetId);
  }

  blocks(userId: string) {
    return this.db.all<{ userId: string; username: string }>(
      'SELECT u.id AS userId, u.username FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.user_id = ?',
      userId,
    );
  }

  report(reporterId: string, targetId: string, reason: string, detailsRaw: string | null, context: Record<string, unknown>) {
    if (reporterId === targetId) throw badRequest('self', 'No puedes reportarte a ti mismo.');
    if (!(REPORT_REASONS as readonly string[]).includes(reason)) throw badRequest('invalid_reason', 'Motivo inválido.');
    if (!this.db.get('SELECT 1 FROM users WHERE id = ?', targetId)) throw notFound('Jugador no encontrado.');
    const today = this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM reports WHERE reporter_id = ? AND created_at > ?', reporterId, clock.now() - DAY_MS)!.n;
    if (today >= 15) throw tooMany('Has enviado demasiados reportes hoy.');
    // Evidencia: últimos mensajes de chat del reportado (se conservan para moderación)
    const recentChat = this.db.all('SELECT channel, text, created_at FROM chat_messages WHERE sender_id = ? ORDER BY created_at DESC LIMIT 20', targetId);
    const id = newId();
    this.db.run(
      'INSERT INTO reports(id, reporter_id, target_id, reason, details, context, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      id,
      reporterId,
      targetId,
      reason,
      detailsRaw ? cleanText(detailsRaw, 500) : null,
      json.str({ ...context, recentChat }),
      'open',
      clock.now(),
    );
    return { id };
  }
}
