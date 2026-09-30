import type { Db } from '../../db/database';
import { json } from '../../db/database';
import type { Bus } from '../../lib/bus';
import { clock } from '../../lib/clock';
import { AppError, badRequest } from '../../lib/errors';
import { newId } from '../../lib/ids';
import type { CurrencyCode } from '../../../../shared/constants';
import type { ItemCatalog } from '../inventory/catalog';

export interface CurrencyLine {
  code: CurrencyCode;
  delta: number;
  reason: string;
}

export interface ItemGrant {
  itemId: string;
  qty: number;
}

export interface ItemRevoke {
  itemId?: string;
  instanceId?: string;
  qty: number;
}

export interface TxInput {
  userId: string;
  type: string;
  idempotencyKey: string;
  details?: Record<string, unknown>;
  currency?: CurrencyLine[];
  grantItems?: ItemGrant[];
  revokeItems?: ItemRevoke[];
  source?: string;
}

export interface TxResult {
  txId: string;
  duplicate: boolean;
  grantedInstances: { instanceId: string; itemId: string; qty: number }[];
}

export class InsufficientFunds extends AppError {
  constructor(code: string) {
    super(400, 'insufficient_funds', `Saldo insuficiente de ${code === 'coins' ? 'monedas' : code === 'gems' ? 'gemas' : 'puntos'}.`);
  }
}

/**
 * Libro mayor económico. ÚNICO punto por el que cambian saldos e inventarios.
 * - Idempotente: la misma `idempotencyKey` nunca se aplica dos veces.
 * - Atómico: saldo, asientos e inventario se escriben en la misma transacción.
 * - Saldos nunca negativos (CHECK en BD + verificación aquí).
 */
export class Economy {
  constructor(
    private readonly db: Db,
    private readonly bus: Bus,
    private readonly catalog: ItemCatalog,
  ) {}

  ensureWallets(userId: string) {
    const now = clock.now();
    for (const code of ['coins', 'gems', 'rp']) {
      this.db.run(
        'INSERT OR IGNORE INTO wallets(user_id, currency_code, balance, updated_at) VALUES (?, ?, 0, ?)',
        userId,
        code,
        now,
      );
    }
  }

  balances(userId: string): { coins: number; gems: number; rp: number } {
    const rows = this.db.all<{ currency_code: string; balance: number }>(
      'SELECT currency_code, balance FROM wallets WHERE user_id = ?',
      userId,
    );
    const out = { coins: 0, gems: 0, rp: 0 };
    for (const r of rows) (out as Record<string, number>)[r.currency_code] = r.balance;
    return out;
  }

  apply(input: TxInput): TxResult {
    const existing = this.db.get<{ id: string }>(
      'SELECT id FROM transactions WHERE idempotency_key = ?',
      input.idempotencyKey,
    );
    if (existing) return { txId: existing.id, duplicate: true, grantedInstances: [] };

    let walletChanged = false;
    let inventoryChanged = false;
    const result = this.db.tx(() => {
      const now = clock.now();
      const txId = newId();
      this.db.run(
        'INSERT INTO transactions(id, user_id, type, status, idempotency_key, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        txId,
        input.userId,
        input.type,
        'completed',
        input.idempotencyKey,
        json.str(input.details ?? {}),
        now,
      );
      this.ensureWallets(input.userId);

      for (const line of input.currency ?? []) {
        if (!Number.isInteger(line.delta)) throw badRequest('invalid_amount', 'Cantidad inválida');
        if (line.delta === 0) continue;
        const w = this.db.get<{ balance: number }>(
          'SELECT balance FROM wallets WHERE user_id = ? AND currency_code = ?',
          input.userId,
          line.code,
        );
        const next = (w?.balance ?? 0) + line.delta;
        if (next < 0) throw new InsufficientFunds(line.code);
        this.db.run(
          'UPDATE wallets SET balance = ?, updated_at = ? WHERE user_id = ? AND currency_code = ?',
          next,
          now,
          input.userId,
          line.code,
        );
        this.db.run(
          'INSERT INTO ledger_entries(id, transaction_id, user_id, currency_code, delta, balance_after, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          newId(),
          txId,
          input.userId,
          line.code,
          line.delta,
          next,
          line.reason,
          now,
        );
        walletChanged = true;
      }

      for (const rv of input.revokeItems ?? []) {
        this.revokeItem(txId, input.userId, rv, input.type, now);
        inventoryChanged = true;
      }

      const granted: TxResult['grantedInstances'] = [];
      for (const g of input.grantItems ?? []) {
        granted.push(...this.grantItem(txId, input.userId, g, input.source ?? input.type, now));
        inventoryChanged = true;
      }
      return { txId, duplicate: false, grantedInstances: granted };
    });

    this.db.onCommit(() => {
      if (walletChanged) this.bus.emit('wallet.changed', { userId: input.userId });
      if (inventoryChanged) this.bus.emit('inventory.changed', { userId: input.userId });
    });
    return result;
  }

