import type { CategoryInput } from "./types";

/**
 * Categorías iniciales de la tienda (estructura real, no demo).
 * Se crean automáticamente la primera vez; después se administran en /admin/categorias.
 */
export const defaultCategories: CategoryInput[] = [
  { slug: "ninas", name: "Niñas", description: "Prendas para exploradoras con estilo.", image: "/categories/ninas.svg", kind: "gender", gender: "nina", sortOrder: 1, visible: true },
  { slug: "ninos", name: "Niños", description: "Ropa cómoda para aventuras sin límite.", image: "/categories/ninos.svg", kind: "gender", gender: "nino", sortOrder: 2, visible: true },
  { slug: "conjuntos", name: "Conjuntos", description: "Looks completos listos para despegar.", image: "/categories/conjuntos.svg", kind: "garment", gender: null, sortOrder: 3, visible: true },
  { slug: "playeras", name: "Playeras", description: "Básicos y estampados de otra galaxia.", image: "/categories/playeras.svg", kind: "garment", gender: null, sortOrder: 4, visible: true },
  { slug: "shorts", name: "Shorts", description: "Libertad de movimiento para jugar.", image: "/categories/shorts.svg", kind: "garment", gender: null, sortOrder: 5, visible: true },
  { slug: "sudaderas", name: "Sudaderas", description: "Abrigo suave para noches estrelladas.", image: "/categories/sudaderas.svg", kind: "garment", gender: null, sortOrder: 6, visible: true },
  { slug: "novedades", name: "Novedades", description: "Lo más reciente en llegar a la estación.", image: "/categories/novedades.svg", kind: "new", gender: null, sortOrder: 7, visible: true },
  { slug: "ofertas", name: "Ofertas", description: "Precios que impulsan tu compra.", image: "/categories/ofertas.svg", kind: "sale", gender: null, sortOrder: 8, visible: true },
];
