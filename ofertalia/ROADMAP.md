# OFERTALIA — Roadmap

> Prioridad del negocio: **1. tráfico → 2. clics → 3. conversiones → 4. comisiones → 5. automatizar → 6. escalar.**
> Cada fase tiene una **puerta de salida medible**. No se construye la siguiente fase "por si acaso".

---

## Fase 0 — Cuentas y aprobaciones (titular; en paralelo a la Fase 1)

OFERTALIA **no** hace estos registros por ti: requieren aceptar términos legales, KYC y datos fiscales.

| Orden | Programa | Para qué | Requisito clave |
|---|---|---|---|
| 1 | Dominio + correo del dominio + página "Acerca de" mínima publicada | Casi todas las redes revisan el sitio antes de aprobar | Sitio con contenido real y avisos legales |
| 2 | **Mercado Libre Afiliados** | Comisión más alta del retail MX | No ser vendedor en ML; cuenta de Mercado Pago |
| 3 | **Amazon Afiliados MX** | Confianza y catálogo | Entrevista fiscal; ventas iniciales para la aprobación definitiva |
| 4 | **Awin** → solicitar Booking.com, Xcaret, Nike | Viajes y marcas | Datos de empresa/pago |
| 5 | **Admitad** → Coppel, PriceTravel y revisar los ~230 anunciantes MX | Retail MX | Aprobación por programa |
| 6 | **Impact** → Adidas, Airalo, Skyscanner | Marcas globales | Datos fiscales (formulario tipo W‑8BEN) |
| 7 | **Travelpayouts** | API de datos de vuelos + Kiwi, Klook, GYG | Registro abierto |
| 8 | **Expedia Travel Creator**, **GetYourGuide**, **Viator**, **DiscoverCars** | Hoteles, experiencias, autos | Aprobación |
| 9 | **Samsung MX Affiliate Program**, **Soicos** (Elektra, Aeroméxico) | Tech y aerolínea MX | Aprobación |

Cuando cada cuenta esté aprobada: copiar la tabla **oficial** de comisiones y actualizar `AFFILIATE_RESEARCH.md` con confianza **A**.

---

## Fase 1 — MVP "primer clic con dinero" (≈ 2–3 semanas)

**Meta:** publicar entre 50 y 150 ofertas **curadas**, conseguir los primeros clics de salida medidos y las primeras conversiones.

- [ ] Repo/proyecto independiente, Next.js + TypeScript + Tailwind, despliegue en Cloudflare Workers (OpenNext) y Supabase.
- [ ] Migraciones del núcleo: `countries`, `categories`, `affiliate_networks`, `merchants`, `merchant_programs`, `program_rules`, `sources`, `offers`, `travel_details`, `price_observations`, `clicks`, `conversions`, `user_roles`, `audit_log`.
- [ ] Datos semilla: categorías, redes y comerciantes de la investigación (con `enabled=false` hasta tener aprobación).
- [ ] **Admin mínimo** (`/admin`, solo owner/editor, con TOTP): crear/editar oferta, **importar CSV** con vista previa, activar o desactivar programas y comerciantes.
- [ ] **Link builder** con reglas por programa (bloquea las URLs no permitidas de ML, etc.) y sub‑ID.
- [ ] **`/go/:offerId`**: validación, 302 y registro asíncrono del clic.
- [ ] Páginas públicas: home (hero, 🔥 Ofertas del día, categorías), categoría, presupuesto (menos de $500/$1,000/$5,000), detalle `/ofertas/[slug]`, buscador básico (FTS).
- [ ] Card de oferta: imagen, nombre, precio anterior (solo con evidencia), precio actual, % de descuento, tienda, etiqueta de valoración y **"VER OFERTA"**.
- [ ] Fichas de Amazon **sin precio** mientras no haya Creators API ("Ver precio en Amazon").
- [ ] Score v0 determinista (descuento verificado + confianza de la tienda + frescura + comisión estimada).
- [ ] Aviso de afiliación en el layout; páginas `/terminos`, `/privacidad`, `/cookies`, `/afiliados`, `/contacto`.
- [ ] SEO base: metadatos, canonical, Open Graph, `sitemap.xml`, `robots.txt` y schema.org `Product/Offer`.
- [ ] Dashboard v0: clics por día, por tienda y por categoría; top ofertas; importación manual de conversiones (CSV desde las redes).
- [ ] Seguridad base: RLS, rate limiting en `/go` y login, CSP, secretos solo en el servidor.

**Puerta de salida:** ≥ 1,000 visitas orgánicas o sociales al mes **y** ≥ 400 clics de salida al mes **y** al menos las 3 primeras ventas en Amazon (para la aprobación definitiva).

---

## Fase 2 — Primeras automatizaciones con dinero comprobado (≈ 3–4 semanas)

