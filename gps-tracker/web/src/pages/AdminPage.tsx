import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAllVehicles } from '../lib/useAllVehicles';
import { LiveMap } from '../components/LiveMap';
import { isStale } from '../lib/types';
import type { Profile, Subscription } from '../lib/types';

const statusLabel: Record<string, { text: string; color: string }> = {
  trialing: { text: 'Prueba', color: 'bg-blue-100 text-blue-700' },
  active: { text: 'Al corriente', color: 'bg-green-100 text-green-700' },
  past_due: { text: 'Pago pendiente', color: 'bg-amber-100 text-amber-700' },
  expired: { text: 'Vencida', color: 'bg-red-100 text-red-700' },
  canceled: { text: 'Cancelada', color: 'bg-gray-100 text-gray-600' },
};

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(cents / 100);
}

/**
 * Vista del instalador/dueño del negocio: TODOS los vehículos de TODOS los
 * clientes en un solo mapa, más una tabla para cobrar y dar seguimiento.
 * Solo accesible si profiles.role = 'admin' (ver migración 0005 y RLS).
 */
export function AdminPage() {
  const { vehicles, loading: loadingVehicles } = useAllVehicles();
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const [subsByOwner, setSubsByOwner] = useState<Record<string, Subscription>>({});
  const [loadingExtra, setLoadingExtra] = useState(true);
  const [view, setView] = useState<'table' | 'map'>('table');

  async function loadExtra() {
    setLoadingExtra(true);
    const [{ data: profiles }, { data: subs }] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('subscriptions').select('*, plans(*)'),
    ]);

    const pMap: Record<string, Profile> = {};
    for (const p of (profiles as Profile[]) ?? []) pMap[p.id] = p;
    setProfilesById(pMap);

    const sMap: Record<string, Subscription> = {};
    for (const s of (subs as Subscription[]) ?? []) sMap[s.owner_id] = s;
    setSubsByOwner(sMap);

    setLoadingExtra(false);
  }

  useEffect(() => {
    loadExtra();
  }, []);

  async function markPaid(subscription: Subscription) {
    if (!subscription.plans) return;
    const ok = window.confirm(
      `¿Registrar pago de ${formatMoney(subscription.plans.price_cents, subscription.plans.currency)} y extender un mes?`,
    );
    if (!ok) return;
    const { error } = await supabase.rpc('record_payment', {
      p_subscription_id: subscription.id,
      p_amount_cents: subscription.plans.price_cents,
      p_method: 'manual',
      p_note: 'Cobro registrado por el administrador',
    });
    if (error) {
      alert(error.message);
      return;
    }
    loadExtra();
  }

  const loading = loadingVehicles || loadingExtra;

  return (
    <div className="h-full flex flex-col">
      <div className="border-b bg-white px-4 py-2 flex items-center justify-between">
        <h1 className="font-semibold">
          Panel de administrador — {vehicles.length} vehículo(s) de {Object.keys(profilesById).length} cuenta(s)
        </h1>
        <div className="flex gap-2 text-sm">
          <button
            onClick={() => setView('table')}
            className={`px-3 py-1 rounded-lg ${view === 'table' ? 'bg-blue-600 text-white' : 'border'}`}
          >
            Lista y cobros
          </button>
          <button
            onClick={() => setView('map')}
            className={`px-3 py-1 rounded-lg ${view === 'map' ? 'bg-blue-600 text-white' : 'border'}`}
          >
            Mapa global
          </button>
        </div>
      </div>

      {loading && <p className="p-4 text-sm text-gray-500">Cargando...</p>}

      {!loading && view === 'map' && (
        <div className="flex-1 p-2">
          <LiveMap vehicles={vehicles} />
        </div>
      )}

      {!loading && view === 'table' && (
        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full text-sm bg-white border rounded-xl overflow-hidden">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Vehículo</th>
                <th className="px-3 py-2">Estado GPS</th>
                <th className="px-3 py-2">Suscripción</th>
                <th className="px-3 py-2">Vence</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {vehicles.map((v) => {
                const owner = profilesById[v.owner_id];
                const sub = subsByOwner[v.owner_id];
                const status = sub ? statusLabel[sub.status] ?? { text: sub.status, color: '' } : null;
                return (
                  <tr key={v.id}>
                    <td className="px-3 py-2">{owner?.full_name || '—'}</td>
                    <td className="px-3 py-2">
                      {v.alias} <span className="text-gray-400">({v.plate})</span>
                    </td>
                    <td className="px-3 py-2">
                      {isStale(v.last_seen_at) ? (
                        <span className="text-red-600">sin señal</span>
                      ) : (
                        <span className="text-green-600">en línea</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {status && <span className={`px-2 py-0.5 rounded-full text-xs ${status.color}`}>{status.text}</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {sub ? new Date(sub.current_period_end).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {sub && (
                        <button
                          onClick={() => markPaid(sub)}
                          className="text-xs border rounded-lg px-3 py-1.5 hover:bg-gray-50"
                        >
                          Marcar pagado
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {vehicles.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-400">
                    Aún no hay vehículos instalados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
