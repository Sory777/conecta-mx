import { RARITY_LABEL, type Rarity } from '../../../shared/constants';
import type { InventoryItemView, PuzzlePrompt, RewardSummary } from '../../../shared/protocol';
import type { Game } from '../game/Game';
import { api, idem, session } from '../net/api';
import { store } from '../state';
import { add, clear, dateTime, fmt, h, money } from './dom';
import type { Hud } from './hud';
import { drawMap } from './map';

export type PanelName = 'journal' | 'inventory' | 'map' | 'social' | 'shop' | 'season' | 'rewards' | 'settings';

const TITLES: Record<PanelName, string> = {
  journal: 'Diario de investigación',
  inventory: 'Inventario',
  map: 'Mapa de San Bartolo',
  social: 'Grupo y amigos',
  shop: 'Tienda',
  season: 'Pase de temporada',
  rewards: 'Puntos de recompensa',
  settings: 'Ajustes y cuenta',
};

const REPORT_REASONS: [string, string][] = [
  ['acoso', 'Acoso'],
  ['lenguaje_ofensivo', 'Lenguaje ofensivo'],
  ['trampas', 'Trampas'],
  ['spam', 'Spam'],
  ['nombre_inapropiado', 'Nombre inapropiado'],
  ['estafa', 'Estafa'],
  ['otro', 'Otro'],
];

function rarityBadge(r: Rarity) {
  return h('span', { class: `rarity-label rarity-${r}` }, RARITY_LABEL[r]);
}

export class Panels {
  current: PanelName | null = null;
  private backdrop: HTMLElement | null = null;
  private body: HTMLElement | null = null;
  private tab: Record<string, string> = {};
  private mapCanvas: HTMLCanvasElement | null = null;
  private unsub: (() => void)[] = [];
  private puzzleEl: HTMLElement | null = null;

  constructor(
    private root: HTMLElement,
    private game: Game,
    private hud: Hud,
    private onLogout: () => void,
  ) {}

  isOpen() {
    return !!this.backdrop;
  }

  close() {
    this.backdrop?.remove();
    this.backdrop = null;
    this.body = null;
    this.current = null;
    this.mapCanvas = null;
    for (const u of this.unsub) u();
    this.unsub = [];
    this.game.paused = false;
    this.game.input.enabled = true;
  }

  private shell(title: string, tabs?: [string, string][], tabKey?: string) {
    this.close();
    const body = h('div', { class: 'panel-body' });
    const panel = h(
      'div',
      { class: 'panel', role: 'dialog', 'aria-label': title },
      h('div', { class: 'panel-head' }, h('h2', null, title), h('button', { class: 'btn ghost small close', onclick: () => this.close(), 'aria-label': 'Cerrar' }, '✕')),
    );
    if (tabs && tabKey) {
      const bar = h('div', { class: 'tabs' });
      for (const [k, label] of tabs) {
        bar.append(
          h('button', {
            class: (this.tab[tabKey] ?? tabs[0][0]) === k ? 'active' : '',
            onclick: () => {
              this.tab[tabKey] = k;
              if (this.current) this.open(this.current);
            },
          }, label),
        );
      }
      panel.append(bar);
    }
    panel.append(body);
    const bd = h('div', { class: 'panel-backdrop', onclick: (e: Event) => e.target === bd && this.close() }, panel);
    this.root.append(bd);
    this.backdrop = bd;
    this.body = body;
    this.game.paused = true;
    return body;
  }

  open(name: PanelName) {
    const keepTab = this.current === name;
    void keepTab;
    this.current = name;
    const fn = {
      journal: () => this.journal(),
      inventory: () => this.inventory(),
      map: () => this.map(),
      social: () => this.social(),
      shop: () => this.shop(),
      season: () => this.season(),
      rewards: () => this.rewards(),
      settings: () => this.settings(),
    }[name];
    fn();
    this.current = name;
    api('POST', '/api/analytics', { type: 'ui_open_panel', props: { panel: name } }).catch(() => undefined);
  }

  private async load<T>(body: HTMLElement, fn: () => Promise<T>, render: (d: T) => void) {
    body.replaceChildren(h('p', { class: 'muted' }, 'Cargando…'));
    try {
      const d = await fn();
      if (this.body !== body) return;
      clear(body);
      render(d);
    } catch (e) {
      body.replaceChildren(h('p', { class: 'error-text' }, (e as Error).message));
    }
  }

  frame() {
    if (this.current === 'map' && this.mapCanvas) {
      const partyIds = new Set(store.party?.members.map((x) => x.userId) ?? []);
      drawMap(this.mapCanvas, {
        me: { x: this.game.pos.x, z: this.game.pos.z, rot: this.game.rotY },
        party: [...store.players.values()].filter((p) => partyIds.has(p.userId) && p.id !== this.game.myCharId).map((p) => ({ x: p.p[0], z: p.p[2], name: p.name })),
        objective: store.tracked()?.marker ?? null,
        inCave: this.game.inCave,
      }, { labels: true });
    }
  }

