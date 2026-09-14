import { useEffect, useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function InstallBanner() {
  const { canInstall, installed, promptInstall } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    const t = setTimeout(() => {}, 0);
    return () => clearTimeout(t);
  }, [dismissed]);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;

  if (installed || isStandalone || dismissed) return null;

  if (canInstall) {
    return (
      <div className="card fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm animate-slide-up p-4 shadow-xl md:left-auto md:right-4">
        <button
          onClick={() => setDismissed(true)}
          className="absolute right-2 top-2 rounded-full p-1.5 text-muted hover:bg-surface-soft"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded mng-gradient text-gold">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold">Instala Conecta MX</p>
            <p className="mt-0.5 text-xs text-muted">
              Accede más rápido y recibe notificaciones de nuevas vacantes y eventos.
            </p>
            <button
              onClick={promptInstall}
              className="btn-primary mt-3 w-full px-4 py-2.5 text-sm"
            >
              <Download className="h-4 w-4" /> Instalar app
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isIOS && !showIOSHint) {
    return (
      <div className="card fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm animate-slide-up p-4 shadow-xl md:left-auto md:right-4">
        <button
          onClick={() => setDismissed(true)}
          className="absolute right-2 top-2 rounded-full p-1.5 text-muted hover:bg-surface-soft"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded mng-gradient text-gold">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold">Instala Conecta MX en tu iPhone</p>
            <p className="mt-0.5 text-xs text-muted">
              Toca el botón <strong>Compartir</strong> y luego <strong>"Añadir a pantalla de inicio"</strong>.
            </p>
            <button
              onClick={() => setShowIOSHint(true)}
              className="btn-outline mt-3 w-full px-4 py-2.5 text-sm"
            >
              Ver instrucciones
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isIOS && showIOSHint) {
    return (
      <div className="card fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm animate-slide-up p-4 shadow-xl md:left-auto md:right-4">
        <button
          onClick={() => setDismissed(true)}
          className="absolute right-2 top-2 rounded-full p-1.5 text-muted hover:bg-surface-soft"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded mng-gradient text-gold">
              <Smartphone className="h-4 w-4" />
            </div>
            <p className="text-sm font-bold">Cómo instalar en iPhone</p>
          </div>
          <ol className="space-y-2 text-xs text-muted">
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-on-gold">1</span>
              <span>Toca el botón de Compartir <strong>Share</strong> en Safari.</span>
            </li>
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-on-gold">2</span>
              <span>Desplázate y selecciona <strong>"Añadir a pantalla de inicio"</strong>.</span>
            </li>
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-on-gold">3</span>
              <span>Toca <strong>"Añadir"</strong>. ¡Listo! Conecta MX aparecerá como una app.</span>
            </li>
          </ol>
          <button
            onClick={() => setDismissed(true)}
            className="btn-outline w-full px-4 py-2 text-xs"
          >
            Entendido
          </button>
        </div>
      </div>
    );
  }

  return null;
}
