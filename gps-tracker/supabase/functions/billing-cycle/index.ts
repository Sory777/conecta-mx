// Edge Function: billing-cycle
//
// Se ejecuta periódicamente (via pg_cron o un scheduler externo, ver README)
// y revisa TODAS las suscripciones:
//
//   - Si current_period_end ya pasó y status era 'active' o 'trialing'
//     -> pasa a 'past_due' (aún no se cancela, se le da un margen).
//   - Si lleva más de GRACE_DAYS en 'past_due'
//     -> pasa a 'expired'. Desde ese momento, ingest-position rechaza
//        cualquier posición nueva de sus vehículos (ver esa función).
//
// Cuando el dueño "paga" (hoy: botón "Marcar como pagado" en el dashboard,
// mañana: webhook de Stripe), se inserta una fila en `payments` y se
// extiende current_period_end + se vuelve a 'active'. Eso pasa en el
// dashboard directamente (RPC `record_payment`), no aquí.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GRACE_DAYS = 3;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (_req) => {
  const now = new Date();

  const { data: dueSubs, error: dueError } = await admin
    .from('subscriptions')
    .select('id, status, current_period_end')
    .in('status', ['active', 'trialing'])
    .lt('current_period_end', now.toISOString());

  if (dueError) {
    console.error('fetch_due_failed', dueError);
    return new Response(JSON.stringify({ error: 'fetch_due_failed' }), { status: 500 });
  }

  let markedPastDue = 0;
  for (const sub of dueSubs ?? []) {
    const { error } = await admin
      .from('subscriptions')
      .update({ status: 'past_due', updated_at: now.toISOString() })
      .eq('id', sub.id);
    if (!error) markedPastDue++;
  }

  const graceLimit = new Date(now.getTime() - GRACE_DAYS * 24 * 60 * 60 * 1000);

  const { data: overdueSubs, error: overdueError } = await admin
    .from('subscriptions')
    .select('id, current_period_end')
    .eq('status', 'past_due')
    .lt('current_period_end', graceLimit.toISOString());

  if (overdueError) {
    console.error('fetch_overdue_failed', overdueError);
    return new Response(JSON.stringify({ error: 'fetch_overdue_failed' }), { status: 500 });
  }

  let markedExpired = 0;
  for (const sub of overdueSubs ?? []) {
    const { error } = await admin
      .from('subscriptions')
      .update({ status: 'expired', updated_at: now.toISOString() })
      .eq('id', sub.id);
    if (!error) markedExpired++;
  }

  return new Response(
    JSON.stringify({ ok: true, markedPastDue, markedExpired, checkedAt: now.toISOString() }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
