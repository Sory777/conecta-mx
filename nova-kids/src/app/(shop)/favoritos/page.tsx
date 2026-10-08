import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { FavoritesList } from "@/components/catalog/favorites-list";

export const metadata: Metadata = { title: "Favoritos", robots: { index: false } };

export default function FavoritesPage() {
  return (
    <>
      <PageHeader eyebrow="Tu selección" title="Favoritos" description="Las prendas que marcaste con un corazón. Se guardan en este dispositivo." />
      <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6">
        <FavoritesList />
      </div>
    </>
  );
}
