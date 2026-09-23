import { useEffect, useState } from 'react';
import { Navigation, MessageCircle, Radio, Clock } from 'lucide-react';
import type { Business, VendorLocation } from '../lib/types';
import { storage } from '../lib/storage';
import { waLink, haversineKm, estimateEtaMinutes, liveLocationEmbedSrc, timeAgo } from '../lib/utils';

const STALE_MS = 5 * 60 * 1000; // treat as offline if not updated in 5 minutes
const POLL_MS = 8000;

export function LiveVendorMap({ business }: { business: Business }) {
  const [loc, setLoc] = useState<VendorLocation | null>(null);
  const [viewerPos, setViewerPos] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => {
      storage.getVendorLocation(business.id).then((l) => { if (active) setLoc(l); }).catch(() => {});
    };
    load();
    const interval = setInterval(load, POLL_MS);
    return () => { active = false; clearInterval(interval); };
  }, [business.id]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setViewerPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }, []);

  if (!business.is_ambulante) return null;

  const isFresh = loc && loc.active && Date.now() - new Date(loc.updated_at).getTime() < STALE_MS;

  if (!isFresh || !loc) {
    return (
      <div className="card mt-4 p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <Radio className="h-4 w-4 text-slate-400" /> Ubicación en vivo
        </div>
        <p className="mt-2 text-sm text-slate-400">Este negocio es ambulante pero no está compartiendo su ubicación en este momento.</p>
      </div>
    );
  }

  const distanceKm = viewerPos ? haversineKm(viewerPos, loc) : null;
  const etaMin = distanceKm !== null ? estimateEtaMinutes(distanceKm) : null;

  return (
    <div className="card mt-4 overflow-hidden">
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          En camino ahora
        </div>
        <span className="flex items-center gap-1 text-xs text-slate-400">
          <Clock className="h-3.5 w-3.5" /> actualizado {timeAgo(new Date(loc.updated_at).getTime())}
        </span>
      </div>

      <iframe title="Ubicación en vivo" src={liveLocationEmbedSrc(loc.lat, loc.lng)} className="h-56 w-full border-0" loading="lazy" />

      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="text-sm text-slate-600">
          {distanceKm !== null ? (
            <>
              <span className="font-bold text-slate-800">{distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`}</span> de distancia ·
              {' '}aprox. <span className="font-bold text-slate-800">{etaMin} min</span>
              <span className="ml-1 text-xs text-slate-400">(estimado)</span>
            </>
          ) : (
            <span className="text-xs text-slate-400">Activa tu ubicación para ver cuánto le falta</span>
          )}
        </div>
        <div className="flex gap-2">
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`} target="_blank" rel="noopener noreferrer" className="btn-outline px-3 py-2 text-xs">
            <Navigation className="h-3.5 w-3.5" /> Ver ruta
          </a>
          {business.whatsapp && (
            <a
              href={waLink(business.whatsapp, `Hola ${business.name}, vi que vienes en camino, ¿cuánto te falta para llegar?`)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-wa px-3 py-2 text-xs"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Preguntar
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
