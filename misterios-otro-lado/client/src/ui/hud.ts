import { formatClock, RARITY_COLOR } from '../../../shared/constants';
import { regionOf } from '../../../shared/world';
import type { DialogueLine, PuzzlePrompt, RewardSummary } from '../../../shared/protocol';
import type { Game, GameUi } from '../game/Game';
import { store } from '../state';
import { tg } from '../telegram';
import { add, clear, fmt, h, isTouch } from './dom';
import { drawMap } from './map';
import { Panels, type PanelName } from './panels';

const WEATHER_LABEL: Record<string, string> = { clear: 'Despejado', fog: 'Niebla', rain: 'Lluvia', storm: 'Tormenta' };

export class Hud implements GameUi {
  private root: HTMLElement;
  private objective = h('div', { class: 'objective', title: 'Abrir diario (J)' });
  private wallet = h('div', { class: 'wallet' });
  private clock = h('div', { class: 'clock' });
  private minimap = h('canvas', { id: 'minimap', title: 'Mapa (M)' });
  private promptEl = h('div', { class: 'prompt hidden' });
  private toasts = h('div', { class: 'toasts' });
  private dialogueEl = h('div', { class: 'dialogue hidden' });
  private chatLog = h('div', { class: 'chat-log' });
  private chatInput = h('input', { class: 'input', placeholder: 'Escribe… (Enter)', maxlength: 200 });
  private chatChannel = h('select', { 'aria-label': 'Canal' }, h('option', { value: 'world' }, 'Mundo'), h('option', { value: 'party' }, 'Grupo'));
  private chat = h('div', { class: 'chat collapsed' });
  private dialogueQueue: DialogueLine[] = [];
  private arrow = h('span', { class: 'arrow' }, '➤');
  private distEl = h('span');
  private conn = h('div', { class: 'sandbox-ribbon' });
  private flashBtn: HTMLElement | null = null;
  private panels: Panels;
  private mapT = 0;
  private lastChatCount = 0;

