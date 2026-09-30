import type { Db } from '../../db/database';
import { notFound } from '../../lib/errors';
import type { Rarity } from '../../../../shared/constants';

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  category: string;
  stackable: boolean;
  tradeable: boolean;
  equipSlot: 'hat' | 'outfit' | 'lantern' | null;
}

export class ItemCatalog {
  private items = new Map<string, ItemDef>();

  constructor(private readonly db: Db) {}

  reload() {
    this.items.clear();
    const rows = this.db.all<{
      id: string;
      name: string;
      description: string;
      rarity: Rarity;
      category: string;
      stackable: number;
      tradeable: number;
      equip_slot: string | null;
    }>('SELECT * FROM items');
    for (const r of rows) {
      this.items.set(r.id, {
        id: r.id,
        name: r.name,
        description: r.description,
        rarity: r.rarity,
        category: r.category,
        stackable: !!r.stackable,
        tradeable: !!r.tradeable,
        equipSlot: (r.equip_slot as ItemDef['equipSlot']) ?? null,
      });
    }
  }

  get(id: string): ItemDef | undefined {
    return this.items.get(id);
  }

  require(id: string): ItemDef {
    const it = this.items.get(id);
    if (!it) throw notFound(`Objeto desconocido: ${id}`);
    return it;
  }

  all(): ItemDef[] {
    return [...this.items.values()];
  }
}
