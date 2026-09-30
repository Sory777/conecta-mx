// Trazado del mapa principal del MVP: "San Bartolo del Monte".
// Es DATOS compartidos: el cliente lo usa para construir la escena 3D y el servidor
// para validar límites, regiones y posiciones de interacción.
//
// Convención de orientación: rotY = 0 mira hacia -Z (norte). forward = (-sin r, 0, -cos r).

export type Collider =
  | { type: 'box'; minX: number; maxX: number; minZ: number; maxZ: number; id?: string }
  | { type: 'circle'; x: number; z: number; r: number; id?: string };

export interface Building {
  id: string;
  kind: 'house' | 'shop' | 'ruin';
  x: number;
  z: number;
  w: number; // tamaño en X
  d: number; // tamaño en Z
  h: number;
  wall: string;
  roof: string;
  /** Ventanas iluminadas por la noche */
  lit: boolean;
  sponsorSlot?: string;
  label?: string;
}

export const BOUNDS = { minX: -125, maxX: 125, minZ: -125, maxZ: 95 };

/** Región subterránea (túnel bajo la Casa Morales). Sólo accesible por teletransporte del servidor. */
export const CAVE = { minX: 150, maxX: 188, minZ: -112, maxZ: -80, floorY: 0, ceilingY: 5 };

export const SPAWN = { x: 0, z: 9, rotY: 0 };

export const PLAZA = { x: 0, z: 0, r: 13 };
export const FOUNTAIN = { x: 0, z: 0, r: 2.6 };
export const WELL = { x: 30, z: -28, r: 1.2 };
export const HILL = { x: 0, z: -78, flat: 20, edge: 46, h: 3.5 };
export const ANGEL = { x: 5, z: -65 };
export const MINE = { x: -84, z: -62 };
export const CAVE_MOUTH = { x: 7, z: -93 };

/** Casa Morales: 16 x 12 m, puerta principal al sur (hacia el pueblo). */
export const CASA_MORALES = {
  x: 0,
  z: -78,
  minX: -8,
  maxX: 8,
  minZ: -84,
  maxZ: -72,
  wallH: 3.2,
  wallT: 0.3,
  frontDoor: { minX: -1.1, maxX: 1.1 },
  /** Estudio: esquina noroeste, puerta cerrada con llave en z = -78 */
  study: { minX: -8, maxX: -1, minZ: -84, maxZ: -78, doorMinX: -5, doorMaxX: -3 },
};

export const CHAPEL = { x: -38, z: -10, w: 10, d: 16, h: 7 };
export const BELL_TOWER = { x: -38, z: 0.2, size: 4.2, h: 13 };

export const TOWN_BUILDINGS: Building[] = [
  { id: 'casa_1', kind: 'house', x: -20, z: 13, w: 8, d: 7, h: 4.2, wall: '#8a7b68', roof: '#4a2c24', lit: true },
  { id: 'casa_2', kind: 'house', x: -20, z: -4, w: 7, d: 7, h: 3.8, wall: '#7c7466', roof: '#3b2a26', lit: false },
  { id: 'casa_3', kind: 'house', x: 21, z: 11, w: 8, d: 6, h: 4.0, wall: '#8d8373', roof: '#51302a', lit: true },
  {
    id: 'tienda',
    kind: 'shop',
    x: 22,
    z: -6,
    w: 9,
    d: 7,
    h: 4.4,
    wall: '#6f6a5f',
    roof: '#2f3a40',
    lit: true,
    sponsorSlot: 'shop_sign',
    label: 'Tienda del Pueblo',
  },
  { id: 'casa_5', kind: 'house', x: -8, z: 27, w: 7, d: 7, h: 3.9, wall: '#7f7666', roof: '#402a22', lit: true },
  { id: 'casa_6', kind: 'house', x: 11, z: 28, w: 8, d: 7, h: 4.1, wall: '#857a6a', roof: '#35302c', lit: false },
  { id: 'ruina_1', kind: 'ruin', x: -27, z: 30, w: 7, d: 6, h: 2.6, wall: '#5d5850', roof: '#2a2522', lit: false },
  { id: 'casa_8', kind: 'house', x: 30, z: 26, w: 7, d: 8, h: 3.9, wall: '#7a7163', roof: '#48302a', lit: true },
];

