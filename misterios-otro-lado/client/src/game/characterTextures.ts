import * as THREE from 'three';

// Texturas procedurales para personajes: albedo en escala de grises (se tiñe con el color del material)
// y mapas de normales derivados de un mapa de alturas (tejido, poros, mechones).

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convierte un mapa de alturas (canal R) en un mapa de normales tangente. */
function normalFromHeight(src: HTMLCanvasElement, strength: number): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const sctx = src.getContext('2d')!;
  const data = sctx.getImageData(0, 0, w, h).data;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d')!;
  const img = octx.createImageData(w, h);
  const H = (x: number, y: number) => data[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

function tex(c: HTMLCanvasElement, srgb: boolean, repeat: [number, number]) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const cache = new Map<string, { map: THREE.Texture; normal: THREE.Texture }>();

function make(key: string, size: number, draw: (ctx: CanvasRenderingContext2D, r: () => number) => void, strength: number, repeat: [number, number]) {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  draw(ctx, rng(size + key.length * 31));
  const res = { map: tex(c, true, repeat), normal: tex(normalFromHeight(c, strength), false, repeat) };
  cache.set(key, res);
  return res;
}

/** Tejido de sarga (gabardinas, abrigos). */
export function twill() {
  return make('twill', 128, (ctx, r) => {
    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 2) {
      for (let x = 0; x < 128; x += 2) {
        const diag = ((x + y) / 2) % 4;
        const v = 150 + diag * 22 + (r() - 0.5) * 30;
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
    // pelusa y desgaste
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = `rgba(${r() < 0.5 ? 255 : 60},${r() < 0.5 ? 255 : 60},${r() < 0.5 ? 255 : 60},0.08)`;
      ctx.fillRect(r() * 128, r() * 128, 1 + r() * 3, 1);
    }
  }, 2.2, [8, 6]);
}

/** Lona / mezclilla (pantalones). */
export function denim() {
  return make('denim', 128, (ctx, r) => {
    ctx.fillStyle = '#bbbbbb';
    ctx.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x += 1) {
        if ((x + y * 3) % 6 < 3) continue;
        const v = 120 + r() * 70;
        ctx.fillStyle = `rgba(${v},${v},${v},0.55)`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, 1.8, [6, 8]);
}

/** Piel: variación de tono y poros muy sutiles. */
export function skin() {
  return make('skin', 256, (ctx, r) => {
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 60; i++) {
      const x = r() * 256;
      const y = r() * 256;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 10 + r() * 30);
      g.addColorStop(0, r() < 0.5 ? 'rgba(210,190,190,0.35)' : 'rgba(255,255,255,0.3)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 40, y - 40, 80, 80);
    }
    for (let i = 0; i < 4000; i++) {
      const v = 200 + r() * 40;
      ctx.fillStyle = `rgba(${v},${v - 8},${v - 8},0.5)`;
      ctx.fillRect(r() * 256, r() * 256, 1, 1);
    }
  }, 0.8, [2, 2]);
}

/** Mechones de cabello. */
export function hair() {
  return make('hair', 128, (ctx, r) => {
    ctx.fillStyle = '#9a9a9a';
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 700; i++) {
      const v = 90 + r() * 160;
      ctx.strokeStyle = `rgba(${v},${v},${v},0.6)`;
      ctx.lineWidth = 0.6 + r();
      const x = r() * 128;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + (r() - 0.5) * 8, 40, x + (r() - 0.5) * 8, 90, x + (r() - 0.5) * 6, 128);
      ctx.stroke();
    }
  }, 3, [4, 2]);
}

/** Cuero (botas, cinturón). */
export function leather() {
  return make('leather', 128, (ctx, r) => {
    ctx.fillStyle = '#a0a0a0';
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 180; i++) {
      ctx.strokeStyle = `rgba(40,40,40,${0.1 + r() * 0.2})`;
      ctx.lineWidth = 0.5 + r();
      ctx.beginPath();
      let x = r() * 128;
      let y = r() * 128;
      ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (r() - 0.5) * 14;
        y += (r() - 0.5) * 14;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, 1.5, [3, 3]);
}
