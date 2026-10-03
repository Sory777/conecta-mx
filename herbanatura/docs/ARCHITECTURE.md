# HerbaNatura — Arquitectura

> “El conocimiento de la naturaleza, investigado con ciencia.”

Este documento responde, en orden, a los 10 pasos pedidos antes de implementar (punto 37 del encargo): requisitos, arquitectura, tablas, relaciones, APIs, búsqueda, seguridad, frontend, backend y estrategia de fuentes científicas. La política editorial (niveles de evidencia, reglas absolutas) está en [`EVIDENCE_POLICY.md`](./EVIDENCE_POLICY.md).

---

## 1. Análisis de requisitos

### 1.1 Qué es (y qué no es)

HerbaNatura es una **base de conocimiento con trazabilidad**, no un recetario. La unidad central no es la “planta”, sino la **afirmación con evidencia** (`evidence_claims`): *quién* (planta/compuesto/alimento/hongo) → *para qué* (condición) → *en qué contexto* (prevención, investigación, complementario, tratamiento del cáncer, seguridad) → *con qué evidencia* (nivel A–X + categoría) → *según qué fuentes* → *revisado por quién y cuándo*.

Esa decisión resuelve la mayor parte de los requisitos de rigor:

| Requisito | Cómo lo resuelve el modelo |
|---|---|
| Distinguir uso tradicional de evidencia | Tablas separadas: `traditional_knowledge` nunca alimenta el nivel de evidencia; el nivel F sólo describe que *existe* un uso documentado. |
| No convertir un resultado experimental en recomendación | Las afirmaciones tienen `category` (in vitro, animal, observacional…) y `human_evidence` explícitos; la UI siempre muestra la categoría junto al texto. No existe un campo “recomendación” en el modelo. |
| Prevención ≠ tratamiento | `context` es obligatorio y la UI agrupa por contexto; el módulo de cáncer separa las cuatro pestañas. |
| “¿Qué sabemos / qué no / qué se investiga / riesgos?” | Campos estructurados en cada afirmación. |
| Nunca inventar | Ninguna afirmación se publica sin `citations`; las fichas sin fuente muestran “Pendiente de investigación/verificación”. La IA sólo puede citar documentos recuperados (validación posterior). |
| Revisión humana | `review_status` en todo contenido científico + `content_reviews` + `audit_logs`. |

### 1.2 Requisitos no funcionales

* **Escala objetivo**: 100 000+ especies, millones de estudios, millones de usuarios. Lecturas ≫ escrituras (contenido editorial), por lo que la arquitectura optimiza lecturas cacheables.
* **Privacidad**: los datos de salud del usuario son sensibles → por defecto **se guardan sólo en el dispositivo** (local-first).
* **Coste inicial bajo**, sin bloquear el crecimiento.
* **Bilingüe desde el día 1** (es/en) y extensible (pt, fr…) sin migraciones.

---

## 2. Arquitectura propuesta

### 2.1 Decisión tecnológica y análisis de costes

| Opción | Coste inicial | Escalabilidad | Simplicidad | Veredicto |
|---|---|---|---|---|
| **Next.js (App Router) + Supabase (PostgreSQL, Auth, Storage)** | Free tier / ~25 USD/mes Pro | PostgreSQL escala vertical + réplicas de lectura; CDN delante | Alta: un solo lenguaje (TS) + SQL | **Elegida** |
| Backend propio (NestJS) + RDS + Cognito | ~80–150 USD/mes | Alta | Media-baja (más piezas que operar) | Excesivo para la fase 1 |
| Firebase/Firestore | Bajo | Alta | Alta | Descartada: el dominio es un **grafo relacional** con consultas por relaciones; NoSQL complica integridad y FTS |
| Elasticsearch/OpenSearch desde el inicio | 50–100+ USD/mes | Muy alta | Baja | Aplazado: PostgreSQL FTS + `pg_trgm` cubre la fase 1; la interfaz de búsqueda está abstraída para migrar |

**Despliegue recomendado**

