# OFERTALIA — Arquitectura

> Principio rector: **empezar casi gratis, medir dinero real y escalar solo lo que genere comisiones.**
> Flujo objetivo: *encontré una oferta → entendí por qué es buena → hice clic → llegué a la tienda oficial.*

---

## 1. Evaluación de tecnologías

| Opción | Costo inicial | Escalabilidad | Mantenimiento | Velocidad / SEO | Veredicto |
|---|---|---|---|---|---|
| **Next.js (App Router) + React + TypeScript** | Gratis | Alta (SSR/ISR, edge) | Ecosistema enorme | SSR/ISR = HTML indexable, metadatos por página, sitemaps nativos | ✅ **Elegido** para el frontend y las páginas SEO |
| Vite + React SPA (el stack actual de Conecta MX) | Gratis | Alta | Simple | **Malo para SEO** (render en cliente) | ❌ No sirve para un sitio que vive de Google |
| **Supabase (PostgreSQL + Auth + RLS + Storage)** | Free tier (los proyectos se pausan por inactividad); Pro ~US$25/mes para producción | Postgres escala muy bien; réplicas y particiones | Gestionado; migraciones SQL versionadas | – | ✅ **Elegido** como base de datos y auth |
| **Cloudflare Workers** (con el adaptador OpenNext para Next.js) | Free tier generoso; plan Workers de pago desde ~US$5/mes | Edge global, sin cold starts relevantes | Wrangler (el repo ya lo usa) | Redirecciones `/go` en el edge con latencia mínima | ✅ **Elegido** como hosting y runtime |
| Vercel | **El plan Hobby es solo para uso no comercial**; un sitio de afiliados necesita Pro (~US$20/usuario/mes) | Excelente | El mejor DX para Next.js | Excelente | 🟡 Alternativa válida si se prefiere comodidad sobre costo |
| Cloudflare Cron Triggers + Queues | Incluidos en Workers (verificar los límites del plan) | Alta | Bajo | – | ✅ Jobs y colas |
| Supabase pg_cron + Edge Functions | Incluido | Media | Bajo | – | 🟡 Respaldo para jobs puramente SQL |
| Cloudflare R2 / Images | R2 sin costo de egreso | Alta | Bajo | – | ✅ Solo para assets propios; las imágenes de producto se sirven desde la URL autorizada por el feed (ver §7) |
| Búsqueda: Postgres FTS (`unaccent` + `pg_trgm`, diccionario español) | Gratis | Suficiente hasta cientos de miles de ofertas | Cero infraestructura extra | – | ✅ MVP. Meilisearch/Typesense solo si hace falta |
| IA: API de Claude | Pago por uso | Alta | – | – | ✅ Modelo pequeño (Haiku 4.5) para tareas masivas; Sonnet 5.5 para redacción. Siempre en el servidor y con presupuesto mensual |

**Costo estimado de arranque:** dominio + Workers (~US$5/mes) + Supabase (gratis al validar, Pro cuando haya tráfico) + IA con tope (p. ej. US$10–20/mes). **Menos de US$50/mes hasta tener comisiones reales.** Precios a verificar en cada proveedor al contratar.

### ¿Dónde vive el código?

Este repositorio (`conecta-mx`) contiene otro proyecto (directorio de negocios de Uriangato, Vite + Supabase). **Recomendación:** OFERTALIA debe ir en **su propio repositorio** (o al menos en un directorio `ofertalia/` independiente, con su propio `package.json`), con un proyecto de Supabase y un Worker separados. Así no se mezclan datos, despliegues ni secretos.

---

## 2. Vista general

```
                          ┌───────────────────────────── Cloudflare ─────────────────────────────┐
 Usuario ──HTTPS──►       │  Next.js (OpenNext Worker)                                           │
                          │   ├─ Páginas públicas SSR/ISR  (/, /ofertas, /ofertas/[slug], ...)    │
                          │   ├─ /go/:offerId  ──► KV cache ─► 302 a URL afiliada                 │
                          │   │        └─ waitUntil → Queue "clicks"                              │
                          │   ├─ /admin (protegido: Supabase Auth + rol + Cloudflare Access)      │
                          │   └─ /api/* (alertas, guardar oferta, webhooks de redes)              │
                          │                                                                      │
                          │  Cron Triggers ─► Queue "jobs" ─► Workers consumidores:               │
                          │     import feeds · precios · expiraciones · link-check · scoring ·    │
                          │     dedupe · IA · alertas · conciliación de conversiones              │
                          └──────────────┬───────────────────────────────────────┬──────────────┘
                                         │ (Hyperdrive / PostgREST)              │ HTTPS (allowlist)
                                 ┌───────▼────────┐                     ┌────────▼─────────────────┐
                                 │ Supabase       │                     │ APIs autorizadas:         │
                                 │ Postgres + RLS │                     │ Awin, Admitad, Impact,    │
                                 │ Auth · Storage │                     │ Travelpayouts, Amazon     │
                                 └────────────────┘                     │ Creators API, Viator...   │
                                                                        │ Claude API (IA)           │
                                                                        └──────────────────────────┘
```

