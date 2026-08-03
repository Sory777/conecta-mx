import { useMemo, useState, useEffect, useRef } from 'react';
import { Calendar, Clock, MapPin, Share2, CalendarPlus, Search, Filter, X, Heart, Flag } from 'lucide-react';
import type { Event } from '../lib/types';
import { MUNICIPALITIES, CATEGORIES } from '../lib/constants';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { storage } from '../lib/storage';
import { ReportButton } from '../components/ReportButton';

interface EventsPageProps {
  events: Event[];
  onChange: () => void;
}

function calcRemaining(targetDate: string) {
  const target = new Date(targetDate).getTime();
  const now = Date.now();
  const diff = target - now;
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    expired: false,
  };
}

// Shared countdown hook - updates only the seconds field every tick, not every card
function useSharedCountdown(targetDate: string, tickRef: React.MutableRefObject<number>) {
  const [remaining, setRemaining] = useState(() => calcRemaining(targetDate));
  useEffect(() => {
    setRemaining(calcRemaining(targetDate));
  }, [targetDate]);
  useEffect(() => {
    const interval = setInterval(() => {
      tickRef.current++;
      setRemaining(calcRemaining(targetDate));
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate, tickRef]);
  return remaining;
}

function generateICS(event: Event): string {
  const dt = new Date(event.date);
  const dtStart = dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dtEnd = new Date(dt.getTime() + 2 * 3600000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Conecta MX//Event//ES
BEGIN:VEVENT
UID:${event.id}@conectamx
DTSTAMP:${dtStart}
DTSTART:${dtStart}
DTEND:${dtEnd}
SUMMARY:${event.title}
DESCRIPTION:${event.description || ''}
LOCATION:${event.location || event.municipality}
END:VEVENT
END:VCALENDAR`;
}

function EventCard({ event, onShare, onFavorite, isFavorite }: {
  event: Event;
  onShare: (e: Event) => void;
  onFavorite: (id: string) => void;
  isFavorite: boolean;
}) {
  const tickRef = useRef(0);
  const countdown = useSharedCountdown(event.date, tickRef);
  const { toast } = useToast();
  const [showMap, setShowMap] = useState(false);

  const addToCalendar = (type: 'google' | 'apple' | 'outlook') => {
    const dt = new Date(event.date);
    const dtStart = dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const dtEnd = new Date(dt.getTime() + 2 * 3600000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    if (type === 'google') {
      const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${dtStart}/${dtEnd}&details=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location || event.municipality)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } else if (type === 'apple' || type === 'outlook') {
      const ics = generateICS(event);
      const blob = new Blob([ics], { type: 'text/calendar' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${event.title.replace(/\s+/g, '_')}.ics`;
      a.click();
      URL.revokeObjectURL(url);
    }
    toast('Evento agregado al calendario', 'success');
  };

  return (
    <div className="card overflow-hidden">
      {event.imageUrl && (
        <div className="relative h-40 overflow-hidden">
          <img src={event.imageUrl} alt={event.title} className="h-full w-full object-cover" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          {!countdown.expired && (
            <div className="absolute bottom-2 left-2 flex gap-1.5">
              <div className="flex flex-col items-center rounded-lg bg-black/70 px-2 py-1 text-white">
                <span className="text-lg font-extrabold leading-none">{countdown.days}</span>
                <span className="text-[10px] uppercase">días</span>
              </div>
              <div className="flex flex-col items-center rounded-lg bg-black/70 px-2 py-1 text-white">
                <span className="text-lg font-extrabold leading-none">{countdown.hours}</span>
                <span className="text-[10px] uppercase">hrs</span>
              </div>
              <div className="flex flex-col items-center rounded-lg bg-black/70 px-2 py-1 text-white">
                <span className="text-lg font-extrabold leading-none">{countdown.minutes}</span>
                <span className="text-[10px] uppercase">min</span>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-800">{event.title}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {new Date(event.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              {event.time && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {event.time}</span>}
            </div>
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" /> {event.location || event.municipality}</p>
          </div>
          {event.category && <span className="chip shrink-0 bg-blue-50 text-xs text-blue-700">{event.category}</span>}
        </div>
        {event.description && <p className="mt-2 text-sm text-slate-600 line-clamp-2">{event.description}</p>}

        {countdown.expired && (
          <span className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Evento finalizado</span>
        )}

        {showMap && (event.location || event.municipality) && (
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
            <iframe
              src={`https://maps.google.com/maps?q=${encodeURIComponent((event.location || '') + ', ' + event.municipality + ', México')}&output=embed`}
              className="h-48 w-full"
              loading="lazy"
              title={`Mapa de ${event.title}`}
            />
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <div className="flex gap-1.5">
            <button onClick={() => addToCalendar('google')} className="btn-outline px-2.5 py-1.5 text-xs" title="Google Calendar">
              <CalendarPlus className="h-3.5 w-3.5" /> Google
            </button>
            <button onClick={() => addToCalendar('apple')} className="btn-outline px-2.5 py-1.5 text-xs" title="Apple Calendar">
              <CalendarPlus className="h-3.5 w-3.5" /> Apple
            </button>
            <button onClick={() => addToCalendar('outlook')} className="btn-outline px-2.5 py-1.5 text-xs" title="Outlook">
              <CalendarPlus className="h-3.5 w-3.5" /> Outlook
            </button>
          </div>
          <button onClick={() => setShowMap((v) => !v)} className="btn-outline px-2.5 py-1.5 text-xs">
            <MapPin className="h-3.5 w-3.5" /> {showMap ? 'Ocultar mapa' : 'Ver mapa'}
          </button>
          <button onClick={() => onShare(event)} className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-[#1565C0]" aria-label="Compartir">
            <Share2 className="h-4 w-4" />
          </button>
          <button onClick={() => onFavorite(event.id)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500" aria-label="Favorito">
            <Heart className={`h-4 w-4 ${isFavorite ? 'fill-rose-500 text-rose-500' : ''}`} />
          </button>
          <div className="ml-auto">
            <ReportButton itemType="event" itemId={event.id} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function EventsPage({ events, onChange }: EventsPageProps) {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [muni, setMuni] = useState('');
  const [category, setCategory] = useState('');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    storage.getFavoriteIds('event').then(setFavorites).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    let list = events.slice();
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      list = list.filter((e) => e.title.toLowerCase().includes(q) || (e.description || '').toLowerCase().includes(q));
    }
    if (muni) list = list.filter((e) => e.municipality === muni);
    if (category) list = list.filter((e) => e.category === category);
    list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return list;
  }, [events, query, muni, category]);

  const shareEvent = async (event: Event) => {
    const url = `${localStorage.getItem('cmx_public_url') || `${window.location.origin}${window.location.pathname}`}#/events`;
    try {
      if (navigator.share) {
        await navigator.share({ title: event.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast('Enlace copiado', 'success');
      }
    } catch { /* cancelled */ }
  };

  const toggleFavorite = async (id: string) => {
    try {
      if (favorites.has(id)) {
        await storage.removeFavorite('event', id);
        setFavorites((s) => { const n = new Set(s); n.delete(id); return n; });
      } else {
        await storage.addFavorite('event', id);
        setFavorites((s) => new Set(s).add(id));
      }
    } catch {
      toast('Inicia sesión para guardar favoritos', 'error');
    }
  };

  const hasFilters = query || muni || category;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-slate-800">Eventos</h1>
        <p className="text-sm text-slate-500">{filtered.length} eventos próximos</p>
      </div>

      <div className="card p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar eventos..." className="input pl-9" />
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <select value={muni} onChange={(e) => setMuni(e.target.value)} className="input">
            <option value="">Todos los estados</option>
            {MUNICIPALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
            <option value="">Todas las categorías</option>
            {CATEGORIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        {hasFilters && (
          <button onClick={() => { setQuery(''); setMuni(''); setCategory(''); }} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#1565C0] hover:underline">
            <X className="h-3.5 w-3.5" /> Limpiar filtros
          </button>
        )}
      </div>

      <div className="mt-5">
        {filtered.length === 0 ? (
          <EmptyState title="No hay eventos" message="No se encontraron eventos con estos filtros." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {filtered.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onShare={shareEvent}
                onFavorite={toggleFavorite}
                isFavorite={favorites.has(event.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