  // ------------------------------------------------------------------ diario
  private journal() {
    const t = this.tab.journal ?? 'missions';
    const body = this.shell(TITLES.journal, [['missions', 'Misterios'], ['clues', `Pistas (${store.missions.clues.length})`]], 'journal');
    const render = () => {
      clear(body);
      if ((this.tab.journal ?? 'missions') === 'missions') {
        for (const m of store.missions.missions) {
          const tracked = store.missions.trackedId === m.id;
          const statusLabel = { available: 'Disponible', active: 'En curso', completed: 'Resuelto', locked: 'Bloqueado' }[m.status];
          body.append(
            h(
              'div',
              { class: `mission ${tracked ? 'tracked' : ''}` },
              h('div', { class: 'row' }, h('h3', { class: 'grow' }, m.title), h('span', { class: 'badge' }, statusLabel), m.seasonId ? h('span', { class: 'badge cold' }, 'Temporada') : null),
              h('p', { class: 'small muted', style: 'margin:4px 0 8px;line-height:1.45' }, m.synopsis),
              m.status === 'active' ? h('div', { class: 'progress' }, h('div', { style: `width:${((m.stageIndex + 0.5) / m.stageCount) * 100}%` })) : null,
              h('p', { style: 'margin:8px 0 2px' }, h('b', null, 'Objetivo: '), m.objective),
              m.hint ? h('p', { class: 'small muted', style: 'margin:2px 0' }, '💡 ', m.hint) : null,
              h('p', { class: 'small', style: 'margin:6px 0' }, h('span', { class: 'muted' }, 'Recompensas: '), `🪙 ${m.rewardsPreview.coins}`, m.rewardsPreview.rp ? ` · ✦ ${m.rewardsPreview.rp}` : '', ` · XP ${m.rewardsPreview.xp}`, m.rewardsPreview.items.length ? ` · ${m.rewardsPreview.items.join(', ')}` : '', m.status !== 'completed' && m.rewardsPreview.rp === 0 && m.status !== 'locked' ? '' : ''),
              h(
                'div',
                { class: 'row' },
                (m.status === 'active' || m.status === 'available') && !tracked
                  ? h('button', { class: 'btn small', onclick: () => (this.game.send({ t: 'track', missionId: m.id }), setTimeout(render, 200)) }, 'Seguir este misterio')
                  : null,
                m.status === 'completed'
                  ? h('button', {
                      class: 'btn small ghost',
                      onclick: async () => {
                        try {
                          await api('POST', `/api/missions/${m.id}/restart`);
                          this.hud.toast('info', 'Misterio reiniciado. Esta vez la recompensa es reducida.');
                        } catch (e) {
                          this.hud.toast('warn', (e as Error).message);
                        }
                      },
                    }, 'Volver a investigar')
                  : null,
              ),
            ),
          );
        }
        body.append(h('p', { class: 'small muted center' }, 'Nuevos episodios llegarán con cada temporada. Próximamente: «La mina donde nadie quiere entrar».'));
      } else {
        if (!store.missions.clues.length) body.append(h('p', { class: 'muted' }, 'Aún no has encontrado pistas. Investiga los lugares marcados con un destello.'));
        for (const c of [...store.missions.clues].reverse()) {
          body.append(
            h(
              'div',
              { class: 'clue' },
              h('h4', null, c.title),
              h('p', null, c.text),
              h(
                'div',
                { class: 'row', style: 'margin-top:8px' },
                c.source === 'shared' ? h('span', { class: 'badge cold' }, `Compartida por ${c.sharedBy ?? 'tu grupo'}`) : null,
                h('span', { class: 'grow' }),
                c.shareable && store.party ? h('button', { class: 'btn small', onclick: () => this.game.send({ t: 'share_clue', clueId: c.id }) }, 'Compartir con el grupo') : null,
              ),
            ),
          );
        }
      }
    };
    void t;
    render();
    this.unsub.push(store.on('missions', render));
  }

  // ------------------------------------------------------------------ inventario
  private inventory() {
    const body = this.shell(TITLES.inventory);
    const render = () =>
      this.load(body, () => api<{ items: InventoryItemView[] }>('GET', '/api/inventory'), ({ items }) => {
        const me = store.players.get(this.game.myCharId ?? '');
        const equipped = new Set([me?.appearance.hat, me?.appearance.outfit, me?.appearance.lantern].filter(Boolean));
        const grid = h('div', { class: 'cards' });
        for (const it of items) {
          const isEq = equipped.has(it.itemId);
          grid.append(
            h(
              'div',
              { class: `card rarity-${it.rarity}` },
              h('div', { class: 'row' }, h('span', { class: 'name grow' }, it.name), it.quantity > 1 ? h('span', { class: 'badge' }, `×${it.quantity}`) : null),
              rarityBadge(it.rarity),
              h('div', { class: 'desc' }, it.description),
              it.state === 'escrow' ? h('span', { class: 'badge' }, 'En el mercado') : null,
              it.equippable && it.state === 'owned'
                ? h('button', {
                    class: `btn small ${isEq ? 'ghost' : ''}`,
                    onclick: async () => {
                      try {
                        await api('POST', '/api/characters/equip', { slot: it.equippable, itemId: isEq ? null : it.itemId });
                        setTimeout(render, 250);
                      } catch (e) {
                        this.hud.toast('warn', (e as Error).message);
                      }
                    },
                  }, isEq ? 'Quitar' : 'Equipar')
                : null,
              it.tradeable && it.state === 'owned' && store.config?.marketplaceEnabled && !isEq
                ? h('button', {
                    class: 'btn small ghost',
                    onclick: async () => {
                      const price = Number(prompt(`Precio en monedas para «${it.name}»:`, '100'));
                      if (!price) return;
                      try {
                        await api('POST', '/api/marketplace/listings', { instanceId: it.instanceId, price: Math.floor(price) });
                        this.hud.toast('success', 'Publicado en el mercado.');
                        render();
                      } catch (e) {
                        this.hud.toast('warn', (e as Error).message);
                      }
                    },
                  }, 'Vender')
                : null,
            ),
          );
        }
        body.append(items.length ? grid : h('p', { class: 'muted' }, 'Tu inventario está vacío.'));
      });
    render();
    this.unsub.push(store.on('inventory', () => render()));
  }