---

## 3. Módulos (monolito modular con límites claros)

```
ofertalia/
  apps/web/                 Next.js (público + admin + API + /go)
  packages/core/            dominio: tipos, reglas, scoring, cálculo de descuento (TS puro, sin I/O)
  packages/connectors/      un adaptador por red/fuente (interfaz común)
  packages/linkbuilder/     construcción de URLs afiliadas por red + reglas por comerciante
  packages/ai/              prompts, clientes y validación de salidas de IA
  packages/db/              cliente, tipos generados, consultas
  workers/jobs/             consumidores de colas y crons
  supabase/migrations/      SQL versionado
```

Se empieza como **un solo despliegue**. Los workers de jobs se separan solo cuando el volumen lo pida.

### 3.1 Conectores de fuentes (Fase 4 del brief)

Contrato común para todas las fuentes:

```ts
interface SourceConnector {
  key: string;                         // 'awin', 'admitad', 'impact', 'travelpayouts', 'amazon_creators', 'csv', 'manual'
  capabilities: {
    productFeed: boolean; deepLinkApi: boolean; conversionsApi: boolean;
    webhooks: boolean; priceRealtime: boolean;
  };
  fetchOffers(cursor?: string): AsyncIterable<RawOffer>;      // feed/API autorizada
  buildAffiliateUrl(target: URL, ctx: LinkContext): Promise<URL>;
  fetchConversions?(since: Date): AsyncIterable<RawConversion>;
}
```

- **Origen siempre registrado:** cada oferta guarda `source`, `source_offer_id`, `import_run_id` y `raw_payload` (JSON).
- **Interruptor de apagado:** `affiliate_networks.enabled`, `merchant_programs.enabled` y `merchants.enabled`. Si cualquiera está en `false`, la oferta deja de mostrarse y `/go` manda a la URL original sin tracking, o a una página "oferta no disponible" si el programa lo exige.
- **Sin scraping:** ningún conector descarga HTML de tiendas para extraer precios. Las fuentes manuales o semimanuales (Mercado Libre, Amazon antes de tener API) entran por el **formulario de admin** o por **CSV**.
- **CSV:** plantilla con validación de columnas, vista previa y modo "dry‑run" antes de confirmar.

### 3.2 Pipeline de ingesta

```
fetch (conector) → normalizar (moneda, país, categoría) → validar (URL, precios, fechas)
  → deduplicar (producto canónico) → registrar precio (price_observations)
  → reglas de cumplimiento (programa activo, link permitido, ¿precio publicable?)
  → enriquecer con IA (opcional, con cola y presupuesto) → calcular score → estado
     ('draft' | 'pending_review' | 'published' | 'expired' | 'rejected' | 'disabled')
```

- **Publicación selectiva (rentabilidad):** solo se pasa a `published` lo que supera el umbral de score o lo que apruebe un editor. Todo lo demás queda indexado internamente pero sin página pública (evita páginas basura).

### 3.3 Link builder y `/go/:offerId` (Fase 10)

1. `GET /go/:offerId?src=home&pos=3` (el `offerId` es público y no secuencial: id corto aleatorio).
2. El Worker busca en **KV** (TTL corto) `{ affiliateUrl, enabled, merchantId, networkId, programId }`; si no está, consulta la base de datos.
3. Valida: oferta activa, programa habilitado y URL de destino dentro de la **allowlist de dominios del comerciante**.
4. Responde **302** con `Cache-Control: no-store` y `Referrer-Policy: no-referrer-when-downgrade` (algunas redes exigen el referrer; se configura por red).
5. `ctx.waitUntil(queue.send(clickEvent))`: el registro **nunca bloquea** la redirección.
6. **Parámetros de tracking intactos:** la URL afiliada se guarda tal como la genera la red. Solo se agregan sub‑IDs en el parámetro que la red documenta (Awin `clickref`, Admitad `subid`, Impact `subId1`, Amazon: tags de seguimiento propios, etc.), y se codifican correctamente. **Nunca se reescriben ni se eliminan parámetros existentes.**
7. Sub‑ID = `clickId` (UUID) → permite conciliar la conversión que reporte la red con el clic, la oferta, la categoría y la fuente.
8. Respuestas con `X-Robots-Tag: noindex`; `/go/` en `robots.txt` como `Disallow`; enlaces con `rel="sponsored nofollow"`.

