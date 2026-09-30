import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { GameServer } from '../src/app';
import { clock } from '../src/lib/clock';
import { signInitData, verifyInitData } from '../src/modules/telegram/initData';
import { api, registerPlayer, startTestServer, stop } from './helpers';

const BOT = '123456789:TEST_token_for_unit_tests_only_abcdef';
const HOOK = 'webhook-secret-for-tests-123';
let server: GameServer;
let base: string;
const calls: { method: string; params: any }[] = [];

function initData(tgId: number, extra: Record<string, string> = {}) {
  return signInitData(
    { auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'AAE', user: JSON.stringify({ id: tgId, first_name: 'Ana', username: `ana${tgId}`, language_code: 'es' }), ...extra },
    BOT,
  );
}

async function tgLogin(tgId: number, extra: Record<string, string> = {}) {
  const r = await api(base, 'POST', '/api/auth/telegram', { initData: initData(tgId, extra), deviceId: `device-tg-${tgId}-abc` });
  expect(r.status).toBe(200);
  return r.data as { token: string; userId: string; created: boolean };
}

beforeAll(async () => {
  ({ server, base } = await startTestServer(
    {
      TELEGRAM_BOT_TOKEN: BOT,
      TELEGRAM_BOT_USERNAME: 'misterios_bot',
      TELEGRAM_APP_SHORT_NAME: 'juego',
      TELEGRAM_UPDATES: 'webhook',
      TELEGRAM_WEBHOOK_SECRET: HOOK,
      TELEGRAM_STARS_ENABLED: 'true',
      ADS_CALLBACK_SECRET: 'ads-callback-secret-for-tests',
    },
    (s) => {
      s.services.telegram.api = async (method, params) => {
        calls.push({ method, params });
        if (method === 'createInvoiceLink') return `https://t.me/$invoice_${params.payload}`;
        return true;
      };
    },
  ));
});
afterAll(async () => stop(server));

describe('Telegram Mini App', () => {
  it('verifica la firma del initData', () => {
    const good = initData(1);
    expect(verifyInitData(good, BOT, 3600)?.user.id).toBe(1);
    expect(verifyInitData(good.replace('Ana', 'Eva'), BOT, 3600)).toBeNull();
    expect(verifyInitData(good, BOT.replace('1', '2'), 3600)).toBeNull();
    const old = signInitData({ auth_date: String(Math.floor(Date.now() / 1000) - 7200), user: JSON.stringify({ id: 1 }) }, BOT);
    expect(verifyInitData(old, BOT, 3600)).toBeNull();
  });

  it('crea la cuenta la primera vez, reutiliza después y aplica el referido de start_param', async () => {
    const ref = await registerPlayer(base, 'padrino');
    const code = server.services.db.get<{ referral_code: string }>('SELECT referral_code FROM users WHERE id = ?', ref.userId)!.referral_code;
    const a = await tgLogin(1001, { start_param: code });
    expect(a.created).toBe(true);
    const b = await tgLogin(1001);
    expect(b.created).toBe(false);
    expect(b.userId).toBe(a.userId);
    expect(server.services.db.get('SELECT 1 FROM referrals WHERE referee_id = ?', a.userId)).toBeTruthy();
    const bad = await api(base, 'POST', '/api/auth/telegram', { initData: initData(1001).replace('Ana', 'X'), deviceId: 'device-x-12345' });
    expect(bad.status).toBe(401);
    const inv = await api(base, 'GET', '/api/referrals', undefined, a.token);
    expect(inv.data.telegramLink).toMatch(/^https:\/\/t\.me\/misterios_bot\/juego\?startapp=/);
  });

  it('permite que Telegram Web incruste el juego (CSP frame-ancestors)', async () => {
    const res = await fetch(`http://${base}/`);
    expect(res.headers.get('content-security-policy') ?? '').toContain('https://web.telegram.org');
    expect(res.headers.get('x-frame-options')).toBeNull();
  });
});

