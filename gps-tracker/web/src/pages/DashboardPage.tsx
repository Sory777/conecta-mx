import { useVehicles } from '../lib/useVehicles';
import { LiveMap } from '../components/LiveMap';
import { isStale } from '../lib/types';

export function DashboardPage() {
  const { vehicles, loading } = useVehicles();

  return (
    <div className="h-full flex flex-col md:flex-row">
      <aside className="w-full md:w-72 border-r bg-white p-4 overflow-y-auto">
        <h2 className="font-semibold mb-3">Vehículos ({vehicles.length})</h2>
        {loading && <p className="text-sm text-gray-500">Cargando...</p>}
        <ul className="space-y-2">
          {vehicles.map((v) => (
            <li key={v.id} className="border rounded-lg p-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{v.alias}</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    isStale(v.last_seen_at) ? 'bg-red-500' : 'bg-green-500'
                  }`}
                  title={isStale(v.last_seen_at) ? 'Sin señal' : 'En línea'}
                />
              </div>
              <p className="text-gray-500">{v.plate}</p>
              <p className="text-gray-500">{v.last_speed_kmh?.toFixed(0) ?? '—'} km/h</p>
            </li>
          ))}
          {!loading && vehicles.length === 0 && (
            <p className="text-sm text-gray-500">
              Aún no tienes vehículos. Ve a la pestaña "Vehículos" para agregar el primero.
            </p>
          )}
        </ul>
      </aside>
      <div className="flex-1 p-2">
        <LiveMap vehicles={vehicles} />
      </div>
    </div>
  );
}
