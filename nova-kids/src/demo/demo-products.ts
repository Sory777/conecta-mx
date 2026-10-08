// ============================================================
// PRODUCTOS DE DEMOSTRACIÓN — NO SON DATOS REALES.
// Solo se cargan en modo local cuando SEED_DEMO_DATA !== "false"
// y el almacén está vacío. Para quitarlos:
//   1) SEED_DEMO_DATA=false en .env.local
//   2) borra .data/store.json (o elimínalos desde /admin/productos)
//   3) opcional: borra esta carpeta y public/demo
// ============================================================

import type { Category, Product, ProductColor } from "@/lib/types";

const C = {
  azul: { name: "Azul cósmico", hex: "#2563EB" },
  marino: { name: "Azul marino", hex: "#1E3A8A" },
  morado: { name: "Morado nebulosa", hex: "#7C3AED" },
  lila: { name: "Lila", hex: "#A78BFA" },
  fucsia: { name: "Fucsia", hex: "#DB2777" },
  rosa: { name: "Rosa estelar", hex: "#F472B6" },
  blanco: { name: "Blanco", hex: "#F8FAFC" },
  negro: { name: "Negro espacial", hex: "#111827" },
  indigo: { name: "Índigo", hex: "#312E81" },
  cian: { name: "Cian", hex: "#06B6D4" },
  petroleo: { name: "Petróleo", hex: "#0E7490" },
  gris: { name: "Gris luna", hex: "#9CA3AF" },
} satisfies Record<string, ProductColor>;

interface Seed {
  slug: string;
  name: string;
  sku: string;
  category: string;
  gender: Product["gender"];
  price: number;
  compareAt?: number;
  colors: ProductColor[];
  sizes: string[];
  description: string;
  isNew?: boolean;
  featured?: boolean;
  sold: number;
  daysAgo: number;
  /** Variantes agotadas para probar la disponibilidad. */
  soldOut?: string[];
}