* **Fase 1**: Next.js en **Vercel** (cero configuración) *o* en **Cloudflare Workers** mediante `@opennextjs/cloudflare` (el equipo ya usa Cloudflare para Conecta MX y es más barato con mucho tráfico). El código no usa APIs propietarias de ninguna plataforma.
* **Imágenes**: Supabase Storage (o Cloudflare R2, sin coste de salida) + CDN. Mientras no haya fotografías propias, se muestran imágenes de **Wikimedia Commons** con autor y licencia (ver §10.4).
* **IA**: API configurable (`AI_PROVIDER`, `AI_MODEL`); por defecto Anthropic Claude. La IA es opcional: sin clave, HerbaAI responde en **modo extractivo** (sólo texto de la base).

### 2.2 Vista general

```
                    ┌──────────────── CDN (Vercel/Cloudflare) ────────────────┐
 Navegador/PWA ───▶ │  Next.js App Router                                      │
  (local-first:     │   • Server Components (fichas, listados; cacheables)     │
   perfil de salud, │   • Route Handlers /api/* (búsqueda, IA, identificación, │
   favoritos sin    │     investigación, cron)  ← rate limit + zod             │
   cuenta)          │   • Server Actions (/admin)                              │
                    └───────┬────────────────────┬─────────────────┬──────────┘
                            │                    │                 │
                  KnowledgeRepository      Proveedor IA       APIs externas
                  (interfaz única)        (Claude, config.)   PubMed E-utilities,
                    │            │                              ClinicalTrials.gov v2,
          SeedRepository   SupabaseRepository                   Wikimedia Commons,
          (demo, sin BD)   (PostgreSQL + RLS)                   Pl@ntNet (opcional)
                                 │
                    PostgreSQL: entidades · evidencia · grafo ·
                    búsqueda (FTS + trigram + pgvector) · revisión · auditoría
```

**Patrón clave — repositorio con dos implementaciones**: toda la app lee a través de `KnowledgeRepository`. `SeedRepository` sirve los datos demostrativos en memoria (la app funciona sin base de datos, útil para desarrollo, pruebas y demos); `SupabaseRepository` usa funciones SQL (`api_*`) que devuelven exactamente las mismas formas JSON. Ambas se eligen automáticamente según las variables de entorno.

### 2.3 Módulos

| Módulo | Ruta | Notas |
|---|---|---|
| Inicio + buscador universal | `/`, `/buscar` | Reconoce entidades en la consulta y construye cadenas de relación |
| Plantas / Hongos / Alimentos / Compuestos | `/plantas`, `/hongos`, `/alimentos`, `/compuestos` (+ `/[slug]`) | Ficha con 3 modos: general · “Explícamelo fácil” · investigador |
| Condiciones y medicamentos | `/condiciones/[slug]`, `/medicamentos/[slug]` | |
| Naturaleza y cáncer | `/cancer` | 4 contextos separados: prevención · investigación · complementario · tratamiento |
| Investigación | `/investigacion` | Base propia + PubMed + ClinicalTrials.gov en vivo, con filtros |
| Interacciones | `/interacciones` | Medicamento → agentes y agente → medicamentos |
| Identificar | `/identificar` | Identificación **preliminar** por foto |
| México | `/mexico`, `/mexico/[estado]` | Estados, municipios (Guanajuato primero) |
| Medicina tradicional | `/medicina-tradicional` | Por región/cultura; siempre separado de la eficacia |
| Seguridad / Prevención | `/seguridad`, `/prevencion` | |
| HerbaAI | `/herba-ai` | RAG con fuentes y nivel de confianza |
| Comparar | `/comparar` | Sin declarar ganador |
| Perfil | `/perfil` | Favoritos, historial, colecciones, perfil de salud local, exportar/borrar |
| Admin | `/admin` | CRUD, cola de revisión, literatura nueva, auditoría |
| Legal | `/privacidad`, `/terminos`, `/evidencia` | |

---

## 3. Tablas

Migraciones en `supabase/migrations/` (probadas contra PostgreSQL 16). Resumen por dominio:

