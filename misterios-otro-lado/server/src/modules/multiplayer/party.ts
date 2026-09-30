import { clock } from '../../lib/clock';
import { newId } from '../../lib/ids';
import { SOCIAL } from '../../../../shared/constants';

export interface Party {
  id: string;
  leaderId: string;
  members: string[];
  names: Map<string, string>;
  offlineSince: Map<string, number>;
}

interface Invite {
  id: string;
  fromId: string;
  toId: string;
  expiresAt: number;
}

/**
 * Grupos en memoria (efímeros por diseño: un grupo vive mientras sus miembros juegan).
 * En despliegue multi-nodo se mueve a Redis con la misma interfaz.
 */
export class PartyManager {
  private parties = new Map<string, Party>();
  private byUser = new Map<string, string>();
  private invites = new Map<string, Invite>();

  partyOf(userId: string): Party | null {
    const id = this.byUser.get(userId);
    return id ? this.parties.get(id) ?? null : null;
  }

  invite(fromId: string, fromName: string, toId: string): Invite {
    const now = clock.now();
    const p = this.partyOf(fromId);
    if (p && p.leaderId !== fromId) throw new Error('Sólo el líder puede invitar.');
    if (p && p.members.length >= SOCIAL.partyMax) throw new Error('El grupo está completo.');
    if (this.byUser.get(toId) && this.byUser.get(toId) === this.byUser.get(fromId)) throw new Error('Ya está en tu grupo.');
    for (const inv of this.invites.values()) {
      if (inv.fromId === fromId && inv.toId === toId && inv.expiresAt > now) return inv;
    }
    const inv: Invite = { id: newId(), fromId, toId, expiresAt: now + 60_000 };
    this.invites.set(inv.id, inv);
    void fromName;
    return inv;
  }

  /** Acepta una invitación. Devuelve el grupo resultante y el grupo que se abandonó (si lo había). */
  accept(inviteId: string, userId: string, names: Map<string, string>): { party: Party; left: Party | null } {
    const inv = this.invites.get(inviteId);
    this.invites.delete(inviteId);
    if (!inv || inv.toId !== userId || inv.expiresAt < clock.now()) throw new Error('La invitación expiró.');
    let party = this.partyOf(inv.fromId);
    if (!party) {
      party = { id: newId(), leaderId: inv.fromId, members: [inv.fromId], names: new Map(), offlineSince: new Map() };
      party.names.set(inv.fromId, names.get(inv.fromId) ?? '?');
      this.parties.set(party.id, party);
      this.byUser.set(inv.fromId, party.id);
    }
    if (party.members.length >= SOCIAL.partyMax) throw new Error('El grupo está completo.');
    const left = this.leave(userId);
    party.members.push(userId);
    party.names.set(userId, names.get(userId) ?? '?');
    this.byUser.set(userId, party.id);
    return { party, left };
  }

  decline(inviteId: string, userId: string): Invite | null {
    const inv = this.invites.get(inviteId);
    if (!inv || inv.toId !== userId) return null;
    this.invites.delete(inviteId);
    return inv;
  }

  /** Sale del grupo. Devuelve el grupo afectado (ya actualizado) o null. */
  leave(userId: string): Party | null {
    const party = this.partyOf(userId);
    if (!party) return null;
    party.members = party.members.filter((m) => m !== userId);
    party.names.delete(userId);
    party.offlineSince.delete(userId);
    this.byUser.delete(userId);
    if (party.members.length <= 1) {
      for (const m of party.members) this.byUser.delete(m);
      party.members = [];
      this.parties.delete(party.id);
    } else if (party.leaderId === userId) {
      party.leaderId = party.members[0];
    }
    return party;
  }

  setOnline(userId: string, online: boolean) {
    const p = this.partyOf(userId);
    if (!p) return;
    if (online) p.offlineSince.delete(userId);
    else p.offlineSince.set(userId, clock.now());
  }

  /** Expulsa a quienes llevan desconectados más de `ms`. Devuelve grupos modificados. */
  sweep(ms = 5 * 60_000): Party[] {
    const now = clock.now();
    const changed: Party[] = [];
    for (const [id, inv] of this.invites) if (inv.expiresAt < now) this.invites.delete(id);
    for (const p of [...this.parties.values()]) {
      for (const [uid, since] of p.offlineSince) {
        if (now - since > ms) {
          this.leave(uid);
          changed.push(p);
        }
      }
    }
    return changed;
  }
}