  // ------------------------------------------------------------------ mapa
  private map() {
    const body = this.shell(TITLES.map);
    this.mapCanvas = h('canvas', { class: 'map-canvas' });
    const m = store.tracked();
    body.append(
      this.mapCanvas,
      h('p', { class: 'small muted center' }, `Estás en: ${this.game.zone}`, m ? ` · Objetivo: ${m.objective}` : ''),
      h('p', { class: 'small muted center' }, '◆ objetivo · ● compañeros de grupo · ➤ tú'),
    );
  }

  // ------------------------------------------------------------------ social
  private social() {
    const tab = this.tab.social ?? 'party';
    const body = this.shell(TITLES.social, [['party', 'Grupo'], ['nearby', 'Jugadores'], ['friends', 'Amigos'], ['invite', 'Invitar amigos']], 'social');
    const renderParty = () => {
      clear(body);
      const p = store.party;
      const input = h('input', { class: 'input', placeholder: 'Nombre de usuario a invitar', maxlength: 20 });
      body.append(
        h('p', { class: 'small muted' }, 'Investiguen juntos: el avance de un compañero cercano se comparte con el grupo, pueden compartirse pistas y reciben una bonificación cooperativa.'),
        h(
          'form',
          { class: 'row', onsubmit: (e: Event) => (e.preventDefault(), input.value && this.game.send({ t: 'party_invite', username: input.value.trim() }), (input.value = '')) },
          input,
          h('button', { class: 'btn', type: 'submit' }, 'Invitar'),
        ),
        h('div', { class: 'sep' }),
      );
      if (!p) {
        body.append(h('p', { class: 'muted' }, 'No estás en un grupo. Invita a alguien (máximo 4 integrantes).'));
        return;
      }
      const meId = store.profile?.user.id;
      for (const m of p.members) {
        body.append(
          h(
            'div',
            { class: 'row', style: 'padding:6px 0' },
            h('span', { class: 'grow' }, m.userId === p.leaderId ? '👑 ' : '', m.name, m.userId === meId ? ' (tú)' : ''),
            h('span', { class: 'small muted' }, m.online ? 'en línea' : 'desconectado'),
            meId === p.leaderId && m.userId !== meId ? h('button', { class: 'btn small ghost', onclick: () => this.game.send({ t: 'party_kick', userId: m.userId }) }, 'Expulsar') : null,
          ),
        );
      }
      body.append(h('button', { class: 'btn danger small', onclick: () => this.game.send({ t: 'party_leave' }) }, 'Salir del grupo'));
    };
    const renderNearby = () => {
      clear(body);
      const others = [...store.players.values()].filter((p) => p.id !== this.game.myCharId);
      if (!others.length) body.append(h('p', { class: 'muted' }, 'No hay otros investigadores en tu zona del mundo ahora mismo.'));
      for (const p of others) {
        const dist = Math.round(Math.hypot(p.p[0] - this.game.pos.x, p.p[2] - this.game.pos.z));
        body.append(
          h(
            'div',
            { class: 'row', style: 'padding:6px 0;flex-wrap:wrap' },
            h('span', { class: 'grow' }, p.name, h('span', { class: 'small muted' }, ` · a ${dist} m`)),
            h('button', { class: 'btn small', onclick: () => this.inviteByUserId(p.userId) }, 'Invitar'),
            h('button', { class: 'btn small ghost', onclick: () => this.friendByUserId(p.userId) }, 'Amistad'),
            h('button', { class: 'btn small ghost', onclick: () => this.block(p.userId, p.name) }, 'Bloquear'),
            h('button', { class: 'btn small danger', onclick: () => this.report(p.userId, p.name) }, 'Reportar'),
          ),
        );
      }
    };
    const renderFriends = () =>
      this.load(body, async () => ({ f: await api<{ friends: any[] }>('GET', '/api/social/friends'), b: await api<{ blocks: any[] }>('GET', '/api/social/blocks') }), ({ f, b }) => {
        const input = h('input', { class: 'input', placeholder: 'Usuario', maxlength: 20 });
        body.append(
          h(
            'form',
            {
              class: 'row',
              onsubmit: async (e: Event) => {
                e.preventDefault();
                try {
                  const r = await api<{ status: string }>('POST', '/api/social/friends', { username: input.value.trim() });
                  this.hud.toast('success', r.status === 'accepted' ? '¡Ahora son amigos!' : 'Solicitud enviada.');
                  renderFriends();
                } catch (e2) {
                  this.hud.toast('warn', (e2 as Error).message);
                }
              },
            },
            input,
            h('button', { class: 'btn', type: 'submit' }, 'Agregar'),
          ),
          h('div', { class: 'sep' }),
        );
        if (!f.friends.length) body.append(h('p', { class: 'muted' }, 'Aún no tienes amigos agregados.'));
        for (const fr of f.friends) {
          body.append(
            h(
              'div',
              { class: 'row', style: 'padding:6px 0;flex-wrap:wrap' },
              h('span', { class: 'grow' }, fr.characterName ?? fr.username, h('span', { class: 'small muted' }, ` @${fr.username}`)),
              fr.status === 'accepted' ? h('span', { class: 'small muted' }, fr.online ? '● en línea' : 'desconectado') : h('span', { class: 'badge' }, fr.status === 'incoming' ? 'Te invitó' : 'Pendiente'),
              fr.status === 'incoming' ? h('button', { class: 'btn small primary', onclick: async () => (await api('POST', `/api/social/friends/${fr.userId}/accept`), renderFriends()) }, 'Aceptar') : null,
              fr.status === 'accepted' && fr.online ? h('button', { class: 'btn small', onclick: () => this.game.send({ t: 'party_invite', username: fr.username }) }, 'Invitar al grupo') : null,
              h('button', { class: 'btn small ghost', onclick: async () => (await api('DELETE', `/api/social/friends/${fr.userId}`), renderFriends()) }, 'Quitar'),
            ),
          );
        }
        if (b.blocks.length) {
          body.append(h('h4', null, 'Bloqueados'));
          for (const bl of b.blocks) {
            body.append(h('div', { class: 'row' }, h('span', { class: 'grow' }, bl.username), h('button', { class: 'btn small ghost', onclick: async () => (await api('DELETE', `/api/social/blocks/${bl.userId}`), renderFriends()) }, 'Desbloquear')));
          }
        }
      });
    const renderInvite = () =>
      this.load(body, () => api<{ code: string; rules: string; stats: Record<string, number>; enabled: boolean }>('GET', '/api/referrals'), (r) => {
        const link = `${location.origin}/?ref=${r.code}`;
        body.append(
          h('p', null, 'Tu código de invitación:'),
          h('div', { class: 'row' }, h('input', { class: 'input', value: link, readonly: true }), h('button', { class: 'btn', onclick: () => navigator.clipboard?.writeText(link).then(() => this.hud.toast('success', 'Enlace copiado.')) }, 'Copiar')),
          h('p', { class: 'small muted', style: 'line-height:1.5' }, r.rules),
          h('p', { class: 'small' }, `Pendientes: ${r.stats.pending ?? 0} · Recompensados: ${r.stats.rewarded ?? 0} · Rechazados: ${r.stats.rejected ?? 0}`),
        );
      });
    if (tab === 'party') {
      renderParty();
      this.unsub.push(store.on('party', renderParty));
    } else if (tab === 'nearby') {
      renderNearby();
      this.unsub.push(store.on('players', renderNearby));
    } else if (tab === 'friends') renderFriends();
    else renderInvite();
  }

