import '../styles.css';
import { api, session } from '../net/api';
import { add, clear, dateTime, fmt, h, money } from '../ui/dom';

// Panel de administración. Toda la autorización se valida en el servidor por rol;
// este cliente sólo presenta datos. No contiene secretos.

const root = document.getElementById('admin')!;
type Section = 'stats' | 'players' | 'reports' | 'suspicious' | 'redemptions' | 'transactions' | 'economy' | 'store' | 'missions' | 'seasons' | 'ads' | 'sponsors' | 'market' | 'audit';
const SECTIONS: [Section, string, 'moderator' | 'admin'][] = [
  ['stats', 'Resumen y analíticas', 'moderator'],
  ['players', 'Jugadores', 'moderator'],
  ['reports', 'Reportes', 'moderator'],
  ['suspicious', 'Actividad sospechosa', 'moderator'],
  ['redemptions', 'Canjes de puntos', 'admin'],
  ['transactions', 'Transacciones', 'admin'],
  ['economy', 'Parámetros económicos', 'admin'],
  ['store', 'Tienda', 'admin'],
  ['missions', 'Misterios', 'admin'],
  ['seasons', 'Temporadas y eventos', 'admin'],
  ['ads', 'Publicidad', 'admin'],
  ['sponsors', 'Patrocinios', 'admin'],
  ['market', 'Marketplace', 'admin'],
  ['audit', 'Auditoría', 'admin'],
];

let role: 'player' | 'moderator' | 'admin' = 'player';
let current: Section = 'stats';
let main: HTMLElement;

