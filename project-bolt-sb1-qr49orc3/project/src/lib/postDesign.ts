// Renders a finished social-media post (photo + short text) onto a canvas.
// Everything happens in the browser: no uploads, no external design service.

export interface PostTemplate {
  id: string;
  label: string;
  emoji: string;
  headline: string;
  tag: string;
  keywords: string[];
  hashtags: string[];
}

export const POST_TEMPLATES: PostTemplate[] = [
  { id: 'crepas', label: 'Crepas', emoji: '🥞', headline: '¡Disfruta hoy nuestras crepas!', tag: 'Recién hechas', keywords: ['crepa', 'nutella', 'cajeta'], hashtags: ['#crepas', '#antojo', '#postres'] },
  { id: 'cafe', label: 'Café', emoji: '☕', headline: 'Café recién hecho para ti', tag: 'Aroma de mañana', keywords: ['café', 'cafe', 'capuchino', 'latte', 'expreso', 'espresso', 'americano', 'frappé', 'frappe'], hashtags: ['#café', '#coffeetime', '#cafeteria'] },
  { id: 'fresas', label: 'Fresas', emoji: '🍓', headline: 'Fresas con crema, como te gustan', tag: 'Antojo del día', keywords: ['fresa', 'crema'], hashtags: ['#fresasconcrema', '#fresas', '#postres'] },
  { id: 'promo', label: 'Promoción', emoji: '🏷️', headline: '¡Promoción solo por hoy!', tag: 'Oferta especial', keywords: ['2x1', 'promo', 'descuento', 'oferta', '%'], hashtags: ['#promoción', '#ofertas', '#hoy'] },
  { id: 'nuevo', label: 'Nuevo', emoji: '✨', headline: '¡Nuevo en nuestro menú!', tag: 'Novedad', keywords: ['nuevo', 'nueva', 'estreno'], hashtags: ['#nuevo', '#menú', '#pruébalo'] },
  { id: 'tarde', label: 'Tarde', emoji: '🌇', headline: 'El antojo de la tarde te espera', tag: 'Te esperamos', keywords: ['tarde', 'merienda'], hashtags: ['#merienda', '#antojo', '#tarde'] },
  { id: 'finde', label: 'Fin de semana', emoji: '🎉', headline: 'Tu fin de semana más dulce', tag: 'Sábado y domingo', keywords: ['sábado', 'sabado', 'domingo', 'fin de semana'], hashtags: ['#findesemana', '#planfamiliar', '#postres'] },
  { id: 'gracias', label: 'Gracias', emoji: '💛', headline: 'Gracias por preferirnos', tag: 'Con cariño', keywords: ['gracias'], hashtags: ['#gracias', '#clientesfelices'] },
];

export function suggestTemplate(text: string): PostTemplate {
  const t = text.toLowerCase();
  return POST_TEMPLATES.find((tpl) => tpl.keywords.some((k) => t.includes(k))) || POST_TEMPLATES[0];
}

export type PostStyle = 'clasico' | 'espresso' | 'dorado';
export type PostFormat = 'post' | 'story';

export const POST_STYLES: { id: PostStyle; label: string; swatch: [string, string] }[] = [
  { id: 'clasico', label: 'Clásico', swatch: ['#F7F1E8', '#B8892B'] },
  { id: 'espresso', label: 'Espresso', swatch: ['#2B1B12', '#D4AF37'] },
  { id: 'dorado', label: 'Dorado', swatch: ['#FFFFFF', '#C9A227'] },
];

export const FORMAT_SIZES: Record<PostFormat, { w: number; h: number; label: string }> = {
  post: { w: 1080, h: 1350, label: 'Publicación' },
  story: { w: 1080, h: 1920, label: 'Historia' },
};

const C = {
  cream: '#F7F1E8',
  creamDark: '#EFE4D3',
  espresso: '#2B1B12',
  coffee: '#5A3A22',
  gold: '#B8892B',
  goldLight: '#D4AF37',
  ink: '#2A211B',
  muted: '#7A6A5C',
};

const SERIF = '"Playfair Display", Georgia, serif';
const SANS = 'Poppins, system-ui, sans-serif';

export interface RenderInput {
  image: HTMLImageElement;
  headline: string;
  text: string;
  tag: string;
  businessName: string;
  style: PostStyle;
  format: PostFormat;
}

