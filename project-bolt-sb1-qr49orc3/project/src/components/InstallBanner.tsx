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
      <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm animate-slide-up rounded-2xl border border-slate-200 bg-white p-4 shadow-xl md:left-auto md:right-4">
        <button
          onClick={() => setDismissed(true)}
          className="absolute right-2 top-2 rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl mng-gradient text-white">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-800">Instala Conecta MX</p>
            <p className="mt-0.5 text-xs text-slate-500">
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
      <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm animate-slide-up rounded-2xl border border-slate-200 bg-white p-4 shadow-xl md:left-auto md:right-4">
        <button
          onClick={() => setDismissed(true)}
          className="absolute right-2 top-2 rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl mng-gradient text-white">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-800">Instala Conecta MX en tu iPhone</p>
            <p className="mt-0.5 text-xs text-slate-500">
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
      <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm animate-slide-up rounded-2xl border border-slate-200 bg-white p-4 shadow-xl md:left-auto md:right-4">
        <button
          onClick={() => setDismissed(true)}
          className="absolute right-2 top-2 rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg mng-gradient text-white">
              <Smartphone className="h-4 w-4" />
            </div>
            <p className="text-sm font-bold text-slate-800">Cómo instalar en iPhone</p>
          </div>
          <ol className="space-y-2 text-xs text-slate-600">
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1565C0] text-[10px] font-bold text-white">1</span>
              <span>Toca el botón de Compartir <strong>Share</strong> en Safari.</span>
            </li>
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1565C0] text-[10px] font-bold text-white">2</span>
              <span>Desplázate y selecciona <strong>"Añadir a pantalla de inicio"</strong>.</span>
            </li>
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1565C0] text-[10px] font-bold text-white">3</span>
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