function toast(msg: string, ok = true) {
  const t = h('div', { class: `toast ${ok ? 'success' : 'error'}`, style: 'position:fixed;top:12px;right:12px;z-index:99;max-width:420px' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 4500);
}

async function run<T>(fn: () => Promise<T>, okMsg?: string): Promise<T | null> {
  try {
    const r = await fn();
    if (okMsg) toast(okMsg);
    return r;
  } catch (e) {
    toast((e as Error).message, false);
    return null;
  }
}

function table(rows: Record<string, unknown>[], cols: [string, string, ((r: any) => Node | string)?][]) {
  const t = h('table', { class: 't' }, h('tr', null, ...cols.map(([, label]) => h('th', null, label))));
  for (const r of rows) {
    t.append(
      h('tr', null, ...cols.map(([k, , fmtFn]) => {
        const v = fmtFn ? fmtFn(r) : r[k];
        return h('td', null, v instanceof Node ? v : v === null || v === undefined ? '—' : String(v));
      })),
    );
  }
  if (!rows.length) t.append(h('tr', null, h('td', { colspan: cols.length, class: 'muted' }, 'Sin datos')));
  return t;
}

function bars(series: { day: string; [k: string]: number | string }[], key: string, color: string) {
  const c = h('canvas', { class: 'chart' });
  requestAnimationFrame(() => {
    const dpr = window.devicePixelRatio || 1;
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    const g = c.getContext('2d')!;
    const vals = series.map((s) => Number(s[key]) || 0);
    const max = Math.max(1, ...vals);
    const bw = c.width / vals.length;
    g.font = `${10 * dpr}px system-ui`;
    vals.forEach((v, i) => {
      const bh = (v / max) * (c.height - 28 * dpr);
      g.fillStyle = color;
      g.fillRect(i * bw + bw * 0.15, c.height - 16 * dpr - bh, bw * 0.7, bh);
      g.fillStyle = '#9b958a';
      g.textAlign = 'center';
      g.fillText(String(v), i * bw + bw / 2, c.height - 20 * dpr - bh);
      g.fillText(series[i].day.slice(5), i * bw + bw / 2, c.height - 4 * dpr);
    });
  });
  return h('div', null, h('div', { class: 'small muted' }, key), c);
}

async function login() {
  clear(root);
  const user = h('input', { class: 'input', placeholder: 'Usuario o correo' });
  const pass = h('input', { class: 'input', type: 'password', placeholder: 'Contraseña' });
  const err = h('div', { class: 'error-text' });
  root.append(
    h('div', { class: 'menu-wrap', style: 'position:fixed' }, h('form', {
      class: 'menu-card col',
      onsubmit: async (e: Event) => {
        e.preventDefault();
        try {
          const r = await api<{ token: string }>('POST', '/api/auth/login', { login: user.value, password: pass.value, deviceId: session.deviceId });
          session.token = r.token;
          void start();
        } catch (e2) {
          err.textContent = (e2 as Error).message;
        }
      },
    }, h('h1', { class: 'title', style: 'font-size:26px' }, 'Administración'), h('p', { class: 'small muted' }, 'Acceso sólo para cuentas con rol de moderador o administrador.'), user, pass, err, h('button', { class: 'btn primary', type: 'submit' }, 'Entrar'))),
  );
}

async function start() {
  if (!session.token) return login();
  const me = await api<any>('GET', '/api/me').catch(() => null);
  if (!me) {
    session.token = null;
    return login();
  }
  role = me.user.role;
  if (role === 'player') {
    clear(root);
    root.append(h('div', { class: 'menu-wrap', style: 'position:fixed' }, h('div', { class: 'menu-card' }, h('h2', null, 'Sin permisos'), h('p', null, 'Esta cuenta no tiene rol administrativo. Un administrador puede asignarlo con `npm run create-admin -- <usuario>` en el servidor.'), h('a', { href: '/', style: 'color:var(--gold)' }, 'Volver al juego'))));
    return;
  }
  clear(root);
  const nav = h('nav', { class: 'admin-nav' }, h('h1', null, 'Misterios · Admin'));
  main = h('main', { class: 'admin-main' });
  for (const [id, label, min] of SECTIONS) {
    if (min === 'admin' && role !== 'admin') continue;
    nav.append(h('button', { class: id === current ? 'active' : '', 'data-s': id, onclick: () => go(id) }, label));
  }
  nav.append(h('div', { class: 'sep' }), h('span', { class: 'small muted', style: 'padding:0 10px' }, `${me.user.username} · ${role}`), h('button', { onclick: () => ((session.token = null), login()) }, 'Cerrar sesión'), h('a', { href: '/', style: 'color:var(--gold);padding:8px 10px;font-size:13px' }, '← Volver al juego'));
  root.append(h('div', { class: 'admin-shell' }, nav, main));
  go(current);
}

function go(s: Section) {
  current = s;
  document.querySelectorAll('.admin-nav button[data-s]').forEach((b) => b.classList.toggle('active', (b as HTMLElement).dataset.s === s));
  clear(main);
  main.append(h('p', { class: 'muted' }, 'Cargando…'));
  const fn = { stats, players, reports, suspicious, redemptions, transactions, economy, store: storeSection, missions, seasons, ads, sponsors, market, audit }[s];
  fn().catch((e) => {
    clear(main);
    main.append(h('p', { class: 'error-text' }, (e as Error).message));
  });
}

// ------------------------------------------------------------------ secciones

async function stats() {
  const d = await api<any>('GET', '/api/admin/stats');
  clear(main);
  const t = d.totals;
  const e = d.economy;
  const stat = (k: string, v: string | number) => h('div', { class: 'stat' }, h('div', { class: 'v' }, typeof v === 'number' ? fmt(v) : v), h('div', { class: 'k' }, k));
  add(
    main,
    h('h2', null, 'Resumen'),
    d.sandbox ? h('div', { class: 'notice-box', style: 'margin-bottom:12px' }, 'MODO SANDBOX: los ingresos por compras y anuncios son simulados y se muestran separados de los reales.') : null,
    h('div', { class: 'stat-grid' },
      stat('Usuarios registrados', t.users), stat('En línea ahora', d.live?.online ?? 0), stat('DAU', t.dau), stat('WAU', t.wau), stat('MAU', t.mau),
      stat('Sesiones', t.sessions), stat('Duración media', `${Math.round(t.avgSessionSec / 60)} min`), stat('Retención D1', d.retention.d1 === null ? '—' : `${d.retention.d1}%`), stat('Retención D7', d.retention.d7 === null ? '—' : `${d.retention.d7}%`),
      stat('Misterios iniciados', t.missionsStarted), stat('Misterios completados', t.missionsCompleted), stat('Anuncios vistos', t.adViews), stat('Anuncios rechazados', t.adRejected),
      stat('Compras tienda', t.storePurchases), stat('Compras reales', t.purchasesReal), stat('Ingreso real', money(t.revenueRealCents)), stat('Compras sandbox', t.purchasesSandbox), stat('Ingreso sandbox (simulado)', money(t.revenueSandboxCents)),
      stat('Canjes solicitados', t.redemptions), stat('Intercambios', t.trades), stat('Reportes abiertos', t.openReports), stat('Sospechas sin revisar', t.suspiciousUnreviewed),
    ),
    h('h3', null, 'Salud económica (últimos 30 días)'),
    e.warning ? h('div', { class: 'notice-box', style: 'margin-bottom:10px' }, '⚠ ', e.warning) : null,
    h('div', { class: 'stat-grid' },
      stat('RP emitidos', e.rpIssued), stat('Valor RP emitidos', money(e.rpIssuedUsdCents)), stat('RP en circulación', e.rpOutstanding), stat('Pasivo RP', money(e.rpOutstandingUsdCents)),
      stat('Ingreso est. anuncios', money(e.estAdRevenueUsdCents)), stat('Anuncios sandbox (simulado)', money(e.estAdRevenueSandboxUsdCents)), stat('Ingreso neto compras', money(e.iapNetRevenueUsdCents)), stat('Costo infra est.', money(e.estInfraCostUsdCents)),
      stat('Margen estimado', money(e.estMarginUsdCents)), stat('Recompensas/Ingreso', e.rewardToRevenueRatio === null ? '—' : `${Math.round(e.rewardToRevenueRatio * 100)}%`), stat('Monedas en circulación', e.coinsInCirculation), stat('Gemas en circulación', e.gemsInCirculation),
    ),
    h('h3', null, 'Últimos 14 días'),
    h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px' }, bars(d.series, 'dau', '#d9b56b'), bars(d.series, 'newUsers', '#8fb3c9'), bars(d.series, 'missionsCompleted', '#86c07f'), bars(d.series, 'adViews', '#a55fe0'), bars(d.series, 'rpIssued', '#e0a95a')),
    h('h3', null, 'Embudo de misterios (dónde se quedan los jugadores)'),
    table(d.funnel, [['mission_id', 'Misterio'], ['status', 'Estado'], ['stage_id', 'Etapa'], ['n', 'Jugadores']]),
    h('h3', null, 'Shards en vivo'),
    table(d.live?.shards ?? [], [['id', 'Shard'], ['players', 'Jugadores']]),
  );
}

async function players() {
  clear(main);
  const q = h('input', { class: 'input', placeholder: 'Buscar por usuario, correo, personaje o id', style: 'max-width:420px' });
  const list = h('div');
  const detail = h('div');
  const search = async () => {
    const d = await api<any>('GET', `/api/admin/players?q=${encodeURIComponent(q.value)}`);
    clear(list);
    list.append(table(d.players, [
      ['username', 'Usuario', (r) => h('a', { href: '#', style: 'color:var(--gold)', onclick: (e: Event) => (e.preventDefault(), void showPlayer(r.id, detail)) }, r.username)],
      ['character', 'Personaje'], ['email', 'Correo'], ['role', 'Rol'], ['status', 'Estado'], ['fraud_score', 'Fraude'], ['rewards_hold', 'Retención', (r) => (r.rewards_hold ? 'Sí' : 'No')], ['created_at', 'Alta', (r) => dateTime(r.created_at)],
    ]));
  };
  main.append(h('h2', null, 'Jugadores'), h('form', { class: 'toolbar', onsubmit: (e: Event) => (e.preventDefault(), void search()) }, q, h('button', { class: 'btn', type: 'submit' }, 'Buscar')), list, detail);
  await search();
}

async function showPlayer(id: string, el: HTMLElement) {
  const d = await api<any>('GET', `/api/admin/players/${id}`);
  clear(el);
  const u = d.user;
  const reason = h('input', { class: 'input', placeholder: 'Motivo', style: 'max-width:280px' });
  const setStatus = (status: string) => run(() => api('POST', `/api/admin/players/${id}/status`, { status, reason: reason.value || null }), `Estado: ${status}`).then(() => showPlayer(id, el));
  const cur = h('select', { class: 'input', style: 'max-width:120px' }, h('option', { value: 'coins' }, 'Monedas'), h('option', { value: 'gems' }, 'Gemas'), h('option', { value: 'rp' }, 'RP'));
  const delta = h('input', { class: 'input', type: 'number', placeholder: '± cantidad', style: 'max-width:140px' });
  const adjReason = h('input', { class: 'input', placeholder: 'Motivo del ajuste (obligatorio)', style: 'max-width:280px' });
  add(
    el,
    h('h2', { style: 'margin-top:24px' }, `${u.username} ${d.online ? '● en línea' : ''}`),
    h('p', { class: 'small muted' }, `${u.email} · rol ${u.role} · estado ${u.status}${u.status_reason ? ` (${u.status_reason})` : ''} · nivel ${u.level} · fraude ${u.fraud_score} · retención ${u.rewards_hold ? 'sí' : 'no'} · correo ${u.email_verified ? 'verificado' : 'sin verificar'}`),
    h('p', null, `Saldo: 🪙 ${fmt(d.wallet.coins)} · 💎 ${fmt(d.wallet.gems)} · ✦ ${fmt(d.wallet.rp)}`),
    h('div', { class: 'toolbar' }, reason, h('button', { class: 'btn small', onclick: () => setStatus('active') }, 'Activar'), h('button', { class: 'btn small', onclick: () => setStatus('suspended') }, 'Suspender'), role === 'admin' ? h('button', { class: 'btn small danger', onclick: () => setStatus('banned') }, 'Bloquear') : null, h('button', { class: 'btn small ghost', onclick: () => run(() => api('POST', `/api/admin/players/${id}/kick`), 'Expulsado de la sesión') }, 'Desconectar')),
    role === 'admin'
      ? h('div', { class: 'toolbar' },
          h('button', { class: 'btn small ghost', onclick: () => run(() => api('POST', `/api/admin/players/${id}/fraud`, { fraudScore: 0, rewardsHold: false }), 'Fraude restablecido').then(() => showPlayer(id, el)) }, 'Limpiar fraude y retención'),
          h('button', { class: 'btn small ghost', onclick: () => run(() => api('POST', `/api/admin/players/${id}/verify-email`), 'Correo verificado').then(() => showPlayer(id, el)) }, 'Marcar correo verificado'),
          h('button', { class: 'btn small ghost', onclick: () => run(() => api('POST', `/api/admin/players/${id}/role`, { role: prompt('Rol (player, moderator, admin):', u.role) ?? u.role }), 'Rol actualizado').then(() => showPlayer(id, el)) }, 'Cambiar rol'),
        )
      : null,
    role === 'admin' ? h('div', { class: 'toolbar' }, cur, delta, adjReason, h('button', { class: 'btn small', onclick: () => run(() => api('POST', `/api/admin/players/${id}/adjust`, { currency: cur.value, delta: Number(delta.value), reason: adjReason.value }), 'Ajuste aplicado (auditado)').then(() => showPlayer(id, el)) }, 'Ajustar saldo')) : null,
    h('h3', null, 'Dispositivos'),
    table(d.devices, [['device_id', 'Dispositivo (hash)', (r) => r.device_id.slice(0, 12) + '…'], ['accounts_on_device', 'Cuentas en el dispositivo'], ['last_ip', 'Última IP'], ['last_seen', 'Visto', (r) => dateTime(r.last_seen)]]),
    h('h3', null, 'Misiones'),
    table(d.missions, [['mission_id', 'Misterio'], ['status', 'Estado'], ['stage_id', 'Etapa'], ['completions', 'Veces']]),
    h('h3', null, 'Actividad sospechosa'),
    table(d.suspicious, [['type', 'Tipo'], ['severity', 'Gravedad'], ['details', 'Detalles'], ['created_at', 'Fecha', (r) => dateTime(r.created_at)]]),
    h('h3', null, 'Reportes recibidos'),
    table(d.reportsAgainst, [['reason', 'Motivo'], ['details', 'Detalles'], ['status', 'Estado'], ['created_at', 'Fecha', (r) => dateTime(r.created_at)]]),
    h('h3', null, 'Movimientos'),
    table(d.ledger, [['created_at', 'Fecha', (r) => dateTime(r.created_at)], ['type', 'Tipo'], ['currency_code', 'Moneda'], ['delta', 'Δ'], ['balance_after', 'Saldo'], ['reason', 'Motivo']]),
    h('h3', null, 'Inventario'),
    table(d.inventory, [['name', 'Objeto'], ['rarity', 'Rareza'], ['quantity', 'Cant.'], ['state', 'Estado']]),
  );
  el.scrollIntoView({ behavior: 'smooth' });
}

async function reports() {
  const d = await api<any>('GET', '/api/admin/reports?status=open');
  clear(main);
  main.append(h('h2', null, 'Reportes abiertos'), table(d.reports, [
    ['created_at', 'Fecha', (r) => dateTime(r.created_at)], ['reporter', 'Reporta'], ['target', 'Reportado'], ['reason', 'Motivo'], ['details', 'Detalles'],
    ['context', 'Evidencia', (r) => h('details', null, h('summary', null, 'ver'), h('pre', null, JSON.stringify(JSON.parse(r.context), null, 2)))],
    ['id', 'Acción', (r) => h('div', { class: 'row' },
      h('button', { class: 'btn small', onclick: () => run(() => api('POST', `/api/admin/reports/${r.id}/resolve`, { status: 'resolved', resolution: prompt('Resolución / acción tomada:') ?? 'resuelto' }), 'Resuelto').then(() => go('reports')) }, 'Resolver'),
      h('button', { class: 'btn small ghost', onclick: () => run(() => api('POST', `/api/admin/reports/${r.id}/resolve`, { status: 'dismissed', resolution: 'Sin infracción' }), 'Descartado').then(() => go('reports')) }, 'Descartar'))],
  ]));
}

async function suspicious() {
  const d = await api<any>('GET', '/api/admin/suspicious');
  clear(main);
  main.append(h('h2', null, 'Actividad sospechosa sin revisar'), h('p', { class: 'small muted' }, 'Señales automáticas (velocidad imposible, anuncios demasiado rápidos, multicuentas, referidos del mismo dispositivo, fuerza bruta en acertijos…). La gravedad se suma al fraud_score; superado el umbral, se retienen recompensas de valor real.'), table(d.items, [
    ['created_at', 'Fecha', (r) => dateTime(r.created_at)], ['username', 'Jugador'], ['type', 'Tipo'], ['severity', 'Gravedad'], ['details', 'Detalles'], ['ip', 'IP'],
    ['id', '', (r) => h('button', { class: 'btn small ghost', onclick: () => run(() => api('POST', `/api/admin/suspicious/${r.id}/review`), 'Marcado como revisado').then(() => go('suspicious')) }, 'Revisado')],
  ]));
}

async function redemptions() {
  const d = await api<any>('GET', '/api/admin/redemptions');
  clear(main);
  main.append(
    h('h2', null, 'Canjes de puntos de recompensa'),
    h('div', { class: 'notice-box', style: 'margin-bottom:12px' }, d.realActive ? 'Canjes REALES activos. Aprobar NO envía dinero: no hay proveedor de pagos integrado; el pago se realiza fuera del sistema y luego se marca como pagado.' : 'Canjes reales DESACTIVADOS. Las solicitudes existentes son sandbox: aprobarlas no tiene valor monetario.'),
    table(d.redemptions, [
      ['created_at', 'Fecha', (r) => dateTime(r.created_at)], ['username', 'Jugador'], ['points', 'Puntos'], ['value_usd_cents', 'Valor', (r) => money(r.value_usd_cents)], ['reward_type', 'Tipo'], ['status', 'Estado'], ['sandbox', 'Sandbox', (r) => (r.sandbox ? 'Sí' : 'No')], ['current_fraud_score', 'Fraude actual'],
      ['id', 'Acción', (r) => r.status === 'pending_review'
        ? h('div', { class: 'row' },
            h('button', { class: 'btn small', onclick: () => run(() => api('POST', `/api/admin/redemptions/${r.id}/review`, { decision: 'approve', notes: null }), 'Aprobado').then(() => go('redemptions')) }, 'Aprobar'),
            h('button', { class: 'btn small danger', onclick: () => run(() => api('POST', `/api/admin/redemptions/${r.id}/review`, { decision: 'reject', notes: prompt('Motivo del rechazo:') }), 'Rechazado (puntos devueltos)').then(() => go('redemptions')) }, 'Rechazar'))
        : r.status === 'approved'
          ? h('button', { class: 'btn small', onclick: () => run(() => api('POST', `/api/admin/redemptions/${r.id}/review`, { decision: 'mark_paid', notes: prompt('Referencia del pago:') }), 'Marcado como pagado').then(() => go('redemptions')) }, 'Marcar pagado')
          : '—'],
    ]),
  );
}

async function transactions() {
  const type = h('input', { class: 'input', placeholder: 'Tipo (purchase, reward, iap, trade…)', style: 'max-width:260px' });
  const load = async () => {
    const d = await api<any>('GET', `/api/admin/transactions${type.value ? `?type=${encodeURIComponent(type.value)}` : ''}`);
    clear(list);
    list.append(table(d.transactions, [['created_at', 'Fecha', (r) => dateTime(r.created_at)], ['username', 'Jugador'], ['type', 'Tipo'], ['lines', 'Monedas'], ['items', 'Objetos'], ['details', 'Detalles']]));
  };
  const list = h('div');
  clear(main);
  main.append(h('h2', null, 'Transacciones (libro mayor)'), h('form', { class: 'toolbar', onsubmit: (e: Event) => (e.preventDefault(), void load()) }, type, h('button', { class: 'btn', type: 'submit' }, 'Filtrar')), list);
  await load();
}

async function economy() {
  const d = await api<any>('GET', '/api/admin/economy');
  clear(main);
  const ta = h('textarea', null);
  ta.value = JSON.stringify(d.config, null, 2);
  const cfg = d.config;
  const quick = (label: string, path: string, value: unknown) => {
    const input = h('input', { class: 'input', value: String(value), style: 'max-width:160px' });
    return h('label', { class: 'field', style: 'max-width:220px' }, label, h('div', { class: 'row' }, input, h('button', {
      class: 'btn small',
      onclick: () => {
        const patch: any = {};
        const keys = path.split('.');
        let o = patch;
        keys.slice(0, -1).forEach((k) => (o = o[k] = {}));
        const raw = input.value.trim();
        o[keys.at(-1)!] = raw === 'true' ? true : raw === 'false' ? false : Number.isNaN(Number(raw)) ? raw : Number(raw);
        void run(() => api('PUT', '/api/admin/economy', patch), 'Guardado').then(() => go('economy'));
      },
    }, 'OK')));
  };
  main.append(
    h('h2', null, 'Parámetros económicos'),
    h('div', { class: 'notice-box', style: 'margin-bottom:12px' }, `Entorno: SANDBOX_MODE=${d.env.SANDBOX_MODE} · REAL_PAYOUTS_ALLOWED=${d.env.REAL_PAYOUTS_ALLOWED} · PAYMENT_PROVIDER=${d.env.PAYMENT_PROVIDER} · AD_PROVIDER=${d.env.AD_PROVIDER}. Los canjes reales requieren los tres candados: interruptor admin + REAL_PAYOUTS_ALLOWED=true + SANDBOX_MODE=false.`),
    h('div', { class: 'toolbar' },
      quick('Canjes reales activados', 'redemption.realRewardsEnabled', cfg.redemption.realRewardsEnabled),
      quick('RP: límite diario', 'rewardPoints.dailyCap', cfg.rewardPoints.dailyCap),
      quick('RP: límite semanal', 'rewardPoints.weeklyCap', cfg.rewardPoints.weeklyCap),
      quick('RP: presupuesto global/día (¢)', 'rewardPoints.globalDailyBudgetUsdCents', cfg.rewardPoints.globalDailyBudgetUsdCents),
      quick('¢ por cada 1000 RP', 'rewardPoints.usdCentsPer1000', cfg.rewardPoints.usdCentsPer1000),
      quick('Mínimo para canjear', 'redemption.minPoints', cfg.redemption.minPoints),
      quick('Multiplicador monedas', 'missions.coinMultiplier', cfg.missions.coinMultiplier),
      quick('Marketplace activo', 'marketplace.enabled', cfg.marketplace.enabled),
      quick('Comisión marketplace %', 'marketplace.commissionPct', cfg.marketplace.commissionPct),
    ),
    h('h3', null, 'Configuración completa (JSON validado en servidor)'),
    ta,
    h('div', { class: 'toolbar', style: 'margin-top:8px' }, h('button', {
      class: 'btn primary',
      onclick: () => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(ta.value);
        } catch {
          return toast('JSON inválido', false);
        }
        void run(() => api('PUT', '/api/admin/economy', parsed), 'Configuración guardada').then(() => go('economy'));
      },
    }, 'Guardar configuración')),
  );
}

