import { useEffect, useRef, useState } from 'react';

const INGEST_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest-position`;
const MIN_INTERVAL_MS = 10_000; // no mandar más de 1 posición cada 10s, para cuidar batería/datos
const STORAGE_KEY = 'gps_tracker_device_token';

type Status = 'idle' | 'tracking' | 'error';

/**
 * Página que convierte el celular del conductor en el "tracker GPS".
 * No requiere iniciar sesión con cuenta de Supabase: se autentica con el
 * device_token que el dueño de la flotilla generó una vez en /vehicles y
 * le compartió (por WhatsApp, QR, lo que sea). Pensada para abrirse desde
 * el celular y quedar como acceso directo en la pantalla de inicio (PWA).
 */
export function DriverPage() {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '');
  const [status, setStatus] = useState<Status>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);
  const watchId = useRef<number | null>(null);
  const lastSendRef = useRef(0);

  useEffect(() => {
    return () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  function startTracking() {
    if (!token.trim()) {
      setLastError('Pega primero el token que te dio el dueño de la flotilla.');
      return;
    }
    localStorage.setItem(STORAGE_KEY, token.trim());
    setLastError(null);

    if (!('geolocation' in navigator)) {
      setLastError('Este navegador no soporta geolocalización.');
      setStatus('error');
      return;
    }

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastSendRef.current < MIN_INTERVAL_MS) return;
        lastSendRef.current = now;
        sendPosition(position);
      },
      (err) => {
        setLastError(err.message);
        setStatus('error');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );

    setStatus('tracking');
  }

  function stopTracking() {
    if (watchId.current != null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setStatus('idle');
  }

  async function sendPosition(position: GeolocationPosition) {
    try {
      const res = await fetch(INGEST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_token: token.trim(),
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          speed_kmh: position.coords.speed != null ? position.coords.speed * 3.6 : null,
          heading: position.coords.heading,
          accuracy_m: position.coords.accuracy,
          recorded_at: new Date(position.timestamp).toISOString(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setLastError(body.message ?? `Error del servidor (${res.status})`);
        if (res.status === 401) stopTracking();
        return;
      }
      setLastError(null);
      setLastSentAt(new Date());
    } catch {
      setLastError('No se pudo conectar al servidor. Se reintentará en el próximo reporte.');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-6 text-center">
        <h1 className="text-lg font-bold mb-1">Modo conductor</h1>
        <p className="text-sm text-gray-500 mb-6">Convierte este celular en el rastreador del vehículo.</p>

        <input
          className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
          placeholder="Token del dispositivo"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          disabled={status === 'tracking'}
        />

        {status !== 'tracking' ? (
          <button
            onClick={startTracking}
            className="w-full bg-green-600 text-white rounded-lg py-2 text-sm font-medium"
          >
            Empezar a compartir ubicación
          </button>
        ) : (
          <button
            onClick={stopTracking}
            className="w-full bg-red-600 text-white rounded-lg py-2 text-sm font-medium"
          >
            Detener
          </button>
        )}

        {status === 'tracking' && (
          <p className="text-sm text-green-700 mt-3">
            Compartiendo ubicación cada {MIN_INTERVAL_MS / 1000}s
            {lastSentAt ? ` · último envío ${lastSentAt.toLocaleTimeString()}` : ''}
          </p>
        )}
        {lastError && <p className="text-sm text-red-600 mt-3">{lastError}</p>}

        <p className="text-xs text-gray-400 mt-6">
          Deja esta pestaña abierta y la pantalla encendida mientras conduces. Para que no se apague el
          GPS al minimizar el navegador, instala esta página como app (menú del navegador → "Agregar a
          pantalla de inicio").
        </p>
      </div>
    </div>
  );
}
