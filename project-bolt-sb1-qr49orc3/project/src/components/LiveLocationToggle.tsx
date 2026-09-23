import { useEffect, useRef, useState } from 'react';
import { Radio, Loader2 } from 'lucide-react';
import { storage } from '../lib/storage';
import { useToast } from './Toast';

const THROTTLE_MS = 8000;

export function LiveLocationToggle({ businessId }: { businessId: string }) {
  const { toast } = useToast();
  const [sharing, setSharing] = useState(false);
  const [starting, setStarting] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const start = () => {
    if (!navigator.geolocation) {
      toast('Tu navegador no soporta geolocalización', 'error');
      return;
    }
    setStarting(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setStarting(false);
        setSharing(true);
        const now = Date.now();
        if (now - lastSentRef.current < THROTTLE_MS) return;
        lastSentRef.current = now;
        storage.setVendorLocation(businessId, pos.coords.latitude, pos.coords.longitude).catch(() => {});
      },
      (err) => {
        setStarting(false);
        setSharing(false);
        const msg = err.code === err.PERMISSION_DENIED
          ? 'Permiso de ubicación denegado. Actívalo en tu navegador para compartir tu recorrido.'
          : 'No se pudo obtener tu ubicación.';
        toast(msg, 'error');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  };

  const stop = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setSharing(false);
    storage.stopVendorLocation(businessId).catch(() => {});
    toast('Dejaste de compartir tu ubicación', 'info');
  };

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${sharing ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
            <Radio className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Ubicación en vivo</p>
            <p className="text-xs text-slate-500">
              {sharing ? 'Compartiendo tu ubicación. Los clientes te ven en el mapa.' : 'Actívala cuando salgas a vender para que te encuentren.'}
            </p>
          </div>
        </div>
        <button
          onClick={sharing ? stop : start}
          disabled={starting}
          className={`btn shrink-0 px-3 py-2 text-xs ${sharing ? 'bg-rose-500 text-white hover:bg-rose-600' : 'btn-primary'}`}
        >
          {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {starting ? 'Activando...' : sharing ? 'Detener' : 'Compartir ubicación'}
        </button>
      </div>
    </div>
  );
}