async function storeSection() {
  const d = await api<any>('GET', '/api/admin/products');
  clear(main);
  const ta = h('textarea', { style: 'min-height:200px' });
  ta.value = JSON.stringify({ sku: 'nuevo_producto', name: 'Nombre', description: 'Descripción', category: 'ropa', itemId: d.items[0]?.id ?? null, priceCurrency: 'coins', price: 100, seasonId: null, active: true }, null, 2);
  main.append(
    h('h2', null, 'Tienda'),
    table(d.products, [['sku', 'SKU'], ['name', 'Nombre'], ['item_id', 'Objeto'], ['price_currency', 'Moneda'], ['price', 'Precio'], ['season_id', 'Temporada'], ['active', 'Activo', (r) => (r.active ? 'Sí' : 'No')],
      ['id', '', (r) => h('button', { class: 'btn small ghost', onclick: () => run(() => api('POST', '/api/admin/products', { sku: r.sku, name: r.name, description: r.description, category: r.category, itemId: r.item_id, priceCurrency: r.price_currency, price: r.price, seasonId: r.season_id, active: !r.active }), 'Actualizado').then(() => go('store')) }, r.active ? 'Desactivar' : 'Activar')]]),
    h('h3', null, 'Crear / editar producto (por SKU)'),
    h('p', { class: 'small muted' }, `Objetos disponibles: ${d.items.map((i: any) => i.id).join(', ')}`),
    ta,
    h('button', { class: 'btn primary', style: 'margin-top:8px', onclick: () => run(() => api('POST', '/api/admin/products', JSON.parse(ta.value)), 'Producto guardado').then(() => go('store')) }, 'Guardar producto'),
    h('h3', null, 'Paquetes de gemas (dinero real — sandbox)'),
    table(d.gemPacks, [['sku', 'SKU'], ['label', 'Nombre'], ['gems', 'Gemas'], ['price_cents', 'Precio', (r) => money(r.price_cents, r.currency)]]),
  );
}

