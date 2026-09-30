import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clock, DAY_MS } from '../src/lib/clock';
import type { GameServer } from '../src/app';
import { registerPlayer, startTestServer, stop } from './helpers';

let server: GameServer;
let base: string;

beforeAll(async () => {
  ({ server, base } = await startTestServer());
});
afterAll(async () => stop(server));

describe('libro mayor económico', () => {
  it('es idempotente: la misma clave no se aplica dos veces', async () => {
    const p = await registerPlayer(base, 'idem');
    const s = server.services;
    const before = s.economy.balances(p.userId).coins;
    const a = s.economy.apply({ userId: p.userId, type: 'test', idempotencyKey: 'k1', currency: [{ code: 'coins', delta: 50, reason: 't' }] });
    const b = s.economy.apply({ userId: p.userId, type: 'test', idempotencyKey: 'k1', currency: [{ code: 'coins', delta: 50, reason: 't' }] });
    expect(a.duplicate).toBe(false);
    expect(b.duplicate).toBe(true);
    expect(s.economy.balances(p.userId).coins).toBe(before + 50);
  });

  it('nunca deja saldos negativos y revierte todo si falla', async () => {
    const p = await registerPlayer(base, 'neg');
    const s = server.services;
    const inv0 = s.inventory.list(p.userId).length;
    expect(() =>
      s.economy.apply({
        userId: p.userId,
        type: 'test',
        idempotencyKey: 'neg1',
        currency: [{ code: 'gems', delta: -1, reason: 't' }],
        grantItems: [{ itemId: 'lupa', qty: 1 }],
      }),
    ).toThrow(/insuficiente/);
    expect(s.economy.balances(p.userId).gems).toBe(0);
    expect(s.inventory.list(p.userId).length).toBe(inv0);
    // La clave no quedó "quemada" por el fallo
    expect(s.db.get("SELECT 1 FROM transactions WHERE idempotency_key = 'neg1'")).toBeUndefined();
  });

  it('respeta los límites diarios de puntos de recompensa', async () => {
    const p = await registerPlayer(base, 'caps');
    const s = server.services;
    const cap = s.ecoCfg.get().rewardPoints.dailyCap;
    const r1 = s.rewards.grant(p.userId, cap - 10, 'test', 'cap1');
    const r2 = s.rewards.grant(p.userId, 100, 'test', 'cap2');
    expect(r1.granted).toBe(cap - 10);
    expect(r2.granted).toBe(10);
    expect(r2.note).toMatch(/límite/);
    const r3 = s.rewards.grant(p.userId, 5, 'test', 'cap3');
    expect(r3.granted).toBe(0);
  });

  it('respeta el presupuesto global diario de puntos', async () => {
    const s = server.services;
    s.ecoCfg.update({ rewardPoints: { globalDailyBudgetUsdCents: 0 } }, null);
    const p = await registerPlayer(base, 'budget');
    const r = s.rewards.grant(p.userId, 50, 'test', 'budget1');
    expect(r.granted).toBe(0);
    expect(r.note).toMatch(/presupuesto global/);
    s.ecoCfg.update({ rewardPoints: { globalDailyBudgetUsdCents: 5000 } }, null);
  });

  it('las cuentas retenidas por fraude no acumulan puntos', async () => {
    const p = await registerPlayer(base, 'hold');
    const s = server.services;
    s.antifraud.flag(p.userId, 'test', 100, {});
    expect(s.antifraud.userRisk(p.userId).hold).toBe(true);
    expect(s.rewards.grant(p.userId, 20, 'test', 'hold1').granted).toBe(0);
  });

  it('el canje exige requisitos y queda en revisión manual (sandbox)', async () => {
    const p = await registerPlayer(base, 'redeem');
    const s = server.services;
    // Sin puntos, sin antigüedad, sin correo verificado, sin misterios
    expect(() => s.rewards.redeem(p.userId, 10_000, 'tarjeta_regalo', 'r1')).toThrow(/días|verificar|misterio/);
    // Preparar cuenta elegible
    s.db.run('UPDATE users SET email_verified = 1, created_at = ? WHERE id = ?', clock.now() - 30 * DAY_MS, p.userId);
    s.db.run("INSERT INTO mission_progress(user_id, mission_id, status, stage_id, flags, started_at, updated_at, completions) VALUES (?, 'ep01_casa_abandonada', 'completed', NULL, '[]', 0, 0, 1)", p.userId);
    s.economy.apply({ userId: p.userId, type: 'test', idempotencyKey: 'rp-seed', currency: [{ code: 'rp', delta: 12_000, reason: 'seed' }] });
    expect(() => s.rewards.redeem(p.userId, 500, 'tarjeta_regalo', 'r2')).toThrow(/mínimo/);
    const ok = s.rewards.redeem(p.userId, 10_000, 'tarjeta_regalo', 'r3');
    expect(ok.status).toBe('pending_review');
    expect(ok.sandbox).toBe(true);
    expect(s.economy.balances(p.userId).rp).toBe(2_000);
    // Cooldown
    s.economy.apply({ userId: p.userId, type: 'test', idempotencyKey: 'rp-seed2', currency: [{ code: 'rp', delta: 20_000, reason: 'seed' }] });
    expect(() => s.rewards.redeem(p.userId, 10_000, 'tarjeta_regalo', 'r4')).toThrow(/cada 7 días|tope mensual/);
    // Revisión: rechazar devuelve los puntos
    const before = s.economy.balances(p.userId).rp;
    const rev = s.rewards.review(ok.id, 'reject', p.userId, 'test');
    expect(rev.status).toBe('rejected');
    expect(s.economy.balances(p.userId).rp).toBe(before + 10_000);
  });

  it('los canjes reales siguen bloqueados aunque el admin los active si el entorno no lo permite', () => {
    const s = server.services;
    s.ecoCfg.update({ redemption: { realRewardsEnabled: true } }, null);
    expect(s.rewards.realRedemptionsActive()).toBe(false);
    s.ecoCfg.update({ redemption: { realRewardsEnabled: false } }, null);
  });

  it('la tienda nunca acepta puntos de recompensa y no vende dos veces un objeto único', async () => {
    const p = await registerPlayer(base, 'shop');
    const s = server.services;
    s.economy.apply({ userId: p.userId, type: 'test', idempotencyKey: 'shop-seed', currency: [{ code: 'coins', delta: 1000, reason: 'seed' }] });
    const r = s.store.buy(p.userId, 'lupa', 'buy-1');
    expect(r.ok).toBe(true);
    const again = s.store.buy(p.userId, 'lupa', 'buy-1'); // reintento idempotente
    expect(again.duplicate).toBe(true);
    expect(() => s.store.buy(p.userId, 'lupa', 'buy-2')).toThrow(/Ya tienes/);
    expect(s.db.get("SELECT 1 FROM store_products WHERE price_currency = 'rp'")).toBeUndefined();
  });

  it('compra de gemas sandbox queda marcada como sandbox', async () => {
    const p = await registerPlayer(base, 'gems');
    const r = await server.services.store.buyGems(p.userId, 'gems_100');
    expect(r.sandbox).toBe(true);
    const row = server.services.db.get<{ sandbox: number; provider: string }>('SELECT sandbox, provider FROM purchases WHERE user_id = ?', p.userId);
    expect(row).toEqual({ sandbox: 1, provider: 'sandbox' });
  });

  it('valida la configuración económica', () => {
    expect(() => server.services.ecoCfg.update({ marketplace: { commissionPct: 500 } }, null)).toThrow();
  });
});

describe('anuncios recompensados', () => {
  it('exige tiempo mínimo, token de un solo uso, cooldown y límite diario', async () => {
    const p = await registerPlayer(base, 'ads');
    const s = server.services;
    clock.freeze(Date.now());
    const st = s.ads.start(p.userId, 'rewarded_coins', '1.1.1.1', null);
    expect(() => s.ads.complete(p.userId, st.token)).toThrow(/no se completó/);
    const st2 = s.ads.start(p.userId, 'rewarded_coins', '1.1.1.1', null);
    clock.advance(6000);
    const done = s.ads.complete(p.userId, st2.token);
    expect(done.coins).toBeGreaterThan(0);
    expect(() => s.ads.complete(p.userId, st2.token)).toThrow(/ya se procesó/);
    expect(() => s.ads.start(p.userId, 'rewarded_coins', '1.1.1.1', null)).toThrow(/Espera/);
    const sus = s.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM suspicious_activity WHERE user_id = ? AND type = 'ad_completed_too_fast'", p.userId)!;
    expect(sus.n).toBe(1);
    clock.reset();
  });
});