  private inviteByUserId(userId: string) {
    this.game.send({ t: 'party_invite', userId });
  }

  private async friendByUserId(userId: string) {
    try {
      const r = await api<{ status: string }>('POST', '/api/social/friends', { userId });
      this.hud.toast('success', r.status === 'accepted' ? '¡Ahora son amigos!' : 'Solicitud de amistad enviada.');
    } catch (e) {
      this.hud.toast('warn', (e as Error).message);
    }
  }

  private async block(userId: string, name: string) {
    if (!confirm(`¿Bloquear a ${name}? No verás sus mensajes ni podrá invitarte.`)) return;
    try {
      await api('POST', '/api/social/blocks', { userId });
      this.hud.toast('success', `${name} bloqueado.`);
    } catch (e) {
      this.hud.toast('warn', (e as Error).message);
    }
  }

  private report(userId: string, name: string) {
    const body = this.shell(`Reportar a ${name}`);
    const sel = h('select', { class: 'input' }, ...REPORT_REASONS.map(([v, l]) => h('option', { value: v }, l)));
    const det = h('textarea', { class: 'input', rows: 4, maxlength: 500, placeholder: 'Describe lo ocurrido (opcional)' });
    body.append(
      h('p', { class: 'small muted' }, 'Los reportes los revisa el equipo de moderación. Se adjuntan automáticamente los últimos mensajes de chat del jugador.'),
      sel,
      det,
      h('div', { class: 'row', style: 'margin-top:10px' }, h('span', { class: 'grow' }), h('button', {
        class: 'btn primary',
        onclick: async () => {
          try {
            await api('POST', '/api/social/reports', { targetUserId: userId, reason: sel.value, details: det.value || null });
            this.hud.toast('success', 'Reporte enviado. Gracias por ayudarnos.');
            this.close();
          } catch (e) {
            this.hud.toast('warn', (e as Error).message);
          }
        },
      }, 'Enviar reporte')),
    );
  }

