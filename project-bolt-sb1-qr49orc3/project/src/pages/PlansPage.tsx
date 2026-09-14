import { Check, Crown, Star, Gift } from 'lucide-react';
import { PLAN_PRICES, FOUNDING_THRESHOLD } from '../lib/constants';

interface PlansPageProps {
  totalBusinesses: number;
}

export function PlansPage({ totalBusinesses }: PlansPageProps) {
  const foundingLeft = Math.max(0, FOUNDING_THRESHOLD - totalBusinesses);
  const plans = [
    {
      key: 'free',
      name: 'Gratis',
      price: PLAN_PRICES.free,
      icon: Gift,
      color: 'text-muted',
      features: [
        'Listado básico en el directorio',
        'Hasta 10 productos',
        'Botón de WhatsApp',
        'Link de Google Maps',
        'Reseñas de clientes',
      ],
    },
    {
      key: 'featured',
      name: 'Destacado',
      price: PLAN_PRICES.featured,
      icon: Star,
      color: 'text-gold',
      featured: true,
      features: [
        'Insignia de verificado',
        'Apareces en la sección destacados',
        'Hasta 50 productos',
        'Estadísticas básicas',
        'Prioridad en búsqueda',
      ],
    },
    {
      key: 'premium',
      name: 'Premium',
      price: PLAN_PRICES.premium,
      icon: Crown,
      color: 'text-emerald-600',
      features: [
        'Prioridad máxima en búsqueda',
        'Productos ilimitados',
        'Links a redes sociales',
        'Promociones destacadas',
        'Estadísticas completas',
        'Soporte prioritario',
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold text-ink dark:text-ink-invert">Planes y precios</h1>
        <p className="mt-1 text-sm text-muted">Elige el plan ideal para hacer crecer tu negocio</p>
      </div>

      {foundingLeft > 0 && (
        <div className="mb-6 flex items-center justify-center gap-2 rounded bg-gold-soft px-4 py-3 text-sm font-medium text-gold">
          <Gift className="h-5 w-5" />
          ¡Quedan {foundingLeft} lugares de Negocio Fundador! Regístrate ahora y obtén beneficios gratis para siempre.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.key}
            className={`card relative flex flex-col p-5 ${p.featured ? 'ring-2 ring-gold' : ''}`}
          >
            {p.featured && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold px-3 py-0.5 text-xs font-bold text-on-gold">
                Más popular
              </span>
            )}
            <div className={`mb-3 flex items-center gap-2 ${p.color}`}>
              <p.icon className="h-6 w-6" />
              <h2 className="text-lg font-bold text-ink dark:text-ink-invert">{p.name}</h2>
            </div>
            <p className="mb-4">
              <span className="text-3xl font-extrabold text-ink dark:text-ink-invert">${p.price}</span>
              <span className="text-sm text-muted">/mes</span>
            </p>
            <ul className="mb-5 flex-1 space-y-2">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-muted">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => { window.location.hash = `#/register?plan=${p.id}`; }}
              className={`btn w-full ${p.featured ? 'btn-primary' : 'btn-outline'}`}
            >
              Elegir {p.name}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded bg-surface-soft p-4 text-center text-sm text-muted">
        <p><strong>Negocio Fundador:</strong> Los primeros {FOUNDING_THRESHOLD} negocios registrados reciben el plan Destacado <strong>gratis para siempre</strong>.</p>
        <p className="mt-1 text-xs">Para cambiar tu plan, contacta a un administrador desde el panel de admin.</p>
      </div>
    </div>
  );
}