export const LAMPS: { x: number; z: number; broken?: boolean }[] = [
  ...Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2;
    return { x: Math.cos(a) * 11, z: Math.sin(a) * 11 };
  }),
  { x: 2.5, z: -24 },
  { x: -1.5, z: -44 },
  { x: 2.5, z: -60, broken: true },
  { x: 16, z: -15 },
  { x: -24, z: -1.5 },
];

export const BILLBOARDS: { slot: string; x: number; z: number; rotY: number }[] = [
  { slot: 'plaza_billboard', x: 9.5, z: 16.5, rotY: faceTowards(9.5, 16.5, 0, 0) },
];

/** Caminos (polilíneas) — se dibujan y se excluyen del bosque. */
export const PATHS: { pts: [number, number][]; w: number }[] = [
  { pts: [[0, 95], [0, 40], [0, 13]], w: 5 }, // carretera sur
  { pts: [[0, -12], [1.5, -28], [-2, -46], [0.5, -62], [0, -72]], w: 3.2 }, // camino de la colina
  { pts: [[12, -4], [21, -17], [29, -26]], w: 2.6 }, // al pozo
  { pts: [[-12, -2], [-24, -4], [-32, -3]], w: 2.8 }, // a la capilla
  { pts: [[-2, -46], [-30, -52], [-58, -58], [-80, -61]], w: 2.4 }, // a la mina
];

