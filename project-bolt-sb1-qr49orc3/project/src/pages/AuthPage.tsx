import { useState, type FormEvent } from 'react';
import { LogIn, UserPlus, Mail, Lock, Loader2, TrendingUp, BarChart3, QrCode } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';

interface AuthPageProps {
  mode: 'login' | 'signup';
  onSuccess: () => void;
  onSwitch: () => void;
}

export function AuthPage({ mode, onSuccess, onSwitch }: AuthPageProps) {
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Email y contraseña son requeridos');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Email inválido');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = mode === 'login' ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
      setLoading(false);
      if (result.error) {
        const msg = result.error.includes('Invalid login')
          ? 'Email o contraseña incorrectos'
          : result.error.includes('already')
          ? 'Ya existe una cuenta con este email'
          : result.error;
        setError(msg);
        toast(msg, 'error');
        return;
      }
      if (mode === 'signup') {
        toast('Cuenta creada. Bienvenido a Conecta MX.', 'success');
      } else {
        toast('Sesión iniciada', 'success');
      }
      onSuccess();
    } catch {
      setLoading(false);
      const msg = 'No se pudo conectar. Revisa tu conexión e intenta de nuevo.';
      setError(msg);
      toast(msg, 'error');
    }
  };

  const benefits = [
    { icon: BarChart3, title: 'Mide tus resultados', desc: 'Vistas, clics en WhatsApp y compartidos por publicación' },
    { icon: TrendingUp, title: 'Índice Conecta', desc: 'Tu puntuación de 0 a 100 para mejorar tu visibilidad' },
    { icon: QrCode, title: 'Código QR exclusivo', desc: 'Genera QR para tu negocio y para cada publicación' },
  ];

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <div className="mb-6 text-center">
        <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl mng-gradient text-white`}>
          {mode === 'login' ? <LogIn className="h-6 w-6" /> : <UserPlus className="h-6 w-6" />}
        </div>
        <h1 className="text-2xl font-extrabold text-slate-800">
          {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {mode === 'login' ? 'Accede a tu panel de negocio' : 'Registra tu negocio y empieza a crecer'}
        </p>
      </div>

      {mode === 'signup' && (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          {benefits.map((b) => (
            <div key={b.title} className="card p-3 text-center">
              <b.icon className="mx-auto h-5 w-5 text-[#1565C0]" />
              <p className="mt-1.5 text-xs font-bold text-slate-700">{b.title}</p>
              <p className="mt-0.5 text-[11px] leading-tight text-slate-500">{b.desc}</p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="card space-y-4 p-5">
        <div>
          <label className="label">Email</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              className="input pl-9"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              placeholder="tu@correo.com"

            />
          </div>
        </div>
        <div>
          <label className="label">Contraseña</label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="password"
              className="input pl-9"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
        </div>
        {error && <p className="text-xs text-rose-500">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full py-3">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : mode === 'login' ? <LogIn className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
          {loading ? 'Procesando...' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-500">
        {mode === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
        <button onClick={onSwitch} className="font-bold text-[#1565C0] hover:underline">
          {mode === 'login' ? 'Regístrate gratis' : 'Inicia sesión'}
        </button>
      </p>
    </div>
  );
}
