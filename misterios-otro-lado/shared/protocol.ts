// Protocolo WebSocket cliente <-> servidor (JSON).
// Cada mensaje lleva un campo `t` (tipo). El servidor valida todos los mensajes entrantes.

import type { Rarity } from './constants';

export type Vec3 = [number, number, number];

export interface Appearance {
  skin: string;
  hair: string;
  coat: string;
  pants: string;
  /** Cosméticos equipados (ids de objeto). El servidor verifica la propiedad. */
  hat?: string | null;
  outfit?: string | null;
  lantern?: string | null;
}

export interface PublicPlayer {
  id: string; // characterId
  userId: string;
  name: string;
  appearance: Appearance;
  p: Vec3;
  r: number;
  a: AnimState;
  partyId: string | null;
}

export type AnimState = 'idle' | 'walk' | 'run';

// ---------- Estado de misiones (vista del cliente, sin respuestas de acertijos) ----------

export interface ClueView {
  id: string;
  missionId: string;
  title: string;
  text: string;
  shareable: boolean;
  source: 'found' | 'shared';
  sharedBy?: string | null;
}

export interface EntityView {
  id: string;
  kind: string;
  label: string;
  model: string;
  p: Vec3;
  radius: number;
  visible: boolean;
  /** Si es true el cliente genera un colisionador (p. ej. puerta cerrada). */
  blocking: boolean;
  blockSize?: [number, number];
  rotY?: number;
  highlight: boolean;
}

export interface NpcView {
  id: string;
  name: string;
  p: Vec3;
  rotY: number;
  appearance: Appearance;
}

export interface MissionView {
  id: string;
  title: string;
  synopsis: string;
  status: 'available' | 'active' | 'completed' | 'locked';
  lockedReason?: string;
  stageId: string | null;
  stageIndex: number;
  stageCount: number;
  objective: string;
  hint: string;
  marker: Vec3 | null;
  locationLabel: string;
  rewardsPreview: { coins: number; rp: number; xp: number; items: string[] };
  seasonId: string | null;
}

export interface MissionsPayload {
  missions: MissionView[];
  trackedId: string | null;
  entities: EntityView[];
  npcs: NpcView[];
  clues: ClueView[];
}

export interface WalletView {
  coins: number;
  gems: number;
  rp: number;
}

export interface DialogueLine {
  speaker: string;
  text: string;
}

export interface PuzzlePrompt {
  id: string;
  missionId: string;
  title: string;
  prompt: string;
  inputHint: string;
}

export interface InventoryItemView {
  instanceId: string;
  itemId: string;
  name: string;
  description: string;
  rarity: Rarity;
  category: string;
  quantity: number;
  tradeable: boolean;
  equippable: string | null;
  state: string;
}

export interface PartyView {
  id: string;
  leaderId: string;
  members: { userId: string; name: string; online: boolean }[];
}

export interface ChatLine {
  id: string;
  channel: 'world' | 'party' | 'system';
  fromUserId: string | null;
  from: string;
  text: string;
  ts: number;
}

// ---------- Mensajes cliente -> servidor ----------

export type ClientMsg =
  | { t: 'hello'; token: string; deviceId: string; v: number }
  | { t: 'move'; p: Vec3; r: number; a: AnimState; seq: number }
  | { t: 'interact'; entityId: string }
  | { t: 'solve'; puzzleId: string; answer: string }
  | { t: 'track'; missionId: string }
  | { t: 'chat'; channel: 'world' | 'party'; text: string }
  | { t: 'share_clue'; clueId: string }
  | { t: 'party_invite'; username?: string; userId?: string }
  | { t: 'party_respond'; inviteId: string; accept: boolean }
  | { t: 'party_leave' }
  | { t: 'party_kick'; userId: string }
  | { t: 'ping'; ts: number };

// ---------- Mensajes servidor -> cliente ----------

export interface WorldState {
  timeOfDay: number;
  serverTime: number;
  dayLengthSec: number;
  weather: 'clear' | 'fog' | 'rain' | 'storm';
  shardId: string;
}

export type ServerMsg =
  | {
      t: 'welcome';
      you: PublicPlayer;
      world: WorldState;
      players: PublicPlayer[];
      missions: MissionsPayload;
      wallet: WalletView;
      party: PartyView | null;
      chat: ChatLine[];
    }
  | { t: 'snapshot'; ts: number; players: { id: string; p: Vec3; r: number; a: AnimState }[] }
  | { t: 'player_join'; player: PublicPlayer }
  | { t: 'player_leave'; id: string }
  | { t: 'player_update'; player: PublicPlayer }
  | {
      t: 'interact_result';
      entityId: string;
      ok: boolean;
      messages: string[];
      dialogue?: DialogueLine[];
      puzzle?: PuzzlePrompt;
      discovered?: { clues: string[]; items: string[] };
    }
  | { t: 'solve_result'; puzzleId: string; ok: boolean; message: string }
  | { t: 'missions'; missions: MissionsPayload }
  | { t: 'mission_complete'; missionId: string; title: string; rewards: RewardSummary }
  | { t: 'wallet'; wallet: WalletView }
  | { t: 'inventory_changed' }
  | { t: 'chat'; line: ChatLine }
  | { t: 'party'; party: PartyView | null }
  | { t: 'party_invite'; inviteId: string; from: string; fromUserId: string }
  | { t: 'notice'; level: 'info' | 'success' | 'warn' | 'error'; text: string }
  | { t: 'teleport'; p: Vec3; r: number }
  | { t: 'world'; world: WorldState }
  | { t: 'correct'; p: Vec3 }
  | { t: 'pong'; ts: number; serverTime: number }
  | { t: 'error'; code: string; message: string }
  | { t: 'kicked'; reason: string };

export interface RewardSummary {
  coins: number;
  rp: number;
  xp: number;
  seasonXp: number;
  items: { itemId: string; name: string; rarity: Rarity }[];
  notes: string[];
}
