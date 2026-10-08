"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cartKey, type CartItem } from "@/lib/cart-types";
import { stockKey, mainImage } from "@/lib/product";
import type { Product } from "@/lib/types";

const CART_KEY = "nk_cart_v1";
const FAV_KEY = "nk_favorites_v1";

interface StoreState {
  hydrated: boolean;
  // Carrito
  items: CartItem[];
  itemCount: number;
  addItem: (product: Product, size: string, color: string, quantity?: number) => { ok: boolean; message?: string };
  removeItem: (key: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  changeVariant: (key: string, size: string, color: string) => void;
  replaceItems: (items: CartItem[]) => void;
  clearCart: () => void;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  // Favoritos
  favorites: string[];
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (productId: string) => void;
  // Buscador
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
}

const StoreContext = createContext<StoreState | null>(null);

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Almacenamiento lleno o bloqueado (modo privado): el carrito sigue funcionando en memoria.
  }
}

const available = (item: Pick<CartItem, "stock">, size: string, color: string) =>
  Math.max(0, item.stock[stockKey(size, color)] ?? 0);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    setItems(readStorage<CartItem[]>(CART_KEY, []));
    setFavorites(readStorage<string[]>(FAV_KEY, []));
    setHydrated(true);
    // Sincroniza entre pestañas abiertas.
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_KEY) setItems(readStorage<CartItem[]>(CART_KEY, []));
      if (e.key === FAV_KEY) setFavorites(readStorage<string[]>(FAV_KEY, []));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (hydrated) writeStorage(CART_KEY, items);
  }, [items, hydrated]);
  useEffect(() => {
    if (hydrated) writeStorage(FAV_KEY, favorites);
  }, [favorites, hydrated]);

  const addItem = useCallback<StoreState["addItem"]>((product, size, color, quantity = 1) => {
    const key = cartKey(product.id, size, color);
    const max = Math.max(0, product.stock[stockKey(size, color)] ?? 0);
    const existing = itemsRef.current.find((i) => i.key === key);
    const current = existing?.quantity ?? 0;
    if (max <= current) {
      return { ok: false, message: max === 0 ? "Esta combinación está agotada." : `Solo hay ${max} piezas disponibles.` };
    }
    const nextQty = Math.min(max, current + quantity);
    setItems((prev) => {
      const snapshot: CartItem = {
        key,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        sku: product.sku,
        image: mainImage(product),
        size,
        color,
        quantity: nextQty,
        unitPrice: product.price,
        compareAtPrice: product.compareAtPrice,
        sizes: product.sizes,
        colors: product.colors,
        stock: product.stock,
      };
      return existing ? prev.map((i) => (i.key === key ? snapshot : i)) : [...prev, snapshot];
    });
    return nextQty < current + quantity ? { ok: true, message: `Se agregaron las ${max} piezas disponibles.` } : { ok: true };
  }, []);

  const removeItem = useCallback((key: string) => setItems((prev) => prev.filter((i) => i.key !== key)), []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    setItems((prev) =>
      prev.flatMap((i) => {
        if (i.key !== key) return [i];
        if (quantity <= 0) return [];
        return [{ ...i, quantity: Math.min(quantity, Math.max(1, available(i, i.size, i.color))) }];
      }),
    );
  }, []);

  const changeVariant = useCallback((key: string, size: string, color: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.key === key);
      if (!item) return prev;
      const newKey = cartKey(item.productId, size, color);
      const max = available(item, size, color);
      if (max === 0) return prev;
      const merged = prev.find((i) => i.key === newKey && i.key !== key);
      const quantity = Math.min(max, item.quantity + (merged?.quantity ?? 0));
      return prev
        .filter((i) => i.key !== newKey || i.key === key)
        .map((i) => (i.key === key ? { ...i, key: newKey, size, color, quantity } : i));
    });
  }, []);

  const value = useMemo<StoreState>(
    () => ({
      hydrated,
      items,
      itemCount: items.reduce((n, i) => n + i.quantity, 0),
      addItem,
      removeItem,
      setQuantity,
      changeVariant,
      replaceItems: setItems,
      clearCart: () => setItems([]),
      cartOpen,
      setCartOpen,
      favorites,
      isFavorite: (id) => favorites.includes(id),
      toggleFavorite: (id) => setFavorites((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id])),
      searchOpen,
      setSearchOpen,
    }),
    [hydrated, items, addItem, removeItem, setQuantity, changeVariant, cartOpen, favorites, searchOpen],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreState {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore debe usarse dentro de <StoreProvider>");
  return ctx;
}