### 3.1 Referencia y usuarios
| Tabla | Propósito |
|---|---|
| `profiles` | 1:1 con `auth.users`; nombre, idioma, plan |
| `admin_users` | Personal con rol (`editor`, `reviewer`, `admin`) — separado de `profiles` para que un usuario nunca pueda auto-ascenderse |
| `sources` | Fuentes (organismo, revista, base de datos, etnobotánica…) con URL, DOI, PMID, fecha de revisión |
| `evidence_levels` | Catálogo A–F, X con descripción bilingüe |
| `regions` | Jerarquía: macro-región → país → estado → municipio; y regiones culturales (pueblos) |

### 3.2 Entidades (herencia por tabla)
Una **superclase `entities`** (id, tipo, slug, nombre localizado, resumen, estado de revisión, vector de búsqueda) + una tabla por tipo con sus campos específicos:

| Tabla | Campos específicos destacados |
|---|---|
| `plants` | nombre científico, familia, sinónimos, descripción botánica, distribución, estado legal |
| `mushrooms` | nombre científico, familia, comestibilidad (`medicinal`/`edible`/`toxic`/`deadly`/`unknown`) |
| `foods` | nombre científico (si aplica), grupo de alimento, nutrientes |
| `compounds` | fórmula, clase química, biodisponibilidad, consulta PubChem |
| `conditions` | tipo (`disease`, `symptom`, `cancer`, `risk_factor`), CIE-10, padre (jerarquía), `is_cancer` |
| `medications` | clase farmacológica, ATC, categorías (anticoagulante, oncológico, cardiovascular, psiquiátrico…) |

Tablas satélite: `entity_aliases` (nombres comunes, regionales, sinónimos, en cualquier idioma — base del reconocimiento de entidades), `plant_parts`, `preparations`, `safety_warnings` (embarazo, lactancia, niños, mayores, hígado, riñón, cirugía, toxicidad, alergias…), `images` (con licencia y autor obligatorios), `entity_regions`.

> La lista del encargo (punto 39) se cubre así: `plant_compounds` es una **vista** sobre `entity_relations` (predicado `contains`), igual que `food_compounds`; `clinical_trials` es tabla propia (registro NCT, fase, estado) vinculada a `studies`.

### 3.3 Evidencia y grafo
| Tabla | Propósito |
|---|---|
| `entity_relations` | Aristas tipadas del grafo: `contains`, `source_of`, `lookalike_of`, `derived_from`, `related_to`… |
| `evidence_claims` | Afirmación: sujeto → condición, contexto, nivel, categoría, tipos de estudio, sabemos/no sabemos/se investiga/riesgos, texto científico y sencillo |
| `studies` | Ficha bibliográfica (título, autores, año, revista, tipo, población, n, intervención, comparador, resultado, limitaciones, DOI/PMID/NCT) — **sin texto completo** |
| `clinical_trials` | Registro de ensayo (NCT, fase, estado, fechas) |
| `study_results` | Resultado de un estudio para un par (entidad, condición) |
| `claim_studies` | Estudios que sustentan una afirmación |
| `interactions` | Agente (planta/compuesto/alimento/hongo) ↔ medicamento: tipo (`documented`, `possible`, `theoretical`, `insufficient`), gravedad, mecanismo, efecto |
| `traditional_knowledge` | Uso tradicional: entidad, región, pueblo/cultura, preparación, parte, fuente etnobotánica |
| `citations` | Fuente → (tabla, fila) con localizador (“sección Seguridad”) |

### 3.4 Usuarios, revisión, operación
`favorites`, `search_history`, `collections`, `collection_items`, `saved_studies`, `user_alerts`, `health_profiles` (opt-in, cifrado recomendado), `ai_queries` (retención 30 días), `subscriptions`, `ad_placements`, `content_reviews`, `audit_logs`, `literature_watches`, `study_candidates`, `ai_drafts`, `search_documents` (índice), `embeddings` (pgvector).

---

## 4. Relaciones

