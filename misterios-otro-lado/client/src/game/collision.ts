import { type Collider, resolveCollisions } from '../../../shared/world';

/** Rejilla espacial para consultar colisionadores cercanos rápidamente. */
export class CollisionGrid {
  private cells = new Map<string, Collider[]>();
  dynamic: Collider[] = [];

  constructor(colliders: Collider[], private size = 8) {
    for (const c of colliders) {
      const [minX, maxX, minZ, maxZ] = c.type === 'box' ? [c.minX, c.maxX, c.minZ, c.maxZ] : [c.x - c.r, c.x + c.r, c.z - c.r, c.z + c.r];
      for (let gx = Math.floor(minX / size); gx <= Math.floor(maxX / size); gx++) {
        for (let gz = Math.floor(minZ / size); gz <= Math.floor(maxZ / size); gz++) {
          const k = `${gx},${gz}`;
          let arr = this.cells.get(k);
          if (!arr) this.cells.set(k, (arr = []));
          arr.push(c);
        }
      }
    }
  }

  near(x: number, z: number): Collider[] {
    const gx = Math.floor(x / this.size);
    const gz = Math.floor(z / this.size);
    const out = new Set<Collider>();
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const c of this.cells.get(`${gx + dx},${gz + dz}`) ?? []) out.add(c);
    for (const c of this.dynamic) out.add(c);
    return [...out];
  }

  resolve(x: number, z: number, r: number): [number, number] {
    return resolveCollisions(x, z, r, this.near(x, z));
  }
}
