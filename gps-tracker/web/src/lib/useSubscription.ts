import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import type { Payment, Subscription } from './types';

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*, plans(*)')
      .eq('owner_id', user.id)
      .maybeSingle();
    setSubscription(sub as Subscription | null);

    if (sub) {
      const { data: pays } = await supabase
        .from('payments')
        .select('*')
        .eq('subscription_id', sub.id)
        .order('paid_at', { ascending: false });
      setPayments((pays as Payment[]) ?? []);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  const simulatePayment = useCallback(
    async (amountCents: number) => {
      if (!subscription) return { error: 'no_subscription' };
      const { error } = await supabase.rpc('record_payment', {
        p_subscription_id: subscription.id,
        p_amount_cents: amountCents,
        p_method: 'manual',
        p_note: 'Pago simulado desde el dashboard',
      });
      if (!error) await reload();
      return { error: error?.message ?? null };
    },
    [subscription, reload],
  );

  return { subscription, payments, loading, reload, simulatePayment };
}
