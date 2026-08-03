import { useState, useEffect, type FormEvent } from 'react';
import {
  ArrowLeft, MapPin, Phone, Clock, BadgeCheck, Sparkles, Facebook, Instagram,
  Plus, MessageCircle, Star, Trash2, Briefcase,
} from 'lucide-react';
import type { Business, Product, Review, Job } from '../lib/types';
import { storage, uid, recomputeBusinessRatings } from '../lib/storage';
import type { AnalyticsEventType } from '../lib/types';
import { categoryIcon, PLAN_LABELS, PLAN_LIMITS, CONTRACT_TYPES, CATEGORIES } from '../lib/constants';
import { businessWaLink, isOpenNow, formatPhone, timeAgo, jobApplyLink, mapsDirectionsLink, mapsEmbedSrc } from '../lib/utils';
import { StarRating } from '../components/StarRating';
import { Modal } from '../components/Modal';
import { ProductCarousel } from '../components/ProductCarousel';
import { ImageUpload } from '../components/ImageUpload';
import { useToast } from '../components/Toast';
import { ReportButton } from '../components/ReportButton';

interface BusinessDetailPageProps {
  business: Business;
  onBack: () => void;
  onTrack: (key: 'whatsappClicks' | 'mapClicks' | 'qrDownloads') => void;
  onJobsChange?: () => void;
}

