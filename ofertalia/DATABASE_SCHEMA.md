# OFERTALIA — Esquema de base de datos (PostgreSQL / Supabase)

> Diseño lógico. Las migraciones SQL reales se escriben al comenzar la implementación.
> Convenciones: `id uuid default gen_random_uuid()`, `created_at` y `updated_at timestamptz`, montos en `numeric(12,2)` más `currency char(3)`, países ISO‑3166 alfa‑2, RLS activado en **todas** las tablas.

---

## 1. Diagrama de relaciones (resumen)

```
countries ─┬─< merchants >──< merchant_programs >── affiliate_networks
           │        │                 │
           │        │                 └─< program_rules
           │        └─< offers >─┬── categories (árbol)
           │                     ├── products (canónico) ─< price_observations
           │                     ├─< offer_scores
           │                     ├─< clicks >──< conversions
           │                     └─< travel_details (1:1, solo viajes)
           │
users (auth) ─< user_roles
users ─< saved_offers / alerts / category_follows ─< notifications_outbox
sources ─< import_runs ─< offers (origen)
discovery_candidates · ad_placements · sponsored_campaigns · job_runs · link_checks · audit_log
```

---

## 2. Catálogos base e internacionalización

```sql
countries (
  code char(2) primary key,            -- 'MX', 'US', 'ES'
  name text, default_currency char(3), default_locale text, timezone text,  -- 'America/Mexico_City'
  enabled boolean default false
)

categories (
  id uuid pk, parent_id uuid null references categories,
  slug text unique,                    -- 'tecnologia', 'celulares', 'vuelos'
  kind text check (kind in ('product','travel','service','finance','other')),
  is_virtual boolean default false,    -- 'ofertas-del-dia', 'flash-deals', 'menos-de-500' (se calculan, no se asignan)
  sort_order int, enabled boolean default true,
  seo_title text, seo_description text
)
category_translations (category_id, locale, name, description, primary key (category_id, locale))
```

Categorías semilla: Ofertas del día*, Flash Deals*, Tecnología › (Celulares, Computadoras, Videojuegos), Hogar › (Electrodomésticos), Moda, Belleza, Deportes, Herramientas, Viajes › (Hoteles, Vuelos, Paquetes, Renta de autos, Experiencias), Restaurantes, Servicios digitales, Software, Educación, Finanzas (desactivada por defecto), Otras ofertas.
Las de presupuesto (*virtuales*) son: menos de $500, menos de $1,000, menos de $5,000 y grandes descuentos (≥50% verificado).

---

## 3. Redes, comerciantes y programas (núcleo de la monetización)

```sql
affiliate_networks (
  id uuid pk, key text unique,                 -- 'awin','admitad','impact','amazon_associates','mercadolibre','travelpayouts','direct'
  name text, website text,
  api_capabilities jsonb,                      -- {productFeed, deepLinkApi, conversionsApi, webhooks}
  subid_param text,                            -- 'clickref' | 'subid' | 'subId1' ...
  credentials_ref text,                        -- NOMBRE del secreto en el Worker; jamás el valor
  enabled boolean default false,               -- interruptor global
  notes text
)

merchants (
  id uuid pk, slug text unique, name text, country_code char(2) references countries,
  website text, logo_url text,
  allowed_domains text[],                      -- allowlist para /go y el link checker
  trust_score smallint check (trust_score between 0 and 100),
  enabled boolean default true
)

merchant_programs (
  id uuid pk, merchant_id uuid references merchants, network_id uuid references affiliate_networks,
  country_code char(2), external_program_id text,         -- id del anunciante en la red
  status text check (status in (
    'researching','to_apply','applied','approved','rejected','paused','closed','manual_only')),
  monetization_model text check (monetization_model in ('cps','cpa','cpl','cpc','revshare','flat','none')),
  commission_rates jsonb,           -- [{category:'electronics', type:'percent', value:4.0}, {type:'fixed', value:36, currency:'USD', event:'lead'}]
  cookie_days numeric(6,2),         -- 1 = 24 h; 365 para DiscoverCars
  attribution_notes text,           -- 'solo estancias completadas', 'excluye ventas en app', ...
  -- capacidades / permisos (de los términos del programa)
  has_api boolean, has_feed boolean, allows_deeplink boolean,
  allows_price_display text check (allows_price_display in ('yes','api_only','no')),  -- Amazon = 'api_only'
  allows_email boolean, allows_cashback boolean, allows_coupons boolean,
  allows_brand_bidding boolean, allows_social boolean,
  requires_approval boolean, requires_kyc boolean, requires_contract boolean,
  min_payout numeric(12,2), payout_currency char(3),
  confidence char(1) check (confidence in ('A','B','C')),
  source_url text, verified_at timestamptz, verified_by uuid,
  enabled boolean default false,    -- interruptor por programa (no se usa hasta aprobarlo y activarlo)
  unique (merchant_id, network_id, country_code)
)

program_rules (                     -- reglas de enlace por programa (p. ej. Mercado Libre)
  id uuid pk, program_id uuid references merchant_programs,
  rule_type text check (rule_type in ('deny_url_pattern','allow_url_pattern','require_param','max_price_age_hours','disclosure_text')),
  value text, description text
)
```

