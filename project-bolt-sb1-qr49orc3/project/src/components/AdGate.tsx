import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, SkipForward, Megaphone } from 'lucide-react';
import type { Ad } from '../lib/types';
import { storage } from '../lib/storage';

const SESSION_KEY = 'cmx_ad_shown_session';

export function AdGate({ onDone }: { onDone: () => void }) {
  const [ad, setAd] = useState<Ad | null | undefined>(undefined); // undefined = loading
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(true);
  const [viewCounted, setViewCounted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (sessionStorage.getItem(SESSION_KEY)) {
        if (active) setAd(null);
        return;
      }
      try {
        const ads = await storage.getActiveAds();
        if (!active) return;
        if (ads.length === 0) {
          setAd(null);
          return;
        }
        const pick = ads[Math.floor(Math.random() * ads.length)];
        setAd(pick);
      } catch {
        if (active) setAd(null);
      }
    })();
    return () => { active = false; };
  }, []);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    sessionStorage.setItem(SESSION_KEY, '1');
    onDone();
  };

  useEffect(() => {
    if (ad === null) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad]);

  if (!ad) return null;

  const canSkip = elapsed >= ad.skip_after_seconds;
  const skipIn = Math.max(0, Math.ceil(ad.skip_after_seconds - elapsed));

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setElapsed(v.currentTime);
    if (!viewCounted && v.currentTime >= ad.skip_after_seconds) {
      setViewCounted(true);
      storage.trackAdStat(ad.id, 'view').catch(() => {});
    }
    if (v.currentTime >= ad.duration_seconds) {
      finish();
    }
  };

  const skip = () => {
    if (!canSkip) return;
    storage.trackAdStat(ad.id, 'skip').catch(() => {});
    finish();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black">
      <video
        ref={videoRef}
        src={ad.video_url}
        autoPlay
        muted={muted}
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onEnded={finish}
        onError={finish}
        className="h-full w-full object-contain"
      />

      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1.5 text-xs font-medium text-white">
        <Megaphone className="h-3.5 w-3.5" /> Publicidad{ad.advertiser_name ? ` · ${ad.advertiser_name}` : ''}
      </div>

      <button
        onClick={() => setMuted((m) => !m)}
        className="absolute right-3 top-3 rounded-lg bg-black/60 p-2 text-white hover:bg-black/80"
        aria-label={muted ? 'Activar sonido' : 'Silenciar'}
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>

      <div className="absolute bottom-4 right-4">
        {canSkip ? (
          <button
            onClick={skip}
            className="flex items-center gap-1.5 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-slate-800 shadow-lg hover:bg-slate-100"
          >
            Saltar anuncio <SkipForward className="h-4 w-4" />
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-black/60 px-4 py-2.5 text-sm font-medium text-white">
            Podrás saltar en {skipIn}s
          </div>
        )}
      </div>
    </div>
  );
}