**Meta:** que las fuentes con API alimenten ofertas sin trabajo manual y ver comisiones reales en el dashboard.

- [ ] Conectores **Awin** y **Admitad** (feeds + deep links + API de conversiones) → conciliación automática por sub‑ID.
- [ ] Conector **Impact**.
- [ ] Historial de precios y **detector de descuento real** (precio de referencia conservador, bandera `suspicious_reference_price`).
- [ ] Jobs: importación, expiraciones, link checker (con protección SSRF), recálculo de scores y dedupe por reglas.
- [ ] Dashboard v1: conversiones, comisión aprobada y pendiente, EPC, CTR (impresiones agregadas), **tabla "Dónde está el dinero"** por categoría y tienda, gráficas (clics/día, ingresos/día, comisión por tienda, conversión por categoría, top ofertas).
- [ ] Amazon **Creators API** en cuanto se cumplan las 10 ventas/30 días → precios automáticos con frescura controlada.

**Puerta de salida:** comisiones aprobadas ≥ costos mensuales durante 2 meses seguidos, o una tendencia clara de EPC por categoría que diga dónde invertir.

---

## Fase 3 — Viajes, IA y alertas (≈ 4–6 semanas)

- [ ] Sección **Viajes** completa: ✈️ vuelos (API de datos de Travelpayouts: "precio encontrado el {fecha}"), 🏨 hoteles (Booking/Expedia/Agoda), 🚗 autos (DiscoverCars), 🌴 paquetes (Despegar/Expedia), 🎟️ experiencias (GYG/Viator/Xcaret). Card: destino, precio, fecha, proveedor, descuento (si hay evidencia) y **"VER VIAJE"**.
- [ ] Módulo de IA: categorización, títulos y resúmenes a partir de los datos de la fuente, etiquetas, detección de dudosos → cola de revisión; presupuesto mensual.
- [ ] **Alertas** por email (doble opt‑in): precio menor a $X, categoría (laptops) y destino (hoteles en Cancún, vuelos a X). Web Push del navegador.
- [ ] Cuentas opcionales: guardar oferta y seguir categoría.
- [ ] Comparación de precios cuando un producto canónico tenga ofertas en varias tiendas.

**Puerta de salida:** la sección de viajes con EPC ≥ el de retail, o descartarla con datos.

---

## Fase 4 — Crecimiento y monetización adicional

- [ ] **"Descubrir nuevos programas"** en el admin: tabla de `discovery_candidates` (empresa, programa, país, categoría, comisión reportada, requisitos, automatización, potencial, estado) con botón **"Investigar"**, que lanza una búsqueda asistida por IA y guarda la evidencia con URLs. **Nunca registra al usuario en nada.**
- [ ] Newsletter semanal (respetando qué programas permiten enlaces en email).
- [ ] Publicidad display (A/B: medir el impacto en el CTR hacia ofertas).
- [ ] Sponsored deals y tiendas destacadas (solo con contrato y la etiqueta "Patrocinado").
- [ ] Telegram (la Bot API es pública) y WhatsApp (Business Platform; revisar términos y costos) para alertas.
- [ ] Más conectores (Soicos, FlexOffers, CJ, Despegar Partner Hub y Expedia si dan API).

---

## Fase 5 — Escala internacional

- [ ] Habilitar `US` y `ES` (y luego LATAM) con sus propios programas (Amazon US/ES, Awin ES, etc.), `hreflang` y monedas.
- [ ] Particionado de `clicks` y `price_observations`; réplica de lectura; búsqueda dedicada si Postgres FTS no alcanza.
- [ ] Separar los workers de jobs en despliegues independientes.

---

## Riesgos principales y cómo se mitigan

| Riesgo | Mitigación |
|---|---|
| Rechazo en las redes por ser un sitio nuevo | Lanzar primero con contenido real (guías y ofertas curadas) y avisos legales completos |
| Amazon no da acceso a la API sin ventas | Arrancar con fichas sin precio; empujar ventas con contenido editorial |
| ML sin API → cuello de botella manual | Admin rápido para capturar ofertas y plantillas CSV; limitarse a productos con mayor demanda |
| Dependencia de Google (actualizaciones de spam/afiliados) | Contenido propio en cada oferta ("por qué es buena"), sin páginas masivas; diversificar con newsletter, Telegram y redes sociales |
| Cambios en comisiones (p. ej. Booking 2025, PA‑API 2026) | `verified_at` + revisión trimestral; interruptor por programa |
| Riesgo legal (PROFECO, LFPDPPP, publicidad financiera) | Descuentos solo con evidencia, aviso de afiliación, privacidad mínima; finanzas apagada hasta revisión legal |
| Costos de IA sin control | Tareas deterministas sin IA; presupuesto y caché |
