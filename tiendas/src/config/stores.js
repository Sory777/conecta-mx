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
//   categories   orden de categorías en la portada (claves de CATEGORIES)
//   onlyColors   (opcional) solo importar variantes de estos colores, p. ej. { black: 'Negro' }
//   domains      dominios propios que resuelven a esta tienda (opcional)
//   niche        búsquedas por categoría: [búsqueda en inglés para CJ, nombre en español, icono].
//                Cada tienda importa los productos más vendidos de SUS búsquedas, así
//                ninguna tienda repite productos de otra.

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
    niche: {
      gadgets: [['wireless earbuds', 'Audífonos inalámbricos', 'headphones'], ['magnetic power bank', 'Power bank magnético', 'battery'], ['smart watch', 'Reloj inteligente', 'watch']],
      ropa: [['gaming hoodie', 'Sudadera gamer', 'hoodie'], ['quick dry t-shirt', 'Playera deportiva dry-fit', 'shirt'], ['sport socks', 'Calcetines deportivos', 'socks']],
      accesorios: [['magsafe phone case', 'Funda MagSafe', 'phone'], ['anti theft laptop backpack', 'Mochila para laptop', 'backpack'], ['usb c hub', 'Hub USB-C multipuerto', 'cable']],
    },
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
    niche: {
      ropa: [['women summer dress', 'Vestido de verano', 'dress'], ['women elegant blouse', 'Blusa elegante', 'shirt'], ['pleated midi skirt', 'Falda plisada', 'dress']],
      accesorios: [['women jewelry set', 'Set de joyería', 'gem'], ['women crossbody bag', 'Bolsa crossbody', 'bag'], ['cat eye sunglasses', 'Lentes de sol cat eye', 'glasses']],
      gadgets: [['led makeup mirror', 'Espejo LED de maquillaje', 'sparkle'], ['hair straightener brush', 'Cepillo alisador', 'sparkle'], ['facial cleansing brush', 'Cepillo facial eléctrico', 'sparkle']],
    },
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
    niche: {
      accesorios: [['minimalist wallet', 'Cartera minimalista', 'wallet'], ['minimalist watch', 'Reloj minimalista', 'watch'], ['canvas tote bag', 'Tote bag de lona', 'bag']],
      gadgets: [['led desk lamp', 'Lámpara de escritorio LED', 'lamp'], ['wireless charger stand', 'Cargador inalámbrico', 'battery'], ['mini humidifier', 'Mini humidificador', 'fan']],
      ropa: [['basic cotton t-shirt', 'Playera básica de algodón', 'shirt'], ['linen shirt', 'Camisa de lino', 'shirt'], ['wide leg pants', 'Pantalón de pierna ancha', 'pants']],
    },
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
    niche: {
      ropa: [['high waist leggings', 'Leggings de tiro alto', 'pants'], ['oversized t-shirt', 'Playera oversize', 'shirt'], ['women summer shorts', 'Shorts de verano', 'pants']],
      gadgets: [['portable neck fan', 'Ventilador portátil', 'fan'], ['waterproof bluetooth speaker', 'Bocina resistente al agua', 'speaker'], ['smart water bottle', 'Botella inteligente', 'package']],
      accesorios: [['bucket hat', 'Sombrero bucket', 'cap'], ['beach bag', 'Bolsa de playa', 'bag'], ['claw hair clips', 'Pinzas para cabello', 'gem']],
    },
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
    niche: {
      gadgets: [['kitchen gadgets', 'Gadgets de cocina', 'package'], ['led strip lights', 'Tira de luces LED', 'lamp'], ['car phone holder', 'Soporte de celular para auto', 'phone']],
      ropa: [['men polo shirt', 'Playera polo', 'shirt'], ['pajama set', 'Pijama de dos piezas', 'hoodie'], ['cargo shorts', 'Bermuda cargo', 'pants']],
      accesorios: [['automatic umbrella', 'Paraguas automático', 'umbrella'], ['men leather belt', 'Cinturón de piel', 'belt'], ['keychain', 'Llavero', 'gem']],
    },
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
    niche: {
      gadgets: [['rgb gaming mouse', 'Mouse gamer RGB', 'mouse'], ['mechanical keyboard', 'Teclado mecánico', 'keyboard'], ['galaxy star projector', 'Proyector de galaxia', 'projector']],
      ropa: [['anime hoodie', 'Sudadera anime', 'hoodie'], ['graphic t-shirt', 'Playera gráfica', 'shirt'], ['techwear pants', 'Pantalón techwear', 'pants']],
      accesorios: [['headphone stand rgb', 'Base RGB para audífonos', 'headphones'], ['rgb mouse pad', 'Mousepad RGB', 'keyboard'], ['mobile game controller', 'Control para celular', 'gamepad']],
    },
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
    niche: {
      ropa: [['cotton hoodie', 'Sudadera de algodón', 'hoodie'], ['linen dress', 'Vestido de lino', 'dress'], ['knit sweater', 'Suéter tejido', 'hoodie']],
      accesorios: [['straw hat', 'Sombrero de palma', 'cap'], ['wooden watch', 'Reloj de madera', 'watch'], ['canvas backpack', 'Mochila de lona', 'backpack']],
      gadgets: [['bamboo wireless charger', 'Cargador de bambú', 'battery'], ['aroma diffuser', 'Difusor de aromas', 'fan'], ['solar garden light', 'Lámpara solar', 'lamp']],
    },
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
    niche: {
      gadgets: [['mini thermal printer', 'Mini impresora térmica', 'camera'], ['cute night light', 'Lámpara de noche kawaii', 'lamp'], ['fidget toys', 'Juguetes antiestrés', 'gamepad']],
      accesorios: [['cute phone case', 'Funda kawaii', 'phone'], ['plush keychain', 'Llavero de peluche', 'gem'], ['cute backpack', 'Mochila kawaii', 'backpack']],
      ropa: [['funny socks', 'Calcetines divertidos', 'socks'], ['cartoon pajamas', 'Pijama de caricatura', 'hoodie'], ['kawaii t-shirt', 'Playera kawaii', 'shirt']],
    },
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
    niche: {
      ropa: [['women swimsuit', 'Traje de baño', 'dress'], ['men swim trunks', 'Short de baño', 'pants'], ['hawaiian shirt', 'Camisa playera', 'shirt']],
      accesorios: [['polarized sunglasses', 'Lentes polarizados', 'glasses'], ['large beach tote', 'Bolsa de playa grande', 'bag'], ['waterproof phone pouch', 'Funda impermeable', 'phone']],
      gadgets: [['action camera', 'Cámara deportiva', 'camera'], ['fitness tracker', 'Pulsera de actividad', 'watch'], ['portable blender', 'Licuadora portátil', 'battery']],
    },
  },
  {
    // Tienda exclusiva de ropa con pedrería, calaveras y alas, solo en negro y blanco.
    // El estilo se inspira en el tattoo/Y2K, pero NO vende la marca Ed Hardy ni ninguna otra
    // (las búsquedas evitan nombres de marca para no importar imitaciones).
    slug: 'alasnegras',
    name: 'Alas Negras',
    tagline: 'Pedrería, calaveras y alas. Solo negro y blanco.',
    heroTitle: 'Brilla en la oscuridad',
    heroText: 'Playeras, sudaderas, chamarras y jeans con pedrería y gráficos estilo tattoo. Toda la colección en negro y blanco.',
    palette: { bg: '#000000', surface: '#0d0d0d', text: '#ffffff', muted: '#a6a6a6', primary: '#ffffff', onPrimary: '#000000', accent: '#ffffff', border: '#2e2e2e' },
    fonts: { heading: 'Pirata One', body: 'Barlow' },
    radius: 0, header: 'centered', hero: 'rhinestone', card: 'bordered', button: 'solid',
    logoShape: 'skullwings', iconStroke: 1.75, uppercase: false,
    markup: 0.9, categories: ['playeras', 'sudaderas', 'chamarras', 'pantalones'], domains: [],
    // Solo se importan variantes en estos colores (nombre del color en inglés en CJ, y su nombre en español).
    onlyColors: { black: 'Negro', white: 'Blanco' },
    niche: {
      playeras: [['rhinestone skull t-shirt', 'Playera calavera con pedrería', 'skull'], ['rhinestone wings t-shirt', 'Playera alas con pedrería', 'wings'], ['tattoo style graphic t-shirt', 'Playera estilo tattoo', 'shirt']],
      sudaderas: [['rhinestone skull hoodie', 'Sudadera calavera con pedrería', 'skull'], ['rhinestone zip up hoodie', 'Sudadera con cierre y pedrería', 'hoodie'], ['gothic wings hoodie', 'Sudadera alas góticas', 'wings']],
      chamarras: [['rhinestone denim jacket', 'Chamarra de mezclilla con pedrería', 'jacket'], ['skull bomber jacket', 'Chamarra bomber calavera', 'jacket']],
      pantalones: [['rhinestone jeans', 'Jeans con pedrería', 'pants'], ['skull print pants', 'Pantalón estampado calavera', 'pants']],
    },
  },
];

export const CATEGORIES = {
  gadgets: { name: 'Gadgets', icon: 'cpu' },
  ropa: { name: 'Ropa', icon: 'shirt' },
  accesorios: { name: 'Accesorios', icon: 'watch' },
  // Categorías de tiendas especializadas en ropa.
  playeras: { name: 'Playeras', icon: 'shirt' },
  sudaderas: { name: 'Sudaderas', icon: 'hoodie' },
  chamarras: { name: 'Chamarras', icon: 'jacket' },
  pantalones: { name: 'Pantalones', icon: 'pants' },
};

export function getStore(slug) {
  return STORES.find((s) => s.slug === slug) || null;
}

export function storeForHost(host) {
  if (!host) return null;
  const h = host.toLowerCase().split(':')[0];
  return STORES.find((s) => s.domains.includes(h)) || null;
}