  constructor(
    root: HTMLElement,
    private game: Game,
    onLogout: () => void,
  ) {
    this.root = root;
    game.ui = this;
    this.panels = new Panels(root, game, this, onLogout);
    clear(root);
    this.objective.addEventListener('click', () => this.open('journal'));
    this.minimap.addEventListener('click', () => this.open('map'));
    this.promptEl.addEventListener('click', () => game.interact());
    this.dialogueEl.addEventListener('click', () => this.advanceDialogue());
    const menu = h(
      'div',
      { class: 'hud-menu' },
      this.menuBtn('📓', 'Diario', 'J', 'journal'),
      this.menuBtn('🎒', 'Inventario', 'I', 'inventory'),
      this.menuBtn('🗺️', 'Mapa', 'M', 'map'),
      this.menuBtn('👥', 'Grupo y amigos', 'P', 'social'),
      this.menuBtn('🛒', 'Tienda', 'B', 'shop'),
      this.menuBtn('🎖️', 'Temporada', 'V', 'season'),
      this.menuBtn('💠', 'Recompensas', '', 'rewards'),
      this.menuBtn('⚙️', 'Ajustes', '', 'settings'),
    );
    this.chat.append(
      this.chatLog,
      h(
        'form',
        {
          class: 'chat-input',
          onsubmit: (e: Event) => {
            e.preventDefault();
            const text = this.chatInput.value.trim();
            if (text) game.send({ t: 'chat', channel: this.chatChannel.value as 'world' | 'party', text });
            this.chatInput.value = '';
            this.chatInput.blur();
            this.chat.classList.add('collapsed');
          },
        },
        this.chatChannel,
        this.chatInput,
      ),
    );
    this.chatInput.addEventListener('blur', () => setTimeout(() => this.chat.classList.add('collapsed'), 150));
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.chatInput.blur();
    });
    this.chatLog.addEventListener('click', () => this.openChat());

    root.append(
      h('div', { class: 'hud-top' }, this.objective, h('div', { class: 'hud-right' }, this.wallet, this.clock, this.minimap)),
      menu,
      this.promptEl,
      this.chat,
      this.dialogueEl,
      this.toasts,
      this.conn,
    );
    if (isTouch()) this.buildTouch();
    this.renderWallet();
    this.renderObjective();
    this.renderChat();
    store.on('wallet', () => this.renderWallet());
    store.on('missions', () => this.renderObjective());
    store.on('chat', () => this.renderChat());
    this.conn.textContent = store.config?.sandbox ? 'Modo sandbox' : '';
  }

  private menuBtn(icon: string, title: string, key: string, panel: PanelName) {
    return h('button', { class: 'icon-btn', title: `${title}${key ? ` (${key})` : ''}`, 'aria-label': title, onclick: () => this.open(panel) }, icon, key ? h('span', { class: 'kbd' }, key) : null);
  }

  open(p: PanelName) {
    this.game.audio.click();
    this.panels.open(p);
  }

  openChat() {
    this.chat.classList.remove('collapsed');
    this.chatInput.focus();
  }

  // ------------------------------------------------------------------ GameUi
  action(a: string) {
    const map: Record<string, PanelName> = { inventory: 'inventory', journal: 'journal', map: 'map', social: 'social', shop: 'shop', season: 'season' };
    if (a === 'chat') return this.openChat();
    if (a === 'escape') {
      if (!this.dialogueEl.classList.contains('hidden')) return this.advanceDialogue();
      if (this.panels.isOpen()) return this.panels.close();
      return this.open('settings');
    }
    if (map[a]) {
      if (this.panels.current === map[a]) this.panels.close();
      else this.open(map[a]);
    }
  }

  prompt(label: string | null) {
    clear(this.promptEl);
    if (!label) {
      this.promptEl.classList.add('hidden');
      return;
    }
    this.promptEl.append(isTouch() ? '' : h('kbd', { class: 'kbd-hint' }, 'E'), label);
    this.promptEl.classList.remove('hidden');
  }

  toast(level: 'info' | 'success' | 'warn' | 'error', text: string, actions?: { label: string; primary?: boolean; fn: () => void }[], ttl = 5000) {
    const t = h('div', { class: `toast ${level}` }, h('div', null, text));
    if (actions?.length) {
      t.append(
        h(
          'div',
          { class: 'actions' },
          ...actions.map((a) =>
            h('button', {
              class: `btn small ${a.primary ? 'primary' : 'ghost'}`,
              onclick: () => {
                a.fn();
                t.remove();
              },
            }, a.label),
          ),
        ),
      );
    }
    this.toasts.append(t);
    setTimeout(() => t.remove(), ttl);
    while (this.toasts.children.length > 4) this.toasts.firstElementChild?.remove();
  }

  discovery(kind: string, text: string) {
    tg.haptic('light');
    const d = h('div', { class: 'discovery' }, h('div', { class: 'k' }, kind), h('div', { class: 'v' }, text));
    this.root.append(d);
    setTimeout(() => d.remove(), 3300);
  }

  dialogue(lines: DialogueLine[], messages: string[]) {
    this.dialogueQueue.push(...lines, ...messages.map((m) => ({ speaker: '', text: m })));
    if (this.dialogueEl.classList.contains('hidden')) this.advanceDialogue();
  }

  private advanceDialogue() {
    const next = this.dialogueQueue.shift();
    clear(this.dialogueEl);
    if (!next) {
      this.dialogueEl.classList.add('hidden');
      this.game.paused = false;
      return;
    }
    this.game.paused = true;
    add(
      this.dialogueEl,
      next.speaker ? h('div', { class: 'who' }, next.speaker) : null,
      h('div', { class: 'what', style: next.speaker ? '' : 'font-style:italic;color:#d6cdb8' }, next.text),
      h('div', { class: 'next' }, isTouch() ? 'Toca para continuar' : 'Clic / E / Esc para continuar'),
    );
    this.dialogueEl.classList.remove('hidden');
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        window.removeEventListener('keydown', onKey, true);
        e.stopPropagation();
        this.advanceDialogue();
      }
    };
    window.addEventListener('keydown', onKey, true);
  }

  puzzle(p: PuzzlePrompt) {
    this.panels.puzzle(p);
  }

  puzzleResult(ok: boolean, msg: string) {
    this.panels.puzzleResult(ok, msg);
  }

  missionComplete(title: string, rewards: RewardSummary) {
    this.panels.missionComplete(title, rewards);
  }

  partyInvite(inviteId: string, from: string) {
    this.toast('info', `${from} te invita a su grupo de investigación.`, [
      { label: 'Aceptar', primary: true, fn: () => this.game.send({ t: 'party_respond', inviteId, accept: true }) },
      { label: 'Rechazar', fn: () => this.game.send({ t: 'party_respond', inviteId, accept: false }) },
    ], 30000);
  }

  kicked(reason: string) {
    this.panels.fatal(reason);
  }

  connection(status: 'connecting' | 'online' | 'offline' | 'fatal') {
    const sb = store.config?.sandbox ? 'Modo sandbox · ' : '';
    this.conn.textContent = status === 'online' ? sb.replace(' · ', '') : `${sb}${status === 'offline' ? 'Reconectando…' : status === 'connecting' ? 'Conectando…' : 'Desconectado'}`;
    if (status === 'offline') this.toast('warn', 'Conexión perdida. Reconectando…');
  }

  frame() {
    const g = this.game;
    // Reloj y zona
    this.clock.replaceChildren(h('b', null, formatClock(g.timeOfDay)), ` · ${WEATHER_LABEL[g.weather] ?? ''}`, h('br'), g.zone);
    // Objetivo: distancia y dirección relativa a la cámara
    const m = store.tracked();
    if (m?.marker && (m.status === 'active' || m.status === 'available')) {
      const dx = m.marker[0] - g.pos.x;
      const dz = m.marker[2] - g.pos.z;
      const dist = Math.hypot(dx, dz);
      const markerRegion = regionOf(m.marker[0], m.marker[2]);
      const myRegion = regionOf(g.pos.x, g.pos.z);
      if (markerRegion !== myRegion) this.distEl.textContent = markerRegion !== 'outdoor' ? 'Bajo tierra' : 'En la superficie';
      else this.distEl.textContent = dist < 3 ? 'Aquí' : `a ${Math.round(dist)} m`;
      const bearing = Math.atan2(-dx, -dz) - g.follow.yaw;
      this.arrow.style.transform = `rotate(${(-bearing - Math.PI / 2) * (180 / Math.PI)}deg)`;
    }
    // Minimapa (≈ 10 fps)
    this.mapT++;
    if (this.mapT % 6 === 0) {
      const partyIds = new Set(store.party?.members.map((x) => x.userId) ?? []);
      const party = [...store.players.values()].filter((p) => partyIds.has(p.userId) && p.id !== g.myCharId);
      drawMap(this.minimap, {
        me: { x: g.pos.x, z: g.pos.z, rot: g.rotY },
        party: party.map((p) => ({ x: p.p[0], z: p.p[2], name: p.name })),
        objective: m?.marker ?? null,
        inCave: g.inCave,
      }, { round: true, zoom: 120 });
    }
    if (this.flashBtn) this.flashBtn.classList.toggle('on', g.flashlightOn);
    this.panels.frame();
  }

  // ------------------------------------------------------------------ render
  private renderWallet() {
    const w = store.wallet;
    clear(this.wallet);
    add(
      this.wallet,
      h('span', { class: 'pill coins', title: 'Monedas (se ganan jugando)' }, h('span', { class: 'ic' }, '🪙'), fmt(w.coins)),
      h('span', { class: 'pill gems', title: 'Gemas (moneda premium)' }, h('span', { class: 'ic' }, '💎'), fmt(w.gems)),
      store.config?.rewardPointsEnabled ? h('span', { class: 'pill rp', title: 'Puntos de recompensa' }, h('span', { class: 'ic' }, '✦'), fmt(w.rp)) : null,
      (store.profile?.vipUntil ?? 0) > Date.now() ? h('span', { class: 'pill', style: 'color:#f0d9a4;border-color:var(--gold)', title: 'VIP activo' }, '👑 VIP') : null,
    );
  }

  private renderObjective() {
    const m = store.tracked();
    clear(this.objective);
    if (!m) {
      this.objective.append(h('div', { class: 'm-title' }, 'Sin investigación activa'), h('div', { class: 'm-text muted' }, 'Explora el pueblo. Abre el diario (J) para ver los misterios.'));
      return;
    }
    const stage = m.status === 'available' ? 'Nuevo misterio' : m.status === 'completed' ? 'Resuelto' : `Etapa ${m.stageIndex + 1} de ${m.stageCount}`;
    add(
      this.objective,
      h('div', { class: 'm-title' }, m.title),
      h('div', { class: 'm-stage' }, stage, ' · ', m.locationLabel),
      h('div', { class: 'm-text' }, m.objective),
      m.marker ? h('div', { class: 'm-dist' }, this.arrow, this.distEl) : null,
    );
  }

  private renderChat() {
    const blocked = new Set<string>();
    const lines = store.chat.slice(-30);
    if (lines.length === this.lastChatCount && this.chatLog.childElementCount) return;
    const isNew = lines.length > this.lastChatCount;
    this.lastChatCount = lines.length;
    clear(this.chatLog);
    for (const l of lines) {
      if (l.fromUserId && blocked.has(l.fromUserId)) continue;
      this.chatLog.append(h('div', { class: `l ${l.channel}` }, h('span', { class: 'n' }, l.channel === 'party' ? `[Grupo] ${l.from}` : l.from), ': ', l.text));
    }
    this.chatLog.scrollTop = this.chatLog.scrollHeight;
    if (isNew) this.chatLog.style.opacity = '1';
  }

  // ------------------------------------------------------------------ táctil
  private buildTouch() {
    const g = this.game;
    const touch = h('div', { class: 'touch' });
    const left = h('div', { class: 'zone left' });
    const right = h('div', { class: 'zone right' });
    const base = h('div', { class: 'joy-base hidden' });
    const knob = h('div', { class: 'joy-knob hidden' });
    let joyId: number | null = null;
    let jx = 0;
    let jy = 0;
    left.addEventListener('pointerdown', (e) => {
      g.audio.unlock();
      if (joyId !== null) return;
      joyId = e.pointerId;
      jx = e.clientX;
      jy = e.clientY;
      left.setPointerCapture(e.pointerId);
      base.style.left = knob.style.left = `${jx}px`;
      base.style.top = knob.style.top = `${jy}px`;
      base.classList.remove('hidden');
      knob.classList.remove('hidden');
    });
    left.addEventListener('pointermove', (e) => {
      if (e.pointerId !== joyId) return;
      let dx = e.clientX - jx;
      let dy = e.clientY - jy;
      const len = Math.hypot(dx, dy);
      const max = 55;
      if (len > max) {
        dx = (dx / len) * max;
        dy = (dy / len) * max;
      }
      knob.style.left = `${jx + dx}px`;
      knob.style.top = `${jy + dy}px`;
      g.input.touchMove.x = dx / max;
      g.input.touchMove.y = -dy / max;
    });
    const endJoy = (e: PointerEvent) => {
      if (e.pointerId !== joyId) return;
      joyId = null;
      g.input.touchMove.x = g.input.touchMove.y = 0;
      base.classList.add('hidden');
      knob.classList.add('hidden');
    };
    left.addEventListener('pointerup', endJoy);
    left.addEventListener('pointercancel', endJoy);
    let camId: number | null = null;
    let cx = 0;
    let cy = 0;
    right.addEventListener('pointerdown', (e) => {
      g.audio.unlock();
      if (camId !== null) return;
      camId = e.pointerId;
      cx = e.clientX;
      cy = e.clientY;
      right.setPointerCapture(e.pointerId);
    });
    right.addEventListener('pointermove', (e) => {
      if (e.pointerId !== camId) return;
      g.input.addCamera((e.clientX - cx) * 1.6, (e.clientY - cy) * 1.6);
      cx = e.clientX;
      cy = e.clientY;
    });
    const endCam = (e: PointerEvent) => {
      if (e.pointerId === camId) camId = null;
    };
    right.addEventListener('pointerup', endCam);
    right.addEventListener('pointercancel', endCam);
    this.flashBtn = h('button', { class: 'touch-btn', 'aria-label': 'Linterna', onclick: () => g.toggleFlashlight() }, '🔦');
    const actions = h(
      'div',
      { class: 'touch-actions' },
      h('button', { class: 'touch-btn', 'aria-label': 'Chat', onclick: () => this.openChat() }, '💬'),
      this.flashBtn,
      h('button', { class: 'touch-btn big', 'aria-label': 'Investigar', onclick: () => g.interact() }, h('span', { style: 'display:flex;flex-direction:column;align-items:center;line-height:1.1' }, h('span', { style: 'font-size:24px' }, '🔍'), h('span', { style: 'font-size:10px' }, 'Investigar'))),
    );
    touch.append(left, right, base, knob, actions);
    this.root.prepend(touch);
  }
}

export function rarityStyle(r: string) {
  return `color:${RARITY_COLOR[r as keyof typeof RARITY_COLOR] ?? '#ccc'}`;
}
