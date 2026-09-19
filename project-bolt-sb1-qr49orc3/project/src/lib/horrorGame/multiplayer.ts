import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import type { Dir } from './types';

export interface RemotePlayerInfo {
  id: string;
  name: string;
  color: string;
  joinedAt: number;
}

export interface MovePayload {
  id: string;
  cx: number;
  cy: number;
  facing: Dir;
  moving: boolean;
}

export interface MonsterPayload {
  cx: number;
  cy: number;
}

export interface KeyCollectedPayload {
  keyId: number;
  by: string;
}

export interface JumpscarePayload {
  kind: 'monster' | 'trap' | 'prank';
  targetId?: string;
  fromName?: string;
}

export interface GameEndPayload {
  result: 'win' | 'gameover';
}

interface RoomEvents {
  onPlayers: (players: RemotePlayerInfo[]) => void;
  onMove: (payload: MovePayload) => void;
  onMonster: (payload: MonsterPayload) => void;
  onKeyCollected: (payload: KeyCollectedPayload) => void;
  onJumpscare: (payload: JumpscarePayload) => void;
  onGameEnd: (payload: GameEndPayload) => void;
  onStart: () => void;
}

export class HorrorRoom {
  channel: RealtimeChannel;
  private self: RemotePlayerInfo;
  private handlers: RoomEvents;

  constructor(roomCode: string, self: RemotePlayerInfo, handlers: RoomEvents) {
    this.self = self;
    this.handlers = handlers;
    this.channel = supabase.channel(`horror-room-${roomCode}`, {
      config: { presence: { key: self.id }, broadcast: { self: false } },
    });

    this.channel
      .on('presence', { event: 'sync' }, () => {
        const state = this.channel.presenceState<RemotePlayerInfo>();
        const players = Object.values(state)
          .map((entries) => entries[0])
          .filter(Boolean) as RemotePlayerInfo[];
        this.handlers.onPlayers(players);
      })
      .on('broadcast', { event: 'move' }, ({ payload }) => this.handlers.onMove(payload as MovePayload))
      .on('broadcast', { event: 'monster' }, ({ payload }) => this.handlers.onMonster(payload as MonsterPayload))
      .on('broadcast', { event: 'key' }, ({ payload }) => this.handlers.onKeyCollected(payload as KeyCollectedPayload))
      .on('broadcast', { event: 'scare' }, ({ payload }) => this.handlers.onJumpscare(payload as JumpscarePayload))
      .on('broadcast', { event: 'end' }, ({ payload }) => this.handlers.onGameEnd(payload as GameEndPayload))
      .on('broadcast', { event: 'start' }, () => this.handlers.onStart());
  }

  async join(): Promise<void> {
    return new Promise((resolve) => {
      this.channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await this.channel.track(this.self);
          resolve();
        }
      });
    });
  }

  isHost(players: RemotePlayerInfo[]): boolean {
    if (players.length === 0) return true;
    const sorted = [...players].sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
    return sorted[0].id === this.self.id;
  }

  sendStart() {
    this.channel.send({ type: 'broadcast', event: 'start', payload: {} });
  }

  sendMove(payload: MovePayload) {
    this.channel.send({ type: 'broadcast', event: 'move', payload });
  }

  sendMonster(payload: MonsterPayload) {
    this.channel.send({ type: 'broadcast', event: 'monster', payload });
  }

  sendKeyCollected(payload: KeyCollectedPayload) {
    this.channel.send({ type: 'broadcast', event: 'key', payload });
  }

  sendJumpscare(payload: JumpscarePayload) {
    this.channel.send({ type: 'broadcast', event: 'scare', payload });
  }

  sendGameEnd(payload: GameEndPayload) {
    this.channel.send({ type: 'broadcast', event: 'end', payload });
  }

  leave() {
    supabase.removeChannel(this.channel);
  }
}

export function randomPlayerId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const PLAYER_COLORS = ['#38bdf8', '#f472b6', '#facc15', '#4ade80', '#c084fc', '#fb923c'];