export async function ensureFonts() {
  if (!document.fonts) return;
  await Promise.all([
    document.fonts.load(`700 80px ${SERIF}`),
    document.fonts.load(`italic 400 40px ${SERIF}`),
    document.fonts.load(`500 40px ${SANS}`),
    document.fonts.load(`600 30px ${SANS}`),
  ]).catch(() => {});
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.naturalWidth - sw) / 2;
  const sy = (img.naturalHeight - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Narrows the wrap width as far as possible without adding a line, so
// multi-line text splits evenly instead of leaving one word on its own.
function balance(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, lineCount: number): string[] {
  let lo = maxWidth * 0.4;
  let hi = maxWidth;
  while (hi - lo > 4) {
    const mid = (lo + hi) / 2;
    if (wrap(ctx, text, mid).length <= lineCount) hi = mid;
    else lo = mid;
  }
  return wrap(ctx, text, hi);
}

// Shrinks the font until the text fits in `maxLines`, then returns the
// lines and the size that was used.
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: (size: number) => string,
  maxWidth: number,
  maxLines: number,
  startSize: number,
  minSize: number,
): { lines: string[]; size: number } {
  let size = startSize;
  for (; size > minSize; size -= 4) {
    ctx.font = font(size);
    const lines = wrap(ctx, text, maxWidth);
    if (lines.length <= maxLines) return { lines: lines.length > 1 ? balance(ctx, text, maxWidth, lines.length) : lines, size };
  }
  ctx.font = font(minSize);
  const lines = wrap(ctx, text, maxWidth);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/\s*\S*$/, '') + '…';
    return { lines: kept, size: minSize };
  }
  return { lines, size: minSize };
}

