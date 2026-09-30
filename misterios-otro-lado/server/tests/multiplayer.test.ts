import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { GameServer } from '../src/app';
import { clock, DAY_MS } from '../src/lib/clock';
import { api, registerPlayer, startTestServer, stop, TestClient } from './helpers';

let server: GameServer;
let base: string;

beforeAll(async () => {
  ({ server, base } = await startTestServer());
  clock.freeze(Date.now());
});
afterAll(async () => stop(server));

describe('multijugador + misterio cooperativo (Episodio 1)', () => {
  let A: TestClient;
  let B: TestClient;
  let pa: Awaited<ReturnType<typeof registerPlayer>>;
  let pb: Awaited<ReturnType<typeof registerPlayer>>;

  it('dos jugadores se ven y se sincronizan', async () => {
    pa = await registerPlayer(base, 'ana');
    pb = await registerPlayer(base, 'beto');
    A = await TestClient.connect(base, pa.token, pa.deviceId);
    const joined = A.wait((m) => m.t === 'player_join');
    B = await TestClient.connect(base, pb.token, pb.deviceId);
    const j = await joined;
    expect(j.player.userId).toBe(pb.userId);
    const welcomeB = B.msgs.find((m) => m.t === 'welcome') as any;
    expect(welcomeB.players.map((p: any) => p.userId)).toContain(pa.userId);
    expect(welcomeB.missions.missions.find((m: any) => m.id === 'ep01_casa_abandonada').status).toBe('available');

    await A.walkTo(2, 6);
    const snap = await B.wait((m) => m.t === 'snapshot' && m.players.some((p: any) => Math.abs(p.p[0] - 2) < 0.01));
    expect(snap.players.length).toBeGreaterThan(0);
  });

  it('el servidor corrige un teletransporte ilegal (speed hack)', async () => {
    A.send({ t: 'move', p: [60, 0, 60], r: 0, a: 'run', seq: 1 });
    const c = await A.wait('correct');
    expect(Math.hypot(c.p[0] - 60, c.p[2] - 60)).toBeGreaterThan(50);
    // Muchos pasos pequeños seguidos sin que pase el tiempo tampoco cuelan
    let corrected = false;
    for (let i = 1; i <= 20 && !corrected; i++) {
      A.send({ t: 'move', p: [A.pos[0] + i, 0, A.pos[2]], r: 0, a: 'run', seq: 2 });
      await A.sync();
      corrected = A.msgs.filter((m) => m.t === 'correct').length > 1;
    }
    expect(corrected).toBe(true);
    const back = A.msgs.filter((m) => m.t === 'correct').at(-1) as any;
    A.pos = [back.p[0], 0, back.p[2]];
  });

  it('grupos: invitar, aceptar y chat de grupo', async () => {
    A.send({ t: 'party_invite', username: pb.username });
    const inv = await B.wait('party_invite');
    const partyA = A.wait((m) => m.t === 'party' && m.party?.members.length === 2);
    B.send({ t: 'party_respond', inviteId: inv.inviteId, accept: true });
    const p = await partyA;
    expect(p.party.leaderId).toBe(pa.userId);
    A.send({ t: 'chat', channel: 'party', text: '  hola <b>equipo</b>  ' });
    const line = await B.wait('chat');
    expect(line.line.text).toBe('hola <b>equipo</b>'); // se limpia; el cliente lo pinta como texto, nunca HTML
    expect(line.line.channel).toBe('party');
  });

  it('las interacciones exigen cercanía validada por el servidor', async () => {
    const r = await A.interact('angel_jardin');
    expect(r.ok).toBe(false);
    expect(r.messages[0]).toMatch(/lejos/);
  });

  it('resuelven el misterio en cooperación', async () => {
    // Ambos hablan con Don Aurelio
    await A.walkTo(3.5, 4.5);
    await B.walkTo(3.0, 5.0);
    const dA = await A.interact('don_aurelio');
    expect(dA.dialogue.length).toBeGreaterThan(0);
    await B.interact('don_aurelio');

    // Pozo: A encuentra la foto; B (cerca y en el grupo) recibe la pista y avanza
    await A.walkTo(28.5, -26.5);
    await B.walkTo(26, -24);
    const bNotice = B.wait((m) => m.t === 'notice' && /avanzó/.test(m.text));
    const pozo = await A.interact('pozo_viejo');
    expect(pozo.discovered.clues).toContain('Fotografía de los Morales');
    expect(pozo.discovered.items).toContain('Fotografía antigua');
    await bNotice;
    await B.sync();
    const bClues = server.services.db.all<{ clue_id: string; source: string }>('SELECT clue_id, source FROM player_clues WHERE user_id = ?', pb.userId);
    expect(bClues).toEqual([{ clue_id: 'foto_morales', source: 'shared' }]);

    // La trampilla no se puede abrir todavía (etapa incorrecta) aunque el cliente lo intente
    await A.walkTo(5, -63.5);
    await B.walkTo(4, -62);
    A.send({ t: 'solve', puzzleId: 'candado_sotano', answer: '1403' });
    const early = await A.wait('solve_result');
    expect(early.ok).toBe(false);

    // Ángel -> llave
    const angel = await A.interact('angel_jardin');
    expect(angel.discovered.items).toContain('Llave oxidada');

    // Puerta del estudio
    await A.walkTo(-4, -76.5);
    await B.walkTo(-3, -75);
    const door = await A.interact('puerta_estudio');
    expect(door.messages.join(' ')).toMatch(/se abre/);
    await B.sync();
    const bRow = server.services.db.get<{ stage_id: string; flags: string }>(
      "SELECT stage_id, flags FROM mission_progress WHERE user_id = ? AND mission_id = 'ep01_casa_abandonada'",
      pb.userId,
    )!;
    expect(bRow.stage_id).toBe('s_diario');
    expect(JSON.parse(bRow.flags)).toContain('study_unlocked');

    // Diario
    await A.walkTo(-5.5, -80.5);
    const diary = await A.interact('diario_lucia');
    expect(diary.discovered.clues).toContain('Diario de Lucía');

    // Candado: respuesta incorrecta y luego correcta -> teletransporte al túnel
    await A.walkTo(-3.2, -81);
    const hatch = await A.interact('trampilla');
    expect(hatch.puzzle.id).toBe('candado_sotano');
    expect(JSON.stringify(hatch)).not.toContain('1403'); // la respuesta nunca viaja al cliente
    A.send({ t: 'solve', puzzleId: 'candado_sotano', answer: '0000' });
    expect((await A.wait('solve_result')).ok).toBe(false);
    const tp = A.wait('teleport');
    A.send({ t: 'solve', puzzleId: 'candado_sotano', answer: '14 03' });
    expect((await A.wait('solve_result')).ok).toBe(true);
    const t = await tp;
    expect(t.p[0]).toBeGreaterThan(150);

    // Túnel: colgante + carta
    await A.walkTo(179.5, -96.5);
    const box = await A.interact('caja_colgante');
    expect(box.discovered.items).toContain('Colgante de plata de Lucía');
    await A.walkTo(153.5, -95);
    const out = A.wait('teleport');
    await A.interact('salida_tunel');
    await out;

    // B también baja (ya tiene el candado abierto gracias al grupo)
    await B.walkTo(-3.2, -81);
    const tpb = B.wait('teleport');
    await B.interact('trampilla');
    await tpb;
    await B.walkTo(179.5, -96.5);
    await B.interact('caja_colgante');
    await B.walkTo(153.5, -95);
    const outB = B.wait('teleport');
    await B.interact('salida_tunel');
    await outB;

    // Regresan con Don Aurelio: completa A y, por cooperación, B
    const coinsA0 = server.services.economy.balances(pa.userId).coins;
    const coinsB0 = server.services.economy.balances(pb.userId).coins;
    await A.walkTo(4, 4);
    await B.walkTo(3, 3.5);
    const doneA = A.wait('mission_complete');
    const doneB = B.wait('mission_complete');
    await A.interact('don_aurelio');
    const ra = await doneA;
    const rb = await doneB;
    expect(ra.rewards.coins).toBe(250);
    expect(ra.rewards.rp).toBe(150);
    expect(rb.rewards.coins).toBe(275); // +10% bonificación cooperativa
    expect(server.services.economy.balances(pa.userId).coins).toBe(coinsA0 + 250);
    expect(server.services.economy.balances(pb.userId).coins).toBe(coinsB0 + 275);
    // Wallet empujado por WebSocket
    await A.sync();
    expect(A.msgs.some((m) => m.t === 'wallet')).toBe(true);

    // Repetir no vuelve a dar RP ni objetos de primera vez
    const restart = await api(base, 'POST', '/api/missions/ep01_casa_abandonada/restart', {}, pa.token);
    expect(restart.status).toBe(200);
    const payload = await api(base, 'GET', '/api/missions', undefined, pa.token);
    const ep = payload.data.missions.find((m: any) => m.id === 'ep01_casa_abandonada');
    expect(ep.status).toBe('active');
    expect(ep.rewardsPreview.rp).toBe(0);
  });

  it('bloquear evita recibir chat e invitaciones', async () => {
    await api(base, 'POST', '/api/social/blocks', { userId: pa.userId }, pb.token);
    A.send({ t: 'chat', channel: 'world', text: 'mensaje que B no debe ver' });
    await A.wait('chat');
    await B.sync();
    expect(B.msgs.some((m) => m.t === 'chat' && m.line.text.includes('B no debe ver'))).toBe(false);
    const rep = await api(base, 'POST', '/api/social/reports', { targetUserId: pa.userId, reason: 'spam', details: 'prueba' }, pb.token);
    expect(rep.status).toBe(200);
  });

  it('admin: roles, estadísticas y bloqueo de cuenta expulsa del juego', async () => {
    const denied = await api(base, 'GET', '/api/admin/stats', undefined, pa.token);
    expect(denied.status).toBe(403);
    const admin = await registerPlayer(base, 'jefa');
    server.services.db.run("UPDATE users SET role = 'admin' WHERE id = ?", admin.userId);
    const stats = await api(base, 'GET', '/api/admin/stats', undefined, admin.token);
    expect(stats.status).toBe(200);
    expect(stats.data.totals.missionsCompleted).toBeGreaterThanOrEqual(2);
    expect(stats.data.economy.rpIssued).toBeGreaterThan(0);
    const reports = await api(base, 'GET', '/api/admin/reports', undefined, admin.token);
    expect(reports.data.reports.length).toBe(1);
    const kicked = B.wait('kicked');
    await api(base, 'POST', `/api/admin/players/${pb.userId}/status`, { status: 'suspended', reason: 'prueba' }, admin.token);
    await kicked;
    const me = await api(base, 'GET', '/api/me', undefined, pb.token);
    expect(me.status).toBe(401);
    const audit = await api(base, 'GET', '/api/admin/audit', undefined, admin.token);
    expect(audit.data.entries.some((e: any) => e.action === 'player_status')).toBe(true);
  });

  it('marketplace (monedas) con custodia y comisión, activable por admin', async () => {
    const s = server.services;
    const seller = await registerPlayer(base, 'vende');
    const buyer = await registerPlayer(base, 'compra');
    const closed = await api(base, 'POST', '/api/marketplace/listings', { instanceId: 'x', price: 100 }, seller.token);
    expect(closed.status).toBe(403);
    s.ecoCfg.update({ marketplace: { enabled: true, minAccountAgeDays: 0 } }, null);
    const tx = s.economy.apply({ userId: seller.userId, type: 'test', idempotencyKey: 'mk-seed', grantItems: [{ itemId: 'medalla_militar', qty: 1 }] });
    const inst = tx.grantedInstances[0].instanceId;
    const l = await api(base, 'POST', '/api/marketplace/listings', { instanceId: inst, price: 100 }, seller.token);
    expect(l.status).toBe(200);
    // En custodia: no se puede volver a listar
    const dup = await api(base, 'POST', '/api/marketplace/listings', { instanceId: inst, price: 100 }, seller.token);
    expect(dup.status).toBe(404);
    const coinsSeller = s.economy.balances(seller.userId).coins;
    const buy = await api(base, 'POST', `/api/marketplace/listings/${l.data.id}/buy`, {}, buyer.token);
    expect(buy.status).toBe(200);
    expect(s.economy.balances(seller.userId).coins).toBe(coinsSeller + 90);
    expect(s.inventory.owns(buyer.userId, 'medalla_militar')).toBe(true);
    expect(s.inventory.owns(seller.userId, 'medalla_militar')).toBe(false);
    s.ecoCfg.update({ marketplace: { enabled: false } }, null);
  });

  it('referidos: sin recompensa por mismo dispositivo; con actividad legítima sí', async () => {
    const s = server.services;
    const code = s.db.get<{ referral_code: string }>('SELECT referral_code FROM users WHERE id = ?', pa.userId)!.referral_code;
    await registerPlayer(base, 'clon', { deviceId: pa.deviceId, referralCode: code });
    const rej = s.db.get<{ status: string; reject_reason: string }>("SELECT status, reject_reason FROM referrals WHERE referrer_id = ? AND status = 'rejected'", pa.userId);
    expect(rej?.reject_reason).toBe('same_device');

    const friend = await registerPlayer(base, 'amiga', { referralCode: code });
    const coins0 = s.economy.balances(pa.userId).coins;
    // Completar el misterio sin tiempo de juego suficiente no califica
    s.bus.emit('mission.completed', { userId: friend.userId, missionId: 'ep01_casa_abandonada', firstTime: true, rewards: { coins: 0, rp: 0, xp: 0, seasonXp: 0, items: [], notes: [] } });
    expect(s.economy.balances(pa.userId).coins).toBe(coins0);
    s.db.run('UPDATE characters SET play_seconds = 3600 WHERE user_id = ?', friend.userId);
    s.referrals.tryQualify(friend.userId);
    expect(s.economy.balances(pa.userId).coins).toBe(coins0 + 300);
    expect(s.db.get<{ status: string }>('SELECT status FROM referrals WHERE referee_id = ?', friend.userId)!.status).toBe('rewarded');
  });
});