Ejemplo de reglas para Mercado Libre: `deny_url_pattern` → `^https://www\.mercadolibre\.com\.mx/?$`, `/ofertas`, `/c/` (categorías), `/carrito`, `/tienda/`.
Ejemplo para Amazon: `allows_price_display='api_only'`, `max_price_age_hours=24` (verificar el texto vigente).

---

## 4. Fuentes e importación

```sql
sources (
  id uuid pk, key text unique,       -- 'awin_feed_xcaret', 'admitad_coppel', 'csv_upload', 'manual'
  type text check (type in ('api','feed','network','csv','manual','webhook')),
  network_id uuid null, program_id uuid null,
  schedule_cron text, config jsonb,  -- sin secretos
  enabled boolean default true, last_success_at timestamptz
)

import_runs (
  id uuid pk, source_id uuid, started_at, finished_at,
  status text, items_seen int, items_created int, items_updated int, items_rejected int,
  error_summary text, triggered_by uuid null
)
```

---

## 5. Productos canónicos, ofertas e historial de precios

```sql
products (                            -- entidad canónica para dedupe e historial entre fuentes
  id uuid pk, title_normalized text, brand text, model text,
  gtin text null, mpn text null,
  external_ids jsonb,                 -- {"asin":"B0..","meli":"MLM..","sku_samsung":".."}
  category_id uuid, attributes jsonb,
  unique nulls not distinct (gtin)
)

offers (
  id uuid pk,
  public_id text unique,              -- id corto aleatorio usado en /go/:offerId y en URLs
  slug text unique,
  product_id uuid null references products,
  merchant_id uuid not null, program_id uuid null, network_id uuid null,
  source_id uuid not null, import_run_id uuid null,
  source_offer_id text,               -- id del producto/oferta en la fuente
  campaign_id text null,              -- id de campaña en la red

  title text not null, description text, highlights text[],
  ai_generated boolean default false, ai_reviewed_by uuid null,
  image_url text,                     -- URL del CDN autorizado por la fuente
  category_id uuid, subcategory_id uuid null, tags text[],

  country_code char(2) not null, currency char(3) not null, locale text,
  price_current numeric(12,2),        -- null si el programa no permite mostrar precio
  price_previous numeric(12,2) null,  -- solo con evidencia (fuente o historial)
  price_previous_source text check (price_previous_source in ('feed_list_price','observed_history','none')),
  discount_pct numeric(5,2) generated always as (
    case when price_previous > 0 and price_current is not null and price_previous > price_current
         then round((1 - price_current/price_previous)*100, 2) end) stored,
  price_checked_at timestamptz,

  availability text check (availability in ('in_stock','limited','out_of_stock','unknown','preorder')),
  starts_at timestamptz null, expires_at timestamptz null,
  original_url text not null,         -- URL oficial del producto/oferta
  affiliate_url text null,            -- generada por la red; se usa tal cual
  estimated_commission numeric(12,2) null, estimated_commission_currency char(3),

  status text check (status in ('draft','pending_review','published','expired','rejected','disabled')),
  is_sponsored boolean default false, sponsored_campaign_id uuid null,
  flags text[],                       -- 'suspicious_reference_price','broken_link','duplicate_candidate'
  raw_payload jsonb,                  -- registro del origen (auditoría)
  published_at timestamptz, created_at, updated_at,
  search_tsv tsvector                 -- FTS español + unaccent
)
-- índices: (status, country_code, category_id), (merchant_id), (expires_at), GIN(search_tsv), GIN(tags),
--          trigram(title), unique(source_id, source_offer_id)

travel_details (                      -- 1:1 con offers de kind 'travel'
  offer_id uuid pk references offers,
  travel_type text check (travel_type in ('flight','hotel','car','package','experience')),
  origin_iata char(3) null, destination_iata char(3) null, destination_name text,
  check_in date null, check_out date null, depart_date date null, return_date date null,
  nights smallint null, provider text, price_found_at timestamptz,
  price_basis text                    -- 'por persona', 'por noche', 'total'
)

price_observations (
  id bigint generated always as identity pk,
  product_id uuid null, offer_id uuid null, merchant_id uuid,
  price numeric(12,2), list_price numeric(12,2) null, currency char(3),
  observed_at timestamptz, source text,  -- 'awin_feed','amazon_creators_api','manual_with_evidence'
  evidence_url text null
)
-- índice (product_id, observed_at desc); particionar por mes cuando crezca

offer_scores (
  offer_id uuid pk, score numeric(5,2), label text check (label in ('exceptional','very_good','good','normal')),
  components jsonb,                   -- {discount:.., popularity:.., commission:.., trust:.., freshness:.., demand:.., history:..}
  explanation text[],                 -- frases basadas en hechos que se muestran al usuario
  computed_at timestamptz, weights_version int
)
scoring_weights (version int pk, country_code char(2), category_id uuid null, weights jsonb, active boolean)
```