```
entities ─┬─ plants | mushrooms | foods | compounds | conditions | medications   (1:1, herencia)
          ├─< entity_aliases
          ├─< images, preparations, safety_warnings, plant_parts
          ├─< entity_relations >─ entities          (grafo: Cúrcuma ─contains→ Curcumina)
          ├─< evidence_claims >─ entities(condition) (Curcumina ─[E, preclínica, investigación]→ Cáncer colorrectal)
          │        └─< claim_studies >─ studies ─< study_results
          │                                └─ clinical_trials (0..1)
          ├─< interactions >─ entities(medication)  (Hipérico ─documented→ Warfarina)
          └─< traditional_knowledge >─ regions

citations: sources ─< citations >─ (claims | interactions | traditional_knowledge | safety_warnings | entities | studies)
regions: regions ─< regions (padre)    entity_regions: entities >─< regions
```

El **grafo de conocimiento** (punto 12) es la vista `v_knowledge_edges`, que une `entity_relations`, `evidence_claims` e `interactions` como aristas homogéneas (`sujeto, predicado, objeto, nivel, fuente`). Permite recorrer *Cúrcuma → Curcumina → Cáncer colorrectal → estudios → nivel → fuente* o *Warfarina → interacciones → plantas* con la misma consulta, y exportar a un motor de grafos (Neo4j/Apache AGE) si algún día hace falta.

---

## 5. APIs

Todas validan entrada con `zod`, aplican rate limiting y nunca exponen claves.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/search?q=&types=&limit=` | Búsqueda universal: entidades reconocidas, resultados, cadenas de relación, alertas de seguridad |
| GET | `/api/entities/[type]/[slug]` | Ficha completa (entidad + relaciones + evidencia + interacciones + fuentes) |
| GET | `/api/interactions?medication=&agent=` | Interacciones |
| GET | `/api/graph?entity=` | Aristas del grafo alrededor de una entidad |
| POST | `/api/ai` | HerbaAI (RAG) |
| POST | `/api/identify` | Identificación preliminar por imagen |
| GET | `/api/research/pubmed` | Proxy a PubMed E-utilities (filtros: tipo, años) |
| GET | `/api/research/trials` | Proxy a ClinicalTrials.gov v2 |
| GET | `/api/research/timeline` | Publicaciones indexadas por periodo (conteos de PubMed) |
| GET | `/api/me/export` · POST `/api/me/delete` | Exportar / eliminar datos de la cuenta |
| GET | `/api/cron/literature` | Detección de nuevos estudios (protegido con `CRON_SECRET`) |

En Supabase, las lecturas públicas son funciones SQL `api_search`, `api_entity_detail`, `api_interactions`, `api_lexicon`, etc. (`security invoker`, por lo que RLS sigue aplicándose).

---

## 6. Sistema de búsqueda

Tres capas, todas detrás de la misma interfaz:

1. **Reconocimiento de entidades** (`src/lib/search/engine.ts`): normaliza (minúsculas, sin acentos), elimina palabras vacías y busca los n‑gramas más largos contra el **léxico** (nombres, alias, nombres científicos, sinónimos, en todos los idiomas). Tolera errores tipográficos con distancia de Levenshtein acotada. “curcumina cáncer colon” → `Curcumina` (compuesto) + `Cáncer colorrectal` (condición, vía alias “cáncer de colon”).
2. **Cadenas de relación**: para cada par (agente, condición) reconocido se recorre el grafo — incluido el salto planta↔compuesto — para construir *Curcumina → Cúrcuma → Cáncer colorrectal → afirmaciones → nivel → fuentes → seguridad*.
3. **Texto completo**: `search_documents.tsv` (configuraciones `spanish` + `english` con `unaccent`), ranking `ts_rank_cd` + similitud `pg_trgm` para nombres. Índices GIN.

**Escalado**: con 100 000 entidades el léxico (~1–2 M alias) se resuelve en SQL (`api_resolve_terms`, índice trigram sobre `entity_aliases.normalized`). Para búsqueda semántica, la tabla `embeddings (vector(1024))` con índice HNSW queda preparada; HerbaAI y el buscador pueden combinar BM25 + vectores (búsqueda híbrida). Si las consultas superan lo razonable para PostgreSQL, `search_documents` se replica a Meilisearch/OpenSearch sin cambiar la API.

**Caché**: respuestas de fichas con revalidación (ISR, 1 h) + invalidación por etiqueta al aprobar contenido; resultados de APIs externas cacheados 24 h.

---

## 7. Seguridad

| Amenaza / requisito | Medida |
|---|---|
| Autenticación | Supabase Auth (contraseña + enlace mágico), cookies `httpOnly` vía `@supabase/ssr` |
| Autorización | **RLS en todas las tablas**. Roles en `admin_users`; funciones `is_staff()`, `has_staff_role()` (`security definer`, `search_path` fijo). Lectura pública sólo de contenido publicado y no rechazado; escritura sólo personal autorizado |
| SQL injection | Sólo consultas parametrizadas (PostgREST/RPC); ningún SQL dinámico con entrada de usuario |
| XSS | React escapa por defecto; el renderizador de respuestas de IA es propio y no admite HTML; CSP + cabeceras de seguridad |
| Validación | `zod` en cada Route Handler y Server Action; límites de tamaño (consulta ≤ 500 car., imagen ≤ 5 MB, tipos MIME permitidos) |
| Rate limiting | Ventana deslizante por IP y ruta (`src/lib/security/rate-limit.ts`). En producción multi-instancia: Cloudflare Rate Limiting / Upstash (misma interfaz) |
| Secretos | Sólo en el servidor (`import "server-only"`); `SUPABASE_SERVICE_ROLE_KEY` únicamente en el cron; nunca prefijo `NEXT_PUBLIC_` salvo URL y anon key (públicas por diseño, protegidas por RLS) |
| Logs | Logger estructurado sin datos personales ni de salud; `audit_logs` para cambios de contenido |
| Backups | Supabase PITR (plan Pro) + `pg_dump` semanal a R2 (script en `docs/OPERATIONS.md`) |
| Publicidad | Tablas separadas y sin claves foráneas hacia evidencia; los anunciantes no tienen rol de escritura; la UI nunca muestra anuncios en cáncer, seguridad ni interacciones |

---

## 8. Frontend

```
src/
  app/                    rutas (App Router), Server Components por defecto
    (público)/…           páginas de módulos
    admin/…               panel (protegido en servidor)
    api/…                 route handlers
  components/
    evidence/             EvidenceBadge, ClaimCard, WhyThisInfo, ContextTabs
    entity/               EntityHeader, SafetyPanel, InteractionsTable, Sources, Timeline
    search/               SearchBox, RelationChain
    layout/               Header, Footer, ModeToggle, LocaleToggle
    user/                 FavoriteButton, PersonalAlerts, HealthProfileForm
  lib/
    domain/               tipos y vocabularios controlados (fuente de verdad)
    data/                 KnowledgeRepository + SeedRepository + SupabaseRepository
    search/               motor de reconocimiento y cadenas
    safety/               triaje de emergencias e intención oncológica
    ai/                   RAG, prompts, guardas anti-invención
    research/             clientes PubMed / ClinicalTrials.gov
    i18n/                 diccionarios es/en
  data/seed/              conjunto demostrativo
