import type { ChatLine, MissionsPayload, PartyView, PublicPlayer, WalletView, WorldState } from '../../shared/protocol';

export interface Profile {
  user: { id: string; email: string; username: string; role: string; emailVerified: boolean; xp: number; level: number; createdAt: number; referralCode: string; rewardsOnHold: boolean };
  character: { id: string; name: string; appearance: import('../../shared/protocol').Appearance } | null;
  wallet: WalletView;
  stats: { missionsCompleted: number; cluesFound: number; itemsOwned: number; playSeconds: number; friends: number };
  vipUntil?: number | null;
  telegramLinked?: boolean;
}

export interface PublicConfig {
  sandbox: boolean;
  paymentsSandbox: boolean;
  adsSandbox: boolean;
  marketplaceEnabled: boolean;
  rewardPointsEnabled: boolean;
  realRedemptions: boolean;
  mailSandbox: boolean;
  telegram?: { enabled: boolean; botUsername: string | null; appShortName: string | null; stars: boolean };
  interstitialAfterMission?: 'off' | 'optional' | 'auto';
}

export interface Settings {
  quality: 'low' | 'medium' | 'high';
  master: number;
  music: number;
  sfx: number;
  ambient: number;
  sensitivity: number;
  invertY: boolean;
}

type Key = 'profile' | 'wallet' | 'missions' | 'party' | 'chat' | 'players' | 'world' | 'config' | 'inventory';

function loadSettings(): Settings {
  const def: Settings = {
    quality: matchMedia('(pointer: coarse)').matches ? 'low' : 'medium',
    master: 0.8,
    music: 0.6,
    sfx: 0.9,
    ambient: 0.8,
    sensitivity: 1,
    invertY: false,
  };
  try {
    return { ...def, ...JSON.parse(localStorage.getItem('mol.settings') ?? '{}') };
  } catch {
    return def;
  }
}

/** Almacén de estado mínimo con suscripción por clave. */
class Store {
  profile: Profile | null = null;
  wallet: WalletView = { coins: 0, gems: 0, rp: 0 };
  missions: MissionsPayload = { missions: [], trackedId: null, entities: [], npcs: [], clues: [] };
  party: PartyView | null = null;
  chat: ChatLine[] = [];
  players = new Map<string, PublicPlayer>();
  world: WorldState | null = null;
  config: PublicConfig | null = null;
  settings: Settings = loadSettings();
  inventoryDirty = true;
  sponsors: { id: string; slot: string; sponsor: string; headline: string; subline: string; bg: string; fg: string; link: string | null }[] = [];
  private subs = new Map<Key, Set<() => void>>();

  on(k: Key, fn: () => void) {
    let s = this.subs.get(k);
    if (!s) this.subs.set(k, (s = new Set()));
    s.add(fn);
    return () => s!.delete(fn);
  }

  emit(k: Key) {
    for (const fn of this.subs.get(k) ?? []) fn();
  }

  saveSettings() {
    try {
      localStorage.setItem('mol.settings', JSON.stringify(this.settings));
    } catch {
      /* ignorar */
    }
  }

  tracked() {
    return this.missions.missions.find((m) => m.id === this.missions.trackedId) ?? null;
  }
}

export const store = new Store();