describe('Pagos con Telegram Stars', () => {
  const hook = (update: unknown, secret = HOOK) =>
    fetch(`http://${base}/api/telegram/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': secret }, body: JSON.stringify(update) });

  it('factura → pre_checkout → pago; entrega única aunque Telegram reenvíe la actualización', async () => {
    const u = await tgLogin(2002);
    const inv = await api(base, 'POST', '/api/offers/stars', { sku: 'vip_30' }, u.token);
    expect(inv.status).toBe(200);
    expect(inv.data.invoiceLink).toContain('$invoice_');
    const created = calls.find((c) => c.method === 'createInvoiceLink' && c.params.payload === inv.data.intentId)!;
    expect(created.params.currency).toBe('XTR');
    expect(created.params.prices[0].amount).toBe(150);

    expect((await hook({ update_id: 1 }, 'wrong-secret')).status).toBe(403);

    // importe manipulado -> rechazado
    await hook({ update_id: 2, pre_checkout_query: { id: 'q1', from: { id: 2002 }, currency: 'XTR', total_amount: 1, invoice_payload: inv.data.intentId } });
    expect(calls.at(-1)).toMatchObject({ method: 'answerPreCheckoutQuery', params: { ok: false } });
    // otra cuenta -> rechazado
    await hook({ update_id: 3, pre_checkout_query: { id: 'q2', from: { id: 9999 }, currency: 'XTR', total_amount: 150, invoice_payload: inv.data.intentId } });
    expect(calls.at(-1)).toMatchObject({ method: 'answerPreCheckoutQuery', params: { ok: false } });
    await hook({ update_id: 4, pre_checkout_query: { id: 'q3', from: { id: 2002 }, currency: 'XTR', total_amount: 150, invoice_payload: inv.data.intentId } });
    expect(calls.at(-1)).toMatchObject({ method: 'answerPreCheckoutQuery', params: { pre_checkout_query_id: 'q3', ok: true } });

    const gems0 = server.services.economy.balances(u.userId).gems;
    const paid = { update_id: 5, message: { chat: { id: 2002 }, from: { id: 2002 }, successful_payment: { currency: 'XTR', total_amount: 150, invoice_payload: inv.data.intentId, telegram_payment_charge_id: 'charge-abc-1' } } };
    await hook(paid);
    await hook({ ...paid, update_id: 6 }); // reenvío
    expect(server.services.economy.balances(u.userId).gems).toBe(gems0 + 50);
    expect(server.services.offers.isVip(u.userId)).toBe(true);
    const st = await api(base, 'GET', `/api/offers/intent/${inv.data.intentId}`, undefined, u.token);
    expect(st.data.status).toBe('paid');
    const row = server.services.db.get<{ amount_stars: number; sandbox: number }>("SELECT amount_stars, sandbox FROM purchases WHERE provider_ref = 'charge-abc-1'")!;
    expect(row).toEqual({ amount_stars: 150, sandbox: 0 });
  });

  it('las cuentas sin Telegram no pueden generar facturas de Stars', async () => {
    const p = await registerPlayer(base, 'webonly');
    const r = await api(base, 'POST', '/api/offers/stars', { sku: 'gems_100' }, p.token);
    expect(r.status).toBe(403);
  });
});

describe('VIP', () => {
  it('cofre diario una vez al día y sin intersticiales', async () => {
    const p = await registerPlayer(base, 'vipweb');
    const pre = await api(base, 'POST', '/api/vip/daily', {}, p.token);
    expect(pre.status).toBe(403);
    server.services.offers.buySandbox(p.userId, 'vip_30');
    const d1 = await api(base, 'POST', '/api/vip/daily', {}, p.token);
    expect(d1.status).toBe(200);
    const d2 = await api(base, 'POST', '/api/vip/daily', {}, p.token);
    expect(d2.status).toBe(400);
    const ads = await api(base, 'GET', '/api/ads', undefined, p.token);
    expect(ads.data.placements.find((x: any) => x.id === 'optional_after_mission').available).toBe(false);
    const once = await api(base, 'POST', '/api/offers/sandbox', { sku: 'starter_pack' }, p.token);
    expect(once.status).toBe(200);
    const twice = await api(base, 'POST', '/api/offers/sandbox', { sku: 'starter_pack' }, p.token);
    expect(twice.status).toBe(400);
  });
});

describe('Mediación de anuncios', () => {
  it('Adsgram: la recompensa sólo llega con la confirmación firmada de la red', async () => {
    const s = server.services;
    s.ads.updateNetwork('adsgram', {
      name: 'Adsgram',
      enabled: true,
      env: 'telegram',
      formats: ['rewarded', 'interstitial'],
      config: { rewardedBlockId: '1234', interstitialBlockId: 'int-1234' },
      estEcpm: { rewarded: 300, interstitial: 150 },
      weight: 1,
      serverVerified: true,
    });
    const u = await tgLogin(3003);
    clock.freeze(Date.now());
    const st = await api(base, 'POST', '/api/ads/start', { placementId: 'rewarded_coins', env: 'telegram' }, u.token);
    expect(st.data.network.kind).toBe('adsgram');
    expect(st.data.network.config.rewardedBlockId).toBe('1234');
    const c1 = await api(base, 'POST', '/api/ads/complete', { token: st.data.token, result: 'completed' }, u.token);
    expect(c1.data.status).toBe('pending');
    const coins0 = s.economy.balances(u.userId).coins;
    const bad = await fetch(`http://${base}/api/ads/callback/adsgram?sig=nope&userid=3003`);
    expect(bad.status).toBe(403);
    const url = s.ads.callbackUrl('adsgram')!.replace('[userId]', '3003').replace(/^https?:\/\/[^/]+/, `http://${base}`);
    const ok = await fetch(url);
    expect(ok.status).toBe(200);
    expect(s.economy.balances(u.userId).coins).toBe(coins0 + 25);
    const status = await api(base, 'GET', `/api/ads/status/${st.data.token}`, undefined, u.token);
    expect(status.data).toMatchObject({ status: 'completed', coins: 25, rp: 5 });
    await fetch(url); // reintento de la red: no paga dos veces
    expect(s.economy.balances(u.userId).coins).toBe(coins0 + 25);
    clock.reset();
  });

  it('una red sin verificación en servidor paga sólo monedas', async () => {
    const s = server.services;
    s.ads.updateNetwork('adsense_h5', { name: 'AdSense', enabled: true, env: 'web', formats: ['rewarded'], config: { client: 'ca-pub-1234567890' }, estEcpm: { rewarded: 400 }, weight: 1, serverVerified: false });
    const p = await registerPlayer(base, 'webads');
    clock.freeze(Date.now());
    const st = await api(base, 'POST', '/api/ads/start', { placementId: 'rewarded_coins', env: 'web' }, p.token);
    expect(st.data.network.kind).toBe('adsense_h5');
    clock.advance(5000);
    const done = await api(base, 'POST', '/api/ads/complete', { token: st.data.token, result: 'completed' }, p.token);
    expect(done.data).toMatchObject({ status: 'completed', coins: 25, rp: 0 });
    clock.reset();
  });
});

