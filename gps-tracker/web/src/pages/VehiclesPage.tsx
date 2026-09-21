import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useVehicles } from '../lib/useVehicles';
import type { Device } from '../lib/types';

function NewVehicleForm({ onCreated }: { onCreated: () => void }) {
  const [alias, setAlias] = useState('');
  const [plate, setPlate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('vehicles').insert({
      owner_id: userData.user?.id,
      alias,
      plate,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setAlias('');
    setPlate('');
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end mb-6">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Alias</label>
        <input
          className="border rounded-lg px-3 py-2 text-sm"
          placeholder="Camioneta reparto 1"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Placa</label>
        <input
          className="border rounded-lg px-3 py-2 text-sm"
          placeholder="ABC-123-A"
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          required
        />
      </div>
      <button
        disabled={saving}
        className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {saving ? 'Guardando...' : 'Agregar vehículo'}
      </button>
      {error && <p className="text-sm text-red-600 w-full">{error}</p>}
    </form>
  );
}

function DeviceRow({ device }: { device: Device }) {
  return (
    <li className="flex items-center justify-between text-sm border-t py-2">
      <span>
        {device.type === 'phone' ? '📱 Celular' : '📡 Hardware GPS'}
        {device.external_id ? ` — IMEI ${device.external_id}` : ''}
      </span>
      <span className={device.is_active ? 'text-green-600' : 'text-gray-400'}>
        {device.is_active ? 'activo' : 'inactivo'}
      </span>
    </li>
  );
}

function VehicleCard({ vehicleId, alias, plate }: { vehicleId: string; alias: string; plate: string }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loadedDevices, setLoadedDevices] = useState(false);
  const [newToken, setNewToken] = useState<{ type: string; token: string } | null>(null);
  const [creating, setCreating] = useState(false);

  async function loadDevices() {
    const { data } = await supabase.from('devices').select('*').eq('vehicle_id', vehicleId);
    setDevices((data as Device[]) ?? []);
    setLoadedDevices(true);
  }

  async function createDevice(type: 'phone' | 'hardware') {
    setCreating(true);
    setNewToken(null);
    const externalId =
      type === 'hardware' ? window.prompt('IMEI del tracker (15 dígitos):') ?? undefined : undefined;
    const { data, error } = await supabase.rpc('create_device', {
      p_vehicle_id: vehicleId,
      p_type: type,
      p_external_id: externalId ?? null,
    });
    setCreating(false);
    if (error) {
      alert(error.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    setNewToken({ type, token: row.device_token });
    loadDevices();
  }

  return (
    <div className="border rounded-xl p-4 bg-white">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{alias}</p>
          <p className="text-sm text-gray-500">{plate}</p>
        </div>
        <button
          className="text-xs text-blue-600"
          onClick={() => (loadedDevices ? setLoadedDevices(false) : loadDevices())}
        >
          {loadedDevices ? 'Ocultar dispositivos' : 'Ver dispositivos'}
        </button>
      </div>

      {loadedDevices && (
        <div className="mt-3">
          <ul>
            {devices.map((d) => (
              <DeviceRow key={d.id} device={d} />
            ))}
            {devices.length === 0 && <p className="text-sm text-gray-400 py-2">Sin dispositivos aún.</p>}
          </ul>

          <div className="flex gap-2 mt-3">
            <button
              disabled={creating}
              onClick={() => createDevice('phone')}
              className="text-xs border rounded-lg px-3 py-1.5 disabled:opacity-50"
            >
              + Token para celular
            </button>
            <button
              disabled={creating}
              onClick={() => createDevice('hardware')}
              className="text-xs border rounded-lg px-3 py-1.5 disabled:opacity-50"
            >
              + Token para tracker GPS
            </button>
          </div>

          {newToken && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
              <p className="font-medium text-amber-800 mb-1">
                Guarda este token ahora — no se volverá a mostrar:
              </p>
              <code className="block bg-white rounded px-2 py-1 break-all">{newToken.token}</code>
              <p className="text-amber-700 mt-2">
                {newToken.type === 'phone'
                  ? 'Pégalo en la página /driver desde el celular del conductor.'
                  : 'Agrégalo a device-map.json del device-gateway, junto con el IMEI que diste.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function VehiclesPage() {
  const { vehicles, loading, reload } = useVehicles();

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-lg font-bold mb-4">Vehículos</h1>
      <NewVehicleForm onCreated={reload} />

      {loading && <p className="text-sm text-gray-500">Cargando...</p>}
      <div className="space-y-3">
        {vehicles.map((v) => (
          <VehicleCard key={v.id} vehicleId={v.id} alias={v.alias} plate={v.plate} />
        ))}
      </div>
    </div>
  );
}