  // ------------------------------------------------------------------ tienda
  private shop() {
    const tab = this.tab.shop ?? 'coins';
    const body = this.shell(TITLES.shop, [['coins', 'Monedas'], ['gems', 'Gemas'], ['free', 'Gratis (anuncios)'], ['market', 'Mercado']], 'shop');
    const productCard = (p: any) =>
      h(
        'div',
        { class: `card rarity-${p.rarity}` },
        h('span', { class: 'name' }, p.name),
        h('div', { class: 'row' }, rarityBadge(p.rarity), p.limited ? h('span', { class: 'badge cold' }, 'Temporada') : null),
        h('div', { class: 'desc' }, p.description),
        h('button', {
          class: 'btn small',
          disabled: p.owned,
          onclick: async (e: Event) => {
            const b = e.currentTarget as HTMLButtonElement;
            b.disabled = true;
            try {
              await api('POST', '/api/store/buy', { sku: p.sku, idempotencyKey: idem() });
              this.game.audio.success();
              this.hud.toast('success', `Compraste: ${p.name}`);
              this.open('shop');
            } catch (err) {
              this.hud.toast('warn', (err as Error).message);
              b.disabled = false;
            }
          },
        }, p.owned ? 'Ya lo tienes' : `${p.priceCurrency === 'coins' ? '🪙' : '💎'} ${fmt(p.price)}`),
      );
    if (tab === 'coins' || tab === 'gems') {
      this.load(body, () => api<any>('GET', '/api/store'), (d) => {
        const list = d.products.filter((p: any) => p.priceCurrency === (tab === 'coins' ? 'coins' : 'gems'));
        if (tab === 'gems') {
          body.append(
            h('div', { class: 'notice-box' }, d.paymentsSandbox ? 'MODO SANDBOX: las compras de gemas son simuladas y NO cobran dinero. En producción se integrará Google Play Billing / App Store / Stripe con verificación de recibos en el servidor.' : 'Las compras se verifican en el servidor.'),
            h('h4', null, 'Paquetes de gemas'),
          );
          const packs = h('div', { class: 'cards' });
          for (const g of d.gemPacks) {
            packs.append(
              h('div', { class: 'card' }, h('span', { class: 'name' }, `💎 ${g.gems} gemas`), h('div', { class: 'desc' }, g.label), d.paymentsSandbox ? h('span', { class: 'badge sandbox' }, 'Sandbox') : null, h('button', {
                class: 'btn small primary',
                disabled: !d.paymentsAvailable,
                onclick: async () => {
                  try {
                    const r = await api<{ gems: number; sandbox: boolean }>('POST', '/api/store/gems', { sku: g.sku });
                    this.hud.toast('success', `+${r.gems} gemas${r.sandbox ? ' (sandbox, sin cobro)' : ''}`);
                  } catch (e) {
                    this.hud.toast('warn', (e as Error).message);
                  }
                },
              }, `${money(g.priceCents, g.currency)}${d.paymentsSandbox ? ' · simulado' : ''}`)),
            );
          }
          body.append(packs, h('h4', null, 'Artículos premium'));
          if (d.seasonPass) {
            body.append(h('div', { class: 'card', style: 'margin-bottom:8px' }, h('span', { class: 'name' }, `Pase premium — ${d.seasonPass.name}`), h('div', { class: 'desc' }, 'Desbloquea la ruta premium del pase de temporada.'), h('button', { class: 'btn small', onclick: () => this.open('season') }, `Ver pase (💎 ${d.seasonPass.priceGems})`)));
          }
        }
        const grid = h('div', { class: 'cards' });
        list.forEach((p: any) => grid.append(productCard(p)));
        body.append(grid, h('p', { class: 'small muted' }, 'Las monedas se ganan jugando. Los puntos de recompensa nunca se usan en la tienda.'));
      });
    } else if (tab === 'free') {
      this.load(body, () => api<any>('GET', '/api/ads'), (d) => {
        body.append(h('p', { class: 'small muted' }, 'Los anuncios son siempre opcionales. Hay un límite diario y un tiempo de espera entre anuncios.'));
        for (const p of d.placements.filter((x: any) => x.type === 'rewarded')) {
          body.append(
            h('div', { class: 'card' }, h('div', { class: 'row' }, h('span', { class: 'name grow' }, p.name), p.sandbox ? h('span', { class: 'badge sandbox' }, 'Sandbox') : null), h('div', { class: 'desc' }, `Recompensa: 🪙 ${p.rewardCoins}${p.rewardRp ? ` + ✦ ${p.rewardRp}` : ''} · Vistos hoy: ${p.usedToday}/${p.dailyCap}${p.cooldownLeftSec ? ` · Disponible en ${p.cooldownLeftSec} s` : ''}`), h('button', { class: 'btn small primary', disabled: !p.available, onclick: () => this.watchAd(p.id, p.minWatchSec) }, p.available ? 'Ver anuncio' : 'No disponible')),
          );
        }
      });
    } else {
      this.load(body, () => api<any>('GET', '/api/marketplace'), (d) => {
        if (!d.enabled) {
          body.append(h('div', { class: 'notice-box' }, 'El mercado entre jugadores todavía no está disponible. Cuando se active, los intercambios serán únicamente con monedas del juego, con custodia del objeto y comisión de plataforma. No se permite dinero real entre jugadores.'));
          return;
        }
        body.append(h('p', { class: 'small muted' }, `Comisión de plataforma: ${d.commissionPct}%. Pon objetos a la venta desde tu inventario.`));
        const grid = h('div', { class: 'cards' });
        for (const l of d.listings) {
          grid.append(
            h('div', { class: `card rarity-${l.rarity}` }, h('span', { class: 'name' }, l.itemName), rarityBadge(l.rarity), h('div', { class: 'desc' }, `Vendedor: ${l.seller}`), l.mine ? h('button', { class: 'btn small ghost', onclick: async () => (await api('POST', `/api/marketplace/listings/${l.id}/cancel`), this.open('shop')) }, 'Retirar') : h('button', {
              class: 'btn small',
              onclick: async () => {
                try {
                  await api('POST', `/api/marketplace/listings/${l.id}/buy`);
                  this.hud.toast('success', 'Compra realizada.');
                  this.open('shop');
                } catch (e) {
                  this.hud.toast('warn', (e as Error).message);
                }
              },
            }, `🪙 ${fmt(l.price)}`)),
          );
        }
        body.append(d.listings.length ? grid : h('p', { class: 'muted' }, 'No hay publicaciones.'));
      });
    }
  }