async function missions() {
  const d = await api<any>('GET', '/api/admin/missions');
  clear(main);
  const ta = h('textarea', { placeholder: 'Pega aquí el JSON de un episodio (ver content/episodes/*.json)' });
  main.append(
    h('h2', null, 'Misterios'),
    h('p', { class: 'small muted' }, 'Los episodios son datos: se validan en el servidor (referencias, etapas, pistas, objetos, posiciones). Subir un id existente crea una nueva versión.'),
    table(d.missions, [['id', 'Id'], ['title', 'Título'], ['version', 'Versión'], ['season_id', 'Temporada'], ['source', 'Origen'], ['enabled', 'Activo', (r) => (r.enabled ? 'Sí' : 'No')],
      ['id', 'Acciones', (r) => h('div', { class: 'row' },
        h('button', { class: 'btn small ghost', onclick: async () => { const e = await api<any>('GET', `/api/admin/missions/${r.id}`); ta.value = JSON.stringify(e.episode, null, 2); ta.scrollIntoView(); } }, 'Editar'),
        h('button', { class: 'btn small ghost', onclick: () => run(() => api('POST', `/api/admin/missions/${r.id}/enabled`, { enabled: !r.enabled }), 'Actualizado').then(() => go('missions')) }, r.enabled ? 'Desactivar' : 'Activar'))]]),
    h('h3', null, 'Crear o actualizar episodio'),
    ta,
    h('button', {
      class: 'btn primary',
      style: 'margin-top:8px',
      onclick: async () => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(ta.value);
        } catch {
          return toast('JSON inválido', false);
        }
        try {
          const r = await api<any>('POST', '/api/admin/missions', parsed);
          toast(`Episodio ${r.id} guardado (v${r.version})`);
          go('missions');
        } catch (e) {
          toast((e as Error).message, false);
        }
      },
    }, 'Validar y guardar'),
  );
}