```

* **Modos de lectura**: General / 🧠 Explícamelo fácil / 🔬 Investigador. El modo investigador muestra mecanismos, tipos de estudio, dosis estudiadas y limitaciones, siempre bajo el rótulo “Contenido técnico — no es una recomendación”.
* **Transparencia**: cada afirmación lleva el botón “¿Por qué aparece esta información?” (fuente, tipo de estudio, fecha, nivel, limitaciones, estado de revisión).
* **Diseño**: estética de atlas botánico/biblioteca científica — tipografía serif para títulos, paleta verde bosque + papel, sin iconografía esotérica. Responsive móvil primero; accesible (contraste AA, navegación por teclado).

## 9. Backend

* **Server Components** leen del repositorio (caché ISR).
* **Route Handlers** para todo lo que llama a terceros o a la IA (claves sólo en servidor).
* **Server Actions** para el admin, ejecutadas con la sesión del usuario (RLS decide).
* **Cron** (`/api/cron/literature`, programado con Vercel Cron / Cloudflare Cron Triggers): consulta PubMed por cada `literature_watch`, inserta `study_candidates` en estado *pendiente*. **Nada se publica automáticamente**.
* **Flujo editorial**: borrador (humano o IA) → `pending_review` → revisor aprueba/rechaza (`review_content()`), lo que registra `content_reviews` y `audit_logs`. Un borrador generado por IA nunca puede auto-aprobarse (restricción en la función: el revisor debe ser humano y distinto del autor).

## 10. Estrategia de fuentes científicas

### 10.1 Jerarquía de fuentes
1. Organismos oficiales: **NIH/NCCIH, NCI (PDQ), ODS, MedlinePlus, OMS/WHO, IARC, FDA, EMA (monografías HMPC)**.
2. Bases bibliográficas: **PubMed/MEDLINE, Cochrane, ClinicalTrials.gov**.
3. Revistas con revisión por pares (preferir revisiones sistemáticas y meta-análisis).
4. Bases botánicas: **POWO (Kew), World Flora Online, GBIF, Tropicos, EncicloVida (CONABIO)**.
5. Etnobotánica: **Biblioteca Digital de la Medicina Tradicional Mexicana (UNAM)** y literatura etnobotánica publicada.
6. Química: **PubChem, ChEBI**.

### 10.2 Integraciones (legales y técnicas)
| Fuente | Uso | Condiciones |
|---|---|---|
| PubMed E-utilities | Búsqueda, metadatos (título, autores, revista, año, DOI, PMID), conteos | Gratuito; ≤3 req/s sin clave, ≤10 con `NCBI_API_KEY`; identificar `tool` y `email` |
| ClinicalTrials.gov API v2 | Ensayos registrados | Dominio público |
| Wikimedia Commons | Fotografías con autor y licencia | Mostrar atribución y licencia |
| Pl@ntNet API (opcional) | Identificación por imagen | Clave gratuita con cuota; uso no comercial salvo acuerdo |
| PubChem PUG-REST (futuro) | Fórmulas, identificadores | Gratuito, límites de uso |

No se almacenan textos completos con copyright: sólo metadatos, un resumen propio y el enlace a la fuente original.

### 10.3 Reglas de datos
* Ningún DOI, PMID o NCT se escribe a mano sin verificar: los identificadores se importan desde PubMed/ClinicalTrials.gov.
* El conjunto demostrativo **no contiene estudios individuales**: sólo enlaza fichas institucionales (NCCIH, NCI, OMS) y marca todo como *pendiente de revisión humana*. Los estudios se incorporan importándolos desde el modo investigador.
* Cada ficha muestra 📚 fuentes, 📅 fecha de revisión (o “pendiente”) y 🔗 enlace original.

### 10.4 Imágenes
Las fotografías se resuelven por nombre científico en Wikimedia Commons (autor, licencia y enlace se muestran siempre) y se rotulan “imagen ilustrativa”. Para producción, la tabla `images` almacena fotografías propias o licenciadas con autor, licencia y verificación botánica.

---

## 11. Escalabilidad — plan por etapas

| Etapa | Volumen | Cambios |
|---|---|---|
| 1 | ≤ 10 000 especies, ≤ 100 000 usuarios | Supabase Pro, ISR, índices GIN/trigram |
| 2 | ≤ 100 000 especies, millones de estudios | Réplica de lectura; `studies` particionada por año; reconocimiento de entidades en SQL; colas para importación |
| 3 | Millones de usuarios | Búsqueda en motor dedicado (Meilisearch/OpenSearch); rate limiting distribuido; CDN de imágenes con R2; embeddings + búsqueda híbrida |

## 12. Monetización (preparada, separada de la evidencia)

* **Gratis**: búsqueda, fichas, uso tradicional, fuentes principales.
* **Premium**: investigación avanzada, comparador, historial ilimitado, biblioteca personal, HerbaAI avanzada, identificación por imagen, alertas de interacciones, modo offline.
* Publicidad, afiliados y contenido educativo viven en `ad_placements`/`sponsors`, sin relación con `evidence_claims`. Política: **ningún pago puede modificar una clasificación científica**; cualquier relación comercial con un producto se declara en la ficha.

Planes y permisos: `src/lib/plans.ts` (un único punto para activar/desactivar funciones).
