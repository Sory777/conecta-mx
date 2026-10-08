import { normalizeText } from "./format";
import { GENDER_LABELS, type Category, type Gender, type Product } from "./types";
import { isNewProduct, isOnSale, productInCategory, totalStock, sizeStock } from "./product";

export type SortOption = "recientes" | "precio-asc" | "precio-desc" | "vendidos";

export const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: "recientes", label: "Más recientes" },
  { id: "precio-asc", label: "Precio: menor a mayor" },
  { id: "precio-desc", label: "Precio: mayor a menor" },
  { id: "vendidos", label: "Más vendidos" },
];

export interface CatalogFilters {
  categories: string[]; // slugs
  genders: Gender[];
  sizes: string[];
  colors: string[];
  minPrice: number | null;
  maxPrice: number | null;
  inStock: boolean;
  onlyNew: boolean;
  onlySale: boolean;
  query: string;
  sort: SortOption;
}

export const emptyFilters: CatalogFilters = {
  categories: [],
  genders: [],
  sizes: [],
  colors: [],
  minPrice: null,
  maxPrice: null,
  inStock: false,
  onlyNew: false,
  onlySale: false,
  query: "",
  sort: "recientes",
};

/** Sinónimos comunes para que "niña", "playera" o "sudadera" encuentren lo esperado. */
const SYNONYMS: Record<string, string[]> = {
  nina: ["nina", "ninas", "girl"],
  nino: ["nino", "ninos", "boy"],
  playera: ["playera", "playeras", "camiseta", "camisetas", "playerita"],
  sudadera: ["sudadera", "sudaderas", "hoodie", "chamarra"],
  short: ["short", "shorts", "bermuda"],
  conjunto: ["conjunto", "conjuntos", "set", "pijama"],
};

function expand(token: string): string[] {
  for (const [, words] of Object.entries(SYNONYMS)) {
    if (words.includes(token)) return words;
  }
  return [token];
}

export interface ParsedQuery {
  terms: string[];
  size: string | null;
}

/** Interpreta búsquedas como "conjunto niña talla 8". */
export function parseQuery(raw: string): ParsedQuery {
  let text = normalizeText(raw);
  let size: string | null = null;
  const sizeMatch = text.match(/\btalla\s*([a-z0-9]+)\b/);
  if (sizeMatch) {
    size = sizeMatch[1];
    text = text.replace(sizeMatch[0], " ");
  }
  const terms = text.split(/\s+/).filter((t) => t.length > 1 || /\d/.test(t));
  return { terms, size };
}

export function matchesQuery(product: Product, category: Category | undefined, parsed: ParsedQuery): boolean {
  if (parsed.size && !product.sizes.some((s) => normalizeText(s) === parsed.size)) return false;
  if (!parsed.terms.length) return true;
  const haystack = normalizeText(
    [
      product.name,
      product.description,
      product.sku,
      category?.name ?? "",
      GENDER_LABELS[product.gender],
      product.gender === "nina" ? "ninas" : product.gender === "nino" ? "ninos" : "nina nino ninas ninos",
      product.colors.map((c) => c.name).join(" "),
    ].join(" "),
  );
  return parsed.terms.every((term) => expand(term).some((word) => haystack.includes(word)));
}

export function searchProducts(products: Product[], categories: Category[], query: string, limit?: number): Product[] {
  const parsed = parseQuery(query);
  if (!parsed.terms.length && !parsed.size) return [];
  const byId = new Map(categories.map((c) => [c.id, c]));
  const results = products.filter((p) => matchesQuery(p, byId.get(p.categoryId), parsed));
  return typeof limit === "number" ? results.slice(0, limit) : results;
}

export function applyFilters(products: Product[], categories: Category[], f: CatalogFilters): Product[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const selectedCats = categories.filter((c) => f.categories.includes(c.slug));
  const parsed = f.query ? parseQuery(f.query) : null;

  const out = products.filter((p) => {
    if (selectedCats.length && !selectedCats.some((c) => productInCategory(p, c))) return false;
    if (f.genders.length && !f.genders.some((g) => p.gender === g || p.gender === "unisex")) return false;
    if (f.sizes.length && !f.sizes.some((s) => p.sizes.includes(s) && (!f.inStock || sizeStock(p, s) > 0))) return false;
    if (f.colors.length && !p.colors.some((c) => f.colors.includes(c.name))) return false;
    if (f.minPrice !== null && p.price < f.minPrice) return false;
    if (f.maxPrice !== null && p.price > f.maxPrice) return false;
    if (f.inStock && totalStock(p) === 0) return false;
    if (f.onlyNew && !isNewProduct(p)) return false;
    if (f.onlySale && !isOnSale(p)) return false;
    if (parsed && !matchesQuery(p, byId.get(p.categoryId), parsed)) return false;
    return true;
  });

  return sortProducts(out, f.sort);
}

export function sortProducts(products: Product[], sort: SortOption): Product[] {
  const list = [...products];
  switch (sort) {
    case "precio-asc":
      return list.sort((a, b) => a.price - b.price);
    case "precio-desc":
      return list.sort((a, b) => b.price - a.price);
    case "vendidos":
      return list.sort((a, b) => b.soldCount - a.soldCount);
    default:
      return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
