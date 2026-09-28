import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, SlidersHorizontal, X, LayoutGrid, List, Heart, Share2, Copy, Loader2 } from 'lucide-react';
import type { Business } from '../lib/types';
import { MUNICIPALITIES, CATEGORIES, categoryIcon } from '../lib/constants';
import { BusinessCard } from '../components/BusinessCard';
import { EmptyState } from '../components/EmptyState';
import { storage } from '../lib/storage';
import { useToast } from '../components/Toast';
import { isOpenNow } from '../lib/utils';

interface DirectoryPageProps {
  onOpenBusiness: (b: Business) => void;
  initialQuery?: string;
  initialMuni?: string;
  initialCategory?: string;
}

const PAGE_SIZE = 24;

export function DirectoryPage({ onOpenBusiness, initialQuery = '', initialMuni = '', initialCategory = '' }: DirectoryPageProps) {
  const { toast } = useToast();
  const [query, setQuery] = useState(initialQuery);
  const [muni, setMuni] = useState(initialMuni);
  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState<'recent' | 'rating' | 'name' | 'open'>('recent');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const [results, setResults] = useState<Business[]>([]);
  const [total, setTotal] = useState(0);
  const [smartCategories, setSmartCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    setQuery(initialQuery);
    setMuni(initialMuni);
    setCategory(initialCategory);
  }, [initialQuery, initialMuni, initialCategory]);

  useEffect(() => {
    storage.getFavoriteIds('business').then(setFavorites).catch(() => {});
  }, []);

  // Debounce the search box so we don't fire a query on every keystroke.
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const fetchPage = async (offset: number, append: boolean) => {
    const myRequest = ++requestId.current;
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const res = await storage.getBusinessesPage({ q: debouncedQuery, muni, category, sort }, offset, PAGE_SIZE);
      if (myRequest !== requestId.current) return;
      setResults((prev) => (append ? [...prev, ...res.data] : res.data));
      setTotal(res.count);
      setSmartCategories(res.smartCategories);
    } catch (err) {
      console.error('Failed to load businesses:', err);
      if (myRequest === requestId.current && !append) toast('No se pudieron cargar los negocios', 'error');
    } finally {
      if (myRequest === requestId.current) { setLoading(false); setLoadingMore(false); }
    }
  };

  useEffect(() => {
    fetchPage(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, muni, category, sort]);

  const loadMore = () => fetchPage(results.length, true);

  // "Abiertos ahora" depends on each business's free-text hours, which we
  // can't sort by in SQL — apply it as a best-effort re-sort of the
  // currently loaded page rather than the whole result set.
  const displayed = useMemo(() => {
    if (sort !== 'open') return results;
    return [...results].sort((a, b) => {
      const aOpen = isOpenNow(a.hours).open ? 1 : 0;
      const bOpen = isOpenNow(b.hours).open ? 1 : 0;
      return bOpen - aOpen;
    });
  }, [results, sort]);

  const clearFilters = () => {
    setQuery('');
    setMuni('');
    setCategory('');
    setSort('recent');
  };

  const hasFilters = query || muni || category || sort !== 'recent';

  const toggleFavorite = async (id: string) => {
    try {
      if (favorites.has(id)) {
        await storage.removeFavorite('business', id);
        setFavorites((s) => { const n = new Set(s); n.delete(id); return n; });
      } else {
        await storage.addFavorite('business', id);
        setFavorites((s) => new Set(s).add(id));
      }
    } catch {
      toast('Inicia sesión para guardar favoritos', 'error');
    }
  };

  const shareBusiness = async (b: Business) => {
    const url = `${localStorage.getItem('cmx_public_url') || `${window.location.origin}${window.location.pathname}`}#/business/${b.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: b.name, url });
        storage.trackEvent(b.id, null, 'share').catch(() => {});
      } else {
        await navigator.clipboard.writeText(url);
        toast('Enlace copiado', 'success');
        storage.trackEvent(b.id, null, 'share').catch(() => {});
      }
    } catch { /* user cancelled */ }
  };

  const copyLink = (b: Business) => {
    const url = `${localStorage.getItem('cmx_public_url') || `${window.location.origin}${window.location.pathname}`}#/business/${b.id}`;
    navigator.clipboard.writeText(url).then(() => toast('Enlace copiado', 'success'));
    storage.trackEvent(b.id, null, 'share').catch(() => {});
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-slate-800">Negocios</h1>
        <p className="text-sm text-slate-500">{displayed.length} de {total} negocios</p>
      </div>

      {/* Search bar */}
      <div className="card p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar: tacos, ferretería, belleza..."
              className="input pl-9"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className="btn-outline sm:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" /> Filtros
            </button>
            <div className="flex rounded-lg border border-slate-200 p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`rounded-md p-2 ${viewMode === 'grid' ? 'bg-[#0D47A1] text-white' : 'text-slate-400'}`}
                aria-label="Vista cuadrícula"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`rounded-md p-2 ${viewMode === 'list' ? 'bg-[#0D47A1] text-white' : 'text-slate-400'}`}
                aria-label="Vista lista"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className={`mt-2 grid gap-2 sm:grid-cols-4 ${showFilters ? 'block' : 'hidden sm:grid'}`}>
          <select value={muni} onChange={(e) => setMuni(e.target.value)} className="input">
            <option value="">Todos los estados</option>
            {MUNICIPALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
            <option value="">Todas las categorías</option>
            {CATEGORIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="input">
            <option value="recent">Más recientes</option>
            <option value="rating">Mejor calificados</option>
            <option value="name">Nombre A-Z</option>
            <option value="open">Abiertos ahora</option>
          </select>
          <button onClick={clearFilters} className="btn-outline text-sm">
            <X className="h-4 w-4" /> Limpiar
          </button>
        </div>

        {smartCategories.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-400">Búsqueda inteligente:</span>
            {smartCategories.map((c) => (
              <span key={c} className="chip bg-blue-50 text-xs text-blue-700">{c}</span>
            ))}
          </div>
        )}
      </div>

      {/* Category chips */}
      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setCategory('')}
          className={`chip whitespace-nowrap ${!category ? 'bg-[#0D47A1] text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
        >
          Todas
        </button>
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.name}
              onClick={() => setCategory(c.name)}
              className={`chip whitespace-nowrap ${category === c.name ? 'bg-[#0D47A1] text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
            >
              <Icon className="h-3.5 w-3.5" /> {c.name}
            </button>
          );
        })}
      </div>

      {/* Grid / List */}
      <div className="mt-5">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-slate-300" />
          </div>
        ) : displayed.length === 0 ? (
          <EmptyState
            title="No se encontraron negocios"
            message="Prueba con otros términos de búsqueda o cambia los filtros."
            action={
              hasFilters ? <button onClick={clearFilters} className="btn-outline mt-1 text-xs">Limpiar filtros</button> : undefined
            }
          />
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayed.map((b) => (
              <BusinessCard key={b.id} business={b} onOpen={onOpenBusiness} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {displayed.map((b) => {
              const Icon = categoryIcon(b.category);
              const openInfo = isOpenNow(b.hours);
              return (
                <div key={b.id} className="card flex items-center gap-3 p-3">
                  <button onClick={() => onOpenBusiness(b)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    {b.imageUrl ? (
                      <img src={b.imageUrl} alt={b.name} loading="lazy" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                        <Icon className="h-7 w-7 text-slate-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold text-slate-800">{b.name}</p>
                        {b.verified && <span className="shrink-0 text-xs text-[#1565C0]">✓</span>}
                      </div>
                      <p className="truncate text-xs text-slate-500">{b.category} · {b.municipality}</p>
                      <div className="mt-1 flex items-center gap-2">
                        {b.rating > 0 && <span className="text-xs font-medium text-amber-500">★ {b.rating}</span>}
                        <span className={`text-xs font-medium ${openInfo.open ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {openInfo.label}
                        </span>
                      </div>
                    </div>
                  </button>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => toggleFavorite(b.id)} className="rounded-lg p-2 text-slate-300 hover:bg-rose-50 hover:text-rose-500" aria-label="Favorito">
                      <Heart className={`h-4 w-4 ${favorites.has(b.id) ? 'fill-rose-500 text-rose-500' : ''}`} />
                    </button>
                    <button onClick={() => shareBusiness(b)} className="rounded-lg p-2 text-slate-300 hover:bg-blue-50 hover:text-[#1565C0]" aria-label="Compartir">
                      <Share2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => copyLink(b)} className="rounded-lg p-2 text-slate-300 hover:bg-slate-100 hover:text-slate-600" aria-label="Copiar enlace">
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && displayed.length > 0 && displayed.length < total && (
          <div className="mt-6 flex justify-center">
            <button onClick={loadMore} disabled={loadingMore} className="btn-outline px-6">
              {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loadingMore ? 'Cargando...' : `Ver más (${total - displayed.length} restantes)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