  /** Anuncio recompensado: flujo con verificación en servidor (sandbox en el MVP). */
  private async watchAd(placementId: string, minWatch: number) {
    let start: { token: string; minWatchSec: number; sandbox: boolean };
    try {
      start = await api('POST', '/api/ads/start', { placementId });
    } catch (e) {
      this.hud.toast('warn', (e as Error).message);
      return;
    }
    const secs = Math.max(minWatch, start.minWatchSec);
    const count = h('div', { class: 'muted' }, `${secs}`);
    const close = h('button', { class: 'btn', disabled: true }, 'Cerrar');
    const overlay = h(
      'div',
      { class: 'ad-overlay' },
      h('span', { class: 'badge sandbox' }, 'Anuncio de prueba (sandbox)'),
      h('div', { class: 'ad-box' }, h('div', { class: 'serif', style: 'font-size:22px;color:#f0d9a4' }, 'Espacio publicitario'), h('div', { class: 'small muted' }, 'Aquí se mostrará un anuncio real de la red configurada (p. ej. AdMob).'), count),
      close,
    );
    this.root.append(overlay);
    this.game.paused = true;
    let left = secs;
    const iv = setInterval(() => {
      left--;
      count.textContent = left > 0 ? `${left}` : 'Listo';
      if (left <= 0) {
        clearInterval(iv);
        close.removeAttribute('disabled');
      }
    }, 1000);
    close.addEventListener('click', async () => {
      overlay.remove();
      this.game.paused = !!this.backdrop;
      try {
        const r = await api<{ coins: number; rp: number; note: string | null }>('POST', '/api/ads/complete', { token: start.token });
        this.hud.toast('success', `¡Gracias! +${r.coins} monedas${r.rp ? ` y +${r.rp} puntos` : ''}.${r.note ? ' ' + r.note : ''}`);
      } catch (e) {
        this.hud.toast('warn', (e as Error).message);
      }
      if (this.current === 'shop') this.open('shop');
    });
  }

  // ------------------------------------------------------------------ temporada
  private season() {
    const body = this.shell(TITLES.season);
    const render = () =>
      this.load(body, () => api<any>('GET', '/api/season'), (d) => {
        if (!d.season) {
          body.append(h('p', { class: 'muted' }, 'No hay una temporada activa en este momento.'));
          return;
        }
        const s = d.season;
        body.append(
          h('h3', { class: 'serif', style: 'margin:0;color:var(--gold-2);font-weight:400' }, s.name),
          h('p', { class: 'small muted' }, s.description, ` · Termina el ${new Date(s.endsAt).toLocaleDateString('es-MX')}`),
          h('div', { class: 'row' }, h('span', { class: 'grow' }, `XP de temporada: ${fmt(d.xp)}`), d.premium ? h('span', { class: 'badge' }, 'Premium activo') : h('button', {
            class: 'btn small primary',
            onclick: async () => {
              if (!confirm(`¿Comprar el pase premium por ${s.premiumPriceGems} gemas?`)) return;
              try {
                await api('POST', '/api/season/premium');
                this.hud.toast('success', 'Pase premium activado.');
                render();
              } catch (e) {
                this.hud.toast('warn', (e as Error).message);
              }
            },
          }, `Pase premium · 💎 ${s.premiumPriceGems}`)),
          h('div', { class: 'sep' }),
        );
        for (const ev of d.events) body.append(h('div', { class: 'notice-box small', style: 'margin-bottom:8px' }, h('b', null, `Evento: ${ev.name}. `), ev.description));
        const tiers = h('div', { class: 'tiers' });
        const claimBtn = (tier: number, track: 'free' | 'premium', claimed: boolean, enabled: boolean) =>
          h('button', {
            class: 'btn small',
            disabled: claimed || !enabled,
            onclick: async () => {
              try {
                await api('POST', '/api/season/claim', { tier, track });
                this.game.audio.success();
                render();
              } catch (e) {
                this.hud.toast('warn', (e as Error).message);
              }
            },
          }, claimed ? 'Reclamado' : 'Reclamar');
        for (const t of d.tiers) {
          tiers.append(
            h(
              'div',
              { class: `tier ${t.unlocked ? '' : 'locked'}` },
              h('div', { class: 'lvl' }, `${t.tier}`, h('small', null, `${t.xpRequired} XP`)),
              h('div', { class: 'rw' }, h('span', { class: 'small muted' }, 'Gratis'), h('span', null, t.free.label), claimBtn(t.tier, 'free', t.freeClaimed, t.unlocked)),
              h('div', { class: 'rw premium' }, h('span', { class: 'small muted' }, 'Premium'), h('span', null, t.premium.label), claimBtn(t.tier, 'premium', t.premiumClaimed, t.unlocked && d.premium)),
            ),
          );
        }
        body.append(tiers);
      });
    render();
  }