async function seasons() {
  const d = await api<any>('GET', '/api/admin/seasons');
  clear(main);
  const ta = h('textarea', { style: 'min-height:240px' });
  const cur = d.seasons[0];
  ta.value = JSON.stringify(
    cur
      ? { id: cur.id, name: cur.name, description: cur.description, startsAt: new Date(cur.starts_at).toISOString(), endsAt: new Date(cur.ends_at).toISOString(), premiumPriceGems: cur.premium_price_gems, tiers: d.tiers.filter((t: any) => t.season_id === cur.id).map((t: any) => ({ tier: t.tier, xp: t.xp_required, free: JSON.parse(t.free_reward), premium: JSON.parse(t.premium_reward) })), events: [] }
      : {},
    null,
    2,
  );
  const ev = h('textarea', { style: 'min-height:160px' });
  ev.value = JSON.stringify({ id: 'evento_nuevo', name: 'Nuevo evento', description: 'Descripción', type: 'multiplier', startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 7 * 864e5).toISOString(), config: { coinMult: 1.25 }, seasonId: cur?.id ?? null }, null, 2);
  add(
    main,
    h('h2', null, 'Temporadas'),
    h('p', { class: 'small muted' }, d.current ? `Temporada activa: ${d.current.name}` : 'No hay temporada activa.'),
    table(d.seasons, [['id', 'Id'], ['name', 'Nombre'], ['starts_at', 'Inicio', (r) => dateTime(r.starts_at)], ['ends_at', 'Fin', (r) => dateTime(r.ends_at)], ['premium_price_gems', 'Premium (gemas)']]),
    h('h3', null, 'Crear / editar temporada (con niveles del pase)'),
    ta,
    h('button', { class: 'btn primary', style: 'margin-top:8px', onclick: () => run(() => api('POST', '/api/admin/seasons', JSON.parse(ta.value)), 'Temporada guardada').then(() => go('seasons')) }, 'Guardar temporada'),
    h('h2', { style: 'margin-top:28px' }, 'Eventos'),
    table(d.events, [['id', 'Id'], ['name', 'Nombre'], ['type', 'Tipo'], ['starts_at', 'Inicio', (r) => dateTime(r.starts_at)], ['ends_at', 'Fin', (r) => dateTime(r.ends_at)], ['config', 'Config'], ['enabled', 'Activo']]),
    h('h3', null, 'Crear / editar evento'),
    ev,
    h('button', { class: 'btn primary', style: 'margin-top:8px', onclick: () => run(() => api('POST', '/api/admin/events', JSON.parse(ev.value)), 'Evento guardado').then(() => go('seasons')) }, 'Guardar evento'),
  );
}

