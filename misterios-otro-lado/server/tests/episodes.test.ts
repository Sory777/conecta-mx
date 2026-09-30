import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { GameServer } from '../src/app';
import { clock } from '../src/lib/clock';
import { registerPlayer, startTestServer, stop, TestClient } from './helpers';

let server: GameServer;
let base: string;

beforeAll(async () => {
  ({ server, base } = await startTestServer());
  clock.freeze(Date.now());
});
afterAll(async () => stop(server));

async function playerWithEp01() {
  const p = await registerPlayer(base, 'nivel');
  server.services.db.run(
    "INSERT INTO mission_progress(user_id, mission_id, status, stage_id, flags, started_at, updated_at, completions) VALUES (?, 'ep01_casa_abandonada', 'completed', NULL, '[]', 0, 0, 1)",
    p.userId,
  );
  const c = await TestClient.connect(base, p.token, p.deviceId);
  return { p, c };
}

describe('Episodio 2 — La mina donde nadie quiere entrar', () => {
  it('está bloqueado sin el Episodio 1', async () => {
    const p = await registerPlayer(base, 'sinep');
    const c = await TestClient.connect(base, p.token, p.deviceId);
    const w = c.msgs.find((m) => m.t === 'welcome') as any;
    expect(w.missions.missions.find((m: any) => m.id === 'ep02_mina').status).toBe('locked');
    c.close();
  });

  it('se completa: caja → tablas → vagoneta → palancas → mochila → salida → Rosa', async () => {
    const { p, c } = await playerWithEp01();
    await c.walkTo(-71, -54);
    const start = await c.interact('rosa_minera');
    expect(start.dialogue.length).toBe(3);

    // Sin barreta no se puede entrar
    await c.walkTo(-84, -59.5);
    const locked = await c.interact('tablas_mina');
    expect(locked.messages[0]).toMatch(/palanca/);

    await c.walkTo(-89.5, -55.5);
    const box = await c.interact('caja_capataz');
    expect(box.discovered.items).toContain('Barreta de hierro');

    await c.walkTo(-84, -59.5);
    const tp = c.wait('teleport');
    await c.interact('tablas_mina');
    expect((await tp).p[0]).toBeGreaterThan(150);

    await c.walkTo(166.5, -19);
    const cart = await c.interact('vagoneta');
    expect(cart.discovered.clues).toContain('Mapa dibujado por Tomás');

    // La compuerta bloquea la cámara hasta resolver las palancas
    await c.walkTo(180, -22);
    const panel = await c.interact('panel_palancas');
    expect(panel.puzzle.id).toBe('palancas_compuerta');
    c.send({ t: 'solve', puzzleId: 'palancas_compuerta', answer: '1-2-3' });
    expect((await c.wait('solve_result')).ok).toBe(false);
    c.send({ t: 'solve', puzzleId: 'palancas_compuerta', answer: '2 - 1 - 3' });
    expect((await c.wait('solve_result')).ok).toBe(true);
    await c.sync();
    const gate = server.services.missions.payload(p.userId).entities.find((e: any) => e.id === 'compuerta')!;
    expect(gate.blocking).toBe(false);

    await c.walkTo(194, -10);
    const bag = await c.interact('cuaderno');
    expect(bag.discovered.items).toContain('Brújula de Tomás');

    await c.walkTo(196, -33.5);
    const up = c.wait('teleport');
    await c.interact('pozo_ascensor');
    expect((await up).p[0]).toBeLessThan(0);

    const done = c.wait('mission_complete');
    await c.walkTo(-72.5, -56);
    await c.interact('rosa_minera');
    const r = await done;
    expect(r.rewards.items.map((i: any) => i.itemId)).toContain('casco_minero');
    expect(server.services.inventory.owns(p.userId, 'casco_minero')).toBe(true);
    c.close();
  });
});

describe('Episodio 4 — Las cartas sin remitente', () => {
  it('se completa: Inés → buzón → lápida → caja → nombre', async () => {
    const { p, c } = await playerWithEp01();
    await c.walkTo(-29.5, -4);
    await c.interact('hermana_ines');
    await c.walkTo(8, -7.5);
    expect((await c.interact('buzon_plaza')).discovered.clues).toContain('La carta del buzón');
    await c.walkTo(-51.5, -8);
    expect((await c.interact('tumba_sin_nombre')).discovered.items).toContain('Llave pequeña de latón');
    await c.walkTo(28.5, -7);
    expect((await c.interact('caja_tienda')).discovered.clues).toContain('Las cartas guardadas');
    expect(server.services.inventory.owns(p.userId, 'llave_buzon')).toBe(false);
    await c.walkTo(-29.5, -4);
    const q = await c.interact('hermana_ines');
    expect(q.puzzle.id).toBe('quien_escribe');
    const done = c.wait('mission_complete');
    c.send({ t: 'solve', puzzleId: 'quien_escribe', answer: 'elena morales' });
    const r = await done;
    expect(r.rewards.items.map((i: any) => i.itemId)).toContain('libreta_cuero');
    c.close();
  });
});