export function faceTowards(x: number, z: number, tx: number, tz: number): number {
  return Math.atan2(-(tx - x), -(tz - z));
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
export function smoothstep(a: number, b: number, x: number) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

export type Region = 'outdoor' | 'cave';

export function regionOf(x: number, z: number): Region | null {
  if (x >= CAVE.minX && x <= CAVE.maxX && z >= CAVE.minZ && z <= CAVE.maxZ) return 'cave';
  if (x >= BOUNDS.minX && x <= BOUNDS.maxX && z >= BOUNDS.minZ && z <= BOUNDS.maxZ) return 'outdoor';
  return null;
}

/** Altura del terreno (determinista). */
export function heightAt(x: number, z: number): number {
  if (regionOf(x, z) === 'cave') return CAVE.floorY;
  const dh = Math.hypot(x - HILL.x, z - HILL.z);
  const hill = HILL.h * (1 - smoothstep(HILL.flat, HILL.edge, dh));
  const r = Math.hypot(x, z);
  const dm = Math.hypot(x - MINE.x, z - MINE.z);
  const und =
    Math.sin(x * 0.045) * 1.1 + Math.cos(z * 0.06) * 0.8 + Math.sin((x + z) * 0.1) * 0.35 + 0.6;
  const far = smoothstep(45, 75, r) * smoothstep(22, 38, dh) * smoothstep(8, 18, dm);
  return hill + far * und;
}

export function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

export function distToPaths(x: number, z: number): number {
  let best = Infinity;
  for (const path of PATHS) {
    for (let i = 0; i < path.pts.length - 1; i++) {
      const [ax, az] = path.pts[i];
      const [bx, bz] = path.pts[i + 1];
      best = Math.min(best, distToSegment(x, z, ax, az, bx, bz) - path.w / 2);
    }
  }
  return best;
}

function box(minX: number, maxX: number, minZ: number, maxZ: number, id?: string): Collider {
  return { type: 'box', minX, maxX, minZ, maxZ, id };
}

/** Segmentos de pared de la Casa Morales (sin la puerta del estudio, que es dinámica). */
export function casaMoralesWalls(): Collider[] {
  const c = CASA_MORALES;
  const t = c.wallT / 2;
  const s = c.study;
  return [
    box(c.minX, c.frontDoor.minX, c.maxZ - t, c.maxZ + t, 'cm_front_l'),
    box(c.frontDoor.maxX, c.maxX, c.maxZ - t, c.maxZ + t, 'cm_front_r'),
    box(c.minX, c.maxX, c.minZ - t, c.minZ + t, 'cm_back'),
    box(c.minX - t, c.minX + t, c.minZ, c.maxZ, 'cm_west'),
    box(c.maxX - t, c.maxX + t, c.minZ, c.maxZ, 'cm_east'),
    box(s.minX, s.doorMinX, s.maxZ - t, s.maxZ + t, 'cm_study_l'),
    box(s.doorMaxX, s.maxX, s.maxZ - t, s.maxZ + t, 'cm_study_r'),
    box(s.maxX - t, s.maxX + t, s.minZ, s.maxZ, 'cm_study_e'),
  ];
}

export function staticColliders(): Collider[] {
  const out: Collider[] = [];
  for (const b of TOWN_BUILDINGS) {
    out.push(box(b.x - b.w / 2, b.x + b.w / 2, b.z - b.d / 2, b.z + b.d / 2, b.id));
  }
  out.push(box(CHAPEL.x - CHAPEL.w / 2, CHAPEL.x + CHAPEL.w / 2, CHAPEL.z - CHAPEL.d / 2, CHAPEL.z + CHAPEL.d / 2, 'capilla'));
  const bt = BELL_TOWER;
  const hs = bt.size / 2;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const px = bt.x + sx * (hs - 0.35);
    const pz = bt.z + sz * (hs - 0.35);
    out.push(box(px - 0.35, px + 0.35, pz - 0.35, pz + 0.35, 'torre'));
  }
  out.push({ type: 'circle', x: FOUNTAIN.x, z: FOUNTAIN.z, r: FOUNTAIN.r, id: 'fuente' });
  out.push({ type: 'circle', x: WELL.x, z: WELL.z, r: WELL.r, id: 'pozo' });
  out.push({ type: 'circle', x: ANGEL.x, z: ANGEL.z, r: 0.7, id: 'angel' });
  for (const l of LAMPS) out.push({ type: 'circle', x: l.x, z: l.z, r: 0.2 });
  for (const b of BILLBOARDS) out.push({ type: 'circle', x: b.x, z: b.z, r: 0.5 });
  out.push(...casaMoralesWalls());
  // Mina tapiada
  out.push(box(MINE.x - 5, MINE.x + 5, MINE.z - 6, MINE.z - 1.5, 'mina'));
  out.push({ type: 'circle', x: CAVE_MOUTH.x, z: CAVE_MOUTH.z - 1.5, r: 2.2, id: 'boca_tunel' });
  // Pilares de roca dentro del túnel
  out.push({ type: 'circle', x: 165, z: -88, r: 1.6 });
  out.push({ type: 'circle', x: 170, z: -104, r: 1.8 });
  out.push({ type: 'circle', x: 178, z: -90, r: 1.2 });
  return out;
}

// ---------- Árboles (deterministas) ----------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Tree {
  x: number;
  z: number;
  s: number;
  kind: 0 | 1 | 2; // pino, pino seco, árbol caducifolio
}

