import type { Vec3 } from '../../../shared/protocol';
import { BELL_TOWER, BOUNDS, CASA_MORALES, CAVE, CHAPEL, MINE_INT, regionOf, FOUNTAIN, HILL, MINE, PATHS, PLAZA, TOWN_BUILDINGS, WELL, generateTrees } from '../../../shared/world';

// Mapa 2D generado a partir del mismo trazado que usan el render 3D y el servidor.

let base: HTMLCanvasElement | null = null;
const W = 512;
const scale = W / (BOUNDS.maxX - BOUNDS.minX);
const toPx = (x: number, z: number): [number, number] => [(x - BOUNDS.minX) * scale, (z - BOUNDS.minZ) * scale];

function baseMap(): HTMLCanvasElement {
  if (base) return base;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = Math.round((BOUNDS.maxZ - BOUNDS.minZ) * scale);
  const g = c.getContext('2d')!;
  g.fillStyle = '#1b2016';
  g.fillRect(0, 0, c.width, c.height);
  // Bosque
  g.fillStyle = 'rgba(12,20,10,0.9)';
  for (const t of generateTrees()) {
    const [x, y] = toPx(t.x, t.z);
    g.beginPath();
    g.arc(x, y, 2.2 * t.s, 0, Math.PI * 2);
    g.fill();
  }
  // Colina
  const [hx, hy] = toPx(HILL.x, HILL.z);
  const grad = g.createRadialGradient(hx, hy, 0, hx, hy, HILL.edge * scale);
  grad.addColorStop(0, 'rgba(92,86,56,0.8)');
  grad.addColorStop(1, 'rgba(92,86,56,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  // Caminos
  g.strokeStyle = '#6d5a42';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const p of PATHS) {
    g.lineWidth = p.w * scale;
    g.beginPath();
    p.pts.forEach(([x, z], i) => {
      const [px, py] = toPx(x, z);
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    });
    g.stroke();
  }
  // Plaza
  const [px, py] = toPx(PLAZA.x, PLAZA.z);
  g.fillStyle = '#4e4a43';
  g.beginPath();
  g.arc(px, py, PLAZA.r * scale, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#23404d';
  g.beginPath();
  g.arc(px, py, FOUNTAIN.r * scale, 0, Math.PI * 2);
  g.fill();
  // Edificios
  const rect = (x: number, z: number, w: number, d: number, fill: string) => {
    const [a, b] = toPx(x - w / 2, z - d / 2);
    g.fillStyle = fill;
    g.fillRect(a, b, w * scale, d * scale);
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 1;
    g.strokeRect(a, b, w * scale, d * scale);
  };
  for (const b of TOWN_BUILDINGS) rect(b.x, b.z, b.w, b.d, b.kind === 'ruin' ? '#3b3730' : '#7a6a58');
  rect(CHAPEL.x, CHAPEL.z, CHAPEL.w, CHAPEL.d, '#8c8577');
  rect(BELL_TOWER.x, BELL_TOWER.z, BELL_TOWER.size, BELL_TOWER.size, '#a39c8c');
  rect(CASA_MORALES.x, CASA_MORALES.z, CASA_MORALES.maxX - CASA_MORALES.minX, CASA_MORALES.maxZ - CASA_MORALES.minZ, '#5b4d44');
  const [wx, wy] = toPx(WELL.x, WELL.z);
  g.fillStyle = '#9a9488';
  g.beginPath();
  g.arc(wx, wy, 3, 0, Math.PI * 2);
  g.fill();
  const [mx, my] = toPx(MINE.x, MINE.z - 3);
  g.fillStyle = '#2a2622';
  g.beginPath();
  g.arc(mx, my, 7, 0, Math.PI * 2);
  g.fill();
  base = c;
  return c;
}

export const MAP_LABELS: { t: string; x: number; z: number }[] = [
  { t: 'Plaza', x: 0, z: -2 },
  { t: 'Capilla', x: CHAPEL.x, z: CHAPEL.z - 11 },
  { t: 'Pozo viejo', x: WELL.x, z: WELL.z - 4 },
  { t: 'Casa Morales', x: CASA_MORALES.x, z: CASA_MORALES.z - 9 },
  { t: 'Mina abandonada', x: MINE.x, z: MINE.z + 7 },
  { t: 'Carretera', x: 4, z: 70 },
];

export interface MapMarkers {
  me: { x: number; z: number; rot: number };
  party: { x: number; z: number; name: string }[];
  objective: Vec3 | null;
  inCave: boolean;
}

/** Dibuja el mapa en un canvas. `zoom` en píxeles de mapa visibles (null = mapa completo). */
export function drawMap(canvas: HTMLCanvasElement, m: MapMarkers, opts: { round?: boolean; zoom?: number | null; labels?: boolean } = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = canvas.clientWidth * dpr;
  const ch = canvas.clientHeight * dpr;
  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw;
    canvas.height = ch;
  }
  const b = baseMap();
  ctx.save();
  ctx.clearRect(0, 0, cw, ch);
  if (opts.round) {
    ctx.beginPath();
    ctx.arc(cw / 2, ch / 2, cw / 2, 0, Math.PI * 2);
    ctx.clip();
  }
  if (m.inCave) {
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = '#8fb3c9';
    ctx.font = `${12 * dpr}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Bajo tierra', cw / 2, ch / 2 - 6 * dpr);
    const R = regionOf(m.me.x, m.me.z) === 'mine' ? MINE_INT : CAVE;
    const k = (cw * 0.7) / (R.maxX - R.minX);
    const ox = cw * 0.15;
    const oy = ch / 2;
    const [x, y] = [ox + (m.me.x - R.minX) * k, oy + (m.me.z - (R.minZ + R.maxZ) / 2) * k];
    if (m.objective && regionOf(m.objective[0], m.objective[2]) === regionOf(m.me.x, m.me.z)) {
      ctx.fillStyle = '#ffd27a';
      ctx.beginPath();
      ctx.arc(ox + (m.objective[0] - R.minX) * k, oy + (m.objective[2] - (R.minZ + R.maxZ) / 2) * k, 4 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
    arrow(ctx, x, y, m.me.rot, 7 * dpr);
    ctx.restore();
    return;
  }
  let view = { sx: 0, sy: 0, sw: b.width, sh: b.height };
  if (opts.zoom) {
    const [cx, cy] = toPx(m.me.x, m.me.z);
    view = { sx: cx - opts.zoom / 2, sy: cy - opts.zoom / 2, sw: opts.zoom, sh: opts.zoom };
  } else {
    const s = Math.max(b.width / cw, b.height / ch);
    view = { sx: (b.width - cw * s) / 2, sy: (b.height - ch * s) / 2, sw: cw * s, sh: ch * s };
  }
  ctx.fillStyle = '#10140d';
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(b, view.sx, view.sy, view.sw, view.sh, 0, 0, cw, ch);
  const map = (x: number, z: number): [number, number] => {
    const [px, py] = toPx(x, z);
    return [((px - view.sx) / view.sw) * cw, ((py - view.sy) / view.sh) * ch];
  };
  if (opts.labels) {
    ctx.font = `italic ${13 * dpr}px Georgia, serif`;
    ctx.textAlign = 'center';
    for (const l of MAP_LABELS) {
      const [x, y] = map(l.x, l.z);
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText(l.t, x + 1, y + 1);
      ctx.fillStyle = '#e8dcc0';
      ctx.fillText(l.t, x, y);
    }
  }
  for (const p of m.party) {
    const [x, y] = map(p.x, p.z);
    ctx.fillStyle = '#8fd0ff';
    ctx.beginPath();
    ctx.arc(x, y, 4 * dpr, 0, Math.PI * 2);
    ctx.fill();
  }
  if (m.objective) {
    let [x, y] = map(m.objective[0], m.objective[2]);
    const inside = x >= 0 && y >= 0 && x <= cw && y <= ch && (!opts.round || Math.hypot(x - cw / 2, y - ch / 2) < cw / 2 - 6 * dpr);
    if (!inside) {
      const a = Math.atan2(y - ch / 2, x - cw / 2);
      const r = cw / 2 - 8 * dpr;
      x = cw / 2 + Math.cos(a) * r;
      y = ch / 2 + Math.sin(a) * r;
    }
    ctx.fillStyle = '#ffd27a';
    ctx.strokeStyle = '#3a2a10';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 7 * dpr);
    ctx.lineTo(x + 5 * dpr, y);
    ctx.lineTo(x, y + 7 * dpr);
    ctx.lineTo(x - 5 * dpr, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  const [x, y] = map(m.me.x, m.me.z);
  arrow(ctx, x, y, m.me.rot, 7 * dpr);
  ctx.restore();
}

function arrow(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-rot);
  ctx.fillStyle = '#f0d9a4';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s * 0.7, s);
  ctx.lineTo(0, s * 0.5);
  ctx.lineTo(-s * 0.7, s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