  // ------------------------------------------------------------------ recompensas
  private rewards() {
    const body = this.shell(TITLES.rewards);
    const render = () =>
      this.load(body, () => api<any>('GET', '/api/rewards'), (d) => {
        const r = d.redemption;
        body.append(
          h('div', { class: 'stat-grid' },
            h('div', { class: 'stat' }, h('div', { class: 'v' }, `✦ ${fmt(d.balance)}`), h('div', { class: 'k' }, 'Saldo de puntos')),
            h('div', { class: 'stat' }, h('div', { class: 'v' }, `${fmt(d.limits.earnedToday)}/${fmt(d.limits.dailyCap)}`), h('div', { class: 'k' }, 'Ganados hoy')),
            h('div', { class: 'stat' }, h('div', { class: 'v' }, `${fmt(d.limits.earnedThisWeek)}/${fmt(d.limits.weeklyCap)}`), h('div', { class: 'k' }, 'Esta semana')),
          ),
          h('div', { class: 'notice-box', style: 'margin:12px 0' },
            r.realActive
              ? 'Los puntos pueden canjearse por recompensas reales sujetas a requisitos, límites y revisión manual. No constituyen un salario ni un ingreso garantizado.'
              : 'MODO SANDBOX: el canje por recompensas de valor real está DESACTIVADO. Puedes probar el flujo; las solicitudes se marcan como sandbox y no generan ningún pago.',
          ),
          h('h4', null, 'Cómo se ganan'),
          h('p', { class: 'small muted', style: 'line-height:1.5' }, 'Resolviendo misterios por primera vez, en eventos, logros, actividades cooperativas y algunos anuncios recompensados opcionales. Hay límites diarios y semanales, y un presupuesto global. Repetir misterios no otorga puntos.'),
          h('h4', null, 'Requisitos para canjear'),
          h('ul', { class: 'small muted', style: 'line-height:1.6' },
            h('li', null, `Mínimo ${fmt(r.minPoints)} puntos por solicitud (máx. ${fmt(r.maxPointsPerRequest)}).`),
            h('li', null, `Cuenta con al menos ${r.minAccountAgeDays} días${r.requireVerifiedEmail ? ' y correo verificado' : ''}.`),
            h('li', null, `Una solicitud cada ${r.cooldownDays} días; tope mensual ${money(r.monthlyCapUsdCents)}.`),
            h('li', null, 'Todas las solicitudes pasan por revisión antifraude manual.'),
          ),
        );
        const pts = h('input', { class: 'input', type: 'number', min: r.minPoints, step: 100, value: r.minPoints });
        const type = h('select', { class: 'input' }, ...r.rewardTypes.map((t: string) => h('option', { value: t }, t.replace(/_/g, ' '))));
        body.append(
          h('div', { class: 'row', style: 'flex-wrap:wrap' }, pts, type, h('button', {
            class: 'btn primary',
            onclick: async () => {
              try {
                const res = await api<any>('POST', '/api/rewards/redeem', { points: Number(pts.value), rewardType: type.value, idempotencyKey: idem() });
                this.hud.toast('success', `Solicitud enviada a revisión${res.sandbox ? ' (sandbox)' : ''}.`);
                render();
              } catch (e) {
                this.hud.toast('warn', (e as Error).message, undefined, 9000);
              }
            },
          }, 'Solicitar canje')),
          h('p', { class: 'small muted' }, `Valor de referencia: ${money(r.usdCentsPer1000)} por cada 1,000 puntos.`),
        );
        if (d.redemptions.length) {
          body.append(h('h4', null, 'Mis solicitudes'));
          const t = h('table', { class: 't' }, h('tr', null, h('th', null, 'Fecha'), h('th', null, 'Puntos'), h('th', null, 'Estado')));
          for (const x of d.redemptions) t.append(h('tr', null, h('td', null, dateTime(x.created_at)), h('td', null, fmt(x.points)), h('td', null, x.status.replace('_', ' '), x.sandbox ? ' · sandbox' : '')));
          body.append(t);
        }
        body.append(h('h4', null, 'Historial de puntos'));
        const t2 = h('table', { class: 't' });
        for (const x of d.history) t2.append(h('tr', null, h('td', null, dateTime(x.created_at)), h('td', { style: x.delta > 0 ? 'color:var(--ok)' : 'color:var(--danger)' }, x.delta > 0 ? `+${x.delta}` : `${x.delta}`), h('td', { class: 'muted' }, x.reason)));
        body.append(d.history.length ? t2 : h('p', { class: 'muted small' }, 'Sin movimientos todavía.'));
      });
    render();
  }