**Datos del clic (mínimos):** oferta, comerciante, programa, red, campaña, sub‑ID, timestamp (UTC), país (de `request.cf.country`), tipo de dispositivo (móvil/escritorio/tablet a partir del UA, sin guardar el UA completo), fuente (`src`, `utm_*`, dominio del referer), `visitor_hash` = HMAC(IP truncada + UA + **sal diaria rotativa**) para contar únicos sin poder identificar personas. **No se guarda la IP ni se hace fingerprinting.**

### 3.4 Motor de puntuación (Fase 6)

Función pura en `packages/core`, con pesos configurables por país y categoría (tabla `scoring_weights`):

```
score (0–100) =
    w1 · descuento_verificado      (0 si el descuento no tiene evidencia)
  + w2 · popularidad               (CTR y clics recientes, con decaimiento temporal)
  + w3 · comisión_esperada         (tasa × precio × prob. de conversión histórica por categoría/comerciante, normalizada)
  + w4 · confiabilidad_tienda      (manual + tasa de enlaces rotos + quejas)
  + w5 · frescura/duración         (penaliza ofertas por expirar sin fecha clara; bonifica las flash con fecha)
  + w6 · demanda                   (búsquedas internas + alertas creadas + estacionalidad)
  + w7 · historial_precio          (precio actual vs. mínimo/mediana de 30/90 días)
  − penalizaciones                 (sospecha de precio inflado, stock bajo/desconocido, comerciante con cookie corta)
```

Etiquetas: **🔥 Excepcional** (≥85) · **⭐ Muy buena** (70–84) · **👍 Buena** (55–69) · **ℹ️ Normal** (<55). Los umbrales se calibran con datos reales.
**Prohibido** decir "el más barato de Internet". Los textos permitidos los genera el sistema a partir de hechos ("Precio más bajo que hemos registrado en 90 días", solo si es cierto según `price_observations`).

### 3.5 Detector de descuento real (Fase 7)

- Cada lectura de precio (feed, API o captura manual con evidencia) se guarda en `price_observations` con su fuente.
- Descuento mostrado = el **más conservador** entre:
  1. `precio_anterior` de la fuente oficial (si el feed lo trae como "precio de lista"), y
  2. la mediana o el máximo **observado por nosotros** en los últimos N días (si hay suficientes observaciones).
- Si no hay evidencia suficiente: se muestra solo el precio actual. **Nunca se inventa ni se infla un "precio antes".**
- Bandera `suspicious_reference_price` cuando el precio de lista de la fuente es muy superior a todo lo observado → baja de score y revisión humana.

### 3.6 Módulo de IA (Fase 5)

| Tarea | Enfoque | Modelo |
|---|---|---|
| Calcular % de descuento, detectar expiradas y cambios de precio | **Código determinista**, no IA | – |
| Categorizar / subcategorizar | Clasificación con salida JSON validada contra la taxonomía | Haiku 4.5 (`claude-haiku-4-5-20251001`) |
| Duplicados | Primero reglas (GTIN/EAN, ASIN, ID de ML, URL canónica) + similitud trigram; la IA solo decide los casos ambiguos | Haiku 4.5 |
| Títulos, resúmenes y etiquetas | Generación **solo a partir de los datos del feed** (prompt con "no agregues especificaciones que no estén en la entrada") | Sonnet 5.5 (`claude-sonnet-5-5`) para destacadas; Haiku para el resto |
| Ofertas potencialmente engañosas | Reglas + IA como segunda opinión → **cola de revisión humana**, nunca rechazo automático silencioso | Haiku 4.5 |
| Prioridad de publicación | Usa el score (determinista); la IA no decide | – |

Controles: la clave de API solo en el servidor; presupuesto mensual y por job; caché por hash de entrada; todo texto generado se guarda con `ai_generated=true` y queda editable en el admin.

### 3.7 Jobs y automatización (Fase 13)

| Job | Disparador | Frecuencia inicial |
|---|---|---|
| `import:<network>` | Cron | Cada 6–24 h según la fuente |
| `prices:refresh` (fuentes con API) | Cron | Cada 6 h para ofertas publicadas; respetar las reglas de frescura de Amazon |
| `offers:expire` | Cron | Cada hora |
| `links:check` (HEAD/GET al **destino final de la red**, con límite de frecuencia) | Cron | Diario (publicadas) |
| `offers:dedupe` | Después de importar | Por lote |
| `scores:recompute` | Cron + eventos (clic, cambio de precio) | Cada hora |
| `ai:enrich` | Cola | Continuo con tope |
| `conversions:sync` (APIs de reportes de las redes) | Cron | Cada 6 h |
| `alerts:match` + `notifications:send` | Después de cambios de precio/ofertas nuevas | Cada hora |
| Webhooks entrantes (postbacks de redes que los soporten) | HTTP firmado | Tiempo real |

