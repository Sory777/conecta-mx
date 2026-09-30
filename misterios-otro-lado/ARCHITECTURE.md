# ARQUITECTURA — Misterios: El Otro Lado

## 1. Análisis del entorno (punto de partida)

- El repositorio contenía otra aplicación (Conecta MX, React + Supabase) sin relación con el juego. El juego vive **aislado** en `misterios-otro-lado/` para no mezclar dependencias ni despliegues.
- Herramientas disponibles: Node.js 22 (con `node:sqlite`), npm, PostgreSQL 16 (cliente), Docker, Go, Python, Chromium + Playwright.
- **No disponibles**: Unity, Unreal y Godot (ni sus editores/licencias, ni SDK de Android para exportar). Además, no hay GPU: el render 3D sólo puede verificarse por software (SwiftShader).

## 2. Comparación de motores

| Criterio | Unity (6 LTS, URP) | Unreal Engine 5 | Godot 4 |
|---|---|---|---|
| Android (gama media/baja) | ★★★★★ muy maduro, URP escalable | ★★☆☆☆ pesado; Lumen/Nanite no aptos para móvil modesto | ★★★★☆ renderer *Mobile/Compatibility* ligero |
| PC | ★★★★☆ | ★★★★★ | ★★★★☆ |
| Gráficos "realistas oscuros" | ★★★★☆ (URP + post-proceso, volumétricos con assets) | ★★★★★ | ★★★☆☆ |
| Multijugador | ★★★★☆ Netcode/Mirror/Fish-Net/Photon; o servidor propio | ★★★★★ replicación nativa y servidores dedicados | ★★★☆☆ API de alto nivel correcta, ecosistema menor |
| Facilidad de desarrollo / equipo | ★★★★☆ C#, enorme comunidad y Asset Store | ★★☆☆☆ C++/Blueprints, curva alta | ★★★★☆ GDScript/C#, simple |
| Monetización (anuncios, IAP) | ★★★★★ LevelPlay/AdMob, Unity IAP, Google Play Billing | ★★★☆☆ plugins, más trabajo | ★★☆☆☆ plugins comunitarios |
| Tamaño de build / descarga | Medio | Grande | Pequeño |
| Licencia | Gratis bajo umbral de ingresos, luego suscripción | 5% de regalías sobre US$1M | MIT, sin regalías |
| Backend / escalabilidad | Independiente del motor | Independiente del motor | Independiente del motor |

### Decisión

1. **Cliente 3D final (Android + PC): Unity 6 LTS con URP.** Es el mejor equilibrio para un juego móvil-primero, multijugador y monetizado con anuncios/compras: rendimiento en Android de gama media, ecosistema de monetización más maduro y gran disponibilidad de desarrolladores. Unreal se descarta por peso en móvil y complejidad; Godot es una alternativa viable (sin regalías) si se prioriza costo de licencia sobre ecosistema de monetización.
2. **MVP jugable ahora: cliente 3D web con Three.js (WebGL).** Como ningún motor puede instalarse ni ejecutarse aquí, se construyó un cliente 3D real en WebGL que **ya funciona en navegadores de Android y PC**, se verifica con navegador automatizado y sirve también como versión "sin instalación" (PWA) a futuro. **No sustituye** el objetivo del cliente nativo: lo acelera.
3. **Servidor independiente del motor.** Toda la lógica (autenticación, mundo, misterios, economía, antifraude) está en un servidor autoritativo con un **protocolo JSON documentado** (`shared/protocol.ts`) y **contenido como datos** (`content/`). El cliente Unity se conectará al mismo servidor (REST + WebSocket) sin reescribir el backend.

### Stack del MVP

| Capa | Tecnología | Motivo |
|---|---|---|
| Cliente 3D | TypeScript + Three.js r186 + Vite | WebGL en Android y PC; sin instalar; tipos compartidos con el servidor |
| Servidor | Node.js 22 + TypeScript (tsx) + Fastify (REST) + `ws` (tiempo real) | Un solo lenguaje, rápido de iterar, excelente para E/S concurrente |
| Validación | zod | Esquemas estrictos para API y contenido |
| Base de datos | SQLite (`node:sqlite`, WAL) | Cero configuración para el MVP; SQL portable a PostgreSQL |
| Pruebas | Vitest (unitarias + integración HTTP/WebSocket) + Playwright (E2E con navegador) | |