async function ads() {
  const d = await api<any>('GET', '/api/admin/ads');
  clear(main);
  main.append(h('h2', null, 'Publicidad'), h('p', { class: 'small muted' }, 'Configuración remota de ubicaciones de anuncios. Nunca se fuerzan anuncios: todos son opcionales, con límite diario y tiempo de espera.'));
  for (const p of d.placements) {
    const f = {
      enabled: h('input', { type: 'checkbox', checked: !!p.enabled }),
      reward_coins: h('input', { class: 'input', type: 'number', value: p.reward_coins }),
      reward_rp: h('input', { class: 'input', type: 'number', value: p.reward_rp }),
      daily_cap: h('input', { class: 'input', type: 'number', value: p.daily_cap }),
      cooldown_sec: h('input', { class: 'input', type: 'number', value: p.cooldown_sec }),
      min_watch_sec: h('input', { class: 'input', type: 'number', value: p.min_watch_sec }),
    };
    main.append(
      h('div', { class: 'card', style: 'margin-bottom:10px' },
        h('b', null, `${p.name} (${p.id}) · proveedor: ${p.provider}`),
        h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px' },
          h('label', { class: 'check' }, f.enabled, 'Activo'),
          h('label', { class: 'field' }, 'Monedas', f.reward_coins), h('label', { class: 'field' }, 'RP', f.reward_rp), h('label', { class: 'field' }, 'Límite diario', f.daily_cap), h('label', { class: 'field' }, 'Espera (s)', f.cooldown_sec), h('label', { class: 'field' }, 'Visión mínima (s)', f.min_watch_sec)),
        h('button', { class: 'btn small', onclick: () => run(() => api('PUT', `/api/admin/ads/${p.id}`, { enabled: f.enabled.checked, reward_coins: Number(f.reward_coins.value), reward_rp: Number(f.reward_rp.value), daily_cap: Number(f.daily_cap.value), cooldown_sec: Number(f.cooldown_sec.value), min_watch_sec: Number(f.min_watch_sec.value) }), 'Guardado') }, 'Guardar')),
    );
  }
  main.append(h('h3', null, 'Estadísticas (7 días)'), table(d.stats, [['placement_id', 'Ubicación'], ['status', 'Estado'], ['n', 'Total']]));
}

