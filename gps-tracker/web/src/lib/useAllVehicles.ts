import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import type { Vehicle } from './types';

/**
 * Igual que useVehicles, pero SIN filtrar por owner_id: solo funciona para
 * una cuenta con role='admin' (la policy "vehicles: admin ve todos" es la
 * que realmente controla qué filas llegan, tanto en la carga inicial como
 * en los eventos de Realtime).
 */
export function useAllVehicles() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from('vehicles').select('*').order('created_at', { ascending: true });
    setVehicles((data as Vehicle[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('admin-vehicles-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, (payload) => {
        setVehicles((current) => {
          if (payload.eventType === 'INSERT') return [...current, payload.new as Vehicle];
          if (payload.eventType === 'UPDATE') {
            return current.map((v) => (v.id === payload.new.id ? { ...v, ...(payload.new as Vehicle) } : v));
          }
          if (payload.eventType === 'DELETE') return current.filter((v) => v.id !== payload.old.id);
          return current;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { vehicles, loading, reload };
}
