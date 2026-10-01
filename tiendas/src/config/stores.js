// Las 10 marcas. Todas comparten la misma estructura (rutas, carrito, checkout),
// pero cada una define su propia identidad visual con estas perillas:
//
//   palette      colores de marca (bg, surface, text, muted, primary, onPrimary, accent, border)
//   fonts        tipografía de títulos y de cuerpo (Google Fonts)
//   radius       redondeo base de tarjetas y botones (px)
//   header       'left' | 'centered' | 'split'
//   hero         'gradient' | 'split' | 'dots' | 'stripes' | 'blob' | 'grid'
//   card         'bordered' | 'shadow' | 'flat' | 'brutal'
//   button       'solid' | 'pill' | 'outline' | 'offset'
//   logoShape    figura del isotipo SVG generado (ver views/brand.js)
//   iconStroke   grosor de trazo de los iconos
//   uppercase    títulos en mayúsculas
//   markup       margen por defecto sobre el costo del proveedor (0.6 = +60 %)
//   categories   orden de categorías en la portada
//   domains      dominios propios que resuelven a esta tienda (opcional)

export const STORES = [
  {
    slug: 'voltia',
    name: 'Voltia',
    tagline: 'Gadgets que cargan tu día',
    heroTitle: 'Tecnología con chispa',
    heroText: 'Audífonos, cargadores y gadgets inteligentes con envío a todo México.',
    palette: { bg: '#0b0f17', surface: '#131a26', text: '#e8eefc', muted: '#8b97b0', primary: '#3d7bff', onPrimary: '#ffffff', accent: '#00e1ff', border: '#243049' },
    fonts: { heading: 'Space Grotesk', body: 'Inter' },
    radius: 10, header: 'left', hero: 'grid', card: 'bordered', button: 'solid',
    logoShape: 'bolt', iconStroke: 2, uppercase: false,
    markup: 0.7, categories: ['gadgets', 'accesorios', 'ropa'], domains: [],
  },
  {
    slug: 'lume',
    name: 'Lumé Boutique',
    tagline: 'Moda que ilumina',
    heroTitle: 'Nueva colección',
    heroText: 'Prendas y accesorios seleccionados para lucir increíble sin gastar de más.',
    palette: { bg: '#fff8f6', surface: '#ffffff', text: '#3b1a24', muted: '#8d6b74', primary: '#9e2a4b', onPrimary: '#ffffff', accent: '#f4b6c2', border: '#f1dde1' },
    fonts: { heading: 'Playfair Display', body: 'Lato' },
    radius: 2, header: 'centered', hero: 'split', card: 'flat', button: 'outline',
    logoShape: 'circle', iconStroke: 1.25, uppercase: false,
    markup: 0.85, categories: ['ropa', 'accesorios', 'gadgets'], domains: [],
  },
  {
    slug: 'kiro',
    name: 'Kiro Market',
    tagline: 'Menos es más',
    heroTitle: 'Objetos esenciales',
    heroText: 'Diseño simple, precio justo. Lo necesario, nada más.',
    palette: { bg: '#f7f5f0', surface: '#ffffff', text: '#141414', muted: '#6e6a63', primary: '#d7261e', onPrimary: '#ffffff', accent: '#141414', border: '#e2ded5' },
    fonts: { heading: 'Zen Kaku Gothic New', body: 'Zen Kaku Gothic New' },
    radius: 0, header: 'split', hero: 'stripes', card: 'flat', button: 'solid',
    logoShape: 'square', iconStroke: 1.5, uppercase: false,
    markup: 0.6, categories: ['accesorios', 'gadgets', 'ropa'], domains: [],
  },
  {
    slug: 'brisa',
    name: 'Brisa Store',
    tagline: 'Fresco, ligero, para ti',
    heroTitle: 'Compra con brisa fresca',
    heroText: 'Ropa cómoda, accesorios coloridos y gadgets útiles para tu día a día.',
    palette: { bg: '#f2fbf9', surface: '#ffffff', text: '#0f3b3a', muted: '#5b7f7d', primary: '#0f9d8f', onPrimary: '#ffffff', accent: '#ffd166', border: '#d3eeea' },
    fonts: { heading: 'Nunito', body: 'Nunito' },
    radius: 18, header: 'left', hero: 'blob', card: 'shadow', button: 'pill',
    logoShape: 'wave', iconStroke: 2, uppercase: false,
    markup: 0.65, categories: ['ropa', 'gadgets', 'accesorios'], domains: [],
  },
  {
    slug: 'zocalo',
    name: 'Zócalo Shop',
    tagline: 'El mercado de todos',
    heroTitle: '¡Ofertas en la plaza!',
    heroText: 'Todo lo que buscas a precio de mercado, con el sabor de siempre.',
    palette: { bg: '#fdf6ec', surface: '#ffffff', text: '#3a2214', muted: '#8a6a52', primary: '#c4501b', onPrimary: '#ffffff', accent: '#e9a23b', border: '#eedcc4' },
    fonts: { heading: 'Rubik', body: 'Work Sans' },
    radius: 8, header: 'centered', hero: 'dots', card: 'bordered', button: 'solid',
    logoShape: 'hex', iconStroke: 2, uppercase: false,
    markup: 0.55, categories: ['gadgets', 'ropa', 'accesorios'], domains: [],
  },
  {
    slug: 'nebula',
    name: 'Nébula',
    tagline: 'Gadgets de otra galaxia',
    heroTitle: 'Explora lo nuevo',
    heroText: 'Luces LED, gaming y gadgets futuristas directo a tu puerta.',
    palette: { bg: '#100a1f', surface: '#1a1130', text: '#f1eaff', muted: '#a397c2', primary: '#a855f7', onPrimary: '#ffffff', accent: '#22d3ee', border: '#2e2350' },
    fonts: { heading: 'Orbitron', body: 'Exo 2' },
    radius: 14, header: 'split', hero: 'gradient', card: 'shadow', button: 'pill',
    logoShape: 'star', iconStroke: 1.75, uppercase: true,
    markup: 0.75, categories: ['gadgets', 'accesorios', 'ropa'], domains: [],
  },
  {
    slug: 'raiz',
    name: 'Raíz & Co.',
    tagline: 'Natural por naturaleza',
    heroTitle: 'Hecho para durar',
    heroText: 'Básicos de algodón, accesorios y artículos prácticos con alma natural.',
    palette: { bg: '#f5f1e8', surface: '#fffdf8', text: '#26331f', muted: '#6d7562', primary: '#3f6b35', onPrimary: '#ffffff', accent: '#c99a5b', border: '#e3dccb' },
    fonts: { heading: 'Fraunces', body: 'DM Sans' },
    radius: 6, header: 'centered', hero: 'split', card: 'bordered', button: 'outline',
    logoShape: 'leaf', iconStroke: 1.5, uppercase: false,
    markup: 0.8, categories: ['ropa', 'accesorios', 'gadgets'], domains: [],
  },
  {
    slug: 'pixelpop',
    name: 'Pixel Pop',
    tagline: '¡Cosas divertidas, precios felices!',
    heroTitle: '¡Pop! Llegó lo nuevo',
    heroText: 'Gadgets curiosos, accesorios coloridos y regalos que sacan sonrisas.',
    palette: { bg: '#fffbe6', surface: '#ffffff', text: '#1d1d1d', muted: '#5c5c5c', primary: '#ff2e88', onPrimary: '#ffffff', accent: '#ffd400', border: '#1d1d1d' },
    fonts: { heading: 'Fredoka', body: 'Poppins' },
    radius: 12, header: 'left', hero: 'dots', card: 'brutal', button: 'offset',
    logoShape: 'triangle', iconStroke: 2.5, uppercase: false,
    markup: 0.6, categories: ['gadgets', 'accesorios', 'ropa'], domains: [],
  },
  {
    slug: 'marazul',
    name: 'Mar Azul',
    tagline: 'Estilo con brisa de costa',
    heroTitle: 'Temporada de playa',
    heroText: 'Ropa ligera, lentes, bolsas y gadgets resistentes al agua.',
    palette: { bg: '#f4f1ea', surface: '#ffffff', text: '#0e2340', muted: '#5f6f86', primary: '#163e72', onPrimary: '#ffffff', accent: '#e0b973', border: '#e1dccf' },
    fonts: { heading: 'Montserrat', body: 'Source Sans 3' },
    radius: 4, header: 'split', hero: 'stripes', card: 'shadow', button: 'solid',
    logoShape: 'ring', iconStroke: 1.75, uppercase: true,
    markup: 0.7, categories: ['ropa', 'accesorios', 'gadgets'], domains: [],
  },
  {
    slug: 'ambar',
    name: 'Ámbar Urbano',
    tagline: 'Streetwear sin reglas',
    heroTitle: 'Calle. Estilo. Actitud.',
    heroText: 'Sudaderas, gorras, mochilas y gadgets para moverte por la ciudad.',
    palette: { bg: '#1b1b1d', surface: '#242427', text: '#f4f1ea', muted: '#a5a19a', primary: '#ffb000', onPrimary: '#1b1b1d', accent: '#ff5a1f', border: '#38383d' },
    fonts: { heading: 'Bebas Neue', body: 'Barlow' },
    radius: 0, header: 'left', hero: 'gradient', card: 'flat', button: 'solid',
    logoShape: 'diamond', iconStroke: 2, uppercase: true,
    markup: 0.9, categories: ['ropa', 'accesorios', 'gadgets'], domains: [],
  },
];

export const CATEGORIES = {
  gadgets: { name: 'Gadgets', icon: 'cpu' },
  ropa: { name: 'Ropa', icon: 'shirt' },
  accesorios: { name: 'Accesorios', icon: 'watch' },
};

export function getStore(slug) {
  return STORES.find((s) => s.slug === slug) || null;
}

export function storeForHost(host) {
  if (!host) return null;
  const h = host.toLowerCase().split(':')[0];
  return STORES.find((s) => s.domains.includes(h)) || null;
}
