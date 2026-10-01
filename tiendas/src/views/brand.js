// Identidad visual generada por código: isotipo, iconos, imágenes de producto y tema CSS.
import { esc } from './html.js';

// Iconos de línea 24x24 (estilo Lucide).
const ICONS = {
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2.5 3h3l2.6 12.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.5L21.5 8H6.2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  truck: '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  package: '<path d="m12 2 9 5v10l-9 5-9-5V7z"/><path d="m3 7 9 5 9-5M12 12v10"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  shirt: '<path d="M8 3 3 6l2 5 3-1v11h8V10l3 1 2-5-5-3a4 4 0 0 1-8 0z"/>',
  watch: '<circle cx="12" cy="12" r="6"/><path d="M12 9v3l2 1.5M9 6.5 9.5 2h5l.5 4.5M9 17.5l.5 4.5h5l.5-4.5"/>',
  headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="5" height="7" rx="2"/><rect x="16" y="14" width="5" height="7" rx="2"/>',
  battery: '<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 11v2M6 10v4M10 10v4"/>',
  lamp: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.5h6c0-1.1.4-1.9 1-2.5A6 6 0 0 0 12 3z"/>',
  speaker: '<rect x="5" y="2" width="14" height="20" rx="3"/><circle cx="12" cy="14" r="4"/><circle cx="12" cy="6" r="1"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
  camera: '<path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="4"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  mouse: '<rect x="6" y="3" width="12" height="18" rx="6"/><path d="M12 7v4"/>',
  cable: '<path d="M7 3v4M11 3v4M5 7h8v4a4 4 0 0 1-8 0zM9 15v2a4 4 0 0 0 8 0V9a3 3 0 0 1 6 0"/>',
  gamepad: '<path d="M6 8h12a4 4 0 0 1 4 4v1a4 4 0 0 1-7 2.6L14 14h-4l-1 1.6A4 4 0 0 1 2 13v-1a4 4 0 0 1 4-4z"/><path d="M7 11v3M5.5 12.5h3M16 11h.01M18 13h.01"/>',
  projector: '<rect x="2" y="8" width="20" height="9" rx="2"/><circle cx="16" cy="12.5" r="2.5"/><path d="M5 17v2M19 17v2M6 12h4"/>',
  hoodie: '<path d="M8 4a4 4 0 0 1 8 0l4 3v13h-3v-8M8 4 4 7v13h3v-8M7 20h10M10 4v3a2 2 0 0 0 4 0V4M10 15h4"/>',
  dress: '<path d="M9 2h6M9 2l1 6-5 13h14L14 8l1-6M10 8h4"/>',
  pants: '<path d="M6 3h12l1 18h-5l-2-11-2 11H5zM6 7h12"/>',
  jacket: '<path d="M8 3 4 6v15h7V8M16 3l4 3v15h-7V8M8 3l4 5 4-5M7 13h1M16 13h1"/>',
  socks: '<path d="M8 2h6v10l-5 5a3 3 0 0 1-4.5-4L8 9.5zM8 6h6"/>',
  glasses: '<circle cx="6.5" cy="14" r="3.5"/><circle cx="17.5" cy="14" r="3.5"/><path d="M10 13.5a2.5 2.5 0 0 1 4 0M3 14 4.5 7M21 14l-1.5-7"/>',
  backpack: '<path d="M6 8a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zM9 4V3h6v1M8 14h8v4H8z"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M16 14h.01"/>',
  cap: '<path d="M3 15a9 9 0 0 1 18 0zM12 6V5M3 15h18l-1 2H8"/>',
  bag: '<path d="M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2"/>',
  gem: '<path d="M6 3h12l4 6-10 12L2 9zM2 9h20M12 21 8 9l4-6 4 6z"/>',
  umbrella: '<path d="M2 12a10 10 0 0 1 20 0zM12 12v7a2 2 0 0 0 4 0M12 2v0"/>',
  fan: '<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1-7 4-7 2 0 2 3-1 5M14 12c4 0 7 1 7 4 0 2-3 2-5-1M12 14c0 4-1 7-4 7-2 0-2-3 1-5M10 12c-4 0-7-1-7-4 0-2 3-2 5 1"/>',
  sparkle: '<path d="M12 3c.8 4.5 3.5 7.2 8 8-4.5.8-7.2 3.5-8 8-.8-4.5-3.5-7.2-8-8 4.5-.8 7.2-3.5 8-8zM19 3v4M17 5h4"/>',
  belt: '<rect x="2" y="9" width="20" height="6" rx="1"/><rect x="9" y="7" width="6" height="10" rx="1"/><path d="M12 10v4"/>',
};

