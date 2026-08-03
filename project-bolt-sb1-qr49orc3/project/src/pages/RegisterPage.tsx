import { useState, type ReactNode, type FormEvent } from 'react';
import { Store, CheckCircle2, Info, MapPin, LocateFixed, Loader2, Mail, Lock } from 'lucide-react';
import type { Business, Plan } from '../lib/types';
import { MUNICIPALITIES, CATEGORIES } from '../lib/constants';
import { storage, uid } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { ImageUpload } from '../components/ImageUpload';

interface RegisterPageProps {
  onRegistered: (b: Business) => void;
}

interface FormState {
  email: string;
  password: string;
  name: string;
  municipality: string;
  city: string;
  category: string;
  description: string;
  whatsapp: string;
  phone: string;
  address: string;
  coords: { lat: number; lng: number } | null;
  hours: string;
  facebook: string;
  instagram: string;
  promotion: string;
  imageUrl: string;
  acceptTerms: boolean;
}

const empty: FormState = {
  email: '', password: '', name: '', municipality: '', city: '', category: '', description: '',
  whatsapp: '', phone: '', address: '', coords: null, hours: '',
  facebook: '', instagram: '', promotion: '', imageUrl: '', acceptTerms: false,
};

const sampleImages = [
  'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=800&q=80',
  'https://images.unsplash.com/photo-1441986300917-64674ad600d9?w=800&q=80',
  'https://images.unsplash.com/photo-1556742049-0cf03492b75a?w=800&q=80',
  'https://images.unsplash.com/photo-1567521464027-f127ff1440ac?w=800&q=80',
];

function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
    </div>
  );
}

