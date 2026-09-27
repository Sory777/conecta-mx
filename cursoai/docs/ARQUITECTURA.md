# CursoAI — Diseño técnico

> Plataforma de aprendizaje personalizada: *objetivo → la IA entiende → crea el camino → enseña → comprueba → detecta debilidades → adapta → objetivo cumplido*.

## 1. Inspección del proyecto existente

| Hallazgo | Detalle |
|---|---|
| Repositorio | `conecta-mx`: contiene **Conecta MX**, un directorio de negocios en producción (`conectamxapp.uk`). No existe nada de CursoAI. |
| Stack | Vite 5 + React 18 + TypeScript + Tailwind 3 + `lucide-react`; Supabase (auth + Postgres + RLS) desde el navegador; despliegue en **Cloudflare Workers** con assets estáticos (`wrangler.jsonc`). |
| Enrutado | Router propio por hash (`#/ruta`), sin dependencias. |
| Backend | No hay backend propio: el cliente habla directo con Supabase usando la *anon key*. |

**Decisión:** CursoAI es otro producto, así que vive en su propia carpeta (`/cursoai`) sin tocar Conecta MX. Se reutiliza lo que tiene sentido: el mismo stack de frontend (Vite/React/TS/Tailwind/lucide), el mismo proveedor de despliegue (Cloudflare Workers + assets), el patrón de router por hash y el estilo de componentes (`.btn`, `.card`, `.input`, Toasts).

Lo que **no** se reutiliza, y por qué:

* **Acceso directo a la BD desde el navegador.** CursoAI necesita llamar a la IA con claves privadas, aplicar cuotas y límites y evaluar respuestas sin mostrar la clave de respuestas. Eso exige un backend. El Worker que ya sirve los assets pasa a servir también `/api/*`.
* **Supabase.** Se sustituye por **Cloudflare D1** (SQLite). Motivos: (1) todo el sistema, BD incluida, corre y se prueba en local sin credenciales; (2) una sola unidad de despliegue en la plataforma que ya usa el proyecto; (3) como el navegador nunca toca la BD, el aislamiento entre usuarios se aplica en una sola capa del servidor (cada consulta filtra por `user_id`), en lugar de depender de políticas RLS. El SQL es estándar, así que migrar a Postgres/Supabase más adelante es factible.

## 2. Arquitectura

```
Navegador (React SPA, responsive)
   │  fetch /api/*  (cookie HttpOnly de sesión, JSON)
   ▼
Cloudflare Worker  ── assets estáticos (dist/)
   ├── http/router      rutas, validación (zod), errores
   ├── auth             PBKDF2 + sesiones en D1, CSRF por Origin
   ├── guard            rate limit, cuotas por plan, presupuesto diario de IA
   ├── services         intake · plan · stage · activity · evaluate · mastery · tutor · certificate · library
   ├── ai/
   │    ├── tasks        definición de cada tarea (prompt, esquema, nivel de modelo, caché, mock)
   │    ├── provider     interfaz AIProvider
   │    ├── anthropic    implementación Claude (SDK oficial)
   │    ├── mock         implementación determinista para desarrollo y pruebas
   │    ├── safety       temas sensibles, delimitación de entrada no confiable, canario anti-filtración
   │    └── cache        caché de contenido generado (D1)
   └── D1 (SQLite)
```

## 3. Flujo de generación del curso (por partes)

```
1. Intake (modelo rápido)     "Quiero aprender Excel para conseguir trabajo"
                              → tema, objetivo, tipo de objetivo, nivel, sensibilidad,
                                volatilidad, ≤3 preguntas SOLO sobre lo que falta
2. Diagnóstico (opcional)     el usuario responde (o se salta) las preguntas
3. Plan (modelo profundo)     objetivo final ("Al terminar podrás…"), etapas con estructura
                              propia del tema, competencias, conceptos, duración, proyecto final
4. Ajuste del plan            "Hazlo más corto" / "más práctico" / "20 min al día" → nueva versión
5. Aceptar                    se materializan etapas, competencias y conceptos (sin IA)
6. Esquema de etapa (estándar) solo para la etapa actual: secuencia de actividades según el tema
                              (lección, práctica, simulación, conversación, reto, caso…)
7. Contenido de actividad     bajo demanda al abrirla; la explicación se acorta si los conceptos
   (estándar)                 ya están dominados
8. Evaluación                 opción múltiple / V-F → se corrige en el servidor sin IA;
                              respuesta abierta, código, caso, conversación → IA (estándar)
9. Dominio (sin IA)           actualiza el estado de cada concepto y competencia
10. Siguiente actividad       política determinista: refuerzo si hay debilidad → siguiente
                              actividad → evaluación de etapa → nueva etapa adaptada →
                              proyecto final → certificado
```

