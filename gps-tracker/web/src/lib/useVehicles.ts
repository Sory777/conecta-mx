import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import type { Vehicle } from './types';

/**
 * Carga los vehículos del dueño y se suscribe a Supabase Realtime para
 * reflejar cambios en vivo: cada vez que llega una posición nueva, el
 * trigger de la base de datos actualiza vehicles.last_lat/last_lng, y ese
 * UPDATE llega aquí por WebSocket sin que el frontend tenga que hacer
 * polling.
 */
export function useVehicles() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('vehicles')
      .select('*')
      .order('created_at', { ascending: true });
    setVehicles((data as Vehicle[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('vehicles-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vehicles', filter: `owner_id=eq.${user.id}` },
        (payload) => {
          setVehicles((current) => {
            if (payload.eventType === 'INSERT') {
              return [...current, payload.new as Vehicle];
            }
            if (payload.eventType === 'UPDATE') {
              return current.map((v) => (v.id === payload.new.id ? { ...v, ...(payload.new as Vehicle) } : v));
            }
            if (payload.eventType === 'DELETE') {
              return current.filter((v) => v.id !== payload.old.id);
            }
            return current;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { vehicles, loading, reload };
}