export function generateTrees(seed = 1337, attempts = 2600): Tree[] {
  const rnd = mulberry32(seed);
  const trees: Tree[] = [];
  const blockers = staticColliders();
  for (let i = 0; i < attempts; i++) {
    const x = BOUNDS.minX + rnd() * (BOUNDS.maxX - BOUNDS.minX);
    const z = BOUNDS.minZ + rnd() * (BOUNDS.maxZ - BOUNDS.minZ);
    const r = Math.hypot(x, z);
    const north = z < -15;
    const density = r < 42 ? 0.04 : north ? 0.95 : 0.45;
    if (rnd() > density) continue;
    if (distToPaths(x, z) < 2.8) continue;
    if (Math.hypot(x - HILL.x, z - HILL.z) < 17) continue;
    if (Math.hypot(x - MINE.x, z - MINE.z) < 11) continue;
    if (Math.hypot(x - WELL.x, z - WELL.z) < 6) continue;
    if (x > CHAPEL.x - 12 && x < CHAPEL.x + 12 && z > CHAPEL.z - 14 && z < BELL_TOWER.z + 8) continue;
    let blocked = false;
    for (const c of blockers) {
      if (c.type === 'box') {
        if (x > c.minX - 3 && x < c.maxX + 3 && z > c.minZ - 3 && z < c.maxZ + 3) blocked = true;
      } else if (Math.hypot(x - c.x, z - c.z) < c.r + 2.5) blocked = true;
      if (blocked) break;
    }
    if (blocked) continue;
    const k = rnd();
    trees.push({ x, z, s: 0.8 + rnd() * 0.7, kind: k < 0.6 ? 0 : k < 0.8 ? 1 : 2 });
  }
  return trees;
}

// ---------- Física simple (predicción en el cliente) ----------

export function resolveCollisions(x: number, z: number, radius: number, colliders: Collider[]): [number, number] {
  for (let iter = 0; iter < 3; iter++) {
    let moved = false;
    for (const c of colliders) {
      if (c.type === 'box') {
        const cx = clamp(x, c.minX, c.maxX);
        const cz = clamp(z, c.minZ, c.maxZ);
        const dx = x - cx;
        const dz = z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < radius * radius) {
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2);
            x = cx + (dx / d) * radius;
            z = cz + (dz / d) * radius;
          } else {
            // Centro dentro de la caja: expulsar por el lado más cercano
            const pens = [x - c.minX, c.maxX - x, z - c.minZ, c.maxZ - z];
            const m = Math.min(...pens);
            if (m === pens[0]) x = c.minX - radius;
            else if (m === pens[1]) x = c.maxX + radius;
            else if (m === pens[2]) z = c.minZ - radius;
            else z = c.maxZ + radius;
          }
          moved = true;
        }
      } else {
        const dx = x - c.x;
        const dz = z - c.z;
        const min = c.r + radius;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min) {
          const d = Math.sqrt(d2) || 1e-4;
          x = c.x + (dx / d) * min;
          z = c.z + (dz / d) * min;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  const reg = regionOf(x, z);
  if (reg === 'cave') {
    x = clamp(x, CAVE.minX + 1, CAVE.maxX - 1);
    z = clamp(z, CAVE.minZ + 1, CAVE.maxZ - 1);
  } else {
    x = clamp(x, BOUNDS.minX + 1, BOUNDS.maxX - 1);
    z = clamp(z, BOUNDS.minZ + 1, BOUNDS.maxZ - 1);
  }
  return [x, z];
}

// ---------- Zonas (para "¿dónde estoy?") ----------

export function zoneAt(x: number, z: number): string {
  if (regionOf(x, z) === 'cave') return 'Túnel bajo la Casa Morales';
  const c = CASA_MORALES;
  if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) {
    const s = c.study;
    if (x < s.maxX && z < s.maxZ) return 'Casa Morales — Estudio';
    return 'Casa Morales';
  }
  if (Math.hypot(x - HILL.x, z - HILL.z) < 26) return 'Colina de los Morales';
  if (Math.hypot(x - MINE.x, z - MINE.z) < 16) return 'Mina abandonada';
  if (Math.hypot(x, z) < PLAZA.r + 3) return 'Plaza de San Bartolo';
  if (Math.hypot(x - CHAPEL.x, z - CHAPEL.z) < 15) return 'Capilla de las Ánimas';
  if (Math.hypot(x - WELL.x, z - WELL.z) < 9) return 'Pozo viejo';
  if (Math.hypot(x, z) < 42) return 'Pueblo de San Bartolo del Monte';
  if (distToPaths(x, z) < 3) return 'Camino del bosque';
  return 'Bosque de los Susurros';
}
