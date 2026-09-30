import './styles.css';
import { Game } from './game/Game';
import { loadCharacterModel } from './game/gltfCharacter';
import { initTelegram, tg } from './telegram';
import type { SponsorCampaign } from './game/world/buildWorld';
import { api, ApiError, session } from './net/api';
import { store, type Profile, type PublicConfig } from './state';
import { clear, h } from './ui/dom';
import { Hud } from './ui/hud';
import { authScreen, characterScreen, loading } from './ui/menu';

const ui = document.getElementById('ui')!;
const canvas = document.getElementById('scene') as HTMLCanvasElement;

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

async function boot() {
  loading(ui, 'Encendiendo los faroles del pueblo…');
  if (!webglAvailable()) {
    clear(ui);
    ui.append(h('div', { class: 'menu-wrap' }, h('div', { class: 'menu-card' }, h('h1', { class: 'title' }, 'Misterios'), h('p', null, 'Tu navegador o dispositivo no soporta WebGL, necesario para el mundo 3D.'))));
    return;
  }
  const tgApp = await initTelegram();
  try {
    store.config = await api<PublicConfig>('GET', '/api/config/public');
  } catch {
    store.config = null;
  }
  // Patrocinio en la pantalla de carga (antes de construir el mundo)
  try {
    const sp = await api<{ campaigns: typeof store.sponsors }>('GET', '/api/sponsors');
    store.sponsors = sp.campaigns;
  } catch {
    store.sponsors = [];
  }
  const loadingSponsor = store.sponsors.find((c) => c.slot === 'loading_screen');
  if (loadingSponsor) {
    loading(ui, 'Encendiendo los faroles del pueblo…', loadingSponsor);
    await new Promise((r) => setTimeout(r, 1200));
  }
  // Se deja un fotograma para que se pinte la pantalla de carga antes de construir el mundo.
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
  const s = store.settings;
  await loadCharacterModel();
  const game = new Game(canvas, s.quality);
  game.audio.volumes = { master: s.master, music: s.music, sfx: s.sfx, ambient: s.ambient };
  game.input.sensitivity = s.sensitivity;
  game.input.invertY = s.invertY;
  // Gancho de depuración/pruebas E2E (sólo lectura/entrada local; el servidor valida todo).
  try {
    if (localStorage.getItem('mol.debug') === '1') (window as unknown as { __game: Game }).__game = game;
  } catch {
    /* ignorar */
  }
  window.addEventListener('pointerdown', () => game.audio.unlock(), { once: true });
  window.addEventListener('keydown', () => game.audio.unlock(), { once: true });

  game.setSponsors(store.sponsors as SponsorCampaign[]);

  const start = async (): Promise<void> => {
    let profile: Profile | null = null;
    // Dentro de Telegram: acceso automático con la cuenta de Telegram (verificada en el servidor)
    if (tgApp && !session.token && store.config?.telegram?.enabled) {
      try {
        const ref = new URLSearchParams(location.search).get('ref');
        const r = await api<{ token: string }>('POST', '/api/auth/telegram', { initData: tg.initData, deviceId: session.deviceId, referralCode: ref });
        session.token = r.token;
      } catch (e) {
        clear(ui);
        ui.append(h('div', { class: 'menu-wrap' }, h('div', { class: 'menu-card col' }, h('h1', { class: 'title' }, 'Misterios'), h('p', null, (e as Error).message), h('button', { class: 'btn primary', onclick: () => location.reload() }, 'Reintentar'))));
        return;
      }
    }
    if (session.token) {
      try {
        profile = await api<Profile>('GET', '/api/me');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) session.token = null;
        else {
          clear(ui);
          ui.append(h('div', { class: 'menu-wrap' }, h('div', { class: 'menu-card col' }, h('h1', { class: 'title' }, 'Misterios'), h('p', null, (e as Error).message), h('button', { class: 'btn primary', onclick: () => location.reload() }, 'Reintentar'))));
          return;
        }
      }
    }
    if (!profile) {
      await authScreen(ui, game);
      return start();
    }
    if (!profile.character) {
      await characterScreen(ui, game);
      return start();
    }
    store.profile = profile;
    store.wallet = profile.wallet;
    clear(ui);
    new Hud(ui, game, () => {
      game.leaveWorld();
      clear(ui);
      store.profile = null;
      void start();
    });
    game.enterWorld();
    // Impresiones de patrocinios vistos en esta sesión (deduplicadas por usuario y día en el servidor)
    for (const c of store.sponsors.filter((x) => x.slot !== 'journal_banner')) {
      void api('POST', `/api/sponsors/${c.id}/event`, { type: 'impression' }).catch(() => undefined);
    }
  };
  await start();
}

void boot();