function drawLines(ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, lineHeight: number) {
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

function drawTag(ctx: CanvasRenderingContext2D, tag: string, cx: number, y: number, color: string) {
  ctx.font = `600 28px ${SANS}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  const label = tag.toUpperCase().split('').join(' ');
  const w = ctx.measureText(label).width;
  ctx.fillText(label, cx, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2 - 70, y - 10);
  ctx.lineTo(cx - w / 2 - 20, y - 10);
  ctx.moveTo(cx + w / 2 + 20, y - 10);
  ctx.lineTo(cx + w / 2 + 70, y - 10);
  ctx.stroke();
}

function drawClasico(ctx: CanvasRenderingContext2D, W: number, H: number, p: RenderInput) {
  ctx.fillStyle = C.cream;
  ctx.fillRect(0, 0, W, H);

  const m = 60;
  const photoH = Math.round(H * (p.format === 'story' ? 0.6 : 0.58));
  ctx.save();
  roundRect(ctx, m, m, W - m * 2, photoH, 36);
  ctx.clip();
  drawCover(ctx, p.image, m, m, W - m * 2, photoH);
  ctx.restore();
  roundRect(ctx, m + 16, m + 16, W - m * 2 - 32, photoH - 32, 26);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 3;
  ctx.stroke();

  const cx = W / 2;
  let y = m + photoH + 90;
  drawTag(ctx, p.tag, cx, y, C.gold);
  y += 40;

  ctx.fillStyle = C.ink;
  ctx.textAlign = 'center';
  const head = fitText(ctx, p.headline, (s) => `700 ${s}px ${SERIF}`, W - 180, 2, 84, 52);
  ctx.font = `700 ${head.size}px ${SERIF}`;
  y = drawLines(ctx, head.lines, cx, y + head.size, head.size * 1.15);

  if (p.text) {
    ctx.fillStyle = C.muted;
    const body = fitText(ctx, p.text, (s) => `400 ${s}px ${SANS}`, W - 220, 2, 40, 30);
    ctx.font = `400 ${body.size}px ${SANS}`;
    drawLines(ctx, body.lines, cx, y + 20, body.size * 1.4);
  }

  drawFooter(ctx, W, H, p.businessName, C.gold, C.ink);
}

function drawEspresso(ctx: CanvasRenderingContext2D, W: number, H: number, p: RenderInput) {
  drawCover(ctx, p.image, 0, 0, W, H);
  const g = ctx.createLinearGradient(0, H * 0.35, 0, H);
  g.addColorStop(0, 'rgba(43,27,18,0)');
  g.addColorStop(0.45, 'rgba(43,27,18,0.82)');
  g.addColorStop(1, 'rgba(43,27,18,0.97)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Round gold seal in the corner
  const r = 92;
  const sx = W - r - 56;
  const sy = r + 56;
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.fillStyle = C.goldLight;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sx, sy, r - 10, 0, Math.PI * 2);
  ctx.strokeStyle = C.espresso;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = C.espresso;
  ctx.textAlign = 'center';
  ctx.font = `700 46px ${SERIF}`;
  ctx.fillText('¡Hoy!', sx, sy + 16);

  const left = 80;
  const maxW = W - 160;
  const bottom = H - 150;
  ctx.textAlign = 'left';

  ctx.font = `400 ${36}px ${SANS}`;
  const body = p.text ? fitText(ctx, p.text, (s) => `400 ${s}px ${SANS}`, maxW, 2, 40, 30) : { lines: [], size: 0 };
  const head = fitText(ctx, p.headline, (s) => `700 ${s}px ${SERIF}`, maxW, 3, 92, 56);
  const bodyH = body.lines.length * body.size * 1.4;
  const headH = head.lines.length * head.size * 1.12;
  let y = bottom - bodyH - headH - 80;

  ctx.font = `600 28px ${SANS}`;
  ctx.fillStyle = C.goldLight;
  ctx.fillText(p.tag.toUpperCase().split('').join(' '), left, y);
  ctx.fillRect(left, y + 22, 90, 4);
  y += 50;

  ctx.fillStyle = C.cream;
  ctx.font = `700 ${head.size}px ${SERIF}`;
  y = drawLines(ctx, head.lines, left, y + head.size, head.size * 1.12);

  if (body.lines.length) {
    ctx.fillStyle = 'rgba(247,241,232,0.85)';
    ctx.font = `400 ${body.size}px ${SANS}`;
    drawLines(ctx, body.lines, left, y + 24, body.size * 1.4);
  }

  if (p.businessName) {
    ctx.fillStyle = C.goldLight;
    ctx.font = `italic 400 40px ${SERIF}`;
    ctx.textAlign = 'left';
    ctx.fillText(p.businessName, left, H - 80);
  }
}

function drawDorado(ctx: CanvasRenderingContext2D, W: number, H: number, p: RenderInput) {
  drawCover(ctx, p.image, 0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = C.goldLight;
  ctx.lineWidth = 6;
  ctx.strokeRect(36, 36, W - 72, H - 72);
  ctx.lineWidth = 2;
  ctx.strokeRect(54, 54, W - 108, H - 108);

  const cardW = W - 200;
  const cx = W / 2;
  ctx.font = `700 70px ${SERIF}`;
  const head = fitText(ctx, p.headline, (s) => `700 ${s}px ${SERIF}`, cardW - 100, 2, 70, 46);
  const body = p.text ? fitText(ctx, p.text, (s) => `400 ${s}px ${SANS}`, cardW - 110, 2, 36, 28) : { lines: [], size: 0 };
  const cardH = 90 + 40 + head.lines.length * head.size * 1.15 + (body.lines.length ? 20 + body.lines.length * body.size * 1.4 : 0) + 70 + (p.businessName ? 50 : 0);
  const cardY = H - cardH - 110;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 12;
  roundRect(ctx, (W - cardW) / 2, cardY, cardW, cardH, 28);
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.fill();
  ctx.restore();

  let y = cardY + 80;
  drawTag(ctx, p.tag, cx, y, C.gold);
  y += 30;
  ctx.fillStyle = C.ink;
  ctx.textAlign = 'center';
  ctx.font = `700 ${head.size}px ${SERIF}`;
  y = drawLines(ctx, head.lines, cx, y + head.size, head.size * 1.15);
  if (body.lines.length) {
    ctx.fillStyle = C.muted;
    ctx.font = `400 ${body.size}px ${SANS}`;
    y = drawLines(ctx, body.lines, cx, y + 20, body.size * 1.4);
  }
  if (p.businessName) {
    ctx.fillStyle = C.gold;
    ctx.font = `italic 400 36px ${SERIF}`;
    ctx.fillText(p.businessName, cx, y + 36);
  }
}

function drawFooter(ctx: CanvasRenderingContext2D, W: number, H: number, name: string, accent: string, ink: string) {
  if (!name) return;
  const y = H - 80;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 40, y - 60);
  ctx.lineTo(W / 2 + 40, y - 60);
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.font = `italic 400 40px ${SERIF}`;
  ctx.fillText(name, W / 2, y);
}

export function renderPost(canvas: HTMLCanvasElement, input: RenderInput) {
  const { w, h } = FORMAT_SIZES[input.format];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.textBaseline = 'alphabetic';
  if (input.style === 'espresso') drawEspresso(ctx, w, h, input);
  else if (input.style === 'dorado') drawDorado(ctx, w, h, input);
  else drawClasico(ctx, w, h, input);
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))), 'image/jpeg', 0.9);
  });
}

export function buildCaption(headline: string, text: string, businessName: string, hashtags: string[]): string {
  const parts = [headline];
  if (text) parts.push(text);
  if (businessName) parts.push(`📍 ${businessName}`);
  parts.push(hashtags.join(' '));
  return parts.join('\n\n');
}