---

## 6. Tracking, conversiones e ingresos

```sql
clicks (                              -- particionada por mes (range sobre clicked_at)
  id uuid pk,                         -- = sub-ID enviado a la red
  clicked_at timestamptz not null,
  offer_id uuid, merchant_id uuid, program_id uuid, network_id uuid, campaign_id text,
  country_code char(2), device_type text check (device_type in ('mobile','desktop','tablet','bot','unknown')),
  source text,                        -- 'home','category','search','newsletter','social'
  placement text,                     -- 'hero','card:3'
  utm_source text, utm_medium text, utm_campaign text,
  referrer_domain text,               -- solo el dominio
  visitor_hash text,                  -- HMAC con sal diaria rotativa: no es reversible ni persistente
  is_bot boolean default false
)

impressions_daily (offer_id uuid, day date, placement text, count int, primary key (offer_id, day, placement))

conversions (
  id uuid pk, network_id uuid, external_id text,  -- id de transacción en la red
  click_id uuid null references clicks,           -- conciliado por sub-ID
  offer_id uuid null, merchant_id uuid, program_id uuid,
  event_type text check (event_type in ('sale','lead','install','booking','click_payout')),
  occurred_at timestamptz, sale_amount numeric(12,2), commission_amount numeric(12,2), currency char(3),
  status text check (status in ('pending','approved','declined','paid')),
  status_updated_at timestamptz, raw jsonb,
  unique (network_id, external_id)
)

payouts (id uuid pk, network_id uuid, period_start date, period_end date, amount numeric(12,2), currency char(3), paid_at timestamptz, reference text)

ad_revenue_daily (day date, provider text, placement text, impressions int, revenue numeric(12,2), currency char(3), primary key (day, provider, placement))
```

**Vistas materializadas del dashboard:** `mv_clicks_daily`, `mv_revenue_daily` (aprobado y pendiente por separado), `mv_by_merchant`, `mv_by_category` (clics, conversiones, tasa de conversión, comisión, **EPC = comisión aprobada / clics**), `mv_top_offers`.

---

## 7. Usuarios (opcionales), favoritos y alertas