Nada se genera antes de que haga falta: un curso de 6 etapas que se abandona en la etapa 2 solo ha costado el plan y dos etapas.

## 4. Estructura flexible (no plantilla rígida)

* `modules` = **etapas**. Cada una tiene un `kind_label` elegido por la IA ("Situación", "Técnica", "Módulo", "Reto"…).
* `lessons` = **actividades** con `type` ∈ `lesson | practice | simulation | conversation | case | challenge | project | reinforcement | quiz`. La IA decide la mezcla y el orden según el tema: inglés conversacional → escenas y conversación; programación → concepto → ejercicio de código → mini proyecto; ventas → escenario → simulación → negociación.
* Los ejercicios tienen `kind` ∈ `multiple_choice | true_false | short_answer | problem | code | scenario | conversation`.

## 5. Base de datos (D1 / SQLite)

Ver `migrations/0001_init.sql`. Resumen de relaciones:

```
users 1─1 user_profiles, user_preferences
users 1─N sessions, courses, answers, project_submissions, ai_conversations, certificates, achievements, usage_events, activity_log
courses 1─N course_plans (versionados), modules, competencies, concepts, lessons, quizzes, projects, sources
modules 1─N lessons, concepts
competencies 1─N concepts
concepts 1─N concept_mastery (por usuario)
lessons 1─N exercises, lesson_progress (por usuario), sources
quizzes 1─N questions ; questions/exercises 1─N answers
projects 1─N project_submissions
ai_conversations 1─N ai_messages
```

**Políticas de seguridad:** el navegador no tiene credenciales de BD. Toda consulta del backend que lee o escribe datos de un usuario incluye `user_id = ?` (o une con `courses.user_id`). Los helpers `requireCourse(userId, courseId)` y `requireLesson(userId, lessonId)` centralizan la comprobación de propiedad. Nunca se envían al cliente: claves de respuesta de preguntas, rúbricas internas, hashes de contraseñas.

## 6. Arquitectura de IA

* **`AIProvider`** (interfaz): `generateJSON`, `generateText`, `research`. Implementaciones: `AnthropicProvider` y `MockProvider`. Cambiar de proveedor = nueva clase + variable `AI_PROVIDER`.
* **Tareas** (`ai/tasks.ts`): cada tarea declara su prompt, esquema zod de salida, **nivel de modelo**, esfuerzo, si se cachea y su salida mock.
* **Niveles de modelo** (configurables por variables de entorno):

| Nivel | Modelo por defecto | Tareas |
|---|---|---|
| `fast` | `claude-haiku-4-5` | interpretar solicitud, corrección de respuestas cortas |
| `standard` | `claude-sonnet-5` | esquema de etapa, contenido de actividades, refuerzo, evaluación abierta, tutor, regeneraciones, investigación con búsqueda web |
| `deep` | `claude-opus-5` | plan del curso y su modificación, evaluación del proyecto final |

* **Salidas estructuradas** (`output_config.format` con esquema JSON), validadas de nuevo con zod en el servidor.
* **Fuentes:** para temas volátiles (finanzas, impuestos, derecho, salud, nutrición, tecnología, IA, ciencia actual) la actividad pasa antes por un paso de investigación con la herramienta de búsqueda web de Claude. Se guardan URL, título y fecha de consulta en `sources`, y el contenido se etiqueta como *"información actualizada — consultada el …"*. Si la búsqueda no está disponible, la actividad lo indica explícitamente en lugar de inventar datos.

## 7. Memoria del alumno

* **Estructurada:** `concept_mastery` (estado, puntuación EWMA, intentos, último error), `lesson_progress`, `answers` (con feedback y tipo de error), `user_profiles` (ritmo, nivel, preferencias), `course.current_lesson_id`.
* **Episódica:** `activity_log` (qué hizo y cuándo) → alimenta *"La última vez estabas trabajando en…"* y las recomendaciones.
* **Conversacional:** `ai_conversations` + `ai_messages` por curso, con ventana de los últimos mensajes y resumen acumulado (`summary`) para acotar tokens.
* El tutor y los generadores reciben un **resumen compacto de contexto** (objetivo, nivel, actividad actual, conceptos dominados/débiles, últimos errores), no el historial completo.

