import type { Db } from '../../db/database';
import type { InventoryItemView } from '../../../../shared/protocol';
import type { ItemCatalog } from './catalog';

export class InventoryService {
  constructor(
    private readonly db: Db,
    private readonly catalog: ItemCatalog,
  ) {}

  list(userId: string): InventoryItemView[] {
    const rows = this.db.all<{ id: string; item_id: string; quantity: number; state: string }>(
      "SELECT id, item_id, quantity, state FROM inventory_items WHERE user_id = ? AND state IN ('owned','escrow') AND quantity > 0 ORDER BY acquired_at",
      userId,
    );
    return rows.map((r) => {
      const def = this.catalog.require(r.item_id);
      return {
        instanceId: r.id,
        itemId: r.item_id,
        name: def.name,
        description: def.description,
        rarity: def.rarity,
        category: def.category,
        quantity: r.quantity,
        tradeable: def.tradeable,
        equippable: def.equipSlot,
        state: r.state,
      };
    });
  }

  countOwned(userId: string, itemId: string): number {
    const r = this.db.get<{ n: number | null }>(
      "SELECT SUM(quantity) AS n FROM inventory_items WHERE user_id = ? AND item_id = ? AND state = 'owned'",
      userId,
      itemId,
    );
    return r?.n ?? 0;
  }

  owns(userId: string, itemId: string): boolean {
    return this.countOwned(userId, itemId) > 0;
  }

  ownedItemIds(userId: string): Set<string> {
    const rows = this.db.all<{ item_id: string }>(
      "SELECT DISTINCT item_id FROM inventory_items WHERE user_id = ? AND state = 'owned' AND quantity > 0",
      userId,
    );
    return new Set(rows.map((r) => r.item_id));
  }
}
