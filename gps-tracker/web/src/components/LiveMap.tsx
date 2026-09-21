import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import L from 'leaflet';
import type { Vehicle } from '../lib/types';
import { isStale } from '../lib/types';

// Los iconos default de Leaflet buscan imágenes por una ruta que Vite no
// resuelve igual que un bundler clásico; se reconstruyen a mano con CDN.
const onlineIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function FitToVehicles({ vehicles }: { vehicles: Vehicle[] }) {
  const map = useMap();

  useEffect(() => {
    const withPosition = vehicles.filter((v) => v.last_lat != null && v.last_lng != null);
    if (withPosition.length === 0) return;
    const bounds = L.latLngBounds(
      withPosition.map((v) => [v.last_lat as number, v.last_lng as number]),
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [vehicles, map]);

  return null;
}

export function LiveMap({ vehicles }: { vehicles: Vehicle[] }) {
  const defaultCenter: [number, number] = [19.4326, -99.1332]; // CDMX, fallback

  return (
    <MapContainer center={defaultCenter} zoom={11} className="h-full w-full rounded-lg">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToVehicles vehicles={vehicles} />
      {vehicles
        .filter((v) => v.last_lat != null && v.last_lng != null)
        .map((v) => (
          <Marker key={v.id} position={[v.last_lat as number, v.last_lng as number]} icon={onlineIcon}>
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{v.alias}</p>
                <p>Placa: {v.plate}</p>
                <p>Velocidad: {v.last_speed_kmh?.toFixed(0) ?? '—'} km/h</p>
                <p>
                  Estado:{' '}
                  {isStale(v.last_seen_at) ? (
                    <span className="text-red-600">sin señal</span>
                  ) : (
                    <span className="text-green-600">en línea</span>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  Últ. reporte: {v.last_seen_at ? new Date(v.last_seen_at).toLocaleString() : 'nunca'}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}