export function icon(name, { size = 20, stroke = 2, cls = '' } = {}) {
  const body = ICONS[name] || ICONS.package;
  return `<svg class="ico ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

// Isotipo de 40x40 por marca.
export function logoMark(store, size = 36) {
  const { primary: p, accent: a, onPrimary: on } = store.palette;
  const initial = esc(store.name[0]);
  const letter = (fill) => `<text x="20" y="26.5" text-anchor="middle" font-family="'${esc(store.fonts.heading)}',system-ui,sans-serif" font-weight="700" font-size="17" fill="${fill}">${initial}</text>`;
  const shapes = {
    bolt: `<rect width="40" height="40" rx="10" fill="${p}"/><path d="M23 5 10 23h9l-3 12 14-19h-9z" fill="${a}"/>`,
    circle: `<circle cx="20" cy="20" r="19" fill="${p}"/><circle cx="29" cy="11" r="6" fill="${a}"/>${letter(on)}`,
    square: `<rect x="1" y="1" width="38" height="38" fill="${a}"/><rect x="8" y="8" width="24" height="24" fill="${p}"/>${letter(on)}`,
    wave: `<rect width="40" height="40" rx="14" fill="${p}"/><path d="M4 24c6-6 10 6 16 0s10 6 16 0v8a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6z" fill="${a}"/><path d="M4 17c6-6 10 6 16 0s10 6 16 0" stroke="${on}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
    hex: `<path d="M20 1 37 10.5v19L20 39 3 29.5v-19z" fill="${p}"/><path d="M20 7 32 14" stroke="${a}" stroke-width="3" stroke-linecap="round"/>${letter(on)}`,
    star: `<circle cx="20" cy="20" r="19" fill="${p}"/><path d="M20 5c1.5 9 6 13.5 15 15-9 1.5-13.5 6-15 15-1.5-9-6-13.5-15-15 9-1.5 13.5-6 15-15z" fill="${a}"/>`,
    leaf: `<circle cx="20" cy="20" r="19" fill="${a}"/><path d="M10 30C10 16 18 9 31 9c0 13-7 21-21 21z" fill="${p}"/><path d="M11 29 25 15" stroke="${a}" stroke-width="2" stroke-linecap="round"/>`,
    triangle: `<rect width="40" height="40" rx="10" fill="${a}"/><path d="M20 7 34 32H6z" fill="${p}" stroke="#1d1d1d" stroke-width="2.5" stroke-linejoin="round"/><circle cx="29" cy="11" r="4" fill="#1d1d1d"/>`,
    ring: `<circle cx="20" cy="20" r="16" fill="none" stroke="${p}" stroke-width="5"/><circle cx="20" cy="20" r="6" fill="${a}"/>`,
    eclipse: `<defs><mask id="ecl-${store.slug}"><rect width="40" height="40" fill="#fff"/><circle cx="24" cy="16.5" r="11" fill="#000"/></mask></defs>
      <circle cx="20" cy="20" r="17.5" fill="none" stroke="${p}" stroke-width=".8" stroke-opacity=".55"/>
      <circle cx="20" cy="20" r="12" fill="${p}" mask="url(#ecl-${store.slug})"/>
      <circle cx="29.5" cy="9.5" r="1" fill="${a}"/>`,
    diamond: `<path d="M20 1 39 20 20 39 1 20z" fill="${p}"/><path d="M20 10 30 20 20 30 10 20z" fill="${a}"/>`,
  };
  return `<svg class="logo-mark" width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true">${shapes[store.logoShape] || shapes.circle}</svg>`;
}