describe('¿Qué me paga más?', () => {
  it('ordena redes/formatos por ingreso real reportado', async () => {
    const s = server.services;
    const day = new Date().toISOString().slice(0, 10);
    s.monetization.addReport({ day, networkId: 'adsgram', format: 'rewarded', impressions: 1000, revenueCents: 450 }, 'admin');
    s.monetization.addReport({ day, networkId: 'adsense_h5', format: 'rewarded', impressions: 1000, revenueCents: 900 }, 'admin');
    const r = s.monetization.importCsv('day,networkId,format,impressions,revenueUsd\n' + `${day},monetag,interstitial,500,0.75\n` + 'basura', 'admin');
    expect(r.imported).toBe(1);
    const d = s.monetization.dashboard(30);
    const rewarded = d.ranking.filter((x) => x.format === 'rewarded' && x.ecpmSource === 'real');
    expect(rewarded[0].networkId).toBe('adsense_h5');
    expect(rewarded.find((x) => x.networkId === 'adsense_h5')!.ecpmCents).toBe(900);
    expect(d.bestByFormat.rewarded).toContain('AdSense');
    expect(d.sources.find((x) => x.source.startsWith('Telegram Stars'))!.cents).toBeGreaterThan(0);
    // La mediación ahora prefiere la red con mejor eCPM real
    s.ecoCfg.update({ ads: { explorePct: 0 } }, null);
    expect(s.ads.realEcpm('adsense_h5', 'rewarded')).toBe(900);
  });
});
