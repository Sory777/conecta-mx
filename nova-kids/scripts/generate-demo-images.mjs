// Genera las ilustraciones SVG de los productos de demostración (public/demo)
// y las imágenes iniciales de categorías (public/categories).
// Son marcadores de posición: reemplázalos por fotografías reales desde /admin.
//
// Uso: npm run demo:images

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const root = join(import.meta.dirname, "..", "public");
const demoDir = join(root, "demo");
const catDir = join(root, "categories");
mkdirSync(demoDir, { recursive: true });
mkdirSync(catDir, { recursive: true });

const GARMENTS = {
  tshirt: {
    body: "M310 180 Q400 245 490 180 L600 212 L705 330 L632 395 L582 352 L582 762 Q400 784 218 762 L218 352 L168 395 L95 330 L200 212 Z",
    details: (c) =>
      `<path d="M310 180 Q400 245 490 180" fill="none" stroke="${c}" stroke-width="16" stroke-linecap="round"/>`,
    printAt: [400, 440, 1],
  },
  hoodie: {
    back: "M298 222 Q282 82 400 74 Q518 82 502 222 Q400 290 298 222 Z",
    body: "M300 212 L205 238 Q142 262 124 360 L92 700 L178 712 L218 430 L218 800 Q400 822 582 800 L582 430 L622 712 L708 700 L676 360 Q658 262 595 238 L500 212 Q400 280 300 212 Z",
    details: (c) => `
      <path d="M232 612 H568 Q580 612 580 624 V700 Q400 716 220 700 V624 Q220 612 232 612 Z" fill="${c}" opacity=".22"/>
      <path d="M218 770 Q400 792 582 770 L582 800 Q400 822 218 800 Z" fill="${c}" opacity=".35"/>
      <path d="M372 250 L366 340 M428 250 L434 340" stroke="${c}" stroke-width="7" stroke-linecap="round" opacity=".6"/>`,
    printAt: [400, 450, 0.9],
  },
  shorts: {
    body: "M228 300 L572 300 L606 708 L432 722 L400 480 L368 722 L194 708 Z",
    details: (c) => `
      <path d="M228 300 H572 L576 352 H224 Z" fill="${c}" opacity=".3"/>
      <path d="M392 352 Q384 400 370 410 M408 352 Q416 400 430 410" stroke="${c}" stroke-width="7" stroke-linecap="round" fill="none" opacity=".7"/>`,
    printAt: [505, 610, 0.45],
  },
  dress: {
    body: "M330 170 Q400 226 470 170 L522 190 L546 332 L522 364 Q650 650 684 826 Q400 880 116 826 Q150 650 278 364 L254 332 L278 190 Z",
    details: (c) => `
      <path d="M278 364 Q400 392 522 364" stroke="${c}" stroke-width="14" fill="none" opacity=".45"/>
      <path d="M126 790 Q400 842 674 790" stroke="${c}" stroke-width="10" fill="none" opacity=".3"/>`,
    printAt: [400, 600, 0.95],
  },
};