// Logotipo SVG independiente (isotipo + nombre) para descargar/usar fuera del sitio.
export function logoSvg(store) {
  const w = 52 + store.name.length * 17;
  const name = store.uppercase ? store.name.toUpperCase() : store.name;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="48" viewBox="0 0 ${w} 48">
<g transform="translate(4 4)">${logoMark(store, 40).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>
<text x="54" y="32" font-family="'${esc(store.fonts.heading)}',system-ui,sans-serif" font-weight="700" font-size="24" fill="${store.palette.text}">${esc(name)}</text>
</svg>`;
}

// Imagen ilustrada para productos sin foto del proveedor (cada tienda la pinta con su paleta y patrón).
export function productArt(store, product) {
  const { primary: p, accent: a, surface: s } = store.palette;
  const id = `g${store.slug}${product.id}`;
  if (store.mood === 'noir') {
    // Bodegón nocturno: haz de luz tenue, marco fino y trazo delgado.
    return `<svg class="art" viewBox="0 0 200 200" role="img" aria-label="${esc(product.title)}" preserveAspectRatio="xMidYMid slice">
<defs><radialGradient id="${id}" cx="50%" cy="42%" r="62%"><stop offset="0" stop-color="#262626"/><stop offset=".55" stop-color="#0b0b0b"/><stop offset="1" stop-color="#000"/></radialGradient></defs>
<rect width="200" height="200" fill="url(#${id})"/><rect x="12" y="12" width="176" height="176" fill="none" stroke="${p}" stroke-opacity=".12"/>
<g transform="translate(64 60) scale(3)" fill="none" stroke="${p}" stroke-opacity=".85" stroke-width=".55" stroke-linecap="round" stroke-linejoin="round">${ICONS[product.icon] || ICONS.package}</g>
<ellipse cx="100" cy="156" rx="34" ry="3" fill="${p}" fill-opacity=".06"/></svg>`;
  }
  const patterns = {
    grid: `<pattern id="${id}p" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0v20" fill="none" stroke="${a}" stroke-opacity=".18"/></pattern>`,
    dots: `<pattern id="${id}p" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="2" fill="${a}" fill-opacity=".35"/></pattern>`,
    stripes: `<pattern id="${id}p" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="14" fill="${a}" fill-opacity=".15"/></pattern>`,
  };
  const pat = patterns[store.hero] || '';
  const body = (ICONS[product.icon] || ICONS.package);
  return `<svg class="art" viewBox="0 0 200 200" role="img" aria-label="${esc(product.title)}" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p}" stop-opacity=".16"/><stop offset="1" stop-color="${a}" stop-opacity=".32"/></linearGradient>${pat}</defs>
<rect width="200" height="200" fill="${s}"/><rect width="200" height="200" fill="url(#${id})"/>${pat ? `<rect width="200" height="200" fill="url(#${id}p)"/>` : ''}
<circle cx="100" cy="100" r="58" fill="${s}" fill-opacity=".7"/>
<g transform="translate(52 52) scale(4)" fill="none" stroke="${p}" stroke-width="${store.iconStroke / 1.3}" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
}

export function productImage(store, product) {
  return product.image_url
    ? `<img src="${esc(product.image_url)}" alt="${esc(product.title)}" loading="lazy" referrerpolicy="no-referrer">`
    : productArt(store, product);
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

export function themeCss(store) {
  const c = store.palette;
  return `:root{--bg:${c.bg};--surface:${c.surface};--text:${c.text};--muted:${c.muted};--primary:${c.primary};--primary-rgb:${hexToRgb(c.primary)};--on-primary:${c.onPrimary};--accent:${c.accent};--accent-rgb:${hexToRgb(c.accent)};--border:${c.border};--radius:${store.radius}px;--font-heading:'${store.fonts.heading}',system-ui,sans-serif;--font-body:'${store.fonts.body}',system-ui,sans-serif;--heading-transform:${store.uppercase ? 'uppercase' : 'none'};}`;
}

// Familias con un solo peso: pedirles otros pesos hace fallar la hoja de Google Fonts.
const SINGLE_WEIGHT = new Set(['Bebas Neue']);

export function fontsHref(store) {
  const fams = [...new Set([store.fonts.heading, store.fonts.body])]
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}${SINGLE_WEIGHT.has(f) ? '' : ':wght@400;700'}`).join('&');
  return `https://fonts.googleapis.com/css2?${fams}&display=swap`;
}
