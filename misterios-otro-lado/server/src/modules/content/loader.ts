import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { Db } from '../../db/database';

const ItemsFile = z.object({
  items: z.array(
    z.object({
      id: z.string().regex(/^[a-z0-9_]{2,48}$/),
      name: z.string().min(1).max(60),
      description: z.string().max(300),
      rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']),
      category: z.string().min(1).max(30),
      stackable: z.boolean(),
      tradeable: z.boolean(),
      equipSlot: z.enum(['hat', 'outfit', 'lantern']).nullable(),
    }),
  ),
});

/** Carga datos base (monedas y catálogo de objetos) desde /content. Idempotente. */
export function loadBaseContent(db: Db, contentDir: string) {
  db.tx(() => {
    const currencies: [string, string, string, string][] = [
      ['coins', 'Monedas', 'soft', 'Moneda virtual que se obtiene jugando. Sin valor monetario.'],
      ['gems', 'Gemas', 'premium', 'Moneda premium que se adquiere con dinero real (sandbox en el MVP). No canjeable por dinero.'],
      ['rp', 'Puntos de recompensa', 'reward', 'Puntos por actividad validada. Pueden canjearse por recompensas reales sólo si el programa está activo.'],
    ];
    for (const c of currencies) db.run('INSERT OR IGNORE INTO currencies(code, name, kind, description) VALUES (?, ?, ?, ?)', ...c);

    const items = ItemsFile.parse(JSON.parse(readFileSync(path.join(contentDir, 'items.json'), 'utf8')));
    for (const it of items.items) {
      db.run(
        `INSERT INTO items(id, name, description, rarity, category, stackable, tradeable, equip_slot) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description, rarity = excluded.rarity,
         category = excluded.category, stackable = excluded.stackable, tradeable = excluded.tradeable, equip_slot = excluded.equip_slot`,
        it.id,
        it.name,
        it.description,
        it.rarity,
        it.category,
        it.stackable ? 1 : 0,
        it.tradeable ? 1 : 0,
        it.equipSlot,
      );
    }
  });
}
