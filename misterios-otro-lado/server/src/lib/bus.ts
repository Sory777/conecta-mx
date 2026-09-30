// Bus de eventos interno: desacopla módulos (misiones -> referidos, economía -> gateway, etc.).
import { EventEmitter } from 'node:events';
import type { RewardSummary } from '../../../shared/protocol';

export interface BusEvents {
  'wallet.changed': { userId: string };
  'inventory.changed': { userId: string };
  'missions.changed': { userId: string };
  'appearance.changed': { userId: string };
  'mission.completed': { userId: string; missionId: string; firstTime: boolean; rewards: RewardSummary };
  'user.status': { userId: string; status: string; reason?: string | null };
  'world.refresh': Record<string, never>;
  'notice': { userId: string; level: 'info' | 'success' | 'warn' | 'error'; text: string };
}

export class Bus {
  private ee = new EventEmitter();
  constructor() {
    this.ee.setMaxListeners(100);
  }
  emit<K extends keyof BusEvents>(ev: K, payload: BusEvents[K]) {
    this.ee.emit(ev, payload);
  }
  on<K extends keyof BusEvents>(ev: K, fn: (payload: BusEvents[K]) => void) {
    this.ee.on(ev, fn);
  }
}
