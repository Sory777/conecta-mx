import { useRef, useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Trash2, MessageCircle } from 'lucide-react';
import type { Business, Product } from '../lib/types';
import { businessWaLink } from '../lib/utils';

interface ProductCarouselProps {
  products: Product[];
  business: Business;
  onDelete: (id: string) => void;
  onTrack: (key: 'whatsappClicks' | 'mapClicks' | 'qrDownloads') => void;
}

export function ProductCarousel({ products, business, onDelete, onTrack }: ProductCarouselProps) {
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const count = products.length;

  const goTo = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(idx, count - 1));
    setActive(clamped);
  }, [count]);

  const next = useCallback(() => goTo(active + 1), [active, goTo]);
  const prev = useCallback(() => goTo(active - 1), [active, goTo]);

  useEffect(() => {
    if (active > count - 1) setActive(Math.max(0, count - 1));
  }, [count, active]);

  if (count === 0) return null;

  return (
    <div className="mt-4">
      <div
        className="relative"
        style={{ perspective: '1200px' }}
        onTouchStart={(e) => {
          const startX = e.touches[0].clientX;
          const handleEnd = (endX: number) => {
            if (startX - endX > 50) next();
            else if (endX - startX > 50) prev();
          };
          const onTouchEnd = (ev: TouchEvent) => {
            handleEnd(ev.changedTouches[0].clientX);
            trackRef.current?.removeEventListener('touchend', onTouchEnd);
          };
          trackRef.current?.addEventListener('touchend', onTouchEnd);
        }}
      >
        <div
          ref={trackRef}
          className="relative mx-auto flex items-center justify-center"
          style={{ transformStyle: 'preserve-3d', height: '280px' }}
        >
          {products.map((p, i) => {
            const offset = i - active;
            const absOffset = Math.abs(offset);
            const isActive = offset === 0;
            const translateX = offset * 180;
            const translateZ = -absOffset * 140;
            const rotateY = offset * -25;
            const opacity = absOffset > 2 ? 0 : 1 - absOffset * 0.25;
            const scale = isActive ? 1 : 0.85;

            return (
              <div
                key={p.id}
                className="card absolute flex w-56 flex-col overflow-hidden transition-all duration-500 ease-out sm:w-64"
                style={{
                  transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                  opacity,
                  zIndex: 10 - absOffset,
                  pointerEvents: isActive ? 'auto' : 'none',
                  backfaceVisibility: 'hidden',
                  boxShadow: isActive ? '0 16px 32px -10px rgba(20,18,16,0.3)' : 'none',
                  borderColor: isActive ? 'rgb(var(--gold))' : 'rgb(var(--border))',
                }}
                onClick={() => !isActive && goTo(i)}
              >
                <div className="relative aspect-square overflow-hidden bg-surface-soft">
                  <img
                    src={p.imageUrl || 'https://images.unsplash.com/photo-1526168107505-1c44b1ca7e07?w=400&q=80'}
                    alt={p.name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                    onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1526168107505-1c44b1ca7e07?w=400&q=80'; }}
                  />
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                  )}
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <h3 className="line-clamp-1 text-sm font-bold">{p.name}</h3>
                  {p.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{p.description}</p>}
                  <p className="mt-1.5 font-serif text-lg font-bold text-gold">${p.price}</p>
                  {isActive && (
                    <div className="mt-3 flex items-center gap-1.5">
                      <a
                        href={businessWaLink(business, p.name)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => onTrack('whatsappClicks')}
                        className="btn-wa flex-1 px-2 py-2 text-xs"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> Me interesa
                      </a>
                      <button
                        onClick={() => onDelete(p.id)}
                        className="rounded p-2 text-muted hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/40"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {count > 1 && (
          <>
            <button
              onClick={prev}
              disabled={active === 0}
              className="absolute left-0 top-1/2 z-30 -translate-y-1/2 rounded border border-line bg-surface p-2 shadow-lg transition-all hover:border-gold hover:text-gold disabled:opacity-30"
              aria-label="Anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              disabled={active === count - 1}
              className="absolute right-0 top-1/2 z-30 -translate-y-1/2 rounded border border-line bg-surface p-2 shadow-lg transition-all hover:border-gold hover:text-gold disabled:opacity-30"
              aria-label="Siguiente"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {products.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`h-1.5 rounded transition-all duration-300 ${
                i === active ? 'w-6 bg-gold' : 'w-1.5 bg-line hover:bg-muted'
              }`}
              aria-label={`Ir al producto ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
