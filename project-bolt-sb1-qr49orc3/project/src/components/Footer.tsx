import { Logo } from './Logo';
import { Store, Briefcase, QrCode, Shield, Heart, Calendar } from 'lucide-react';

interface FooterProps {
  onNavigate: (route: string) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="mt-12 border-t border-slate-100 bg-white">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <Logo size={40} showText />
            <p className="mt-2 max-w-xs text-xs text-slate-500">
              Conectando a los negocios de los 32 estados de México. Apoya al comercio local dondequiera que estés.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-700">Explorar</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-500">
              <li><button onClick={() => onNavigate('directory')} className="inline-flex items-center gap-1.5 hover:text-[#1565C0]"><Store className="h-4 w-4" /> Directorio</button></li>
              <li><button onClick={() => onNavigate('jobs')} className="inline-flex items-center gap-1.5 hover:text-[#1565C0]"><Briefcase className="h-4 w-4" /> Bolsa de Empleo</button></li>
              <li><button onClick={() => onNavigate('events')} className="inline-flex items-center gap-1.5 hover:text-[#1565C0]"><Calendar className="h-4 w-4" /> Eventos</button></li>
              <li><button onClick={() => onNavigate('qr')} className="inline-flex items-center gap-1.5 hover:text-[#1565C0]"><QrCode className="h-4 w-4" /> Códigos QR</button></li>
              <li><button onClick={() => onNavigate('plans')} className="inline-flex items-center gap-1.5 hover:text-[#1565C0]"><Shield className="h-4 w-4" /> Planes</button></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-700">Contacto</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-500">
              <li>contacto@conectamx.app</li>
              <li>México</li>
              <li><button onClick={() => onNavigate('register')} className="text-[#1565C0] hover:underline">Registra tu negocio</button></li>
            </ul>
          </div>
        </div>
        <div className="mt-6 flex flex-col items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs text-slate-400 sm:flex-row">
          <p>© {new Date().getFullYear()} Conecta MX. Todos los derechos reservados.</p>
          <p className="inline-flex items-center gap-1">Hecho con <Heart className="h-3 w-3 fill-rose-500 text-rose-500" /> en México</p>
        </div>
      </div>
    </footer>
  );
}
