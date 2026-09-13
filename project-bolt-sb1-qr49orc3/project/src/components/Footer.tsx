import { Logo } from './Logo';
import { Store, Briefcase, QrCode, Shield, Heart, Calendar } from 'lucide-react';

interface FooterProps {
  onNavigate: (route: string) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="mt-12 border-t border-white/10 bg-ink text-ink-invert">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <Logo size={40} showText invert />
            <p className="mt-3 max-w-xs text-xs text-ink-invert/60">
              Conectando a los negocios de los 32 estados de México. Apoya al comercio local dondequiera que estés.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-gold">Explorar</h3>
            <ul className="mt-3 space-y-2 text-sm text-ink-invert/70">
              <li><button onClick={() => onNavigate('directory')} className="inline-flex items-center gap-1.5 hover:text-gold"><Store className="h-4 w-4" /> Directorio</button></li>
              <li><button onClick={() => onNavigate('jobs')} className="inline-flex items-center gap-1.5 hover:text-gold"><Briefcase className="h-4 w-4" /> Bolsa de Empleo</button></li>
              <li><button onClick={() => onNavigate('events')} className="inline-flex items-center gap-1.5 hover:text-gold"><Calendar className="h-4 w-4" /> Eventos</button></li>
              <li><button onClick={() => onNavigate('qr')} className="inline-flex items-center gap-1.5 hover:text-gold"><QrCode className="h-4 w-4" /> Códigos QR</button></li>
              <li><button onClick={() => onNavigate('plans')} className="inline-flex items-center gap-1.5 hover:text-gold"><Shield className="h-4 w-4" /> Planes</button></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-gold">Contacto</h3>
            <ul className="mt-3 space-y-2 text-sm text-ink-invert/70">
              <li>contacto@conectamx.app</li>
              <li>México</li>
              <li><button onClick={() => onNavigate('register')} className="text-gold hover:underline">Registra tu negocio</button></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-white/10 pt-5 text-xs text-ink-invert/50 sm:flex-row">
          <p>© {new Date().getFullYear()} Conecta MX. Todos los derechos reservados.</p>
          <p className="inline-flex items-center gap-1">Hecho con <Heart className="h-3 w-3 fill-gold text-gold" /> en México</p>
        </div>
      </div>
    </footer>
  );
}
