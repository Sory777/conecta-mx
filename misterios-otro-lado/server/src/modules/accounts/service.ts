import type { Db } from '../../db/database';
import { json } from '../../db/database';
import type { Bus } from '../../lib/bus';
import { clock } from '../../lib/clock';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { newId } from '../../lib/ids';
import { CHARACTER_NAME_RE, HEX_COLOR_RE } from '../../lib/sanitize';
import type { Appearance } from '../../../../shared/protocol';
import { heightAt, SPAWN } from '../../../../shared/world';
import type { Economy } from '../economy/ledger';
import type { ItemCatalog } from '../inventory/catalog';
import type { InventoryService } from '../inventory/service';

export interface CharacterRow {
  id: string;
  user_id: string;
  name: string;
  appearance: string;
  pos_x: number;
  pos_y: number;
  pos_z: number;
  rot_y: number;
  tracked_mission_id: string | null;
  play_seconds: number;
}

/** Separación: users (cuenta) ≠ characters (personaje) ≠ inventory ≠ wallet. */
export class AccountService {
  constructor(
    private readonly db: Db,
    private readonly bus: Bus,
    private readonly catalog: ItemCatalog,
    private readonly inventory: InventoryService,
    private readonly economy: Economy,
  ) {}

  character(userId: string): CharacterRow | undefined {
    return this.db.get<CharacterRow>('SELECT * FROM characters WHERE user_id = ? AND slot = 0', userId);
  }

  appearanceOf(c: CharacterRow): Appearance {
    return json.parse<Appearance>(c.appearance, { skin: '#c69c7b', hair: '#2b2118', coat: '#4a4a42', pants: '#2a2a2a' });
  }

  createCharacter(userId: string, name: string, appearance: Appearance) {
    if (this.character(userId)) throw conflict('character_exists', 'Ya tienes un personaje.');
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!CHARACTER_NAME_RE.test(clean)) throw badRequest('invalid_name', 'Nombre inválido (3-20 letras; puede incluir espacios, punto o guion).');
    if (this.db.get('SELECT 1 FROM characters WHERE name = ? COLLATE NOCASE', clean)) throw conflict('name_taken', 'Ese nombre ya está en uso.');
    for (const k of ['skin', 'hair', 'coat', 'pants'] as const) {
      if (!HEX_COLOR_RE.test(appearance[k] ?? '')) throw badRequest('invalid_color', `Color inválido: ${k}`);
    }
    const app: Appearance = {
      skin: appearance.skin,
      hair: appearance.hair,
      coat: appearance.coat,
      pants: appearance.pants,
      hat: null,
      outfit: null,
      lantern: this.inventory.owns(userId, 'linterna_basica') ? 'linterna_basica' : null,
    };
    const now = clock.now();
    const id = newId();
    // Pequeña dispersión para que los recién llegados no aparezcan unos encima de otros
    const a = Math.random() * Math.PI * 2;
    const sx = SPAWN.x + Math.cos(a) * 1.8;
    const sz = SPAWN.z + Math.sin(a) * 1.2;
    this.db.run(
      'INSERT INTO characters(id, user_id, slot, name, appearance, pos_x, pos_y, pos_z, rot_y, created_at, updated_at) VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)',
      id,
      userId,
      clean,
      json.str(app),
      sx,
      heightAt(sx, sz),
      sz,
      SPAWN.rotY,
      now,
      now,
    );
    return this.character(userId)!;
  }

  /** Equipar un cosmético: el servidor verifica propiedad y ranura. */
  equip(userId: string, slot: 'hat' | 'outfit' | 'lantern', itemId: string | null) {
    const c = this.character(userId);
    if (!c) throw notFound('Crea un personaje primero.');
    if (itemId) {
      const def = this.catalog.require(itemId);
      if (def.equipSlot !== slot) throw badRequest('wrong_slot', 'Ese objeto no va en esa ranura.');
      if (!this.inventory.owns(userId, itemId)) throw badRequest('not_owned', 'No tienes ese objeto.');
    }
    const app = this.appearanceOf(c);
    app[slot] = itemId;
    this.db.run('UPDATE characters SET appearance = ?, updated_at = ? WHERE id = ?', json.str(app), clock.now(), c.id);
    this.bus.emit('appearance.changed', { userId });
    return app;
  }

  savePosition(userId: string, x: number, y: number, z: number, rotY: number) {
    this.db.run('UPDATE characters SET pos_x = ?, pos_y = ?, pos_z = ?, rot_y = ?, updated_at = ? WHERE user_id = ? AND slot = 0', x, y, z, rotY, clock.now(), userId);
  }

  profile(userId: string) {
    const u = this.db.get<{ id: string; email: string; username: string; role: string; email_verified: number; xp: number; level: number; created_at: number; referral_code: string; rewards_hold: number }>(
      'SELECT id, email, username, role, email_verified, xp, level, created_at, referral_code, rewards_hold FROM users WHERE id = ?',
      userId,
    );
    if (!u) throw notFound('Usuario no encontrado');
    const c = this.character(userId);
    const stats = {
      missionsCompleted: this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM mission_progress WHERE user_id = ? AND completions > 0', userId)!.n,
      cluesFound: this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM player_clues WHERE user_id = ?', userId)!.n,
      itemsOwned: this.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM inventory_items WHERE user_id = ? AND state = 'owned'", userId)!.n,
      playSeconds: c?.play_seconds ?? 0,
      friends: this.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM friendships WHERE user_id = ? AND status = 'accepted'", userId)!.n,
    };
    return {
      user: {
        id: u.id,
        email: u.email,
        username: u.username,
        role: u.role,
        emailVerified: !!u.email_verified,
        xp: u.xp,
        level: u.level,
        createdAt: u.created_at,
        referralCode: u.referral_code,
        rewardsOnHold: !!u.rewards_hold,
      },
      character: c ? { id: c.id, name: c.name, appearance: this.appearanceOf(c) } : null,
      wallet: this.economy.balances(userId),
      stats,
    };
  }
}
