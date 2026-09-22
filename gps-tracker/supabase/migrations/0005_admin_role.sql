-- Rol de administrador: el negocio que instala los GPS necesita ver TODOS
-- los vehículos de TODOS los clientes desde una sola cuenta (para dar
-- soporte, revisar quién dejó de reportar, y cobrar/cortar servicio),
-- mientras que cada cliente sigue viendo solo lo suyo.

alter table profiles
  add column if not exists role text not null default 'client'
  check (role in ('admin', 'client'));

-- security definer para poder consultarla desde otras policies sin caer
-- en recursión infinita de RLS sobre la propia tabla profiles.
create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function is_admin() to authenticated;

-- profiles: el admin puede ver todos los perfiles (para mostrar nombre del
-- cliente dueño de cada vehículo en el panel de admin).
create policy "profiles: admin ve todos" on profiles
  for select using (is_admin());

-- subscriptions / payments: el admin puede ver y el admin puede registrar
-- pagos de cualquier cliente (cobro en persona, transferencia, etc.).
create policy "subscriptions: admin ve todas" on subscriptions
  for select using (is_admin());

create policy "payments: admin ve todos" on payments
  for select using (is_admin());

-- vehicles / devices / positions: el admin ve todo, incluido el historial
-- de recorridos, para poder dar soporte técnico si un cliente reporta que
-- "el GPS no marca bien".
create policy "vehicles: admin ve todos" on vehicles
  for select using (is_admin());

create policy "devices: admin ve todos" on devices
  for select using (is_admin());

create policy "positions: admin ve todas" on positions
  for select using (is_admin());

-- record_payment ya valida "auth.uid() = owner_id" cuando quien llama es
-- un usuario normal; se amplía para que el admin también pueda registrar
-- el pago de cualquier suscripción (cobro manual en nombre del cliente).
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

  if auth.uid() is not null and auth.uid() <> v_owner and not is_admin() then
    raise exception 'not_authorized';
  end if;

  insert into payments (subscription_id, amount_cents, method, note, status)
  values (p_subscription_id, p_amount_cents, p_method, p_note, 'paid');

  update subscriptions
  set status = 'active',
      current_period_start = now(),
      current_period_end = greatest(v_current_end, now()) + interval '1 month',
      updated_at = now()
  where id = p_subscription_id;
end;
$$;
