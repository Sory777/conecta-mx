import { Store, Briefcase, QrCode, TrendingUp, Building2, Sparkles, ArrowRight, MapPin, Calendar } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Business, Event } from '../lib/types';
import { CATEGORIES, APP_NAME, APP_TAGLINE } from '../lib/constants';
import { FeaturedCarousel } from '../components/FeaturedCarousel';
import { EventsCarousel } from '../components/EventsCarousel';
import { Logo } from '../components/Logo';
import { Modal } from '../components/Modal';

interface HomePageProps {
  businesses: Business[];
  jobsCount: number;
  events: Event[];
  onOpenBusiness: (b: Business) => void;
  onNavigate: (route: string, params?: Record<string, string>) => void;
}

export function HomePage({ businesses, jobsCount, events, onOpenBusiness, onNavigate }: HomePageProps) {
  const [showMunis, setShowMunis] = useState(false);

  const featured = useMemo(() => {
    const premium = businesses.filter((b) => b.plan !== 'free');
    const sorted = [...(premium.length ? premium : businesses)].sort((a, b) => b.rating - a.rating);
    return sorted.slice(0, 6);
  }, [businesses]);

  const stats = useMemo(() => {
    const states = new Set(businesses.map((b) => b.municipality));
    return {
      total: businesses.length,
      states: states.size,
      jobs: jobsCount,
    };
  }, [businesses, jobsCount]);

  const locationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    businesses.forEach((b) => {
      counts[b.municipality] = (counts[b.municipality] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [businesses]);

  const heroCards = [
    {
      icon: Store,
      label: 'Negocios Registrados',
      value: stats.total,
      route: 'directory' as const,
      desc: 'Encuentra negocios cerca de ti',
    },
    {
      icon: Building2,
      label: 'Estados',
      value: stats.states,
      route: 'munis' as const,
      desc: 'Filtra por tu estado',
    },
    {
      icon: Briefcase,
      label: 'Bolsa de Empleo',
      value: stats.jobs,
      route: 'jobs' as const,
      desc: 'Mide cuántos clientes te trae',
    },
  ];

  const handleCardClick = (route: string) => {
    if (route === 'munis') {
      setShowMunis(true);
    } else {
      onNavigate(route);
    }
  };

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden mng-gradient text-ink-invert">
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, #fff 1px, transparent 1px), radial-gradient(circle at 80% 70%, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative mx-auto max-w-5xl px-4 py-14 sm:py-20 text-center">
          <div className="flex justify-center">
            <Logo size={80} />
          </div>
          <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-5xl">{APP_NAME}</h1>
          <p className="mt-2 text-sm font-medium uppercase tracking-[0.2em] text-gold sm:text-base">{APP_TAGLINE}</p>
          <p className="mx-auto mt-3 max-w-xl text-base text-ink-invert/70 sm:text-lg">La plataforma que ayuda a los negocios de México a conseguir más clientes</p>

          {/* Stat cards */}
          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
            {heroCards.map((card) => (
              <button
                key={card.label}
                onClick={() => handleCardClick(card.route)}
                className="group relative overflow-hidden rounded border border-white/15 bg-white/[0.04] p-5 text-left backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-gold/50 hover:bg-white/[0.07]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded border border-gold/30 text-gold transition-colors group-hover:bg-gold group-hover:text-on-gold">
                    <card.icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-ink-invert/40 transition-all duration-300 group-hover:translate-x-1 group-hover:text-gold" />
                </div>
                <div className="mt-4">
                  <span className="font-serif text-4xl font-bold tracking-tight text-ink-invert">{card.value}</span>
                  <p className="mt-1 text-xs font-bold uppercase tracking-wide text-gold">{card.label}</p>
                  <p className="mt-1 text-xs text-ink-invert/60">{card.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Quick actions */}
          <div className="mt-8 flex flex-wrap justify-center gap-2.5">
            <button onClick={() => onNavigate('register')} className="btn border border-white/20 bg-white/[0.06] text-ink-invert hover:border-gold/50 hover:bg-white/[0.1]">
              <Store className="h-4 w-4" /> Registrar Negocio
            </button>
            <button onClick={() => onNavigate('jobs')} className="btn border border-white/20 bg-white/[0.06] text-ink-invert hover:border-gold/50 hover:bg-white/[0.1]">
              <Briefcase className="h-4 w-4" /> Bolsa de Empleo
            </button>
            <button onClick={() => onNavigate('qr')} className="btn border border-white/20 bg-white/[0.06] text-ink-invert hover:border-gold/50 hover:bg-white/[0.1]">
              <QrCode className="h-4 w-4" /> Código QR
            </button>
          </div>
        </div>
      </section>

      {/* Sponsor banner */}
      <section className="mx-auto max-w-5xl px-4 mt-8">
        <div className="flex items-center justify-between rounded border border-dashed border-line bg-surface-soft px-5 py-4">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-gold" />
            <div>
              <p className="text-sm font-semibold">Espacio para patrocinador</p>
              <p className="text-xs text-muted">Tu anuncio aquí · contacto@conectamx.app</p>
            </div>
          </div>
          <button onClick={() => onNavigate('plans')} className="btn-ghost text-xs">Ver planes</button>
        </div>
      </section>

      {/* Featured carousel */}
      <section className="mx-auto max-w-5xl px-4 mt-10">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold">Negocios destacados</h2>
            <p className="text-sm text-muted">Los mejor calificados del país</p>
          </div>
          <button onClick={() => onNavigate('directory')} className="btn-ghost text-sm">
            Ver todos <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <FeaturedCarousel businesses={featured} onOpen={onOpenBusiness} />
      </section>

      {/* Events 3D carousel */}
      <section className="mx-auto max-w-5xl px-4 mt-10">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold">Próximos eventos</h2>
            <p className="text-sm text-muted">Eventos en los estados de México</p>
          </div>
          <button onClick={() => onNavigate('events')} className="btn-ghost text-sm">
            Ver todos <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        {events.length === 0 ? (
          <div className="rounded border-2 border-dashed border-line bg-surface-soft p-8 text-center">
            <Calendar className="mx-auto h-7 w-7 text-muted" />
            <p className="mt-2 text-sm text-muted">Aún no hay eventos publicados.</p>
          </div>
        ) : (
          <EventsCarousel events={events.slice(0, 8)} />
        )}
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-5xl px-4 pb-12 mt-10">
        <h2 className="mb-4 text-xl font-bold">Explora por categoría</h2>
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 lg:grid-cols-10">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.name}
                onClick={() => onNavigate('directory', { category: cat.name })}
                className="card flex flex-col items-center gap-1 p-3 transition-all hover:-translate-y-0.5 hover:border-gold"
              >
                <Icon className="h-6 w-6 text-gold" />
                <span className="text-center text-[11px] font-medium leading-tight text-muted">{cat.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 pb-16">
        <div className="mng-gradient-soft relative overflow-hidden rounded px-6 py-10 text-center text-ink-invert sm:px-10">
          <div className="relative">
            <TrendingUp className="mx-auto h-8 w-8 text-gold" />
            <h2 className="mt-3 text-2xl font-bold sm:text-3xl">¿Tienes un negocio en México?</h2>
            <p className="mx-auto mt-2 max-w-xl text-ink-invert/75">Regístralo gratis y empieza a conseguir más clientes. Mide cuántas personas te buscan, cuántos te contactan por WhatsApp y cuántos comparten tu negocio.</p>
            <button onClick={() => onNavigate('register')} className="btn-primary mt-5">
              <Store className="h-4 w-4" /> Empezar gratis
            </button>
          </div>
        </div>
      </section>

      {/* Locations modal */}
      <Modal open={showMunis} onClose={() => setShowMunis(false)} title="Estados y ubicaciones con negocios" maxWidth="max-w-lg">
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {locationCounts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Aún no hay negocios registrados. ¡Sé el primero!</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-muted">Toca una ubicación para ver los negocios registrados ahí.</p>
              <div className="space-y-1.5">
                {locationCounts.map(({ name, count }) => (
                  <button
                    key={name}
                    onClick={() => { setShowMunis(false); onNavigate('directory', { m: name }); }}
                    className="flex w-full items-center justify-between rounded border border-line px-4 py-3 text-left transition-all hover:border-gold"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <MapPin className="h-4 w-4 text-gold" /> {name}
                    </span>
                    <span className="chip text-xs">
                      {count} {count === 1 ? 'negocio' : 'negocios'}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
