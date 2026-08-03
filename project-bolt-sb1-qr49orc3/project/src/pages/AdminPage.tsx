import { useMemo, useState, useEffect } from 'react';
import { Shield, Trash2, BadgeCheck, Search, BarChart3, QrCode, FileText, Mail, Phone, MapPin, Lock, AlertCircle, Flag, Package, Clock, HardDrive, Map } from 'lucide-react';
import type { Business, Plan, CV, Report } from '../lib/types';
import { storage } from '../lib/storage';
import { MUNICIPALITIES, CATEGORIES, PLAN_LABELS, categoryIcon } from '../lib/constants';
import { useToast } from '../components/Toast';
import { StarRating } from '../components/StarRating';
import { Modal } from '../components/Modal';
import { QRBox } from '../components/QRBox';
import { useAuth } from '../lib/auth';

interface AdminPageProps {
  businesses: Business[];
  onChange: () => void;
}

export function AdminPage({ businesses, onChange }: AdminPageProps) {
  const { toast } = useToast();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [query, setQuery] = useState('');
  const [muni, setMuni] = useState('');
  const [category, setCategory] = useState('');
  const [plan, setPlan] = useState('');
  const [qrBusiness, setQrBusiness] = useState<Business | null>(null);
  const [tab, setTab] = useState<'businesses' | 'cvs' | 'reports' | 'health'>('businesses');
  const [cvs, setCvs] = useState<CV[]>([]);
  const [cvFilter, setCvFilter] = useState('');
  const [reports, setReports] = useState<Report[]>([]);
  const [productCount, setProductCount] = useState(0);

  useEffect(() => {
    if (tab === 'cvs') {
      storage.getCVs().then(setCvs).catch(() => {});
    } else if (tab === 'reports') {
      storage.getReports().then(setReports).catch(() => {});
    }
  }, [tab]);

  useEffect(() => {
    storage.getProducts().then((p) => setProductCount(p.length)).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    let list = businesses.slice();
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      list = list.filter((b) => b.name.toLowerCase().includes(q) || b.city.toLowerCase().includes(q));
    }
    if (muni) list = list.filter((b) => b.municipality === muni);
    if (category) list = list.filter((b) => b.category === category);
    if (plan) list = list.filter((b) => b.plan === plan);
    list.sort((a, b) => b.createdAt - a.createdAt);
    return list;
  }, [businesses, query, muni, category, plan]);

  const stats = useMemo(() => {
    const byPlan = { free: 0, featured: 0, premium: 0 };
    const byMuni: Record<string, number> = {};
    const today = new Date().setHours(0, 0, 0, 0);
    let newToday = 0;
    let pendingValidation = 0;
    businesses.forEach((b) => {
      byPlan[b.plan as keyof typeof byPlan]++;
      byMuni[b.municipality] = (byMuni[b.municipality] || 0) + 1;
      if (b.createdAt > today) newToday++;
      if (!b.verified) pendingValidation++;
    });
    const topMunis = Object.entries(byMuni).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { byPlan, topMunis, total: businesses.length, newToday, pendingValidation };
  }, [businesses]);

  const pendingReports = reports.filter((r) => r.status === 'pending').length;

  if (authLoading) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#1565C0]" />
        <p className="mt-3 text-sm text-slate-500">Verificando permisos...</p>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4">
        <div className="w-full card p-6">
          <div className="mb-5 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Lock className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-800">Acceso restringido</h1>
            <p className="mt-1 text-sm text-slate-500">Esta área es solo para administradores autorizados.</p>
          </div>
          <p className="text-center text-xs text-slate-400">
            Necesitas iniciar sesión con una cuenta de administrador para acceder.
          </p>
        </div>
      </div>
    );
  }

  const toggleVerified = async (id: string) => {
    const list = await storage.getBusinesses();
    const idx = list.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const updated = !list[idx].verified;
    await storage.updateBusiness(id, { verified: updated });
    onChange();
    toast(updated ? 'Negocio verificado' : 'Verificación removida', 'success');
  };

  const changePlan = async (id: string, newPlan: Plan) => {
    const updates: Partial<Business> = { plan: newPlan };
    if (newPlan !== 'free') updates.verified = true;
    await storage.updateBusiness(id, updates);
    onChange();
    toast(`Plan cambiado a ${PLAN_LABELS[newPlan]}`, 'success');
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) return;
    await storage.deleteBusiness(id);
    onChange();
    toast('Negocio eliminado', 'info');
  };

  const deleteCV = async (id: string) => {
    await storage.deleteCV(id);
    setCvs((s) => s.filter((c) => c.id !== id));
    toast('Currículum eliminado', 'info');
  };

  const resolveReport = async (id: string, status: 'resolved' | 'dismissed') => {
    await storage.updateReportStatus(id, status);
    setReports((s) => s.map((r) => r.id === id ? { ...r, status } : r));
    toast(status === 'resolved' ? 'Reporte resuelto' : 'Reporte descartado', 'success');
  };

  const filteredCVs = useMemo(() => {
    if (!cvFilter.trim()) return cvs;
    const q = cvFilter.toLowerCase();
    return cvs.filter((c) => c.fullName.toLowerCase().includes(q) || c.position.toLowerCase().includes(q) || (c.companyName || '').toLowerCase().includes(q));
  }, [cvs, cvFilter]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5 flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl mng-gradient text-white">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Panel de administración</h1>
          <p className="text-sm text-slate-500">Gestiona negocios, reportes y monitoreo del sistema</p>
        </div>
      </div>

      {/* Alerts */}
      {(stats.pendingValidation > 0 || pendingReports > 0) && (
        <div className="mb-5 flex flex-wrap gap-2">
          {stats.pendingValidation > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <AlertCircle className="h-4 w-4" /> {stats.pendingValidation} negocios esperando validación
            </div>
          )}
          {pendingReports > 0 && (
            <button onClick={() => setTab('reports')} className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 hover:bg-rose-100">
              <Flag className="h-4 w-4" /> {pendingReports} reportes pendientes
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto">
        <button onClick={() => setTab('businesses')} className={`btn shrink-0 text-sm ${tab === 'businesses' ? 'btn-primary' : 'btn-outline'}`}>
          <Shield className="h-4 w-4" /> Negocios
        </button>
        <button onClick={() => setTab('cvs')} className={`btn shrink-0 text-sm ${tab === 'cvs' ? 'btn-primary' : 'btn-outline'}`}>
          <FileText className="h-4 w-4" /> Currículums {cvs.length > 0 && `(${cvs.length})`}
        </button>
        <button onClick={() => setTab('reports')} className={`btn shrink-0 text-sm ${tab === 'reports' ? 'btn-primary' : 'btn-outline'}`}>
          <Flag className="h-4 w-4" /> Reportes {pendingReports > 0 && `(${pendingReports})`}
        </button>
        <button onClick={() => setTab('health')} className={`btn shrink-0 text-sm ${tab === 'health' ? 'btn-primary' : 'btn-outline'}`}>
          <HardDrive className="h-4 w-4" /> Salud del sistema
        </button>
      </div>

      {tab === 'businesses' && (
      <>
      {/* Stats */}
      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-500">Total negocios</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-800">{stats.total}</p>
          {stats.newToday > 0 && <p className="text-xs text-emerald-600">+{stats.newToday} hoy</p>}
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-500">Plan Gratis</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-600">{stats.byPlan.free}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-500">Destacados</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-600">{stats.byPlan.featured}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-500">Premium</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-600">{stats.byPlan.premium}</p>
        </div>
      </div>

      {/* Top municipalities */}
      <div className="card mb-5 p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <BarChart3 className="h-4 w-4 text-[#1565C0]" /> Top estados
        </div>
        <div className="mt-3 space-y-2">
          {stats.topMunis.map(([m, count]) => (
            <div key={m} className="flex items-center gap-2">
              <span className="w-32 truncate text-xs font-medium text-slate-600">{m}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full mng-gradient" style={{ width: `${(count / stats.total) * 100}%` }} />
              </div>
              <span className="w-6 text-right text-xs font-bold text-slate-700">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4 p-3">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar negocio..." className="input pl-9" />
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <select value={muni} onChange={(e) => setMuni(e.target.value)} className="input">
            <option value="">Todos los estados</option>
            {MUNICIPALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
            <option value="">Todas las categorías</option>
            {CATEGORIES.map((c) => { const Icon = c.icon; return <option key={c.name} value={c.name}>{c.name}</option>; })}
          </select>
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className="input">
            <option value="">Todos los planes</option>
            <option value="free">Gratis</option>
            <option value="featured">Destacado</option>
            <option value="premium">Premium</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Negocio</th>
                <th className="hidden px-3 py-2.5 font-semibold sm:table-cell">Estado</th>
                <th className="hidden px-3 py-2.5 font-semibold md:table-cell">Calificación</th>
                <th className="px-3 py-2.5 font-semibold">Verificado</th>
                <th className="px-3 py-2.5 font-semibold">Plan</th>
                <th className="px-3 py-2.5"></th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{(() => { const Icon = categoryIcon(b.category); return <Icon className="h-4 w-4 text-slate-500" />; })()}</span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800">{b.name}</p>
                        <p className="truncate text-xs text-slate-400">{b.category}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-3 py-2.5 text-slate-600 sm:table-cell">{b.municipality}</td>
                  <td className="hidden px-3 py-2.5 md:table-cell">
                    <StarRating value={b.rating} size={12} showNumber />
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => toggleVerified(b.id)}
                      className={`badge ${b.verified ? 'bg-[#1565C0] text-white' : 'bg-slate-100 text-slate-500'}`}
                    >
                      <BadgeCheck className="h-3.5 w-3.5" /> {b.verified ? 'Sí' : 'No'}
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      value={b.plan}
                      onChange={(e) => changePlan(b.id, e.target.value as Plan)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium"
                    >
                      <option value="free">Gratis</option>
                      <option value="featured">Destacado</option>
                      <option value="premium">Premium</option>
                    </select>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button onClick={() => setQrBusiness(b)} className="rounded-lg p-1.5 text-slate-300 hover:bg-[#1565C0] hover:text-white" aria-label="Generar QR" title="Generar QR del negocio">
                      <QrCode className="h-4 w-4" />
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button onClick={() => remove(b.id, b.name)} className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500" aria-label="Eliminar">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">No hay negocios que coincidan.</p>
        )}
      </div>
      {qrBusiness && (
        <Modal open={true} onClose={() => setQrBusiness(null)} title={`QR de ${qrBusiness.name}`}>
          <div className="flex flex-col items-center gap-4 py-2">
            <QRBox
              value={`${localStorage.getItem('cmx_public_url') || `${window.location.origin}${window.location.pathname}`}#/business/${qrBusiness.id}`}
              filename={`qr-${qrBusiness.name.replace(/\s+/g, '-').toLowerCase()}.png`}
              label={`${localStorage.getItem('cmx_public_url') || `${window.location.origin}${window.location.pathname}`}#/business/${qrBusiness.id}`}
              onDownload={() => {}}
            />
            <p className="text-center text-xs text-slate-500">
              Descarga el PNG, imprímelo y entrégaselo al negocio. Este QR es exclusivo del plan que vendes aparte.
            </p>
          </div>
        </Modal>
      )}
      </>
      )}

      {tab === 'cvs' && (
        <>
          <div className="card mb-4 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={cvFilter} onChange={(e) => setCvFilter(e.target.value)} placeholder="Buscar por nombre, puesto o empresa..." className="input pl-9" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredCVs.map((c) => (
              <div key={c.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">{c.fullName}</h3>
                    <p className="text-sm font-medium text-[#1565C0]">{c.position}</p>
                  </div>
                  <button onClick={() => deleteCV(c.id)} className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500" aria-label="Eliminar CV">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {c.companyName && (
                  <p className="mt-1 text-xs text-slate-500">Postuló a: <strong>{c.companyName}</strong></p>
                )}
                <div className="mt-2 space-y-1 text-xs text-slate-600">
                  <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-slate-400" /> {c.email}</p>
                  <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-slate-400" /> {c.phone}</p>
                  <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-slate-400" /> {c.municipality}</p>
                </div>
                {c.experience && (
                  <p className="mt-2 text-xs text-slate-600"><span className="font-semibold">Experiencia:</span> {c.experience}</p>
                )}
                {c.education && (
                  <p className="mt-1 text-xs text-slate-600"><span className="font-semibold">Educación:</span> {c.education}</p>
                )}
                {c.skills && (
                  <p className="mt-1 text-xs text-slate-600"><span className="font-semibold">Habilidades:</span> {c.skills}</p>
                )}
                <div className="mt-3 flex gap-2 border-t border-slate-100 pt-2">
                  <a href={`mailto:${c.email}?subject=${encodeURIComponent(`Tu currículum para ${c.position}`)}`} className="btn-outline flex-1 px-3 py-2 text-xs">
                    <Mail className="h-3.5 w-3.5" /> Contactar
                  </a>
                  <a href={`https://wa.me/52${c.phone}?text=${encodeURIComponent(`Hola ${c.fullName}, vimos tu currículum en Conecta MX...`)}`} target="_blank" rel="noopener noreferrer" className="btn-wa flex-1 px-3 py-2 text-xs">
                    <Phone className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                </div>
              </div>
            ))}
          </div>
          {filteredCVs.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-400">No hay currículums todavía.</p>
          )}
        </>
      )}

      {tab === 'reports' && (
        <>
          <div className="mb-3">
            <p className="text-sm text-slate-500">Reportes enviados por usuarios. Resuelve o descarta según corresponda.</p>
          </div>
          {reports.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No hay reportes.</p>
          ) : (
            <div className="space-y-3">
              {reports.map((r) => (
                <div key={r.id} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`badge ${r.status === 'pending' ? 'bg-rose-100 text-rose-700' : r.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {r.status === 'pending' ? 'Pendiente' : r.status === 'resolved' ? 'Resuelto' : 'Descartado'}
                        </span>
                        <span className="text-xs text-slate-500">{r.item_type}</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-700">{r.reason}</p>
                      {r.details && <p className="mt-1 text-xs text-slate-500">{r.details}</p>}
                      <p className="mt-1 text-xs text-slate-400">{new Date(r.created_at).toLocaleString('es-MX')}</p>
                    </div>
                    {r.status === 'pending' && (
                      <div className="flex gap-1.5">
                        <button onClick={() => resolveReport(r.id, 'resolved')} className="btn-outline px-3 py-1.5 text-xs text-emerald-600">
                          Resolver
                        </button>
                        <button onClick={() => resolveReport(r.id, 'dismissed')} className="btn-outline px-3 py-1.5 text-xs text-slate-500">
                          Descartar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'health' && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-4">
              <Package className="h-5 w-5 text-[#1565C0]" />
              <p className="mt-2 text-2xl font-extrabold text-slate-800">{stats.total}</p>
              <p className="text-xs text-slate-500">Negocios registrados</p>
            </div>
            <div className="card p-4">
              <Package className="h-5 w-5 text-emerald-600" />
              <p className="mt-2 text-2xl font-extrabold text-slate-800">{productCount}</p>
              <p className="text-xs text-slate-500">Publicaciones</p>
            </div>
            <div className="card p-4">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <p className="mt-2 text-2xl font-extrabold text-slate-800">{stats.pendingValidation}</p>
              <p className="text-xs text-slate-500">Pendientes de validar</p>
            </div>
            <div className="card p-4">
              <Flag className="h-5 w-5 text-rose-500" />
              <p className="mt-2 text-2xl font-extrabold text-slate-800">{pendingReports}</p>
              <p className="text-xs text-slate-500">Reportes pendientes</p>
            </div>
          </div>

          <div className="mt-5 card p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <Map className="h-4 w-4 text-[#1565C0]" /> Estados más activos
            </div>
            <div className="mt-3 space-y-2">
              {stats.topMunis.map(([m, count]) => (
                <div key={m} className="flex items-center gap-2">
                  <span className="w-32 truncate text-xs font-medium text-slate-600">{m}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full mng-gradient" style={{ width: `${(count / stats.total) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right text-xs font-bold text-slate-700">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 card p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <Clock className="h-4 w-4 text-[#1565C0]" /> Negocios nuevos hoy
            </div>
            <p className="mt-2 text-3xl font-extrabold text-emerald-600">+{stats.newToday}</p>
            <p className="text-xs text-slate-500">negocios registrados en las últimas 24 horas</p>
          </div>
        </>
      )}
    </div>
  );
}
