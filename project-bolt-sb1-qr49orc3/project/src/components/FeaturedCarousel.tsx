import { useRef, useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, MapPin, BadgeCheck, Star } from 'lucide-react';
import type { Business } from '../lib/types';
import { categoryIcon } from '../lib/constants';

interface FeaturedCarouselProps {
  businesses: Business[];
  onOpen: (b: Business) => void;
}

export function FeaturedCarousel({ businesses, onOpen }: FeaturedCarouselProps) {
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const count = businesses.length;

  const goTo = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(idx, count - 1));
    setActive(clamped);
  }, [count]);

  const next = useCallback(() => goTo(active + 1), [active, goTo]);
  const prev = useCallback(() => goTo(active - 1), [active, goTo]);

  useEffect(() => {
    if (active > count - 1) setActive(Math.max(0, count - 1));
  }, [count, active]);

  useEffect(() => {
    if (count <= 1) return;
    const id = setInterval(() => {
      setActive((a) => (a + 1) % count);
    }, 4500);
    return () => clearInterval(id);
  }, [count]);

  if (count === 0) return null;

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ perspective: '1400px' }}
      onTouchStart={(e) => {
        const startX = e.touches[0].clientX;
        const handleEnd = (endX: number) => {
          if (startX - endX > 50) next();
          else if (endX - startX > 50) prev();
        };
        const onTouchEnd = (ev: TouchEvent) => {
          handleEnd(ev.changedTouches[0].clientX);
          containerRef.current?.removeEventListener('touchend', onTouchEnd);
        };
        containerRef.current?.addEventListener('touchend', onTouchEnd);
      }}
    >
      <div
        className="relative mx-auto flex items-center justify-center"
        style={{ transformStyle: 'preserve-3d', height: '340px' }}
      >
        {businesses.map((b, i) => {
          const offset = i - active;
          const absOffset = Math.abs(offset);
          const isActive = offset === 0;
          const translateX = offset * 200;
          const translateZ = -absOffset * 180;
          const rotateY = offset * -30;
          const opacity = absOffset > 2 ? 0 : 1 - absOffset * 0.2;
          const scale = isActive ? 1 : 0.82;

          return (
            <div
              key={b.id}
              className="card absolute w-64 cursor-pointer overflow-hidden transition-all duration-700 ease-out sm:w-72"
              style={{
                transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                opacity,
                zIndex: 10 - absOffset,
                pointerEvents: absOffset <= 1 ? 'auto' : 'none',
                backfaceVisibility: 'hidden',
                boxShadow: isActive ? '0 20px 40px -12px rgba(20,18,16,0.35)' : 'none',
                borderColor: isActive ? 'rgb(var(--gold))' : 'rgb(var(--border))',
              }}
              onClick={() => (isActive ? onOpen(b) : goTo(i))}
            >
              <div className="relative h-44 overflow-hidden bg-surface-soft">
                <img
                  src={b.imageUrl || 'https://images.unsplash.com/photo-1441986300917-64674ad600d9?w=600&q=80'}
                  alt={b.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                  onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1441986300917-64674ad600d9?w=600&q=80'; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                {b.verified && (
                  <span className="absolute left-3 top-3 badge bg-ink text-ink-invert shadow">
                    <BadgeCheck className="h-3.5 w-3.5 text-gold" /> Verificado
                  </span>
                )}
                <div className="absolute bottom-0 left-0 right-0 p-3 text-ink-invert">
                  <h3 className="line-clamp-1 font-serif text-lg font-bold">{b.name}</h3>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-invert/85">
                    <span className="inline-flex items-center gap-1">{(() => { const Icon = categoryIcon(b.category); return <Icon className="h-3 w-3" />; })()} {b.category}</span>
                    <span className="inline-flex items-center gap-0.5">
                      <MapPin className="h-3 w-3" /> {b.municipality}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-gold text-gold" />
                  <span className="text-sm font-bold">{b.rating || 'N/A'}</span>
                  {b.reviewCount > 0 && (
                    <span className="text-xs text-muted">({b.reviewCount})</span>
                  )}
                </div>
                {b.promotion && (
                  <span className="line-clamp-1 rounded bg-gold-soft px-2 py-0.5 text-xs font-medium text-gold">
                    {b.promotion}
                  </span>
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
            className="absolute left-0 top-1/2 z-30 -translate-y-1/2 rounded border border-line bg-surface p-2.5 shadow-lg transition-all hover:border-gold hover:text-gold disabled:opacity-30"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={next}
            disabled={active === count - 1}
            className="absolute right-0 top-1/2 z-30 -translate-y-1/2 rounded border border-line bg-surface p-2.5 shadow-lg transition-all hover:border-gold hover:text-gold disabled:opacity-30"
            aria-label="Siguiente"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {count > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {businesses.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`h-1.5 rounded transition-all duration-300 ${
                i === active ? 'w-7 bg-gold' : 'w-1.5 bg-line hover:bg-muted'
              }`}
              aria-label={`Ir a ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