const PRINTS = {
  rocket: (ink, accent) => `
    <g transform="rotate(35)">
      <path d="M0 -92 C42 -60 46 10 30 62 H-30 C-46 10 -42 -60 0 -92 Z" fill="${ink}"/>
      <circle cx="0" cy="-22" r="17" fill="${accent}"/>
      <path d="M-30 30 L-58 74 L-26 66 Z M30 30 L58 74 L26 66 Z" fill="${ink}"/>
      <path d="M-18 70 Q0 128 18 70 Z" fill="${accent}"/>
    </g>`,
  planet: (ink, accent) => `
    <circle r="66" fill="${ink}"/>
    <ellipse rx="118" ry="30" fill="none" stroke="${accent}" stroke-width="12" transform="rotate(-18)"/>
    <path d="M-66 0 A66 66 0 0 0 66 0" fill="${ink}" transform="rotate(-18)"/>
    <circle cx="92" cy="-86" r="9" fill="${accent}"/>`,
  stars: (ink, accent) => `
    <path d="M0 -84 Q8 -8 84 0 Q8 8 0 84 Q-8 8 -84 0 Q-8 -8 0 -84 Z" fill="${ink}"/>
    <path d="M86 -66 Q90 -36 120 -32 Q90 -28 86 2 Q82 -28 52 -32 Q82 -36 86 -66 Z" fill="${accent}"/>
    <path d="M-92 52 Q-89 74 -66 78 Q-89 82 -92 104 Q-95 82 -118 78 Q-95 74 -92 52 Z" fill="${accent}"/>`,
  orbit: (ink, accent) => `
    <ellipse rx="120" ry="44" fill="none" stroke="${ink}" stroke-width="12" transform="rotate(-24)"/>
    <circle r="34" fill="${accent}"/>
    <path d="M104 -86 Q108 -58 136 -54 Q108 -50 104 -22 Q100 -50 72 -54 Q100 -58 104 -86 Z" fill="${ink}"/>`,
  text: (ink, accent) => `
    <text text-anchor="middle" y="-6" font-family="Arial Black, Arial, sans-serif" font-size="74" font-weight="900" letter-spacing="6" fill="${ink}">NOVA</text>
    <rect x="-120" y="22" width="240" height="10" rx="5" fill="${accent}"/>
    <text text-anchor="middle" y="82" font-family="Arial, sans-serif" font-size="34" font-weight="700" letter-spacing="14" fill="${accent}">KIDS</text>`,
};

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function garmentSvg({ garment, color, print, detail = false, bg = ["#EEF2FB", "#DDE4F5"] }) {
  const g = GARMENTS[garment];
  const light = luminance(color) > 0.7;
  const ink = light ? "#3B2BD9" : "#FFFFFF";
  const accent = light ? "#E11D9B" : "#4FD8FF";
  const trim = light ? "#1E1B4B" : "#000000";
  const [px, py, ps] = g.printAt;
  const view = detail ? `${px - 230} ${py - 290} 460 575` : "0 0 800 1000";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}" width="800" height="1000" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient>
    <radialGradient id="shadow"><stop offset="0" stop-color="#1E1B4B" stop-opacity=".22"/><stop offset="1" stop-color="#1E1B4B" stop-opacity="0"/></radialGradient>
  </defs>
  <rect x="-1000" y="-1000" width="3000" height="3000" fill="url(#bg)"/>
  <ellipse cx="400" cy="880" rx="300" ry="40" fill="url(#shadow)"/>
  ${g.back ? `<path d="${g.back}" fill="${color}"/><path d="${g.back}" fill="#000" opacity=".18"/>` : ""}
  <path d="${g.body}" fill="${color}"/>
  <path d="${g.body}" fill="url(#shade)"/>
  ${g.details(trim)}
  <g transform="translate(${px} ${py}) scale(${ps})">${PRINTS[print](ink, accent)}</g>
</svg>`;
}

function setSvg({ top, bottom, print, detail = false }) {
  const t = GARMENTS.tshirt;
  const s = GARMENTS.shorts;
  const lightTop = luminance(top) > 0.7;
  const ink = lightTop ? "#3B2BD9" : "#FFFFFF";
  const accent = lightTop ? "#E11D9B" : "#4FD8FF";
  const view = detail ? "170 160 460 575" : "0 0 800 1000";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}" width="800" height="1000" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EEF2FB"/><stop offset="1" stop-color="#DDE4F5"/></linearGradient>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient>
  </defs>
  <rect x="-1000" y="-1000" width="3000" height="3000" fill="url(#bg)"/>
  <g transform="translate(400 330) scale(.72) translate(-400 -470)">
    <path d="${t.body}" fill="${top}"/><path d="${t.body}" fill="url(#shade)"/>${t.details("#1E1B4B")}
    <g transform="translate(400 440)">${PRINTS[print](ink, accent)}</g>
  </g>
  <g transform="translate(400 760) scale(.6) translate(-400 -510)">
    <path d="${s.body}" fill="${bottom}"/><path d="${s.body}" fill="url(#shade)"/>${s.details("#1E1B4B")}
  </g>
</svg>`;
}

// ---- Productos demo: deben coincidir con src/demo/demo-products.ts ----
const products = [
  { slug: "conjunto-nova-kids-espacial", kind: "set", top: "#1E3A8A", bottom: "#111827", print: "rocket", alt: { top: "#F8FAFC", bottom: "#4C1D95" } },
  { slug: "conjunto-nebulosa", kind: "set", top: "#F472B6", bottom: "#4C1D95", print: "stars", alt: { top: "#F8FAFC", bottom: "#BE185D" } },
  { slug: "playera-cohete-orbital", garment: "tshirt", color: "#2563EB", print: "rocket", alt: "#F8FAFC" },
  { slug: "playera-planeta-anillos", garment: "tshirt", color: "#7C3AED", print: "planet", alt: "#111827" },
  { slug: "playera-nova-basica", garment: "tshirt", color: "#F8FAFC", print: "text", alt: "#111827" },
  { slug: "playera-constelacion", garment: "tshirt", color: "#DB2777", print: "stars", alt: "#06B6D4" },
  { slug: "short-explorador", garment: "shorts", color: "#1E1B4B", print: "stars", alt: "#0E7490" },
  { slug: "short-deportivo-cometa", garment: "shorts", color: "#06B6D4", print: "orbit", alt: "#7C3AED" },
  { slug: "sudadera-galaxia", garment: "hoodie", color: "#312E81", print: "orbit", alt: "#9CA3AF" },
  { slug: "sudadera-astronauta", garment: "hoodie", color: "#F472B6", print: "rocket", alt: "#F8FAFC" },
  { slug: "vestido-polvo-de-estrellas", garment: "dress", color: "#A78BFA", print: "stars", alt: "#F472B6" },
  { slug: "sudadera-nova-classic", garment: "hoodie", color: "#111827", print: "text", alt: "#2563EB" },
];