## 8. Motor de dominio (determinista, sin IA)

* Por concepto: `score` = media móvil (0,6·anterior + 0,4·nuevo resultado), `attempts`, `correct`, `wrong_streak`.
* `mastered`: score ≥ 0,8 y ≥ 2 aciertos. `needs_reinforcement`: 2 fallos seguidos, o score < 0,5 con ≥ 2 intentos. Si no: `learning`. Sin intentos: `not_started`.
* Competencia = agregado de sus conceptos. El progreso del curso (%) se muestra **junto** a la tabla de competencias, no en lugar de ella.

## 9. Seguridad

* Autenticación propia: contraseñas con PBKDF2-SHA256 (100 000 iteraciones, sal aleatoria); sesiones con token aleatorio de 256 bits en cookie `HttpOnly; Secure; SameSite=Lax`; en la BD solo se guarda el hash SHA-256 del token.
* CSRF: toda petición que modifica exige `Content-Type: application/json` y un `Origin` igual al host.
* Validación de toda entrada con zod y límites de longitud.
* Rate limiting en D1: login/registro por IP; endpoints de IA por usuario y minuto.
* Cuotas por plan (gratis/premium) y **presupuesto diario global** de IA como cortacircuitos.
* Claves solo como *secrets* del Worker (`ANTHROPIC_API_KEY`); nunca en el bundle.
* Cabeceras: CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`.

## 10. Protección contra contenido malicioso

* Todo texto del usuario y todo resultado externo se inserta dentro de etiquetas delimitadas (`<user_input>`, `<reference_material>`) con las etiquetas de cierre neutralizadas, y el prompt de sistema declara que su contenido es **dato, nunca instrucción**.
* Salidas estructuradas + validación zod: la IA no puede "salirse" del formato esperado.
* **Canario** en los prompts de sistema: si una respuesta lo contiene (intento de revelar instrucciones), se descarta.
* Las respuestas del alumno se evalúan con una rúbrica fija; un "ponme 10/10" dentro de la respuesta se ignora de forma explícita.
* Cuotas, rate limit y límites de longitud contra el abuso y la automatización.

## 11. Riesgos técnicos

| Riesgo | Mitigación |
|---|---|
| Latencia de generación del plan (modelo profundo) | Pantalla de progreso; el plan es la única llamada lenta; el resto se genera bajo demanda y por partes. |
| Salidas de la IA mal formadas | Salidas estructuradas + validación zod + un reintento. |
| Evaluación inconsistente de respuestas abiertas | Rúbrica por ejercicio generada junto al ejercicio; caché de evaluaciones de respuestas idénticas. |
| Alucinaciones en temas volátiles o regulados | Paso de investigación con fuentes, etiquetado, fechas y avisos. |
| Límite de CPU del Worker | Las llamadas a la IA son E/S (no cuentan como CPU); PBKDF2 limitado a 100k iteraciones. |
| Consistencia de D1 (sin transacciones interactivas) | Escrituras agrupadas con `db.batch()` (atómico). |

## 12. Costos

* Generación por partes y bajo demanda (no se paga contenido que nadie lee).
* Corrección local gratuita de opción múltiple y V/F.
* Caché `ai_cache` por hash de (tarea + modelo + entrada normalizada): cursos duplicados o compartidos, regeneraciones repetidas y evaluaciones idénticas no vuelven a llamar a la IA.
* Modelo según tarea (tabla de la sección 6) y esfuerzo bajo en tareas simples.
* Contexto compacto para el tutor (ventana + resumen) en lugar del historial completo.
* `usage_events` registra tokens y costo estimado por llamada → cuotas por plan y presupuesto diario global (`AI_DAILY_BUDGET_USD`).

## 13. Estructura del MVP

**Dentro:** registro/login; crear curso desde texto libre; diagnóstico (≤3 preguntas); plan con aceptar/modificar; etapas y actividades bajo demanda; ejercicios con corrección local e IA; dominio por concepto y competencia; refuerzo automático; evaluación de etapa; tutor con contexto; regeneración de actividades; biblioteca (continuar, duplicar, pausar, reiniciar, eliminar, compartir e importar, agregar contenido); progreso; perfil con uso y límites; proyecto final; certificado verificable; fuentes en temas volátiles; avisos en temas sensibles.

**Fuera (arquitectura preparada):** pagos (`users.plan` ya existe), multimedia (`content_json` admite bloques nuevos como `image`, `diagram` o `audio`), recuperación de contraseña por correo (necesita un proveedor de email), OAuth.