```sql
-- auth.users lo gestiona Supabase. Perfil mínimo:
profiles (user_id uuid pk references auth.users, display_name text null, locale text, country_code char(2), marketing_opt_in boolean default false, created_at)
user_roles (user_id uuid, role text check (role in ('owner','admin','editor','analyst')), primary key (user_id, role))

saved_offers (user_id uuid, offer_id uuid, created_at, primary key (user_id, offer_id))
category_follows (user_id uuid, category_id uuid, primary key (user_id, category_id))

alerts (
  id uuid pk, user_id uuid null,
  email_hash text null,               -- para alertas sin cuenta (doble opt-in); el email va cifrado en email_enc
  email_enc bytea null,
  type text check (type in ('price_below','category_deal','travel_destination','keyword')),
  product_id uuid null, category_id uuid null, keyword text null,
  max_price numeric(12,2) null, currency char(3),
  origin_iata char(3) null, destination_iata char(3) null, date_from date null, date_to date null,
  channels text[] default '{email}',  -- 'email','webpush'; más adelante 'telegram','whatsapp'
  confirmed_at timestamptz null, active boolean default true, last_triggered_at timestamptz null
)

push_subscriptions (id uuid pk, user_id uuid null, endpoint text unique, keys jsonb, created_at)

notifications_outbox (
  id uuid pk, alert_id uuid, channel text, payload jsonb,
  status text check (status in ('queued','sent','failed','suppressed')), attempts int, sent_at timestamptz
)
```

Privacidad: el correo solo se guarda cuando el usuario crea una alerta o una cuenta. Es cifrado y se puede borrar con un clic (darse de baja = borrar).

---

## 8. Publicidad, patrocinios y descubrimiento

```sql
ad_placements (id uuid pk, key text unique, provider text, enabled boolean, config jsonb)      -- 'home_sidebar', 'category_inline'

sponsored_campaigns (                 -- Fase 4: solo con contrato firmado
  id uuid pk, merchant_id uuid, contract_ref text not null,
  type text check (type in ('sponsored_deal','featured_store','newsletter_slot')),
  starts_at, ends_at, price numeric(12,2), currency char(3),
  disclosure_label text default 'Patrocinado', active boolean
)

discovery_candidates (                -- "Descubrir nuevos programas" (Fase 12)
  id uuid pk, company text, program_name text, network_key text null,
  country_code char(2), category_id uuid null,
  commission_text text,               -- texto tal como lo reporta la fuente; jamás inventado
  requirements text, automation text check (automation in ('api','feed','deeplink_only','manual','unknown')),
  potential smallint,                 -- 1–5, lo calcula/asigna el admin
  integration_status text check (integration_status in ('new','researching','to_apply','applied','approved','rejected','not_viable')),
  evidence_urls text[], confidence char(1),
  notes text, created_by uuid, updated_at
)
```

---

## 9. Operación y auditoría

```sql
job_runs (id uuid pk, job text, started_at, finished_at, status text, stats jsonb, error text)
link_checks (id bigint pk, offer_id uuid, checked_at timestamptz, http_status int, final_domain text, ok boolean, error text)
audit_log (id bigint pk, actor uuid, action text, entity text, entity_id text, diff jsonb, at timestamptz)
```

---

## 10. Políticas RLS (resumen)

| Tabla | anon | usuario autenticado | editor | admin/owner |
|---|---|---|---|---|
| offers, categories, merchants (públicas) | `select` solo `status='published'` / `enabled` | igual | CRUD | CRUD |
| merchant_programs, affiliate_networks, conversions, payouts, clicks | ✗ | ✗ | lectura limitada | CRUD |
| saved_offers, alerts, category_follows, profiles | ✗ | solo las propias (`user_id = auth.uid()`) | ✗ | lectura agregada |
| discovery_candidates, audit_log, job_runs | ✗ | ✗ | lectura | CRUD |

- La inserción de clics la hace **solo** el Worker con la service role (no hay inserción pública directa).
- La creación de alertas sin cuenta pasa por un endpoint de servidor con Turnstile y doble opt‑in.

---

## 11. Retención de datos

- `clicks`: el detalle se conserva 13 meses; después se agrega a `mv_clicks_daily` y se borran las particiones.
- `visitor_hash`: inútil fuera del día (la sal rota); se borra a los 30 días.
- `notifications_outbox`: 90 días.
- Alertas inactivas sin confirmar: se borran a los 7 días.
