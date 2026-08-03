import { useRef, useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Calendar, Clock, Plus, Trash2 } from 'lucide-react';
import type { Event } from '../lib/types';

interface EventsCarouselProps {
  events: Event[];
  canManage?: boolean;
  onDelete?: (id: string) => void;
  onAdd?: () => void;
}

export function EventsCarousel({ events, canManage, onDelete, onAdd }: EventsCarouselProps) {
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const count = events.length;

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
    }, 5000);
    return () => clearInterval(id);
  }, [count]);

  if (count === 0) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 p-10 text-center">
        <Calendar className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-2 text-sm font-medium text-slate-500">No hay eventos publicados{canManage ? '' : ' en este municipio'}.</p>
        {canManage && onAdd && (
          <button onClick={onAdd} className="btn-primary mt-3 text-xs">
            <Plus className="h-4 w-4" /> Publicar evento
          </button>
        )}
      </div>
    );
  }

  const fmtDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return d;
    }
  };

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
        style={{ transformStyle: 'preserve-3d', height: '380px' }}
      >
        {events.map((ev, i) => {
          const offset = i - active;
          const absOffset = Math.abs(offset);
          const isActive = offset === 0;
          const translateX = offset * 210;
          const translateZ = -absOffset * 190;
          const rotateY = offset * -32;
          const opacity = absOffset > 2 ? 0 : 1 - absOffset * 0.2;
          const scale = isActive ? 1 : 0.82;

          return (
            <div
              key={ev.id}
              className="absolute w-64 cursor-pointer overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl transition-all duration-700 ease-out sm:w-72"
              style={{
                transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                opacity,
                zIndex: 10 - absOffset,
                pointerEvents: absOffset <= 1 ? 'auto' : 'none',
                backfaceVisibility: 'hidden',
              }}
              onClick={() => (isActive ? undefined : goTo(i))}
            >
              <div className="relative h-48 overflow-hidden bg-slate-100">
                <img
                  src={ev.imageUrl || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80'}
                  alt={ev.title}
                  loading="lazy"
                  className="h-full w-full object-cover"
                  onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80'; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/10 to-transparent" />
                {ev.category && (
                  <span className="absolute left-3 top-3 badge bg-[#1565C0] text-white shadow">
                    {ev.category}
                  </span>
                )}
                {canManage && onDelete && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(ev.id); }}
                    className="absolute right-3 top-3 rounded-full bg-slate-900/70 p-1.5 text-white transition hover:bg-rose-500"
                    aria-label="Eliminar evento"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                  <h3 className="line-clamp-1 text-lg font-extrabold">{ev.title}</h3>
                  <div className="mt-1 flex items-center gap-2 text-xs text-white/90">
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {ev.municipality}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5 p-3">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Calendar className="h-3.5 w-3.5 text-[#1565C0]" /> {fmtDate(ev.date)}
                  {ev.time && <><span className="text-slate-300">·</span><Clock className="h-3.5 w-3.5 text-[#1565C0]" /> {ev.time}</>}
                </div>
                {ev.location && (
                  <p className="flex items-start gap-1.5 text-xs text-slate-500">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0" /> {ev.location}
                  </p>
                )}
                {ev.description && (
                  <p className="line-clamp-2 text-xs text-slate-600">{ev.description}</p>
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
            className="absolute left-0 top-1/2 z-30 -translate-y-1/2 rounded-full bg-white/90 p-2.5 shadow-lg transition-all hover:bg-white hover:scale-110 disabled:opacity-30 disabled:hover:scale-100"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-5 w-5 text-slate-700" />
          </button>
          <button
            onClick={next}
            disabled={active === count - 1}
            className="absolute right-0 top-1/2 z-30 -translate-y-1/2 rounded-full bg-white/90 p-2.5 shadow-lg transition-all hover:bg-white hover:scale-110 disabled:opacity-30 disabled:hover:scale-100"
            aria-label="Siguiente"
          >
            <ChevronRight className="h-5 w-5 text-slate-700" />
          </button>
        </>
      )}

      {count > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {events.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === active ? 'w-7 bg-[#1565C0]' : 'w-2 bg-slate-300 hover:bg-slate-400'
              }`}
              aria-label={`Ir a ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