Todos los jobs son **idempotentes**, guardan una fila en `job_runs` y se reintentan con backoff; los mensajes que fallan van a una cola de mensajes fallidos (DLQ).

---

## 4. SEO (Fase 14)

- Rutas: `/ofertas`, `/ofertas-del-dia`, `/tecnologia`, `/viajes`, `/hoteles`, `/vuelos`, `/moda`, `/videojuegos`, `/ofertas/[slug]`, `/tiendas/[slug]`, `/presupuesto/menos-de-500`, etc.
- ISR: páginas de categoría con revalidación de 5–15 min; páginas de oferta revalidadas por evento (cambio de precio o estado).
- `generateMetadata`: title, meta description, canonical, Open Graph y Twitter cards.
- schema.org: `Product` + `Offer` (con `price`, `priceCurrency`, `availability`, `priceValidUntil` **solo con datos reales**), `BreadcrumbList`, `ItemList` en categorías y `Organization` en el home. **No usar `AggregateRating` sin reseñas reales.**
- `sitemap.xml` segmentado (ofertas activas, categorías, tiendas) y `robots.txt` con `Disallow: /go/ /admin /api/`.
- **Anti‑páginas basura:** solo se indexan ofertas `published` con score ≥ umbral y contenido propio (explicación de "por qué es buena"). Las ofertas expiradas se mantienen un tiempo con `noindex` y luego responden 410, o redirigen a la categoría si tenían tráfico.

---

## 5. Seguridad (Fase 16)

| Riesgo | Control |
|---|---|
| Acceso al admin | Supabase Auth (email + **TOTP obligatorio** para admins) + roles (`owner`, `admin`, `editor`, `analyst`) en `user_roles`; RLS en todas las tablas; además **Cloudflare Access** delante de `/admin` |
| Secretos | Solo en Worker Secrets / variables de servidor de Supabase. **Nunca** con prefijo `NEXT_PUBLIC_`. La service key de Supabase solo en workers. Rotación documentada |
| Open redirect en `/go` | Se redirige solo a URLs guardadas en la base de datos (nunca a una URL que venga en la petición) y se valida el dominio contra la allowlist del comerciante o la red |
| SSRF (link checker, importadores, imágenes) | Allowlist de hosts por conector; bloqueo de IPs privadas/locales y de esquemas que no sean `https`; tiempos de espera y tamaño máximo; sin seguir redirecciones a hosts fuera de la allowlist |
| XSS | React escapa por defecto; textos de feeds e IA guardados como texto plano; si se permite HTML en descripciones, se sanitiza con una allowlist estricta; CSP con nonce |
| Inyección SQL | Consultas parametrizadas o el cliente tipado; nunca concatenar SQL |
| Abuso | Rate limiting (Cloudflare WAF/Rate Limiting) en `/go`, `/api/alerts` y login; Turnstile en formularios públicos |
| Fraude de clics | No se paga por clic al usuario; se excluyen bots conocidos (`cf.botManagement` / UA) de las métricas |
| Logs | Logs estructurados sin datos personales; `audit_log` de acciones del admin (quién cambió qué oferta o programa) |
| Dependencias | Dependabot/Renovate; `npm audit` en CI |

---

## 6. Internacionalización (Fase 22)

- Todas las entidades llevan `country_code` (ISO‑3166), `currency` (ISO‑4217), `locale` (BCP‑47) y la zona horaria del país.
- Las rutas por país vendrán después: `ofertalia.mx` (raíz para MX) y luego `/us/`, `/es/` o dominios propios, con `hreflang`.
- Los precios se guardan en la **moneda original** (`numeric(12,2)` + `currency`); las conversiones solo sirven para reportes internos y nunca se muestran como precio de la tienda.
- La taxonomía de categorías es común, con traducciones por locale.

---

## 7. Imágenes y contenido de terceros

- Se usan **solo** las imágenes que entregan los feeds o APIs oficiales, con la URL que indique la red (muchas redes exigen hotlinking a su CDN y prohíben copiar las imágenes).
- Optimización: loader de imágenes con allowlist de dominios de CDN de las redes; si un programa lo prohíbe, se muestra la imagen sin procesar.
- Las descripciones largas de los comerciantes **no se copian**: se genera un resumen breve y propio a partir de atributos, más la explicación de por qué la oferta es buena.

---

## 8. Observabilidad y métricas de negocio

- Cloudflare Workers Logs/Analytics + Sentry (plan gratuito) para errores.
- Vistas materializadas en Postgres para el dashboard (clics por día, conversiones, comisión por tienda/categoría, EPC, CTR), refrescadas por cron.
- Las métricas de página vista para el CTR salen de un contador propio y anónimo (evento `impression` agregado por oferta y día), sin cookies de terceros.