export function BusinessDetailPage({ business, onBack, onTrack, onJobsChange }: BusinessDetailPageProps) {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [businessJobs, setBusinessJobs] = useState<Job[]>([]);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showAddJob, setShowAddJob] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [prods, revs, businessJobsData] = await Promise.all([
          storage.getProductsByBusiness(business.id),
          storage.getReviewsByBusiness(business.id),
          storage.getJobsByBusiness(business.id),
        ]);
        if (!active) return;
        setProducts(prods);
        setReviews(revs);
        setBusinessJobs(businessJobsData);
        storage.trackEvent(business.id, null, 'view').catch(() => {});
      } catch (err) {
        console.error('Failed to load detail data:', err);
      }
    })();
    return () => { active = false; };
  }, [business.id]);

  const status = isOpenNow(business.hours);
  const productLimit = PLAN_LIMITS[business.plan];
  const canAddProduct = products.length < productLimit;

  const addProduct = async (p: Omit<Product, 'id' | 'businessId' | 'createdAt'>) => {
    const product: Product = {
      ...p, id: uid('prod'), businessId: business.id, createdAt: Date.now(),
      category: p.category || business.category, expiresAt: p.expiresAt,
      tags: p.tags || [], views: 0, whatsappClicks: 0, shares: 0, uniqueViews: 0,
    };
    await storage.addProduct(product);
    setProducts((s) => [...s, product]);
    setShowAddProduct(false);
    toast('Publicación agregada', 'success');
  };

  const deleteProduct = async (id: string) => {
    await storage.deleteProduct(id);
    setProducts((s) => s.filter((p) => p.id !== id));
    toast('Producto eliminado', 'info');
  };

  const addReview = async (author: string, rating: number, comment: string) => {
    const review: Review = { id: uid('rev'), businessId: business.id, author, rating, comment, createdAt: Date.now() };
    await storage.addReview(review);
    await recomputeBusinessRatings(business.id);
    setReviews((s) => [review, ...s]);
    setShowReview(false);
    toast('¡Gracias por tu reseña!', 'success');
  };

  const deleteReview = async (id: string) => {
    await storage.deleteReview(id);
    await recomputeBusinessRatings(business.id);
    setReviews((s) => s.filter((r) => r.id !== id));
    toast('Reseña eliminada', 'info');
  };

  const addJob = async (job: Omit<Job, 'id' | 'createdAt'>) => {
    const newJob: Job = { ...job, id: uid('job'), createdAt: Date.now() };
    await storage.addJob(newJob);
    setBusinessJobs((s) => [newJob, ...s]);
    setShowAddJob(false);
    if (onJobsChange) onJobsChange();
    toast('Vacante publicada en la Bolsa de Empleo', 'success');
  };

  const deleteJob = async (id: string) => {
    await storage.deleteJob(id);
    setBusinessJobs((s) => s.filter((j) => j.id !== id));
    if (onJobsChange) onJobsChange();
    toast('Vacante eliminada', 'info');
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-5">
      <button onClick={onBack} className="btn-ghost mb-4 -ml-2 text-sm">
        <ArrowLeft className="h-4 w-4" /> Volver
      </button>

      {/* Hero image */}
      <div className="relative overflow-hidden rounded-2xl">
        <img
          src={business.imageUrl || 'https://images.unsplash.com/photo-1441986300917-64674ad600d9?w=1000&q=80'}
          alt={business.name}
          className="h-48 w-full object-cover sm:h-64"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
          <div className="flex flex-wrap items-center gap-2">
            {business.verified && <span className="badge bg-[#1565C0] text-white"><BadgeCheck className="h-3.5 w-3.5" /> Verificado</span>}
            {business.founding && <span className="badge bg-amber-400 text-amber-900"><Sparkles className="h-3.5 w-3.5" /> Fundador</span>}
            <span className="badge bg-emerald-500 text-white">{PLAN_LABELS[business.plan]}</span>
          </div>
          <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">{business.name}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-white/90">
            <span className="chip bg-white/20 text-white inline-flex items-center gap-1">{(() => { const Icon = categoryIcon(business.category); return <Icon className="h-3.5 w-3.5" />; })()} {business.category}</span>
            <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {business.municipality}, {business.city}</span>
          </div>
        </div>
      </div>

      {/* Status + rating row */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`badge ${status.open ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-white'}`}>
            <Clock className="h-3.5 w-3.5" /> {status.label}
          </span>
          <StarRating value={business.rating} showNumber reviewCount={business.reviewCount} />
        </div>
        <div className="flex gap-2">
          <a
            href={businessWaLink(business)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => { onTrack('whatsappClicks'); storage.trackEvent(business.id, null, 'whatsapp_click').catch(() => {}); }}
            className="btn-wa px-4 py-2 text-sm"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        </div>
      </div>

      {business.hours && (
        <p className="mt-2 text-xs text-slate-500"><Clock className="mr-1 inline h-3.5 w-3.5" /> {business.hours}</p>
      )}

      {/* Description */}
      <div className="card mt-4 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Descripción</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{business.description}</p>
        {business.promotion && (
          <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-700">
            <Sparkles className="mr-1 inline h-4 w-4" /> {business.promotion}
          </div>
        )}
      </div>

      {/* Contact */}
      <div className="card mt-4 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Contacto</h2>
        <div className="mt-2 space-y-2 text-sm">
          {business.phone && (
            <p className="flex items-center gap-2 text-slate-700">
              <Phone className="h-4 w-4 text-slate-400" /> {formatPhone(business.phone)}
            </p>
          )}
          <p className="flex items-center gap-2 text-slate-700">
            <MessageCircle className="h-4 w-4 text-emerald-500" /> WhatsApp: {formatPhone(business.whatsapp)}
          </p>
          {business.address && (
            <p className="flex items-start gap-2 text-slate-700">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> {business.address}
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {(business.coords || business.mapsLink || business.address) && (
              <a href={mapsDirectionsLink(business) || '#'} target="_blank" rel="noopener noreferrer" onClick={() => { onTrack('mapClicks'); storage.trackEvent(business.id, null, 'directions_click').catch(() => {}); }} className="btn-outline px-3 py-1.5 text-xs">
                <MapPin className="h-3.5 w-3.5" /> Cómo llegar
              </a>
            )}
            {business.facebook && (
              <a href={`https://facebook.com/${business.facebook}`} target="_blank" rel="noopener noreferrer" className="btn-outline px-3 py-1.5 text-xs">
                <Facebook className="h-3.5 w-3.5" /> Facebook
              </a>
            )}
            {business.instagram && (
              <a href={`https://instagram.com/${business.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="btn-outline px-3 py-1.5 text-xs">
                <Instagram className="h-3.5 w-3.5" /> Instagram
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Map embed */}
      {(business.coords || business.mapsLink || business.address) && (
        <div className="card mt-4 overflow-hidden">
          <iframe
            title="Ubicación"
            src={mapsEmbedSrc(business)}
            className="h-56 w-full border-0"
            loading="lazy"
          />
        </div>
      )}

      {/* Products */}
      <div className="card mt-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Publicaciones
          </h2>
          <button
            onClick={() => (canAddProduct ? setShowAddProduct(true) : toast(`Límite del plan ${PLAN_LABELS[business.plan]}: ${productLimit === Infinity ? 'ilimitado' : productLimit} publicaciones`, 'error'))}
            className="btn-ghost px-2 py-1 text-xs"
          >
            <Plus className="h-4 w-4" /> Agregar
          </button>
        </div>
        <p className="mt-0.5 text-xs text-slate-400">{products.length} / {productLimit === Infinity ? '∞' : productLimit} publicaciones</p>

        {products.length === 0 ? (
          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-400">
            Aún no hay publicaciones. ¡Agrega la primera!
          </p>
        ) : (
          <ProductCarousel products={products} business={business} onDelete={deleteProduct} onTrack={onTrack} />
        )}
      </div>

      {/* Job postings */}
      <div className="card mt-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            <Briefcase className="mr-1 inline h-3.5 w-3.5" /> Vacantes de empleo
          </h2>
          <button
            onClick={() => setShowAddJob(true)}
            className="btn-ghost px-2 py-1 text-xs"
          >
            <Plus className="h-4 w-4" /> Publicar vacante
          </button>
        </div>
        <p className="mt-0.5 text-xs text-slate-400">Publica ofertas de trabajo para tu negocio</p>

        {businessJobs.length === 0 ? (
          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-400">
            No hay vacantes publicadas. ¡Publica la primera!
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {businessJobs.map((j) => {
              const apply = jobApplyLink(j);
              return (
                <div key={j.id} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{j.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-slate-500">
                        <span className="chip bg-slate-100 text-slate-600">{j.contractType}</span>
                        {j.salary && <span className="chip bg-emerald-50 text-emerald-700">{j.salary}</span>}
                      </div>
                    </div>
                    <button onClick={() => deleteJob(j.id)} className="text-slate-300 hover:text-rose-500" aria-label="Eliminar vacante">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{j.description}</p>
                  {j.requirements && (
                    <p className="mt-1 text-xs text-slate-500"><span className="font-semibold">Requisitos:</span> {j.requirements}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2">
                    <span className="text-xs text-slate-400">{timeAgo(j.createdAt)}</span>
                    <div className="ml-auto flex gap-2">
                      {apply && apply.type === 'wa' && (
                        <a href={apply.href} target="_blank" rel="noopener noreferrer" className="btn-wa px-3 py-1.5 text-xs">
                          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                        </a>
                      )}
                      {apply && apply.type === 'mail' && (
                        <a href={apply.href} className="btn-outline px-3 py-1.5 text-xs">
                          Email
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reviews */}
      <div className="card mt-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Reseñas ({reviews.length})</h2>
          <button onClick={() => setShowReview(true)} className="btn-ghost px-2 py-1 text-xs">
            <Star className="h-4 w-4" /> Dejar reseña
          </button>
        </div>
        {reviews.length === 0 ? (
          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-400">
            Sin reseñas aún. ¡Sé el primero en opinar!
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{r.author}</p>
                    <StarRating value={r.rating} size={14} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{timeAgo(r.createdAt)}</span>
                    <button onClick={() => deleteReview(r.id)} className="text-slate-300 hover:text-rose-500" aria-label="Eliminar">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="mt-1.5 text-sm text-slate-600">{r.comment}</p>
              </div>
            ))}
          </div>
        )}
      </div>

{/* Add product modal */}
      <Modal open={showAddProduct} onClose={() => setShowAddProduct(false)} title="Agregar publicación">
        <AddProductForm onAdd={addProduct} businessCategory={business.category} />
      </Modal>

      {/* Review modal */}
      <Modal open={showReview} onClose={() => setShowReview(false)} title="Dejar reseña">
        <ReviewForm onSubmit={addReview} />
      </Modal>

      <Modal open={showAddJob} onClose={() => setShowAddJob(false)} title="Publicar vacante" maxWidth="max-w-xl">
        <AddJobForm business={business} onAdd={addJob} />
      </Modal>
    </div>
  );
}

function AddProductForm({ onAdd, businessCategory }: { onAdd: (p: Omit<Product, 'id' | 'businessId' | 'createdAt'>) => void; businessCategory?: string }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [category, setCategory] = useState(businessCategory || '');
  const [tags, setTags] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState('');
  const { toast } = useToast();

  const toggleTag = (tag: string) => {
    setTags((s) => s.includes(tag) ? s.filter((t) => t !== tag) : [...s, tag]);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price) {
      toast('Nombre y precio son requeridos', 'error');
      return;
    }
    const exp = expiresAt ? new Date(expiresAt).getTime() : undefined;
    onAdd({
      name: name.trim(),
      description: description.trim() || undefined,
      price: parseFloat(price) || 0,
      imageUrl: imageUrl.trim() || undefined,
      category: category || 'Otros',
      tags,
      expiresAt: exp,
    });
  };

  const tagOptions = [
    { value: 'new', label: 'Nuevo' },
    { value: 'featured', label: 'Destacado' },
    { value: 'offer', label: 'Oferta' },
    { value: 'last_units', label: 'Últimas piezas' },
    { value: 'promotion', label: 'Promoción' },
  ];

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label">Nombre *</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Tacos al pastor" />
      </div>
      <div>
        <label className="label">Descripción</label>
        <textarea className="input min-h-[70px]" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Precio (MXN) *</label>
          <input className="input" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="75" inputMode="decimal" />
        </div>
        <div>
          <label className="label">Categoría</label>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Selecciona...</option>
            {CATEGORIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Fecha de expiración</label>
        <input type="date" className="input" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
      </div>
      <div>
        <label className="label">Etiquetas</label>
        <div className="flex flex-wrap gap-2">
          {tagOptions.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => toggleTag(t.value)}
              className={`chip text-xs ${tags.includes(t.value) ? 'bg-[#0D47A1] text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <ImageUpload
        value={imageUrl}
        onChange={setImageUrl}
        folder="products"
        label="Foto de la publicación"
        aspect="aspect-square"
      />
      <button type="submit" className="btn-primary w-full"><Plus className="h-4 w-4" /> Agregar publicación</button>
    </form>
  );
}

function AddJobForm({ business, onAdd }: { business: Business; onAdd: (j: Omit<Job, 'id' | 'createdAt'>) => void }) {
  const [f, setF] = useState({
    title: '', description: '', requirements: '',
    salary: '', contractType: CONTRACT_TYPES[0], contact: '', whatsapp: '', email: '',
  });
  const { toast } = useToast();
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.title.trim() || !f.description.trim() || !f.contact.trim()) {
      toast('Completa los campos requeridos', 'error');
      return;
    }
    onAdd({
      companyName: business.name,
      municipality: business.municipality,
      category: business.category,
      title: f.title.trim(),
      description: f.description.trim(),
      requirements: f.requirements.trim(),
      salary: f.salary.trim() || 'No especificado',
      contractType: f.contractType,
      contact: f.contact.trim(),
      whatsapp: f.whatsapp.replace(/\D/g, '').slice(0, 10) || business.whatsapp.replace(/\D/g, '').slice(0, 10) || undefined,
      email: f.email.trim() || undefined,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label">Puesto *</label>
        <input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Ej. Mesero/a" />
      </div>
      <div>
        <label className="label">Descripción *</label>
        <textarea className="input min-h-[70px]" value={f.description} onChange={(e) => set('description', e.target.value)} />
      </div>
      <div>
        <label className="label">Requisitos</label>
        <textarea className="input min-h-[60px]" value={f.requirements} onChange={(e) => set('requirements', e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Salario</label>
          <input className="input" value={f.salary} onChange={(e) => set('salary', e.target.value)} placeholder="$5,000 mensual" />
        </div>
        <div>
          <label className="label">Tipo de contrato</label>
          <select className="input" value={f.contractType} onChange={(e) => set('contractType', e.target.value)}>
            {CONTRACT_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Contacto *</label>
        <input className="input" value={f.contact} onChange={(e) => set('contact', e.target.value)} placeholder="Nombre del responsable" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">WhatsApp (10 dígitos)</label>
          <input className="input" value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder={business.whatsapp || '4771234567'} inputMode="numeric" />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="correo@empresa.mx" />
        </div>
      </div>
      <button type="submit" className="btn-primary w-full"><Briefcase className="h-4 w-4" /> Publicar vacante</button>
    </form>
  );
}

function ReviewForm({ onSubmit }: { onSubmit: (author: string, rating: number, comment: string) => void }) {
  const [author, setAuthor] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const { toast } = useToast();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!author.trim() || !comment.trim()) {
      toast('Tu nombre y comentario son requeridos', 'error');
      return;
    }
    onSubmit(author.trim(), rating, comment.trim());
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label">Tu nombre *</label>
        <input className="input" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Ej. Carlos M." />
      </div>
      <div>
        <label className="label">Calificación</label>
        <StarRating value={rating} onChange={setRating} size={28} />
      </div>
      <div>
        <label className="label">Comentario *</label>
        <textarea className="input min-h-[80px]" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Cuéntanos tu experiencia..." />
      </div>
      <button type="submit" className="btn-primary w-full"><Star className="h-4 w-4" /> Publicar reseña</button>
    </form>
  );
}