for (const p of products) {
  if (p.kind === "set") {
    writeFileSync(join(demoDir, `${p.slug}-1.svg`), setSvg({ top: p.top, bottom: p.bottom, print: p.print }));
    writeFileSync(join(demoDir, `${p.slug}-2.svg`), setSvg({ top: p.top, bottom: p.bottom, print: p.print, detail: true }));
    writeFileSync(join(demoDir, `${p.slug}-3.svg`), setSvg({ top: p.alt.top, bottom: p.alt.bottom, print: p.print }));
  } else {
    writeFileSync(join(demoDir, `${p.slug}-1.svg`), garmentSvg({ garment: p.garment, color: p.color, print: p.print }));
    writeFileSync(
      join(demoDir, `${p.slug}-2.svg`),
      garmentSvg({ garment: p.garment, color: p.color, print: p.print, detail: true, bg: ["#E6E0FA", "#D7E3FB"] }),
    );
    writeFileSync(join(demoDir, `${p.slug}-3.svg`), garmentSvg({ garment: p.garment, color: p.alt, print: p.print }));
  }
}

// ---- Imágenes de categorías: fondo espacial + silueta con degradado de marca ----
function starsField(seed, count = 40) {
  let s = seed;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: count }, () => {
    const r = rand() * 2.2 + 0.6;
    return `<circle cx="${(rand() * 600).toFixed(1)}" cy="${(rand() * 750).toFixed(1)}" r="${r.toFixed(1)}" fill="#fff" opacity="${(rand() * 0.6 + 0.2).toFixed(2)}"/>`;
  }).join("");
}

const ICONS = {
  ninas: `<g transform="translate(300 395) scale(.62) translate(-400 -500)"><path d="${GARMENTS.dress.body}" fill="url(#brand)"/></g>`,
  ninos: `<g transform="translate(300 400) scale(.6) translate(-400 -470)"><path d="${GARMENTS.tshirt.body}" fill="url(#brand)"/><g transform="translate(400 440)">${PRINTS.rocket("#0B0B22", "#0B0B22")}</g></g>`,
  conjuntos: `<g transform="translate(300 300) scale(.5) translate(-400 -470)"><path d="${GARMENTS.tshirt.body}" fill="url(#brand)"/></g><g transform="translate(300 545) scale(.42) translate(-400 -510)"><path d="${GARMENTS.shorts.body}" fill="url(#brand)"/></g>`,
  playeras: `<g transform="translate(300 400) scale(.62) translate(-400 -470)"><path d="${GARMENTS.tshirt.body}" fill="url(#brand)"/><g transform="translate(400 440)">${PRINTS.stars("#0B0B22", "#0B0B22")}</g></g>`,
  shorts: `<g transform="translate(300 400) scale(.66) translate(-400 -510)"><path d="${GARMENTS.shorts.body}" fill="url(#brand)"/></g>`,
  sudaderas: `<g transform="translate(300 400) scale(.6) translate(-400 -450)"><path d="${GARMENTS.hoodie.back}" fill="url(#brand)" opacity=".7"/><path d="${GARMENTS.hoodie.body}" fill="url(#brand)"/></g>`,
  novedades: `<g transform="translate(300 390) scale(1.9)">${PRINTS.rocket("url(#brand)", "#0B0B22")}</g>`,
  ofertas: `<g transform="translate(300 390) rotate(-12)"><path d="M-120 -80 H70 L140 0 L70 80 H-120 Q-140 80 -140 60 V-60 Q-140 -80 -120 -80 Z" fill="url(#brand)"/><circle cx="68" cy="0" r="16" fill="#0B0B22"/><text x="-40" y="22" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="64" font-weight="900" fill="#0B0B22">%</text></g>`,
};

let seed = 7;
for (const [slug, icon] of Object.entries(ICONS)) {
  seed += 31;
  writeFileSync(
    join(catDir, `${slug}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 750" width="600" height="750">
  <defs>
    <linearGradient id="space" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0B0B2B"/><stop offset="1" stop-color="#05050F"/></linearGradient>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22D3EE"/><stop offset=".5" stop-color="#7C3AED"/><stop offset="1" stop-color="#EC4899"/></linearGradient>
    <radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#7C3AED" stop-opacity=".45"/><stop offset="1" stop-color="#7C3AED" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="600" height="750" fill="url(#space)"/>
  ${starsField(seed)}
  <circle cx="300" cy="390" r="260" fill="url(#glow)"/>
  <ellipse cx="300" cy="400" rx="250" ry="70" fill="none" stroke="url(#brand)" stroke-width="3" opacity=".55" transform="rotate(-18 300 400)"/>
  ${icon}
</svg>`,
  );
}

console.log(`Listo: ${products.length * 3} imágenes demo y ${Object.keys(ICONS).length} de categorías.`);