describe('misterio de temporada nocturno (Episodio 3)', () => {
  it('sólo se puede resolver de noche y dentro de su temporada', async () => {
    const s = server.services;
    const now = clock.now();
    s.seasons.upsert({
      id: 't1_ecos',
      name: 'Temporada de prueba',
      description: 'test',
      startsAt: new Date(now - 10 * DAY_MS).toISOString(),
      endsAt: new Date(now + 10 * DAY_MS).toISOString(),
      premiumPriceGems: 200,
      tiers: [{ tier: 1, xp: 0, free: { coins: 10 }, premium: { coins: 20 } }],
      events: [],
    });
    const p = await registerPlayer(base, 'noche');
    s.db.run(
      "INSERT INTO mission_progress(user_id, mission_id, status, stage_id, flags, started_at, updated_at, completions) VALUES (?, 'ep01_casa_abandonada', 'completed', NULL, '[]', 0, 0, 1)",
      p.userId,
    );
    // Fijar el reloj a pleno día del mundo
    const dayLen = 1440_000;
    const k = Math.floor(clock.now() / dayLen) + 1;
    clock.freeze((k + 0.7) * dayLen); // timeOfDay = 0.5 (mediodía)
    const c = await TestClient.connect(base, p.token, p.deviceId);
    await c.walkTo(-32, -9);
    await c.interact('aviso_capilla');
    await c.walkTo(-36.5, 1.5);
    const day = await c.interact('cuerda_campana');
    expect(day.messages[0]).toMatch(/De día/);
    // Noche
    clock.freeze((k + 1 + 0.15) * dayLen); // timeOfDay ≈ 0.95
    const night = await c.interact('cuerda_campana');
    expect(night.puzzle.id).toBe('voz_campana');
    const done = c.wait('mission_complete');
    c.send({ t: 'solve', puzzleId: 'voz_campana', answer: 'Cuatro' });
    const r = await done;
    expect(r.rewards.items.map((i: any) => i.itemId)).toContain('farol_antiguo');
    expect(r.rewards.seasonXp).toBeGreaterThan(0);
    const season = await api(base, 'GET', '/api/season', undefined, p.token);
    expect(season.data.xp).toBeGreaterThan(0);
    const claim = await api(base, 'POST', '/api/season/claim', { tier: 1, track: 'free' }, p.token);
    expect(claim.status).toBe(200);
    const claim2 = await api(base, 'POST', '/api/season/claim', { tier: 1, track: 'free' }, p.token);
    expect(claim2.status).toBe(400);
    c.close();
  });
});
