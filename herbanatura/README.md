# 🌿 HerbaNatura

> **“El conocimiento de la naturaleza, investigado con ciencia.”**

Enciclopedia digital de plantas medicinales, hongos, alimentos y compuestos naturales que combina medicina tradicional, investigación científica y seguridad — y que **distingue rigurosamente** el uso tradicional, la evidencia en laboratorio, en animales, observacional y clínica. Nunca convierte un resultado experimental en una recomendación médica.

* 📐 Arquitectura, tablas, relaciones, APIs, búsqueda, seguridad y estrategia de fuentes: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
* ⚖️ Política editorial y niveles de evidencia (A–F, X): [`docs/EVIDENCE_POLICY.md`](docs/EVIDENCE_POLICY.md)
* 🛠️ Puesta en marcha, despliegue, backups: [`docs/OPERATIONS.md`](docs/OPERATIONS.md)

## Inicio rápido

```bash
cd herbanatura
npm install
npm run dev            # http://localhost:3000 → /es
```

Sin variables de entorno la app funciona con el **conjunto demostrativo en memoria** (sin base de datos). Con Supabase configurado usa PostgreSQL con RLS; con `ANTHROPIC_API_KEY`, HerbaAI genera respuestas con citas (si no, responde en modo extractivo). Ver `.env.example`.

## Qué incluye

| Módulo | Ruta | Destacado |
|---|---|---|
| Buscador universal | `/es/buscar` | Reconoce plantas, compuestos, enfermedades y medicamentos (con tolerancia a errores) y construye cadenas: *Curcumina → Cúrcuma → Cáncer colorrectal → nivel → fuentes* |
| Fichas | `/es/plantas/curcuma`, `/es/compuestos/…`, `/es/hongos/…`, `/es/alimentos/…`, `/es/condiciones/…`, `/es/medicamentos/…` | Modos General · 🧠 Explícamelo fácil · 🔬 Investigador; “¿Por qué aparece esta información?”; sabemos / no sabemos / se investiga / riesgos |
| Naturaleza y cáncer | `/es/cancer` | Prevención, investigación, complementario y tratamiento **separados**; filtros por tipo de cáncer y origen |
| Interacciones | `/es/interacciones` | Medicamento → plantas y planta → medicamentos; “Información insuficiente” explícita |
| Investigación | `/es/investigacion` | Base propia + PubMed + ClinicalTrials.gov en vivo, con filtros |
| Identificar | `/es/identificar` | Identificación **preliminar** por foto (Claude visión o Pl@ntNet), especies tóxicas similares |
| HerbaAI | `/es/herba-ai` | RAG sobre la base: sólo puede citar documentos recuperados; guarda que elimina DOI/PMID/URL inventados; confianza calculada a partir de la evidencia, no por el modelo |
| México | `/es/mexico`, `/es/mexico/guanajuato` | 32 estados (claves INEGI) y 46 municipios de Guanajuato |
| Medicina tradicional | `/es/medicina-tradicional` | Por región y tradición, separado de la eficacia |
| Seguridad / Prevención | `/es/seguridad`, `/es/prevencion` | “Causa demostrada” frente a “factor asociado” |
| Comparar | `/es/comparar?a=curcumina&b=egcg` | Sin declarar ganadora |
| Perfil | `/es/perfil` | Favoritos, historial, colecciones, perfil de salud **sólo en el dispositivo**, exportar y borrar |
| Admin | `/es/admin` | Cola de revisión (cuatro ojos), CRUD, evidencia, interacciones, importación desde PubMed, vigilancia de literatura, auditoría |

Seguridad para el usuario: triaje determinista de emergencias (dolor torácico, disnea, convulsiones, anafilaxia, ictus, intoxicación, autolesión) que **bloquea** cualquier remedio y muestra el aviso de urgencia; detección de la intención de “tratar el cáncer con plantas” o de abandonar tratamientos.

## Garantías de rigor (en código, no sólo en la UI)

* La base de datos **rechaza**: evidencia preclínica marcada como humana; tratamiento del cáncer con nivel A/B sin evidencia humana; aprobar afirmaciones o interacciones sin fuente; DOI/PMID escritos a mano; que un editor apruebe su propio contenido.
* Editar contenido revisado lo devuelve a revisión; todo cambio queda en `audit_logs`.
* El conjunto demostrativo **no contiene estudios individuales** ni identificadores: sólo enlaza fichas institucionales (NCCIH, NCI, OMS/IARC, MedlinePlus, POWO, UNAM…) y todo está **pendiente de revisión humana**. Los campos sin fuente muestran “Pendiente de investigación/verificación”.

## Pruebas

```bash
npm test                 # 37 pruebas: integridad de datos, buscador, triaje, RAG y guardas anti-invención
npm run db:test          # aplica migraciones + seed en PostgreSQL local y verifica RLS y reglas
HN_TEST_DB=herbanatura_test npm test   # + paridad entre funciones SQL y el repositorio TypeScript
```

## Stack

Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 · Supabase (PostgreSQL 15+, Auth, Storage, RLS) · PostgreSQL FTS + pg_trgm (+ pgvector preparado) · Anthropic Claude (configurable) · despliegue en Vercel o Cloudflare.
