import { useEffect, useState } from 'react';
import { Award, LogOut } from 'lucide-react';
import { api, ApiError, type ProfileResponse } from '../lib/api';
import { useAuth } from '../lib/auth';
import { navigate } from '../lib/router';
import { useAsync } from '../lib/useAsync';
import { relativeTime } from '../lib/format';
import { ErrorBox, ProgressBar, Spinner, useToast } from '../components/ui';

export function ProfilePage() {
  const toast = useToast();
  const { setUser, logout } = useAuth();
  const { data, setData, error, loading, reload } = useAsync(() => api.profile(), []);
  const [form, setForm] = useState({ name: '', daily_minutes: 30, explanation_style: 'balanced', practice_first: true, background: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        name: data.user.name,
        daily_minutes: data.preferences.daily_minutes,
        explanation_style: data.preferences.explanation_style,
        practice_first: data.preferences.practice_first,
        background: data.profile?.background ?? '',
      });
    }
  }, [data]);

  if (loading && !data) return <Spinner />;
  if (error || !data) return <div className="page"><ErrorBox error={error} onRetry={reload} /></div>;
  const p: ProfileResponse = data;
  const pct = (a: number, b: number) => Math.min(100, Math.round((a / b) * 100));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api.updateProfile({ ...form, daily_minutes: Number(form.daily_minutes) });
      setData(r);
      setUser(r.user);
      toast('Perfil guardado');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'No se pudo guardar.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Perfil</h1>

      <form className="card space-y-4 p-5" onSubmit={save}>
        <h2 className="font-semibold text-slate-900">Tus datos y preferencias</h2>
        <p className="text-sm text-slate-500">{p.user.email}</p>
        <div>
          <label className="label" htmlFor="pf-name">
            Nombre (aparece en tus certificados)
          </label>
          <input id="pf-name" className="input" maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="pf-min">
              Minutos al día para estudiar
            </label>
            <input id="pf-min" type="number" min={5} max={480} className="input" value={form.daily_minutes} onChange={(e) => setForm({ ...form, daily_minutes: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label" htmlFor="pf-style">
              Explicaciones
            </label>
            <select id="pf-style" className="input" value={form.explanation_style} onChange={(e) => setForm({ ...form, explanation_style: e.target.value })}>
              <option value="concise">Breves y directas</option>
              <option value="balanced">Equilibradas</option>
              <option value="detailed">Detalladas</option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={form.practice_first} onChange={(e) => setForm({ ...form, practice_first: e.target.checked })} />
          Prefiero aprender practicando desde el principio
        </label>
        <div>
          <label className="label" htmlFor="pf-bg">
            Lo que ya sabes o a qué te dedicas (opcional)
          </label>
          <textarea id="pf-bg" className="input min-h-[80px]" maxLength={1000} value={form.background} onChange={(e) => setForm({ ...form, background: e.target.value })} placeholder="Ej.: trabajo en administración, uso Word a diario, sé inglés básico…" />
          <p className="mt-1 text-xs text-slate-500">La IA lo usa para no explicarte lo que ya sabes.</p>
        </div>
        <button className="btn-primary" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </form>

      <section className="card space-y-4 p-5" aria-labelledby="plan-title">
        <div className="flex items-center justify-between">
          <h2 id="plan-title" className="font-semibold text-slate-900">
            Tu plan: {p.usage.plan === 'premium' ? 'Premium' : 'Gratis'}
          </h2>
          {p.profile?.learning_pace && (
            <span className="text-xs text-slate-500">Ritmo detectado: {{ slow: 'pausado', normal: 'normal', fast: 'rápido' }[p.profile.learning_pace] ?? p.profile.learning_pace}</span>
          )}
        </div>
        <ProgressBar value={pct(p.usage.used.active_courses, p.usage.limits.active_courses)} label={`Cursos activos: ${p.usage.used.active_courses} de ${p.usage.limits.active_courses}`} />
        <ProgressBar value={pct(p.usage.used.ai_generations_today, p.usage.limits.ai_generations_per_day)} label={`Generaciones con IA hoy: ${p.usage.used.ai_generations_today} de ${p.usage.limits.ai_generations_per_day}`} />
        <ProgressBar value={pct(p.usage.used.tutor_messages_today, p.usage.limits.tutor_messages_per_day)} label={`Mensajes al tutor hoy: ${p.usage.used.tutor_messages_today} de ${p.usage.limits.tutor_messages_per_day}`} />
        {p.usage.plan === 'free' && <p className="text-sm text-slate-500">Premium (próximamente): más cursos y generaciones, tutor avanzado, memoria ampliada y funciones multimedia.</p>}
      </section>

      <section aria-labelledby="ach-title">
        <h2 id="ach-title" className="mb-3 font-semibold text-slate-900">
          Logros
        </h2>
        {p.achievements.length === 0 ? (
          <p className="text-sm text-slate-500">Tus logros aparecerán aquí a medida que avances.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {p.achievements.map((a, i) => (
              <li key={i} className="card flex items-center gap-3 p-3 text-sm">
                <Award className="h-5 w-5 shrink-0 text-amber-500" aria-hidden />
                <span className="flex-1 text-slate-800">{a.title}</span>
                <span className="text-xs text-slate-400">{relativeTime(a.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        className="btn-danger"
        onClick={async () => {
          await logout();
          navigate('/');
        }}
      >
        <LogOut className="h-4 w-4" aria-hidden /> Cerrar sesión
      </button>
    </div>
  );
}
