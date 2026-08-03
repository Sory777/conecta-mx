import { useEffect, useState, useMemo } from 'react';
import {
  Eye, MessageCircle, Share2, MapPin, Phone, Mail, Globe, Heart, Star,
  TrendingUp, BarChart3, AlertCircle, Lightbulb, Clock, Award, RefreshCw,
  Package, Calendar, Users, Camera
} from 'lucide-react';
import type { Business, Product, AnalyticsEventType } from '../lib/types';
import { storage } from '../lib/storage';
import { useToast } from '../components/Toast';
import { PLAN_LABELS } from '../lib/constants';

interface DashboardPageProps {
  business: Business;
  onNavigate: (route: string, params?: Record<string, string>) => void;
  onRefresh: () => Promise<void>;
}

export function DashboardPage({ business, onNavigate, onRefresh }: DashboardPageProps) {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, number>>({});
  const [uniqueVisitors, setUniqueVisitors] = useState(0);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [prods, anlyt, uniq] = await Promise.all([
          storage.getProductsByBusiness(business.id),
          storage.getAnalyticsByBusiness(business.id),
          storage.getUniqueVisitors(business.id),
        ]);
        if (!active) return;
        setProducts(prods);
        setAnalytics(anlyt);
        setUniqueVisitors(uniq);
        setLoading(false);
      } catch {
        if (!active) return;
        setError(true);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [business.id]);

  const conectaIndex = useMemo(() => {
    let score = 0;
    if (business.imageUrl) score += 10;
    if (business.description && business.description.length > 50) score += 10;
    if (business.hours) score += 10;
    if (business.address) score += 10;
    if (business.coords) score += 5;
    if (business.facebook || business.instagram) score += 10;
    if (business.verified) score += 15;
    if (business.rating > 0) score += Math.round(business.rating * 3);
    if (products.length > 0) score += Math.min(products.length * 5, 20);
    return Math.min(score, 100);
  }, [business, products]);

  const recommendations = useMemo(() => {
    const recs: { icon: typeof Lightbulb; text: string; priority: number }[] = [];
    if (products.length === 0) {
      recs.push({ icon: Package, text: 'Aún no tienes publicaciones. Crea tu primera publicación para empezar a recibir clientes.', priority: 1 });
    }
    if (!business.hours) {
      recs.push({ icon: Clock, text: 'Agrega tu horario para que los clientes sepan cuándo estás abierto.', priority: 2 });
    }
    if (!business.imageUrl) {
      recs.push({ icon: Camera, text: 'Sube una foto de tu negocio. Los perfiles con foto reciben 40% más de clics.', priority: 3 });
    }
    if (products.length > 0 && products.every((p) => !p.imageUrl)) {
      recs.push({ icon: Package, text: 'Tus publicaciones no tienen fotos. Agregar fotos puede aumentar la visibilidad significativamente.', priority: 4 });
    }
    if (!business.address && !business.coords) {
      recs.push({ icon: MapPin, text: 'Agrega tu dirección o ubicación para que los clientes puedan llegar a tu negocio.', priority: 5 });
    }
    const recentProduct = products[0];
    if (recentProduct) {
      const daysSince = Math.floor((Date.now() - recentProduct.createdAt) / 86400000);
      if (daysSince > 14) {
        recs.push({ icon: Calendar, text: `Hace ${daysSince} días que no publicas algo nuevo. Publicar con frecuencia mantiene tu negocio visible.`, priority: 6 });
      }
    }
    const productsWithPrice = products.filter((p) => p.price > 0);
    if (productsWithPrice.length < products.length / 2 && products.length > 0) {
      recs.push({ icon: TrendingUp, text: 'Tus publicaciones con precio reciben más clics. Agrega precio a todas tus publicaciones.', priority: 7 });
    }
    return recs.sort((a, b) => a.priority - b.priority);
  }, [business, products]);

  const topProducts = useMemo(() => {
    return [...products].sort((a, b) => b.views - a.views).slice(0, 5);
  }, [products]);

  const expiredCount = useMemo(() => {
    const now = Date.now();
    return products.filter((p) => p.expiresAt && p.expiresAt < now).length;
  }, [products]);

  const expiringCount = useMemo(() => {
    const now = Date.now();
    const week = 7 * 86400000;
    return products.filter((p) => p.expiresAt && p.expiresAt > now && p.expiresAt < now + week).length;
  }, [products]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <RefreshCw className="mx-auto h-8 w-8 animate-spin text-slate-300" />
        <p className="mt-3 text-sm text-slate-500">Cargando tus estadísticas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-rose-400" />
        <p className="mt-3 text-sm text-slate-500">No se pudieron cargar tus estadísticas.</p>
        <button onClick={() => window.location.reload()} className="btn-outline mt-4 text-sm">Reintentar</button>
      </div>
    );
  }

  const metricCards = [
    { icon: Eye, label: 'Vistas totales', value: analytics['view'] || 0, color: 'text-blue-600', bg: 'bg-blue-50' },
    { icon: Users, label: 'Usuarios únicos', value: uniqueVisitors, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { icon: MessageCircle, label: 'Clics WhatsApp', value: analytics['whatsapp_click'] || 0, color: 'text-green-600', bg: 'bg-green-50' },
    { icon: MapPin, label: 'Cómo llegar', value: analytics['directions_click'] || 0, color: 'text-orange-600', bg: 'bg-orange-50' },
    { icon: Share2, label: 'Compartidos', value: analytics['share'] || 0, color: 'text-purple-600', bg: 'bg-purple-50' },
    { icon: Heart, label: 'Favoritos', value: analytics['favorite'] || 0, color: 'text-rose-600', bg: 'bg-rose-50' },
    { icon: Phone, label: 'Clics llamar', value: analytics['call_click'] || 0, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { icon: Star, label: 'Reseñas nuevas', value: analytics['review'] || 0, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Mi Panel</h1>
          <p className="text-sm text-slate-500">{business.name} · Plan {PLAN_LABELS[business.plan]}</p>
        </div>
        <button onClick={() => onNavigate('business', { id: business.id })} className="btn-outline text-sm">
          <Eye className="h-4 w-4" /> Ver mi perfil público
        </button>
      </div>

      {/* Conecta Index */}
      <div className="mb-5 card overflow-hidden">
        <div className="flex items-center justify-between bg-gradient-to-r from-[#0D47A1] to-[#1565C0] px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <Award className="h-8 w-8" />
            <div>
              <p className="text-sm font-medium text-white/80">Índice Conecta</p>
              <p className="text-3xl font-extrabold">{conectaIndex}<span className="text-lg text-white/60">/100</span></p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/70">
              {conectaIndex >= 80 ? 'Excelente' : conectaIndex >= 60 ? 'Bien' : conectaIndex >= 40 ? 'Regular' : 'Necesita mejorar'}
            </p>
            <div className="mt-1 h-2 w-24 overflow-hidden rounded-full bg-white/20">
              <div className="h-full bg-white transition-all" style={{ width: `${conectaIndex}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metricCards.map((m) => (
          <div key={m.label} className="card p-3">
            <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${m.bg}`}>
              <m.icon className={`h-4 w-4 ${m.color}`} />
            </div>
            <p className="text-2xl font-extrabold text-slate-800">{m.value}</p>
            <p className="text-xs font-medium text-slate-500">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Publications summary */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <Package className="h-5 w-5 text-[#1565C0]" />
          <p className="mt-2 text-2xl font-extrabold text-slate-800">{products.length}</p>
          <p className="text-xs text-slate-500">Publicaciones totales</p>
        </div>
        <div className="card p-4">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          <p className="mt-2 text-2xl font-extrabold text-slate-800">{expiringCount}</p>
          <p className="text-xs text-slate-500">Próximas a vencer</p>
        </div>
        <div className="card p-4">
          <Clock className="h-5 w-5 text-slate-400" />
          <p className="mt-2 text-2xl font-extrabold text-slate-800">{expiredCount}</p>
          <p className="text-xs text-slate-500">Expiradas</p>
        </div>
      </div>

      {/* Top products */}
      {topProducts.length > 0 && (
        <div className="mb-5 card p-4">
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#1565C0]" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Publicaciones más vistas</h2>
          </div>
          <div className="space-y-2">
            {topProducts.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{i + 1}</span>
                {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="h-10 w-10 rounded-lg object-cover" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.views} vistas · {p.whatsappClicks} clics WhatsApp</p>
                </div>
                {p.price > 0 && <span className="text-sm font-bold text-emerald-600">${p.price}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="mb-5 card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Recomendaciones para mejorar</h2>
          </div>
          <div className="space-y-2">
            {recommendations.map((r, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-xl bg-amber-50 p-3">
                <r.icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-sm text-amber-900">{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => onNavigate('business', { id: business.id })} className="btn-outline text-sm">
          <Package className="h-4 w-4" /> Gestionar publicaciones
        </button>
        <button onClick={() => onNavigate('plans')} className="btn-outline text-sm">
          <TrendingUp className="h-4 w-4" /> Mejorar mi plan
        </button>
      </div>
    </div>
  );
}
