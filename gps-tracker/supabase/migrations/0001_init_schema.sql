-- ConectaMX GPS Tracker — esquema inicial
-- Modelo: un "owner" (dueño de flotilla) tiene una suscripcion mensual,
-- puede registrar varios vehiculos, cada vehiculo tiene un dispositivo
-- (celular o hardware GPS) que envia posiciones.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Perfiles (1:1 con auth.users de Supabase)
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Planes de suscripcion (catalogo, no dependen del owner)
-- ---------------------------------------------------------------------------
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,               -- 'basic', 'pro', 'fleet'
  name text not null,
  price_cents integer not null,            -- ej. 14900 = $149.00 MXN
  currency text not null default 'MXN',
  max_vehicles integer not null default 1,
  billing_interval text not null default 'month' check (billing_interval in ('month','year')),
  created_at timestamptz not null default now()
);

insert into plans (code, name, price_cents, max_vehicles)
values
  ('basic', 'Básico', 14900, 1),
  ('pro', 'Pro', 39900, 5),
  ('fleet', 'Flotilla', 99900, 25)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Suscripciones: una activa por owner. Simulada (sin pasarela real todavia).
-- ---------------------------------------------------------------------------
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  plan_id uuid not null references plans(id),
  status text not null default 'trialing'
    check (status in ('trialing','active','past_due','canceled','expired')),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default (now() + interval '7 days'),
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists one_subscription_per_owner
  on subscriptions (owner_id);

-- ---------------------------------------------------------------------------
-- Pagos: bitacora de cobros. Hoy se insertan "a mano" (simulado);
-- el dia que se conecte Stripe, el webhook inserta aqui igual.
-- ---------------------------------------------------------------------------
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  amount_cents integer not null,
  currency text not null default 'MXN',
  status text not null default 'paid' check (status in ('paid','pending','failed','refunded')),
  method text not null default 'manual' check (method in ('manual','stripe','transfer','cash')),
  note text,
  paid_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Vehiculos
-- ---------------------------------------------------------------------------
create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  alias text not null,               -- "Camioneta reparto 1"
  plate text not null,
  brand text,
  model text,
  color text,
  created_at timestamptz not null default now(),
  -- Cache de la ultima posicion conocida, para que el dashboard no tenga
  -- que escanear la tabla "positions" completa en cada carga.
  last_lat double precision,
  last_lng double precision,
  last_speed_kmh double precision,
  last_heading double precision,
  last_seen_at timestamptz
);

create index if not exists vehicles_owner_idx on vehicles (owner_id);

-- ---------------------------------------------------------------------------
-- Dispositivos: la fuente de datos GPS de un vehiculo.
-- type = 'phone'    -> app/PWA en el celular del conductor (usa navigator.geolocation)
-- type = 'hardware' -> tracker GPS/GSM fisico (protocolo GT06 via device-gateway)
--
-- token_hash: el dispositivo se autentica con un token propio (NO con la
-- sesion del dueño), asi si se pierde el celular o se roba el hardware,
-- solo hay que revocar ese token, no la cuenta completa.
-- ---------------------------------------------------------------------------
create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  type text not null check (type in ('phone','hardware')),
  external_id text,                  -- IMEI para hardware, opcional para phone
  token_hash text not null,          -- sha256(token), nunca se guarda en claro
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create index if not exists devices_vehicle_idx on devices (vehicle_id);
create unique index if not exists devices_token_hash_idx on devices (token_hash);

-- ---------------------------------------------------------------------------
-- Posiciones: historial completo (para reportes/recorridos). El dashboard
-- en vivo usa vehicles.last_* (via Realtime); esta tabla es la bitacora.
-- ---------------------------------------------------------------------------
create table if not exists positions (
  id bigint generated always as identity primary key,
  device_id uuid not null references devices(id) on delete cascade,
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  speed_kmh double precision,
  heading double precision,
  accuracy_m double precision,
  recorded_at timestamptz not null,   -- hora que reporta el dispositivo/GPS
  received_at timestamptz not null default now() -- hora que llego al servidor
);

create index if not exists positions_vehicle_time_idx
  on positions (vehicle_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- Trigger: cada INSERT en positions actualiza el cache en vehicles.
-- Esto es lo que hace que el mapa se sienta "en tiempo real": el frontend
-- escucha cambios en la fila de vehicles via Supabase Realtime.
-- ---------------------------------------------------------------------------
create or replace function fn_update_vehicle_last_position()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update vehicles
  set last_lat = new.lat,
      last_lng = new.lng,
      last_speed_kmh = new.speed_kmh,
      last_heading = new.heading,
      last_seen_at = new.recorded_at
  where id = new.vehicle_id;

  update devices
  set last_seen_at = new.received_at
  where id = new.device_id;

  return new;
end;
$$;

drop trigger if exists trg_update_vehicle_last_position on positions;
create trigger trg_update_vehicle_last_position
  after insert on positions
  for each row execute function fn_update_vehicle_last_position();

-- ---------------------------------------------------------------------------
-- Trigger: crear perfil + suscripcion de prueba al registrarse.
-- ---------------------------------------------------------------------------
create or replace function fn_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  basic_plan_id uuid;
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));

  select id into basic_plan_id from plans where code = 'basic' limit 1;

  insert into subscriptions (owner_id, plan_id, status, current_period_end)
  values (new.id, basic_plan_id, 'trialing', now() + interval '7 days');

  return new;
end;
$$;

drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function fn_handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table subscriptions enable row level security;
alter table payments enable row level security;
alter table vehicles enable row level security;
alter table devices enable row level security;
alter table positions enable row level security;
alter table plans enable row level security;

create policy "profiles: ver el propio" on profiles
  for select using (auth.uid() = id);
create policy "profiles: editar el propio" on profiles
  for update using (auth.uid() = id);

create policy "plans: publico puede leer" on plans
  for select using (true);

create policy "subscriptions: solo el dueno" on subscriptions
  for select using (auth.uid() = owner_id);

create policy "payments: solo el dueno" on payments
  for select using (
    subscription_id in (select id from subscriptions where owner_id = auth.uid())
  );

create policy "vehicles: CRUD del propio dueno" on vehicles
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "devices: solo via su vehiculo" on devices
  for all using (
    vehicle_id in (select id from vehicles where owner_id = auth.uid())
  ) with check (
    vehicle_id in (select id from vehicles where owner_id = auth.uid())
  );

create policy "positions: solo via su vehiculo" on positions
  for select using (
    vehicle_id in (select id from vehicles where owner_id = auth.uid())
  );

-- Nota: las inserciones a "positions" NO se hacen con el JWT del dueno.
-- Las hace la Edge Function "ingest-position" usando la service_role key,
-- despues de validar el token del dispositivo a mano. Por eso no hay
-- policy de INSERT para usuarios autenticados normales.
