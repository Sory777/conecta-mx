import { Store, Briefcase, QrCode, TrendingUp, Building2, Sparkles, ArrowRight, MapPin, Calendar } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Business, Event } from '../lib/types';
import { CATEGORIES, MUNICIPALITIES, APP_NAME, APP_TAGLINE } from '../lib/constants';
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
      gradient: 'from-[#0D47A1] to-[#1565C0]',
      glow: 'shadow-[#1565C0]/40',
      route: 'directory' as const,
      desc: 'Encuentra negocios cerca de ti',
    },
    {
      icon: Building2,
      label: 'Estados',
      value: stats.states,
      gradient: 'from-emerald-600 to-teal-600',
      glow: 'shadow-emerald-500/40',
      route: 'munis' as const,
      desc: 'Filtra por tu estado',
    },
    {
      icon: Briefcase,
      label: 'Bolsa de Empleo',
      value: stats.jobs,
      gradient: 'from-amber-500 to-orange-600',
      glow: 'shadow-amber-500/40',
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
      <section className="relative overflow-hidden mng-gradient text-white">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, #fff 1px, transparent 1px), radial-gradient(circle at 80% 70%, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative mx-auto max-w-5xl px-4 py-12 sm:py-16 text-center">
          <div className="flex justify-center">
            <Logo size={88} />
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{APP_NAME}</h1>
          <p className="mt-1 text-sm font-medium text-white/70 sm:text-base">{APP_TAGLINE}</p>
          <p className="mt-2 text-base text-white/85 sm:text-lg">La plataforma que ayuda a los negocios de México a conseguir más clientes</p>

          {/* 3D Stat Cards */}
          <div className="mx-auto mt-8 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
            {heroCards.map((card) => (
              <button
                key={card.label}
                onClick={() => handleCardClick(card.route)}
                className="group relative"
                style={{ perspective: '1000px' }}
              >
                <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.gradient} p-5 text-left text-white transition-all duration-300 group-hover:-translate-y-2 ${card.glow} shadow-[0_8px_30px_rgba(0,0,0,0.3)] group-hover:shadow-[0_16px_40px_rgba(0,0,0,0.4)]`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30" />
                  <div className="relative flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
                      <card.icon className="h-6 w-6" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-white/60 transition-all duration-300 group-hover:translate-x-1 group-hover:text-white" />
                  </div>
                  <div className="relative mt-4">
                    <span className="text-4xl font-extrabold tracking-tight drop-shadow-sm">{card.value}</span>
                    <p className="mt-0.5 text-sm font-bold uppercase tracking-wide text-white/90">{card.label}</p>
                    <p className="mt-1 text-xs text-white/70">{card.desc}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Quick actions */}
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            <button onClick={() => onNavigate('register')} className="btn bg-white/15 text-white backdrop-blur hover:bg-white/25">
              <Store className="h-4 w-4" /> Registrar Negocio
            </button>
            <button onClick={() => onNavigate('jobs')} className="btn bg-white/15 text-white backdrop-blur hover:bg-white/25">
              <Briefcase className="h-4 w-4" /> Bolsa de Empleo
            </button>
            <button onClick={() => onNavigate('qr')} className="btn bg-white/15 text-white backdrop-blur hover:bg-white/25">
              <QrCode className="h-4 w-4" /> Código QR
            </button>
          </div>
        </div>
      </section>

      {/* Sponsor banner */}
      <section className="mx-auto max-w-5xl px-4 mt-8">
        <div className="flex items-center justify-between rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-sm font-semibold text-slate-700">Espacio para patrocinador</p>
              <p className="text-xs text-slate-500">Tu anuncio aquí · contacto@conectamx.app</p>
            </div>
          </div>
          <button onClick={() => onNavigate('plans')} className="btn-ghost text-xs">Ver planes</button>
        </div>
      </section>

      {/* Featured carousel */}
      <section className="mx-auto max-w-5xl px-4 mt-8">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Negocios destacados</h2>
            <p className="text-sm text-slate-500">Los mejor calificados del país</p>
          </div>
          <button onClick={() => onNavigate('directory')} className="btn-ghost text-sm">
            Ver todos <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <FeaturedCarousel businesses={featured} onOpen={onOpenBusiness} />
      </section>

      {/* Events 3D carousel */}
      <section className="mx-auto max-w-5xl px-4 mt-8">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Próximos eventos</h2>
            <p className="text-sm text-slate-500">Eventos en los estados de México</p>
          </div>
          <button onClick={() => onNavigate('events')} className="btn-ghost text-sm">
            Ver todos <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        {events.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <Calendar className="mx-auto h-7 w-7 text-slate-300" />
            <p className="mt-2 text-sm text-slate-500">Aún no hay eventos publicados.</p>
          </div>
        ) : (
          <EventsCarousel events={events.slice(0, 8)} />
        )}
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-5xl px-4 pb-12">
        <h2 className="mb-4 text-xl font-bold text-slate-800">Explora por categoría</h2>
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 lg:grid-cols-10">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.name}
                onClick={() => onNavigate('directory', { category: cat.name })}
                className="card flex flex-col items-center gap-1 p-3 transition-all hover:-translate-y-0.5 hover:border-[#1565C0] hover:shadow-md"
              >
                <Icon className="h-6 w-6 text-[#1565C0]" />
                <span className="text-center text-[11px] font-medium leading-tight text-slate-600">{cat.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 pb-16">
        <div className="mng-gradient-soft relative overflow-hidden rounded-3xl px-6 py-10 text-center text-white sm:px-10">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 20%, #fff 2px, transparent 2px)', backgroundSize: '50px 50px' }} />
          <div className="relative">
            <TrendingUp className="mx-auto h-8 w-8" />
            <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">¿Tienes un negocio en México?</h2>
            <p className="mx-auto mt-2 max-w-xl text-white/85">Regístralo gratis y empieza a conseguir más clientes. Mide cuántas personas te buscan, cuántos te contactan por WhatsApp y cuántos comparten tu negocio.</p>
            <button onClick={() => onNavigate('register')} className="mt-5 btn bg-white text-[#0D47A1] hover:-translate-y-0.5 hover:shadow-lg">
              <Store className="h-4 w-4" /> Empezar gratis
            </button>
          </div>
        </div>
      </section>

      {/* Locations modal */}
      <Modal open={showMunis} onClose={() => setShowMunis(false)} title="Estados y ubicaciones con negocios" maxWidth="max-w-lg">
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {locationCounts.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Aún no hay negocios registrados. ¡Sé el primero!</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-slate-500">Toca una ubicación para ver los negocios registrados ahí.</p>
              <div className="space-y-1.5">
                {locationCounts.map(({ name, count }) => (
                  <button
                    key={name}
                    onClick={() => { setShowMunis(false); onNavigate('directory', { m: name }); }}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-100 px-4 py-3 text-left transition-all hover:bg-slate-50"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <MapPin className="h-4 w-4 text-[#1565C0]" /> {name}
                    </span>
                    <span className="chip bg-slate-100 text-xs text-slate-600">
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