async function sponsors() {
  const d = await api<any>('GET', '/api/admin/sponsors');
  clear(main);
  const ta = h('textarea', { style: 'min-height:220px' });
  ta.value = JSON.stringify({ sponsorName: 'Panadería La Esperanza', slotId: 'plaza_billboard', headline: 'Pan de muerto', subline: 'Recién horneado cada noche', bgColor: '#2b1d14', fgColor: '#f3e2c0', startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 30 * 864e5).toISOString(), active: true }, null, 2);
  main.append(
    h('h2', null, 'Patrocinios'),
    h('p', { class: 'small muted' }, 'Espacios disponibles: plaza_billboard (cartel de la plaza), shop_sign (fachada de la tienda). Todo contenido patrocinado se rotula como «Patrocinado». Las impresiones provienen del cliente (métrica de baja confianza).'),
    table(d.campaigns, [['sponsor_name', 'Patrocinador'], ['slot_id', 'Espacio'], ['headline', 'Titular'], ['starts_at', 'Inicio', (r) => dateTime(r.starts_at)], ['ends_at', 'Fin', (r) => dateTime(r.ends_at)], ['active', 'Activa'], ['impressions', 'Impresiones']]),
    h('h3', null, 'Nueva campaña'),
    ta,
    h('button', { class: 'btn primary', style: 'margin-top:8px', onclick: () => run(() => api('POST', '/api/admin/sponsors', JSON.parse(ta.value)), 'Campaña guardada').then(() => go('sponsors')) }, 'Guardar campaña'),
  );
}

async function market() {
  const d = await api<any>('GET', '/api/admin/marketplace');
  clear(main);
  main.append(h('h2', null, 'Marketplace (sólo monedas del juego)'), table(d.listings, [['created_at', 'Fecha', (r) => dateTime(r.created_at)], ['seller', 'Vendedor'], ['item_id', 'Objeto'], ['price', 'Precio'], ['commission', 'Comisión'], ['status', 'Estado'],
    ['id', '', (r) => (r.status === 'active' ? h('button', { class: 'btn small danger', onclick: () => run(() => api('POST', `/api/admin/marketplace/${r.id}/remove`), 'Retirada').then(() => go('market')) }, 'Retirar') : '—')]]));
}

async function audit() {
  const d = await api<any>('GET', '/api/admin/audit');
  clear(main);
  main.append(h('h2', null, 'Registro de auditoría'), table(d.entries, [['created_at', 'Fecha', (r) => dateTime(r.created_at)], ['actor', 'Actor'], ['action', 'Acción'], ['target_type', 'Tipo'], ['target_id', 'Objetivo'], ['ip', 'IP'], ['details', 'Detalles', (r) => h('details', null, h('summary', null, 'ver'), h('pre', null, r.details))]]));
}

void start();