  private grantItem(txId: string, userId: string, g: ItemGrant, source: string, now: number) {
    const item = this.catalog.require(g.itemId);
    if (!Number.isInteger(g.qty) || g.qty <= 0) throw badRequest('invalid_qty', 'Cantidad inválida');
    const out: TxResult['grantedInstances'] = [];
    if (item.stackable) {
      const inst = this.db.get<{ id: string; quantity: number }>(
        "SELECT id, quantity FROM inventory_items WHERE user_id = ? AND item_id = ? AND state = 'owned' ORDER BY acquired_at LIMIT 1",
        userId,
        g.itemId,
      );
      let instanceId: string;
      if (inst) {
        instanceId = inst.id;
        this.db.run('UPDATE inventory_items SET quantity = quantity + ?, updated_at = ? WHERE id = ?', g.qty, now, inst.id);
      } else {
        instanceId = newId();
        this.db.run(
          'INSERT INTO inventory_items(id, user_id, item_id, quantity, state, source, acquired_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          instanceId,
          userId,
          g.itemId,
          g.qty,
          'owned',
          source,
          now,
          now,
        );
      }
      this.logItem(txId, userId, g.itemId, instanceId, g.qty, source, now);
      out.push({ instanceId, itemId: g.itemId, qty: g.qty });
    } else {
      for (let i = 0; i < g.qty; i++) {
        const instanceId = newId();
        this.db.run(
          'INSERT INTO inventory_items(id, user_id, item_id, quantity, state, source, acquired_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?, ?)',
          instanceId,
          userId,
          g.itemId,
          'owned',
          source,
          now,
          now,
        );
        this.logItem(txId, userId, g.itemId, instanceId, 1, source, now);
        out.push({ instanceId, itemId: g.itemId, qty: 1 });
      }
    }
    return out;
  }

  private revokeItem(txId: string, userId: string, rv: ItemRevoke, reason: string, now: number) {
    let remaining = rv.qty;
    const rows = rv.instanceId
      ? this.db.all<{ id: string; item_id: string; quantity: number }>(
          "SELECT id, item_id, quantity FROM inventory_items WHERE id = ? AND user_id = ? AND state = 'owned'",
          rv.instanceId,
          userId,
        )
      : this.db.all<{ id: string; item_id: string; quantity: number }>(
          "SELECT id, item_id, quantity FROM inventory_items WHERE user_id = ? AND item_id = ? AND state = 'owned' ORDER BY acquired_at",
          userId,
          rv.itemId ?? '',
        );
    for (const r of rows) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, r.quantity);
      const left = r.quantity - take;
      if (left > 0) {
        this.db.run('UPDATE inventory_items SET quantity = ?, updated_at = ? WHERE id = ?', left, now, r.id);
      } else {
        this.db.run("UPDATE inventory_items SET quantity = 0, state = 'consumed', updated_at = ? WHERE id = ?", now, r.id);
      }
      this.logItem(txId, userId, r.item_id, r.id, -take, reason, now);
      remaining -= take;
    }
    if (remaining > 0) throw badRequest('item_not_owned', 'No tienes ese objeto.');
  }

  private logItem(txId: string, userId: string, itemId: string, instanceId: string, delta: number, reason: string, now: number) {
    this.db.run(
      'INSERT INTO item_ledger(id, transaction_id, user_id, item_id, instance_id, delta, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      newId(),
      txId,
      userId,
      itemId,
      instanceId,
      delta,
      reason,
      now,
    );
  }

  history(userId: string, limit = 50) {
    return this.db.all<{
      id: string;
      currency_code: string;
      delta: number;
      balance_after: number;
      reason: string;
      created_at: number;
      type: string;
    }>(
      `SELECT l.id, l.currency_code, l.delta, l.balance_after, l.reason, l.created_at, t.type
       FROM ledger_entries l JOIN transactions t ON t.id = l.transaction_id
       WHERE l.user_id = ? ORDER BY l.created_at DESC, l.rowid DESC LIMIT ?`,
      userId,
      limit,
    );
  }
}