  // ------------------------------------------------------------------ ajustes
  private settings() {
    const body = this.shell(TITLES.settings);
    const s = store.settings;
    const slider = (label: string, key: 'master' | 'music' | 'sfx' | 'ambient' | 'sensitivity', max = 1) => {
      const input = h('input', { type: 'range', min: 0, max, step: 0.05, value: s[key] });
      input.addEventListener('input', () => {
        s[key] = Number(input.value);
        this.game.audio.volumes = { master: s.master, music: s.music, sfx: s.sfx, ambient: s.ambient };
        this.game.audio.applyVolumes();
        this.game.input.sensitivity = s.sensitivity;
        store.saveSettings();
      });
      return h('label', { class: 'field' }, label, input);
    };
    const quality = h('select', { class: 'input' }, ...(['low', 'medium', 'high'] as const).map((q) => h('option', { value: q, selected: s.quality === q }, { low: 'Baja (móviles modestos)', medium: 'Media', high: 'Alta' }[q])));
    quality.addEventListener('change', () => {
      s.quality = quality.value as typeof s.quality;
      store.saveSettings();
      if (confirm('La calidad se aplica al recargar. ¿Recargar ahora?')) location.reload();
    });
    const invert = h('input', { type: 'checkbox', checked: s.invertY });
    invert.addEventListener('change', () => {
      s.invertY = invert.checked;
      this.game.input.invertY = s.invertY;
      store.saveSettings();
    });
    const p = store.profile;
    add(
      body,
      h('h4', null, 'Gráficos y sonido'),
      h('label', { class: 'field' }, 'Calidad gráfica', quality),
      slider('Volumen general', 'master'),
      slider('Música', 'music'),
      slider('Efectos', 'sfx'),
      slider('Ambiente', 'ambient'),
      h('h4', null, 'Controles'),
      slider('Sensibilidad de cámara', 'sensitivity', 2),
      h('label', { class: 'check' }, invert, h('span', null, 'Invertir eje vertical')),
      h('p', { class: 'small muted', style: 'line-height:1.6' }, 'PC: WASD/flechas mover · Mayús correr · arrastrar ratón cámara · rueda zoom · E investigar · F linterna · J diario · I inventario · M mapa · P grupo · B tienda · V temporada · Enter chat · Esc menú. Gamepad: stick izq. mover, stick der. cámara, A investigar, X linterna, Y diario.'),
      h('div', { class: 'sep' }),
      h('h4', null, 'Cuenta'),
      p ? h('p', { class: 'small' }, `${p.user.username} · ${p.user.email} · Nivel ${p.user.level} (${fmt(p.user.xp)} XP)`) : null,
      p ? h('p', { class: 'small muted' }, `Misterios resueltos: ${p.stats.missionsCompleted} · Pistas: ${p.stats.cluesFound} · Objetos: ${p.stats.itemsOwned} · Tiempo de juego: ${Math.round(p.stats.playSeconds / 60)} min`) : null,
      p && !p.user.emailVerified ? h('p', { class: 'small', style: 'color:var(--warn)' }, 'Tu correo no está verificado.', store.config?.mailSandbox ? ' (Sandbox: el enlace aparece en la consola del servidor.)' : '') : null,
      p?.user.role !== 'player' ? h('p', null, h('a', { href: '/admin.html', target: '_blank', rel: 'noopener', style: 'color:var(--gold)' }, 'Abrir panel de administración')) : null,
      h('div', { class: 'row' }, h('button', {
        class: 'btn danger',
        onclick: async () => {
          try {
            await api('POST', '/api/auth/logout');
          } catch {
            /* ignorar */
          }
          session.token = null;
          this.onLogout();
        },
      }, 'Cerrar sesión')),
    );
  }

  // ------------------------------------------------------------------ modales
  puzzle(p: PuzzlePrompt) {
    const body = this.shell(p.title);
    const input = h('input', { class: 'input', placeholder: p.inputHint, maxlength: 40, autocomplete: 'off', style: 'font-size:22px;text-align:center;letter-spacing:.3em' });
    this.puzzleEl = h('div', { class: 'error-text center' });
    body.append(
      h('p', { class: 'serif', style: 'font-size:16px;line-height:1.5' }, p.prompt),
      h('form', { class: 'col', onsubmit: (e: Event) => (e.preventDefault(), input.value.trim() && this.game.send({ t: 'solve', puzzleId: p.id, answer: input.value.trim() })) }, input, this.puzzleEl, h('button', { class: 'btn primary block', type: 'submit' }, 'Probar')),
      h('p', { class: 'small muted' }, 'Consejo: revisa las pistas de tu diario (J).'),
    );
    setTimeout(() => input.focus(), 50);
  }

  puzzleResult(ok: boolean, msg: string) {
    if (!this.puzzleEl) return;
    this.puzzleEl.textContent = msg;
    this.puzzleEl.style.color = ok ? 'var(--ok)' : '';
    if (ok) setTimeout(() => this.close(), 700);
  }

  missionComplete(title: string, r: RewardSummary) {
    const body = this.shell('Misterio resuelto');
    body.append(
      h('h3', { class: 'serif center', style: 'color:var(--gold-2);font-weight:400;font-size:24px;margin:6px 0' }, title),
      h('div', { class: 'stat-grid', style: 'margin:12px 0' },
        h('div', { class: 'stat' }, h('div', { class: 'v' }, `🪙 ${fmt(r.coins)}`), h('div', { class: 'k' }, 'Monedas')),
        h('div', { class: 'stat' }, h('div', { class: 'v' }, `✦ ${fmt(r.rp)}`), h('div', { class: 'k' }, 'Puntos de recompensa')),
        h('div', { class: 'stat' }, h('div', { class: 'v' }, fmt(r.xp)), h('div', { class: 'k' }, 'XP')),
        h('div', { class: 'stat' }, h('div', { class: 'v' }, fmt(r.seasonXp)), h('div', { class: 'k' }, 'XP de temporada')),
      ),
      ...r.items.map((i) => h('div', { class: `card rarity-${i.rarity}`, style: 'margin-bottom:6px' }, h('span', { class: 'name' }, `Hallazgo: ${i.name}`), rarityBadge(i.rarity))),
      ...r.notes.map((n) => h('p', { class: 'small muted' }, n)),
      h('div', { class: 'row', style: 'margin-top:12px' },
        h('button', { class: 'btn ghost', onclick: () => (this.close(), this.watchAd('optional_after_mission', 5)) }, 'Ver anuncio opcional (+10 🪙)'),
        h('span', { class: 'grow' }),
        h('button', { class: 'btn primary', onclick: () => this.close() }, 'Continuar'),
      ),
    );
  }

  fatal(reason: string) {
    this.close();
    const bd = h('div', { class: 'panel-backdrop' }, h('div', { class: 'panel' }, h('div', { class: 'panel-body center' }, h('h2', { class: 'serif', style: 'color:var(--gold-2);font-weight:400' }, 'Desconectado'), h('p', null, reason), h('button', { class: 'btn primary', onclick: () => location.reload() }, 'Volver al inicio'))));
    this.root.append(bd);
    this.game.paused = true;
  }
}
