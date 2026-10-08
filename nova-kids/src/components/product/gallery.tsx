"use client";

import { useRef, useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/format";
import type { ProductImage as Img } from "@/lib/types";
import { ProductImage } from "./product-image";

export function Gallery({ images, name }: { images: Img[]; name: string }) {
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  function go(i: number) {
    setActive(i);
    const track = trackRef.current;
    if (track) track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" });
  }

  if (!images.length) {
    return (
      <div className="bg-space-800 grid aspect-[4/5] place-items-center rounded-3xl text-ink-faint" data-gallery-main>
        <ImageOff className="size-10" />
      </div>
    );
  }

  return (
    <div className="lg:grid lg:grid-cols-[84px_1fr] lg:gap-4">
      {/* Miniaturas (escritorio) */}
      <div className="hidden flex-col gap-3 lg:flex">
        {images.map((img, i) => (
          <button
            key={img.url + i}
            type="button"
            onClick={() => go(i)}
            aria-label={`Ver imagen ${i + 1}`}
            aria-current={i === active}
            className={cn(
              "bg-space-800 relative aspect-[4/5] overflow-hidden rounded-xl ring-2 transition",
              i === active ? "ring-nova-cyan" : "ring-transparent opacity-70 hover:opacity-100",
            )}
          >
            <ProductImage src={img.url} alt="" fill sizes="84px" className="object-cover" />
          </button>
        ))}
      </div>

      <div className="relative">
        <div
          ref={trackRef}
          data-gallery-main
          onScroll={(e) => {
            const el = e.currentTarget;
            const i = Math.round(el.scrollLeft / el.clientWidth);
            if (i !== active) setActive(i);
          }}
          className="scrollbar-none bg-space-800 flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto rounded-3xl ring-1 ring-white/10"
        >
          {images.map((img, i) => (
            <div key={img.url + i} className="relative h-full w-full shrink-0 snap-center">
              <ProductImage
                src={img.url}
                alt={img.alt || `${name} — imagen ${i + 1}`}
                fill
                priority={i === 0}
                sizes="(min-width:1024px) 560px, 100vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
        {images.length > 1 && (
          <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2 lg:hidden">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`Ver imagen ${i + 1}`}
                className={cn("h-2 rounded-full transition-all", i === active ? "w-6 bg-white" : "w-2 bg-white/50")}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
