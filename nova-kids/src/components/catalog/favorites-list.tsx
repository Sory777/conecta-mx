"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart, Loader2, Rocket } from "lucide-react";
import { useStore } from "@/components/store/store-provider";
import { ProductGrid } from "@/components/product/product-grid";
import { loadCatalog } from "@/components/layout/search-overlay";
import type { Product } from "@/lib/types";

export function FavoritesList() {
  const { favorites, hydrated } = useStore();
  const [products, setProducts] = useState<Product[] | null>(null);

  useEffect(() => {
    loadCatalog().then((d) => setProducts(d.products), () => setProducts([]));
  }, []);

  if (!hydrated || !products) {
    return (
      <div className="grid min-h-[30vh] place-items-center text-ink-muted">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  const list = products.filter((p) => favorites.includes(p.id));
  if (!list.length) {
    return (
      <div className="surface mx-auto flex max-w-lg flex-col items-center px-6 py-14 text-center">
        <Heart className="size-10 text-nova-magenta" />
        <p className="mt-4 font-display text-xl font-semibold">Aún no tienes favoritos</p>
        <p className="mt-1 text-sm text-ink-muted">Toca el corazón en cualquier producto para guardarlo aquí.</p>
        <Link href="/catalogo" className="btn btn-primary mt-6">
          <Rocket className="rocket-icon size-4" /> Explorar catálogo
        </Link>
      </div>
    );
  }
  return <ProductGrid products={list} />;
}