const seeds: Seed[] = [
  { slug: "conjunto-nova-kids-espacial", name: "Conjunto espacial NOVA", sku: "NK-CJ-001", category: "conjuntos", gender: "unisex", price: 399, compareAt: 499, colors: [C.marino, C.blanco], sizes: ["4", "6", "8", "10", "12"], description: "Playera de algodón peinado con cohete estampado y short de felpa ligera con cintura elástica y cordón. Ideal para jugar todo el día.", featured: true, sold: 128, daysAgo: 12, isNew: true },
  { slug: "conjunto-nebulosa", name: "Conjunto Nebulosa", sku: "NK-CJ-002", category: "conjuntos", gender: "nina", price: 429, colors: [C.rosa, C.blanco], sizes: ["4", "6", "8", "10"], description: "Conjunto suave en tonos nebulosa con estampado de estrellas. Tela fresca que no pierde la forma después de muchas lavadas.", featured: true, sold: 96, daysAgo: 6, isNew: true },
  { slug: "playera-cohete-orbital", name: "Playera Cohete Orbital", sku: "NK-PL-001", category: "playeras", gender: "nino", price: 219, colors: [C.azul, C.blanco], sizes: ["4", "6", "8", "10", "12", "14"], description: "Playera 100% algodón con cohete en órbita. Cuello redondo reforzado y costuras planas que no raspan.", featured: true, sold: 210, daysAgo: 40 },
  { slug: "playera-planeta-anillos", name: "Playera Planeta Anillos", sku: "NK-PL-002", category: "playeras", gender: "unisex", price: 219, compareAt: 279, colors: [C.morado, C.negro], sizes: ["4", "6", "8", "10", "12"], description: "Estampado de planeta con anillos en tinta suave al tacto. Perfecta para combinar con shorts y joggers.", sold: 154, daysAgo: 55, soldOut: ["4|Negro espacial", "6|Negro espacial"] },
  { slug: "playera-nova-basica", name: "Playera NOVA Básica", sku: "NK-PL-003", category: "playeras", gender: "unisex", price: 189, colors: [C.blanco, C.negro], sizes: ["2", "4", "6", "8", "10", "12", "14"], description: "El básico de la tripulación: playera con logotipo NOVA KIDS al frente. Algodón grueso de larga duración.", sold: 302, daysAgo: 90 },
  { slug: "playera-constelacion", name: "Playera Constelación", sku: "NK-PL-004", category: "playeras", gender: "nina", price: 229, colors: [C.fucsia, C.cian], sizes: ["4", "6", "8", "10", "12"], description: "Estrellas brillantes sobre algodón suave. Corte cómodo para moverse con libertad.", sold: 77, daysAgo: 3, isNew: true },
  { slug: "short-explorador", name: "Short Explorador", sku: "NK-SH-001", category: "shorts", gender: "nino", price: 249, colors: [C.indigo, C.petroleo], sizes: ["4", "6", "8", "10", "12"], description: "Short de felpa francesa con bolsillos laterales, cintura elástica y cordón. Resiste las aventuras más intensas.", sold: 88, daysAgo: 70 },
  { slug: "short-deportivo-cometa", name: "Short Deportivo Cometa", sku: "NK-SH-002", category: "shorts", gender: "unisex", price: 199, compareAt: 259, colors: [C.cian, C.morado], sizes: ["4", "6", "8", "10"], description: "Tela ligera de secado rápido para deporte y días de calor. Forro interior suave.", sold: 140, daysAgo: 25 },
  { slug: "sudadera-galaxia", name: "Sudadera Galaxia", sku: "NK-SD-001", category: "sudaderas", gender: "unisex", price: 549, colors: [C.indigo, C.gris], sizes: ["4", "6", "8", "10", "12", "14"], description: "Sudadera con capucha y bolsa canguro, interior perchado calientito. Estampado orbital al frente.", featured: true, sold: 64, daysAgo: 8, isNew: true },
  { slug: "sudadera-astronauta", name: "Sudadera Astronauta", sku: "NK-SD-002", category: "sudaderas", gender: "nina", price: 499, compareAt: 599, colors: [C.rosa, C.blanco], sizes: ["4", "6", "8", "10", "12"], description: "Suave, abrigadora y con cohete estampado. Puños y pretina en rib para un ajuste perfecto.", sold: 51, daysAgo: 33 },
  { slug: "vestido-polvo-de-estrellas", name: "Vestido Polvo de Estrellas", sku: "NK-VS-001", category: "conjuntos", gender: "nina", price: 459, colors: [C.lila, C.rosa], sizes: ["4", "6", "8", "10"], description: "Vestido de algodón con falda amplia y estampado de estrellas. Cómodo para fiestas y para el día a día.", sold: 43, daysAgo: 15, isNew: true },
  { slug: "sudadera-nova-classic", name: "Sudadera NOVA Classic", sku: "NK-SD-003", category: "sudaderas", gender: "unisex", price: 529, colors: [C.negro, C.azul], sizes: ["6", "8", "10", "12", "14"], description: "La sudadera insignia de la marca con logotipo NOVA KIDS. Algodón grueso con capucha forrada.", sold: 112, daysAgo: 60, soldOut: ["14|Azul cósmico"] },
];

export function demoProducts(categories: Category[], nowIso: string): Product[] {
  const now = new Date(nowIso).getTime();
  return seeds.map((s, i) => {
    const category = categories.find((c) => c.slug === s.category);
    const stock: Record<string, number> = {};
    s.sizes.forEach((size, si) =>
      s.colors.forEach((color, ci) => {
        const key = `${size}|${color.name}`;
        stock[key] = s.soldOut?.includes(key) ? 0 : 2 + ((i + si * 3 + ci * 5) % 9);
      }),
    );
    const created = new Date(now - s.daysAgo * 86_400_000).toISOString();
    return {
      id: `demo-${String(i + 1).padStart(2, "0")}`,
      slug: s.slug,
      sku: s.sku,
      name: s.name,
      description: s.description,
      price: s.price,
      compareAtPrice: s.compareAt ?? null,
      categoryId: category?.id ?? s.category,
      gender: s.gender,
      sizes: s.sizes,
      colors: s.colors,
      stock,
      images: [
        { url: `/demo/${s.slug}-1.svg`, alt: `${s.name} — vista frontal` },
        { url: `/demo/${s.slug}-2.svg`, alt: `${s.name} — detalle del estampado` },
        { url: `/demo/${s.slug}-3.svg`, alt: `${s.name} — color ${s.colors[1]?.name ?? ""}` },
      ],
      status: "active",
      isNew: Boolean(s.isNew),
      featured: Boolean(s.featured),
      soldCount: s.sold,
      seoTitle: null,
      seoDescription: null,
      createdAt: created,
      updatedAt: created,
    };
  });
}
