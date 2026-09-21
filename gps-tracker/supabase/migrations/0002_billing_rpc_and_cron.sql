-- RPC para "pagar" una suscripción (hoy manual, mañana lo llama el webhook
-- de Stripe con los mismos parámetros). Extiende el período y reactiva.
create or replace function record_payment(
  p_subscription_id uuid,
  p_amount_cents integer,
  p_method text default 'manual',
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_current_end timestamptz;
begin
  select owner_id, current_period_end into v_owner, v_current_end
  from subscriptions where id = p_subscription_id;

  if v_owner is null then
    raise exception 'subscription_not_found';
  end if;

  -- Solo el propio dueño puede registrar su pago (o el service_role, que
  -- se ejecuta sin auth.uid() y por lo tanto no pasa por esta validación
  -- gracias a security definer + el check explícito abajo).
  if auth.uid() is not null and auth.uid() <> v_owner then
    raise exception 'not_authorized';
  end if;

  insert into payments (subscription_id, amount_cents, method, note, status)
  values (p_subscription_id, p_amount_cents, p_method, p_note, 'paid');

  update subscriptions
  set status = 'active',
      current_period_start = now(),
      -- si ya estaba vencida, el nuevo periodo empieza hoy; si pagó antes
      -- de que venciera, se le respeta lo que le quedaba y se le suma un mes.
      current_period_end = greatest(v_current_end, now()) + interval '1 month',
      updated_at = now()
  where id = p_subscription_id;
end;
$$;

grant execute on function record_payment(uuid, integer, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Cron: llama billing-cycle todos los días a las 03:00 UTC.
-- Requiere las extensiones pg_cron y pg_net (disponibles en Supabase).
-- Sustituye <PROJECT_REF> y <SERVICE_ROLE_KEY> antes de aplicar, o hazlo
-- desde el SQL editor del dashboard de Supabase con esos valores reales.
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'gps-tracker-billing-cycle',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/billing-cycle',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
