import { store } from "@/config/store";

const money = new Intl.NumberFormat(store.locale, {
  style: "currency",
  currency: store.currency,
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** $399 MXN */
export function formatPrice(value: number): string {
  return `${money.format(value)} ${store.currency}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(store.locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Minúsculas y sin acentos, para comparar búsquedas. */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