export function RegisterPage({ onRegistered }: RegisterPageProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.email.trim()) e.email = 'Requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email inválido';
    if (form.password.length < 6) e.password = 'Mínimo 6 caracteres';
    if (!form.name.trim()) e.name = 'Requerido';
    if (!form.municipality) e.municipality = 'Selecciona un estado';
    if (!form.city.trim()) e.city = 'Requerido';
    if (!form.category) e.category = 'Selecciona una categoría';
    if (!form.description.trim()) e.description = 'Requerido';
    if (!/^\d{10}$/.test(form.whatsapp.replace(/\D/g, ''))) e.whatsapp = 'Debe tener 10 dígitos';
    if (!form.acceptTerms) e.acceptTerms = 'Debes aceptar los términos';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!validate()) {
      toast('Revisa los campos marcados', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
      });
      if (authError) throw new Error(authError.message);
      if (!authData.user) throw new Error('No se pudo crear la cuenta');

      const businesses = await storage.getBusinesses();
      const isFounding = businesses.length < 30;
      const business: Business = {
        id: uid('biz'),
        name: form.name.trim(),
        municipality: form.municipality,
        city: form.city.trim(),
        category: form.category,
        description: form.description.trim(),
        whatsapp: form.whatsapp.replace(/\D/g, ''),
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        coords: form.coords || undefined,
        mapsLink: undefined,
        hours: form.hours.trim() || undefined,
        facebook: form.facebook.trim() || undefined,
        instagram: form.instagram.trim() || undefined,
        promotion: form.promotion.trim() || undefined,
        imageUrl: form.imageUrl.trim() || sampleImages[Math.floor(Math.random() * sampleImages.length)],
        plan: 'free',
        verified: false,
        founding: isFounding,
        rating: 0,
        reviewCount: 0,
        createdAt: Date.now(),
        user_id: authData.user.id,
      };
      await storage.addBusiness(business);
      if (isFounding) {
        toast('¡Registro exitoso! Eres Negocio Fundador (gratis para siempre).', 'success');
      } else {
        toast('Negocio registrado. Bienvenido a Conecta MX.', 'success');
      }
      setForm(empty);
      onRegistered(business);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo registrar el negocio';
      toast(msg, 'error');
      toast('Si creaste una cuenta, inicia sesión e intenta registrar tu negocio de nuevo.', 'info');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-5 text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl mng-gradient text-white">
          <Store className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-800">Registrar negocio</h1>
        <p className="text-sm text-slate-500">Crea tu cuenta y empieza a conseguir más clientes</p>
      </div>

      <form onSubmit={submit} className="card space-y-4 p-5">
        <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-700 flex gap-2">
          <Info className="h-4 w-4 shrink-0" />
          <span>Los primeros 30 negocios registrados obtienen membresía <strong>Fundador</strong> gratis para siempre.</span>
        </div>

        {/* Account credentials */}
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="mb-3 text-sm font-bold text-slate-700">Datos de tu cuenta</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email *" error={errors.email}>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="email" className="input pl-9" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="tu@correo.com" />
              </div>
            </Field>
            <Field label="Contraseña *" hint="Mínimo 6 caracteres" error={errors.password}>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="password" className="input pl-9" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="******" />
              </div>
            </Field>
          </div>
        </div>

        <Field label="Nombre del negocio *" error={errors.name}>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ej. Taquería El Patrón" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Estado *" error={errors.municipality} hint="Selecciona el estado donde opera tu negocio">
            <select className="input" value={form.municipality} onChange={(e) => set('municipality', e.target.value)}>
              <option value="">Selecciona...</option>
              {MUNICIPALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Ciudad *" error={errors.city}>
            <input className="input" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Ciudad o localidad" />
          </Field>
        </div>

        <Field label="Categoría *" error={errors.category}>
          <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
            <option value="">Selecciona...</option>
            {CATEGORIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </Field>

        <Field label="Descripción *" error={errors.description}>
          <textarea className="input min-h-[90px]" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Describe tu negocio, productos y servicios..." />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="WhatsApp (10 dígitos) *" hint="Solo números, sin +52" error={errors.whatsapp}>
            <input className="input" value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="4771234567" inputMode="numeric" />
          </Field>
          <Field label="Teléfono (opcional)" error={errors.phone}>
            <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="4771234567" />
          </Field>
        </div>

        <Field label="Dirección (opcional)" error={errors.address}>
          <input className="input" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Calle, número, colonia" />
        </Field>

        <div>
          <label className="label">Ubicación GPS (para verificación)</label>
          <p className="mb-2 text-xs text-slate-500">Comparte tu ubicación actual para que los clientes te encuentren en el mapa y verifiquemos tu negocio.</p>
          <GeoButton coords={form.coords} onSet={(c) => set('coords', c)} />
        </div>

        <Field label="Horario (opcional)" hint="Formato: Lun-Vie 9:00-18:00, Sab 9:00-14:00" error={errors.hours}>
          <input className="input" value={form.hours} onChange={(e) => set('hours', e.target.value)} placeholder="Lun-Dom 9:00-21:00" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Facebook (opcional)" error={errors.facebook}>
            <input className="input" value={form.facebook} onChange={(e) => set('facebook', e.target.value)} placeholder="usuario o URL" />
          </Field>
          <Field label="Instagram (opcional)" error={errors.instagram}>
            <input className="input" value={form.instagram} onChange={(e) => set('instagram', e.target.value)} placeholder="@usuario" />
          </Field>
        </div>

        <Field label="Promoción del día (opcional)" error={errors.promotion}>
          <input className="input" value={form.promotion} onChange={(e) => set('promotion', e.target.value)} placeholder="2x1 en tacos los martes" />
        </Field>

        <ImageUpload
          value={form.imageUrl}
          onChange={(url) => set('imageUrl', url)}
          folder="businesses"
          label="Foto del negocio"
          hint="Sube una foto desde tu galería o déjala vacía para una imagen por defecto"
        />

        <label className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3">
          <input
            type="checkbox"
            checked={form.acceptTerms}
            onChange={(e) => set('acceptTerms', e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#1565C0]"
          />
          <span className="text-xs text-slate-600">
            Acepto los términos y condiciones de Conecta MX y autorizo la publicación de mi información de contacto.
          </span>
        </label>
        {errors.acceptTerms && <p className="-mt-2 text-xs text-rose-500">{errors.acceptTerms}</p>}

        <button type="submit" disabled={submitting} className="btn-primary w-full py-3">
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
          {submitting ? 'Creando cuenta...' : 'Registrar mi negocio'}
        </button>
      </form>
    </div>
  );
}

function GeoButton({ coords, onSet }: { coords: { lat: number; lng: number } | null; onSet: (c: { lat: number; lng: number } | null) => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const capture = () => {
    if (!navigator.geolocation) {
      toast('Tu navegador no soporta geolocalización', 'error');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false);
        onSet({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast('Ubicación capturada', 'success');
      },
      (err) => {
        setLoading(false);
        const msg = err.code === err.PERMISSION_DENIED
          ? 'Permiso denegado. Activa el acceso a tu ubicación.'
          : 'No se pudo obtener tu ubicación. Intenta de nuevo.';
        toast(msg, 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  if (coords) {
    return (
      <div className="flex items-center gap-2">
        <span className="chip bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
        </span>
        <button type="button" onClick={capture} className="btn-ghost px-3 py-1.5 text-xs">
          <LocateFixed className="h-3.5 w-3.5" /> Actualizar
        </button>
        <button type="button" onClick={() => onSet(null)} className="text-xs text-slate-400 hover:text-rose-500">
          Quitar
        </button>
      </div>
    );
  }

  return (
    <button type="button" onClick={capture} disabled={loading} className="btn-outline w-full py-2.5 text-sm">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
      {loading ? 'Obteniendo ubicación...' : 'Compartir mi ubicación actual'}
    </button>
  );
}
