-- ============================================================
-- NOVA KIDS — esquema inicial para Supabase
-- Ejecuta este archivo en el SQL Editor de Supabase (o con `supabase db push`).
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- Categorías ----------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  image text,
  kind text not null default 'garment' check (kind in ('garment', 'gender', 'new', 'sale')),
  gender text check (gender in ('nina', 'nino', 'unisex')),
  sort_order int not null default 0,
  visible boolean not null default true
);

-- ---------- Productos ----------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  sku text not null,
  name text not null,
  description text not null default '',
  price numeric(10, 2) not null check (price >= 0),
  compare_at_price numeric(10, 2) check (compare_at_price is null or compare_at_price >= 0),
  category_id uuid not null references public.categories (id) on delete restrict,
  gender text not null default 'unisex' check (gender in ('nina', 'nino', 'unisex')),
  sizes text[] not null default '{}',
  colors jsonb not null default '[]',      -- [{ "name": "Azul", "hex": "#1E6BFF" }]
  stock jsonb not null default '{}',       -- { "8|Azul": 5 }
  images jsonb not null default '[]',      -- [{ "url": "...", "alt": "..." }] la primera es la principal
  status text not null default 'draft' check (status in ('active', 'draft', 'archived')),
  is_new boolean not null default false,
  featured boolean not null default false,
  sold_count int not null default 0,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_status_idx on public.products (status);
create index if not exists products_category_idx on public.products (category_id);

-- ---------- Pedidos ----------
create sequence if not exists public.order_number_seq start 1001;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('NK-' || lpad(nextval('public.order_number_seq')::text, 6, '0')),
  customer jsonb not null,
  address jsonb not null,
  items jsonb not null,
  shipping_method_id text not null,
  shipping_label text not null,
  payment_method text not null check (payment_method in ('mercadopago', 'stripe', 'paypal', 'transferencia')),
  payment_reference text,
  coupon_code text,
  subtotal numeric(10, 2) not null,
  discount numeric(10, 2) not null default 0,
  shipping numeric(10, 2) not null default 0,
  total numeric(10, 2) not null,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'pagado', 'preparando', 'enviado', 'entregado', 'cancelado')),
  history jsonb not null default '[]',
  -- Reservado para cuentas de cliente (Supabase Auth).
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_created_idx on public.orders (created_at desc);

-- ---------- Seguridad (RLS) ----------
-- La tienda lee y escribe desde el servidor con la service role key.
-- El público solo puede leer productos activos y categorías visibles.
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;

drop policy if exists "categorias visibles" on public.categories;
create policy "categorias visibles" on public.categories for select using (visible);

drop policy if exists "productos activos" on public.products;
create policy "productos activos" on public.products for select using (status = 'active');

drop policy if exists "mis pedidos" on public.orders;
create policy "mis pedidos" on public.orders for select using (auth.uid() is not null and auth.uid() = user_id);

-- ---------- Crear pedido descontando inventario (atómico) ----------
create or replace function public.place_order(p_order jsonb, p_items jsonb)
returns public.orders
language plpgsql
as $$
declare
  it jsonb;
  k text;
  qty int;
  avail int;
  result public.orders;
begin
  for it in select * from jsonb_array_elements(p_items) loop
    k := (it ->> 'size') || '|' || (it ->> 'color');
    qty := (it ->> 'quantity')::int;
    avail := null;
    select coalesce((stock ->> k)::int, 0) into avail
      from public.products where id = (it ->> 'productId')::uuid for update;
    if avail is null or avail < qty then
      raise exception 'OUT_OF_STOCK:%', it::text;
    end if;
    update public.products
      set stock = jsonb_set(stock, array[k], to_jsonb(avail - qty), true),
          sold_count = sold_count + qty
      where id = (it ->> 'productId')::uuid;
  end loop;

  insert into public.orders (
    customer, address, items, shipping_method_id, shipping_label, payment_method,
    payment_reference, coupon_code, subtotal, discount, shipping, total, status, history
  ) values (
    p_order -> 'customer', p_order -> 'address', p_order -> 'items',
    p_order ->> 'shippingMethodId', p_order ->> 'shippingLabel', p_order ->> 'paymentMethod',
    p_order ->> 'paymentReference', p_order ->> 'couponCode',
    (p_order ->> 'subtotal')::numeric, (p_order ->> 'discount')::numeric,
    (p_order ->> 'shipping')::numeric, (p_order ->> 'total')::numeric,
    'pendiente', jsonb_build_array(jsonb_build_object('status', 'pendiente', 'at', now()))
  ) returning * into result;

  return result;
end;
$$;

-- ---------- Cambiar estado (devuelve inventario al cancelar) ----------
create or replace function public.set_order_status(p_id uuid, p_status text, p_note text default null)
returns public.orders
language plpgsql
as $$
declare
  o public.orders;
  it jsonb;
  dir int := 0;
  k text;
  result public.orders;
begin
  select * into o from public.orders where id = p_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if o.status = p_status then
    return o;
  end if;
  if p_status = 'cancelado' then dir := 1;
  elsif o.status = 'cancelado' then dir := -1;
  end if;
  if dir <> 0 then
    for it in select * from jsonb_array_elements(o.items) loop
      k := (it ->> 'size') || '|' || (it ->> 'color');
      update public.products
        set stock = jsonb_set(stock, array[k], to_jsonb(coalesce((stock ->> k)::int, 0) + dir * (it ->> 'quantity')::int), true),
            sold_count = greatest(0, sold_count - dir * (it ->> 'quantity')::int)
        where id = (it ->> 'productId')::uuid;
    end loop;
  end if;
  update public.orders
    set status = p_status,
        updated_at = now(),
        history = history || jsonb_build_array(
          jsonb_strip_nulls(jsonb_build_object('status', p_status, 'at', now(), 'note', p_note)))
    where id = p_id
    returning * into result;
  return result;
end;
$$;

revoke execute on function public.place_order(jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.set_order_status(uuid, text, text) from public, anon, authenticated;

-- ---------- Almacenamiento de imágenes ----------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- ---------- Categorías iniciales ----------
insert into public.categories (slug, name, description, image, kind, gender, sort_order) values
  ('ninas', 'Niñas', 'Prendas para exploradoras con estilo.', '/categories/ninas.svg', 'gender', 'nina', 1),
  ('ninos', 'Niños', 'Ropa cómoda para aventuras sin límite.', '/categories/ninos.svg', 'gender', 'nino', 2),
  ('conjuntos', 'Conjuntos', 'Looks completos listos para despegar.', '/categories/conjuntos.svg', 'garment', null, 3),
  ('playeras', 'Playeras', 'Básicos y estampados de otra galaxia.', '/categories/playeras.svg', 'garment', null, 4),
  ('shorts', 'Shorts', 'Libertad de movimiento para jugar.', '/categories/shorts.svg', 'garment', null, 5),
  ('sudaderas', 'Sudaderas', 'Abrigo suave para noches estrelladas.', '/categories/sudaderas.svg', 'garment', null, 6),
  ('novedades', 'Novedades', 'Lo más reciente en llegar a la estación.', '/categories/novedades.svg', 'new', null, 7),
  ('ofertas', 'Ofertas', 'Precios que impulsan tu compra.', '/categories/ofertas.svg', 'sale', null, 8)
on conflict (slug) do nothing;
