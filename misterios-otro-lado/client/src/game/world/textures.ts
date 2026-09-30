import * as THREE from 'three';

// Texturas procedurales (canvas). Sin archivos externos: carga instantánea y sin licencias de terceros.
// Cuando haya arte definitivo (PBR fotogramétrico), se sustituyen aquí sin tocar el resto.

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

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')!];
}

function speckle(ctx: CanvasRenderingContext2D, size: number, r: () => number, n: number, colors: string[], maxR = 2) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[Math.floor(r() * colors.length)];
    ctx.globalAlpha = 0.15 + r() * 0.35;
    const s = 0.5 + r() * maxR;
    ctx.fillRect(r() * size, r() * size, s, s);
  }
  ctx.globalAlpha = 1;
}

function blotches(ctx: CanvasRenderingContext2D, size: number, r: () => number, n: number, color: string, alpha: number, maxR: number) {
  for (let i = 0; i < n; i++) {
    const x = r() * size;
    const y = r() * size;
    const rad = maxR * (0.3 + r());
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha * r();
    ctx.fillStyle = g;
    // envolver para que la textura sea repetible
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) ctx.fillRect(x - rad + dx, y - rad + dy, rad * 2, rad * 2);
  }
  ctx.globalAlpha = 1;
}

function toTex(c: HTMLCanvasElement, repeat = 1, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const cache = new Map<string, THREE.CanvasTexture>();
function cached(key: string, make: () => THREE.CanvasTexture) {
  let t = cache.get(key);
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
}

/** Detalle para el terreno (se multiplica por colores de vértice). */
export function groundDetail() {
  return cached('ground', () => {
    const size = 256;
    const [c, ctx] = canvas(size);
    const r = rng(11);
    ctx.fillStyle = '#bdbdbd';
    ctx.fillRect(0, 0, size, size);
    blotches(ctx, size, r, 40, '#8a8a8a', 0.5, 40);
    blotches(ctx, size, r, 30, '#e0e0e0', 0.4, 30);
    speckle(ctx, size, r, 5000, ['#6f6f6f', '#dcdcdc', '#9a9a9a', '#4f4f4f'], 2);
    // briznas
    ctx.strokeStyle = '#f0f0f0';
    for (let i = 0; i < 700; i++) {
      ctx.globalAlpha = 0.12 + r() * 0.2;
      const x = r() * size;
      const y = r() * size;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 3, y - 2 - r() * 4);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return toTex(c, 1);
  });
}

export function cobble() {
  return cached('cobble', () => {
    const size = 256;
    const [c, ctx] = canvas(size);
    const r = rng(3);
    ctx.fillStyle = '#2b2a27';
    ctx.fillRect(0, 0, size, size);
    const cell = 32;
    for (let y = 0; y < size / cell; y++) {
      for (let x = 0; x < size / cell; x++) {
        const ox = (y % 2) * (cell / 2);
        const cx = x * cell + ox + (r() - 0.5) * 5;
        const cy = y * cell + (r() - 0.5) * 5;
        const shade = 70 + Math.floor(r() * 45);
        ctx.fillStyle = `rgb(${shade},${shade - 3},${shade - 8})`;
        ctx.beginPath();
        const w = cell * 0.44 + r() * 2;
        const hgt = cell * 0.42 + r() * 2;
        ctx.ellipse(cx + cell / 2, cy + cell / 2, w, hgt, r() * 0.4, 0, Math.PI * 2);
        ctx.fill();
        if (cx + cell > size) {
          ctx.beginPath();
          ctx.ellipse(cx + cell / 2 - size, cy + cell / 2, w, hgt, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    speckle(ctx, size, r, 3000, ['#1c1b19', '#6d6a61', '#3a3834'], 1.5);
    blotches(ctx, size, r, 12, '#23311d', 0.5, 20); // musgo
    return toTex(c, 6);
  });
}

export function plaster(tint = '#a79c88', seed = 5) {
  return cached(`plaster-${tint}-${seed}`, () => {
    const size = 256;
    const [c, ctx] = canvas(size);
    const r = rng(seed);
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, size, size);
    blotches(ctx, size, r, 26, '#3b3328', 0.35, 50); // manchas de humedad
    blotches(ctx, size, r, 18, '#ffffff', 0.12, 40);
    speckle(ctx, size, r, 4000, ['#2d2820', '#d8cfbd', '#6b6252'], 1.4);
    // escurrimientos
    for (let i = 0; i < 14; i++) {
      const x = r() * size;
      const g = ctx.createLinearGradient(0, 0, 0, size);
      g.addColorStop(0, 'rgba(30,25,18,0.25)');
      g.addColorStop(1, 'rgba(30,25,18,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 2 + r() * 5, size * (0.3 + r() * 0.7));
    }
    // ladrillos asomando
    for (let i = 0; i < 6; i++) {
      const x = r() * size;
      const y = r() * size;
      ctx.fillStyle = '#5a3a2c';
      ctx.globalAlpha = 0.6;
      for (let k = 0; k < 4; k++) ctx.fillRect(x + (k % 2) * 12, y + k * 7, 22, 6);
      ctx.globalAlpha = 1;
    }
    return toTex(c, 1);
  });
}

export function wood(tint = '#5b4330', seed = 7) {
  return cached(`wood-${tint}-${seed}`, () => {
    const size = 256;
    const [c, ctx] = canvas(size);
    const r = rng(seed);
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, size, size);
    const plank = 32;
    for (let i = 0; i < size / plank; i++) {
      const shade = r() * 0.35 - 0.15;
      ctx.fillStyle = shade > 0 ? `rgba(255,230,190,${shade * 0.4})` : `rgba(0,0,0,${-shade})`;
      ctx.fillRect(i * plank, 0, plank, size);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(i * plank, 0, 2, size);
      for (let g = 0; g < 18; g++) {
        ctx.strokeStyle = `rgba(20,12,6,${0.1 + r() * 0.25})`;
        ctx.beginPath();
        const x = i * plank + 3 + r() * (plank - 6);
        ctx.moveTo(x, 0);
        for (let y = 0; y <= size; y += 16) ctx.lineTo(x + Math.sin(y * 0.05 + g) * 1.5, y);
        ctx.stroke();
      }
      // nudos y clavos
      if (r() < 0.6) {
        ctx.fillStyle = 'rgba(25,14,6,0.7)';
        ctx.beginPath();
        ctx.ellipse(i * plank + plank / 2, r() * size, 3, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#1b1b1b';
      ctx.fillRect(i * plank + plank / 2 - 1, 10, 3, 3);
      ctx.fillRect(i * plank + plank / 2 - 1, size - 14, 3, 3);
    }
    speckle(ctx, size, r, 1500, ['#1a120b', '#8d7358'], 1.2);
    return toTex(c, 1);
  });
}

export function roofTiles(tint = '#4a2c24', seed = 9) {
  return cached(`roof-${tint}-${seed}`, () => {
    const size = 256;
    const [c, ctx] = canvas(size);
    const r = rng(seed);
    ctx.fillStyle = '#140d0a';
    ctx.fillRect(0, 0, size, size);
    const rowH = 21;
    const w = 26;
    for (let y = 0; y < size / rowH + 1; y++) {
      for (let x = -1; x < size / w + 1; x++) {
        const ox = (y % 2) * (w / 2);
        const base = new THREE.Color(tint);
        base.offsetHSL(0, 0, (r() - 0.5) * 0.12);
        ctx.fillStyle = `#${base.getHexString()}`;
        ctx.beginPath();
        ctx.roundRect(x * w + ox + 1, y * rowH + 1, w - 2, rowH + 4, [0, 0, 8, 8]);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x * w + ox + 1, y * rowH + rowH, w - 2, 4);
        if (r() < 0.08) {
          ctx.fillStyle = 'rgba(40,55,30,0.6)';
          ctx.fillRect(x * w + ox + 2, y * rowH + 2, w - 4, rowH);
        }
      }
    }
    speckle(ctx, size, r, 1500, ['#000', '#6b5145'], 1.2);
    return toTex(c, 1);
  });
}

export function stoneBlocks(tint = '#77746c', seed = 13) {
  return cached(`stone-${tint}-${seed}`, () => {
    const size = 256;
    const [c, ctx] = canvas(size);
    const r = rng(seed);
    ctx.fillStyle = '#262522';
    ctx.fillRect(0, 0, size, size);
    const bh = 32;
    for (let y = 0; y < size / bh; y++) {
      let x = -(y % 2) * 30;
      while (x < size) {
        const bw = 40 + r() * 36;
        const base = new THREE.Color(tint);
        base.offsetHSL(0, 0, (r() - 0.5) * 0.1);
        ctx.fillStyle = `#${base.getHexString()}`;
        ctx.fillRect(x + 2, y * bh + 2, bw - 4, bh - 4);
        x += bw;
      }
    }
    blotches(ctx, size, r, 20, '#1f2a18', 0.45, 30);
    speckle(ctx, size, r, 3500, ['#1a1a18', '#a5a196', '#55524b'], 1.5);
    return toTex(c, 1);
  });
}

export function rock() {
  return cached('rock', () => {
    const size = 256;
    const [c, ctx] = canvas(size);
    const r = rng(21);
    ctx.fillStyle = '#4c4a45';
    ctx.fillRect(0, 0, size, size);
    blotches(ctx, size, r, 50, '#2a2926', 0.6, 40);
    blotches(ctx, size, r, 30, '#7a766d', 0.4, 30);
    ctx.strokeStyle = 'rgba(15,15,14,0.6)';
    for (let i = 0; i < 30; i++) {
      ctx.lineWidth = 0.5 + r() * 1.5;
      ctx.beginPath();
      let x = r() * size;
      let y = r() * size;
      ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += (r() - 0.5) * 30;
        y += (r() - 0.5) * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    speckle(ctx, size, r, 4000, ['#1a1a18', '#8f8a80'], 1.4);
    return toTex(c, 1);
  });
}

export function bark() {
  return cached('bark', () => {
    const size = 128;
    const [c, ctx] = canvas(size);
    const r = rng(31);
    ctx.fillStyle = '#3a2d22';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 60; i++) {
      ctx.strokeStyle = `rgba(${r() < 0.5 ? '15,10,6' : '90,72,55'},${0.3 + r() * 0.4})`;
      ctx.lineWidth = 1 + r() * 2;
      ctx.beginPath();
      const x = r() * size;
      ctx.moveTo(x, 0);
      for (let y = 0; y <= size; y += 8) ctx.lineTo(x + Math.sin(y * 0.2 + i) * 2, y);
      ctx.stroke();
    }
    return toTex(c, 1);
  });
}

export function foliage() {
  return cached('foliage', () => {
    const size = 128;
    const [c, ctx] = canvas(size);
    const r = rng(41);
    ctx.fillStyle = '#9a9a9a';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 900; i++) {
      const v = 90 + Math.floor(r() * 140);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.beginPath();
      ctx.ellipse(r() * size, r() * size, 1 + r() * 2.5, 3 + r() * 3, r() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    return toTex(c, 1, true);
  });
}

/** Cartel con texto (patrocinios, avisos). */
export function signTexture(lines: { text: string; size: number; color: string; font?: string }[], bg: string, w = 512, hgt = 256, footer?: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = hgt;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, hgt);
  // desgaste
  const r = rng(w + hgt);
  blotches(ctx, Math.max(w, hgt), r, 20, 'rgba(0,0,0,0.9)', 0.25, 50);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const total = lines.reduce((s, l) => s + l.size * 1.25, 0);
  let y = hgt / 2 - total / 2 + lines[0].size * 0.6;
  for (const l of lines) {
    ctx.fillStyle = l.color;
    ctx.font = `${l.font ?? '700'} ${l.size}px Georgia, serif`;
    ctx.fillText(l.text, w / 2, y, w - 30);
    y += l.size * 1.25;
  }
  if (footer) {
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.textAlign = 'right';
    ctx.fillText(footer, w - 14, hgt - 16);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 10;
  ctx.strokeRect(0, 0, w, hgt);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Sprite radial suave (brillos, luciérnagas, destellos de misterio). */
export function glowSprite(color = '#ffe2a8') {
  return cached(`glow-${color}`, () => {
    const [c, ctx] = canvas(64);
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, color);
    g.addColorStop(0.25, color + 'aa');
    g.addColorStop(1, color + '00');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}