## 3. Vista general

```
┌──────────────────────── CLIENTE (Three.js / futuro Unity) ────────────────────────┐
│ render: mundo, cielo día/noche, niebla, lluvia, linterna, farolas, efectos         │
│ controles: teclado/ratón · joystick táctil · gamepad · cámara 3ª persona          │
│ UI: menús, HUD, diario/pistas, inventario, mapa, tienda, temporada, social, chat  │
│ audio procedural (ambiente, música dinámica)                                       │
│ predicción local de movimiento + colisiones; interpolación de otros jugadores     │
└──────────────┬───────────────────────────────────────────┬────────────────────────┘
       REST (JSON, Bearer)                            WebSocket /ws (JSON)
┌──────────────┴───────────────────────────────────────────┴────────────────────────┐
│ SERVIDOR (autoritativo)                                                            │
│  http: seguridad (CSP, rate limit, roles), rutas jugador y admin                   │
│  multiplayer/gateway: shards, snapshots 10 Hz con radio de interés, validación de  │
│      movimiento, grupos, invitaciones, chat, cooperación, teletransportes          │
│  missions: motor de misterios dirigido por datos                                   │
│  economy (libro mayor) · rewards (RP) · inventory · store (+payments) · ads        │
│  seasons/events · social · referrals · marketplace · sponsors                     │
│  antifraud · analytics · auth · accounts · admin                                  │
│  bus de eventos interno (desacopla módulos)                                        │
└──────────────────────────────────────┬─────────────────────────────────────────────┘
                                  SQL parametrizado
┌──────────────────────────────────────┴─────────────────────────────────────────────┐
│ BASE DE DATOS: SQLite (MVP) → PostgreSQL (producción)                               │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## 4. Estructura de carpetas

```
misterios-otro-lado/
├─ shared/                    # Código compartido cliente/servidor
│  ├─ constants.ts            # velocidades, red, rarezas, reloj del mundo
│  ├─ protocol.ts             # mensajes WebSocket y vistas (tipos)
│  └─ world.ts                # trazado del mapa, alturas, colisiones, zonas
├─ content/                   # CONTENIDO COMO DATOS (sin tocar código)
│  ├─ items.json              # catálogo de objetos y rarezas
│  ├─ store.json              # productos y paquetes de gemas
│  ├─ seasons/*.json          # temporadas, niveles del pase, eventos
│  └─ episodes/*.json         # misterios (episodios)
├─ server/
│  ├─ src/
│  │  ├─ app.ts / index.ts / services.ts
│  │  ├─ config/env.ts        # variables de entorno validadas
│  │  ├─ db/                  # schema.sql + envoltorio transaccional
│  │  ├─ http/                # rutas jugador/admin, helpers
│  │  ├─ lib/                 # reloj inyectable, bus, rate limit, ids, sanitización
│  │  ├─ modules/
│  │  │  ├─ auth/ accounts/ inventory/ economy/ rewards/ missions/
│  │  │  ├─ multiplayer/ store/ ads/ seasons/ social/ referrals/
│  │  │  └─ marketplace/ sponsors/ antifraud/ analytics/ content/
│  │  └─ scripts/create-admin.ts
│  └─ tests/                  # vitest: economía + integración multijugador
├─ client/
│  ├─ index.html / admin.html
│  └─ src/
│     ├─ game/                # Game, cámara, entrada, colisiones, personajes, entidades, audio
│     │  └─ world/            # construcción del mundo, entorno (cielo/luces/clima), texturas
│     ├─ ui/                  # menú, HUD, paneles, mapa, utilidades DOM seguras
│     ├─ net/                 # API REST y WebSocket
│     └─ admin/               # panel de administración
└─ scripts/                   # dev.mjs, e2e-smoke.mjs
```

## 5. Multijugador

- **Conexión**: `GET /ws` → el primer mensaje debe ser `hello {token, deviceId, v}` (8 s de plazo). Versión de protocolo verificada. Una sesión por cuenta (una nueva expulsa a la anterior).
- **Shards**: instancias de hasta 40 jugadores (`NET.maxPlayersPerShard`). Al unirse a un grupo, el jugador se mueve al shard del líder.
- **Movimiento**: el cliente predice y envía su posición a 12 Hz; el servidor valida (presupuesto de distancia por tiempo, región, límites) y corrige con `correct`. Snapshots a 10 Hz sólo con jugadores dentro del **radio de interés** (90 m) y de la misma región. El cliente interpola ~130 ms en el pasado.
- **Autoridad**: interacciones, acertijos, economía, inventario, progreso, teletransportes y recompensas son del servidor. Las colisiones con el escenario se resuelven en el cliente (ver SECURITY §11).
- **Grupos** (máx. 4): invitar (por usuario o desde la lista de jugadores), aceptar/rechazar (expira en 60 s), líder, expulsar, salir, miembros desconectados se retiran tras 5 min.
- **Cooperación**: si una regla del episodio es `coop`, sus efectos de progreso (pistas, banderas, etapas, completar) se replican a compañeros del grupo **cercanos** (45 m, misma región) con la investigación activa. Los objetos no se replican. Bonificación cooperativa de monedas (+10%). Pistas compartibles manualmente con todo el grupo.
- **Chat**: canal de mundo (shard) y de grupo; limpieza y filtro; bloqueos respetados; mensajes guardados para moderación.
- **Mundo compartido**: hora del día derivada del reloj del servidor (día = 24 min) y clima rotativo (despejado/niebla/lluvia/tormenta) o forzado por eventos.

### Protocolo (resumen; ver `shared/protocol.ts`)

Cliente → servidor: `hello`, `move`, `interact`, `solve`, `track`, `chat`, `share_clue`, `party_invite`, `party_respond`, `party_leave`, `party_kick`, `ping`.

Servidor → cliente: `welcome`, `snapshot`, `player_join/leave/update`, `interact_result`, `solve_result`, `missions`, `mission_complete`, `wallet`, `inventory_changed`, `chat`, `party`, `party_invite`, `notice`, `teleport`, `correct`, `world`, `pong`, `error`, `kicked`.

## 6. Sistema de misterios (dirigido por datos)

Un episodio (`content/episodes/*.json`, validado por `server/src/modules/missions/schema.ts`) define:

- `title`, `synopsis`, `location`, `seasonId`, `prerequisites`, `availability` (fechas), `repeatable`.
- `start`: objetivo/pista antes de empezar y a quién hay que hablarle.
- `npcs`: posición, apariencia.
- `clues`: pistas (compartibles o no).
- `entities`: puntos interactivos con `kind`, `model` visual, radio, `visibleWhen`, `blockingWhen` (p. ej. puerta cerrada = colisión), `highlightWhen`.
- `puzzles`: enunciado, respuestas (**sólo servidor**), intentos por minuto, requisitos y acciones al resolver.
- `stages`: etapas con objetivo, pista y marcador.
- `interactions`: reglas `target + whenStatus + when[] → do[]` (+ `coop`). Se ejecuta la **primera** regla cuyas condiciones se cumplen.
- `rewards`: monedas, RP, XP, XP de temporada, objetos y tabla de botín.

**Condiciones**: `stage`, `stageIn`, `hasItem`, `notHasItem`, `hasClue`, `notHasClue`, `flag`, `notFlag`, `night`, `status`.
**Acciones**: `start`, `dialogue`, `message`, `giveItem`, `takeItem`, `giveClue`, `setFlag`, `clearFlag`, `setStage`, `teleport`, `openPuzzle`, `complete`.

Añadir un misterio = escribir un JSON (o subirlo desde el panel admin). El validador comprueba referencias cruzadas, objetos existentes, posiciones dentro del mapa e ids únicos entre episodios. El cliente dibuja entidades con modelos genéricos por `model`; nuevos modelos o zonas del mapa sí requieren arte/código de cliente.

### Episodio 1 — «Los desaparecidos de la casa abandonada»

Don Aurelio (plaza) → pozo viejo (fotografía con fecha y pista del ángel) → ángel del jardín (llave) → puerta del estudio (usar llave) → diario de Lucía (cómo se formó el código) → candado de la trampilla (acertijo: día+mes de la foto = `1403`) → túnel subterráneo (colgante y carta) → regreso con Don Aurelio. Cooperativo, con pistas compartibles y recompensas.

### Episodio 3 (temporada) — «La campana que suena a medianoche»

Requiere el Episodio 1 y la Temporada 1 activa. Sólo se resuelve **de noche** (hora del mundo). El acertijo se responde con información de la fotografía del Episodio 1 (contenido conectado entre episodios).

## 7. Base de datos

Esquema en `server/src/db/schema.sql` (3FN salvo JSON de configuración/contenido). Separación explícita:

| Concepto | Tablas |
|---|---|
| Player ID / Account | `users` (id = Player ID), `sessions`, `password_resets`, `email_verifications`, `devices`, `user_devices` |
| Character | `characters` (1:N por cuenta vía `slot`; el MVP usa 1) |
| Items / Inventory | `items` (catálogo), `inventory_items` (instancias), `item_ledger` |
| Currencies / Wallet | `currencies`, `wallets` (saldo por moneda, `CHECK >= 0`) |
| Transactions | `transactions` (operación idempotente), `ledger_entries` (asientos por moneda) |
| Reward balance / rewards | `wallets` (rp), `reward_redemptions`, configuración en `economy_config` |
| Missions / clues | `missions` (contenido versionado), `clues`, `mission_progress`, `player_clues`, `puzzle_attempts` |
| Seasons / events | `seasons`, `season_tiers`, `season_progress`, `events` |
| Purchases / store | `store_products`, `gem_packs`, `purchases` (`UNIQUE(provider, provider_ref)`) |
| Social | `friendships`, `blocks`, `reports`, `chat_messages` |
| Referrals | `referrals` (+ `users.referral_code`) |
| Marketplace | `marketplace_listings` |
| Advertisements / sponsors | `ad_placements`, `ad_views`, `sponsor_campaigns` |
| Seguridad | `suspicious_activity`, `audit_log` |
| Analytics | `play_sessions`, `analytics_events` |

### Migración a PostgreSQL

El SQL evita extensiones de SQLite (fechas como epoch ms, ids UUID en texto, JSON en `TEXT`). Pasos: reemplazar `Db` (`db/database.ts`) por un adaptador `pg` con la misma interfaz (`get/all/run/tx`), convertir `?` → `$n`, `INSERT OR IGNORE` → `ON CONFLICT DO NOTHING`, `TEXT` JSON → `JSONB`. La interfaz síncrona actual pasa a `async` (los servicios ya encapsulan cada operación en una transacción).

## 8. Escalabilidad

| Fase | Carga | Arquitectura |
|---|---|---|
| MVP | cientos de CCU | 1 proceso Node + SQLite (WAL) en un VPS |
| Crecimiento | miles de CCU | PostgreSQL gestionado; Redis para sesiones de WS, grupos, rate limit y pub/sub; varios nodos de juego detrás de un balanceador con afinidad por shard; API REST sin estado escalada horizontalmente |
| Escala | decenas de miles | Separar servicios (auth/economía/juego), colas para analíticas (p. ej. a un data warehouse), CDN para el cliente, servidores de juego regionales, posible servidor de física autoritativo (colisiones en servidor) |

El código ya está modularizado por dominio, con un bus de eventos y servicios inyectados, para que cada módulo pueda extraerse sin reescribir el resto.

## 9. Riesgos técnicos identificados

| Riesgo | Mitigación |
|---|---|
| Rendimiento WebGL en Android de gama baja | Calidad baja/media/alta (sombras, píxeles, densidad de árboles/hierba, luces); instanciado; texturas procedurales pequeñas. Cliente Unity nativo a mediano plazo |
| Migración de cliente web a Unity | Protocolo y contenido independientes del motor; tipos compartidos documentados |
| Colisiones no autoritativas | Condiciones/distancias validadas en servidor; física en servidor en fase posterior |
| SQLite en un solo nodo | Capa `Db` aislada; ruta clara a PostgreSQL |
| Estado en memoria (grupos, limitadores) | Interfaz lista para Redis |
| Contenido mal formado | Validación estricta y referencial al cargar/subir episodios |
