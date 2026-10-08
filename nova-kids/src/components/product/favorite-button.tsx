"use client";

import { Heart } from "lucide-react";
import { useStore } from "@/components/store/store-provider";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/format";

export function FavoriteButton({ productId, className, withLabel = false }: { productId: string; className?: string; withLabel?: boolean }) {
  const { isFavorite, toggleFavorite, hydrated } = useStore();
  const active = hydrated && isFavorite(productId);
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? "Quitar de favoritos" : "Agregar a favoritos"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(productId);
        toast(active ? "Eliminado de favoritos" : "Guardado en favoritos", "info");
      }}
      className={cn(
        "inline-flex items-center justify-center gap-2 transition",
        withLabel ? "btn btn-secondary" : "size-10 rounded-full bg-space-950/55 backdrop-blur hover:bg-space-950/80",
        className,
      )}
    >
      <Heart className={cn("size-5 transition", active ? "fill-nova-magenta text-nova-magenta scale-110" : "text-white")} />
      {withLabel && <span className="max-[379px]:sr-only">{active ? "En favoritos" : "Favorito"}</span>}
    </button>
  );
}
