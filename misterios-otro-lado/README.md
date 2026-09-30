# Misterios: El Otro Lado

Juego 3D multijugador de **misterio, exploración e investigación** con estética oscura y cinematográfica.
Este directorio contiene el **MVP 1 jugable**: cliente 3D (WebGL, Android y PC), servidor autoritativo en tiempo real, base de datos, economía con controles antifraude y panel de administración.

> ⚠️ **Modo sandbox activo por defecto.** Compras de gemas, anuncios y canjes de puntos son **simulados** y están rotulados como tales. No se cobra ni se paga dinero real. Ver [Modo sandbox](#modo-sandbox).

Documentación: [ARCHITECTURE.md](ARCHITECTURE.md) · [ECONOMY.md](ECONOMY.md) · [SECURITY.md](SECURITY.md) · [ROADMAP.md](ROADMAP.md)

---

## Qué se construyó

| Área | Estado en el MVP |
|---|---|
| **Mundo 3D** | San Bartolo del Monte: plaza con fuente, 8 edificios, capilla con campanario y cementerio, pozo, bosque instanciado (~1,000 árboles), caminos, la **Casa Morales** (estudio con puerta cerrada, techo derrumbado, jardín con ángel), mina (con **interior completo**: galería entibada, rieles, derrumbes, compuerta y cámara del nivel 3) y túnel subterráneo |
| **Ambiente** | Día/noche compartido (1 día = 24 min), niebla, lluvia, tormenta con relámpagos y truenos, linterna (3 tipos), farolas dinámicas, ventanas encendidas de noche, polvo en suspensión, audio 100% procedural (viento, grillos, lluvia, pasos por superficie, goteo), **música dinámica** que se tensa cerca del objetivo, eventos inesperados (campana lejana, susurros, silueta en la niebla). Sin gore |
| **Controles** | PC: WASD/flechas, Mayús, ratón (arrastrar), rueda, E, F, J, I, M, P, B, V, Enter, Esc. Móvil: joystick virtual, arrastre de cámara, botones Investigar/Linterna/Chat. Gamepad: sticks, A/B/X/Y, LB/RB |
| **Misterios** | Motor dirigido por datos. **4 episodios conectados**: Ep. 1 «Los desaparecidos de la casa abandonada» (7 etapas), Ep. 2 «La mina donde nadie quiere entrar» (6 etapas, acertijo de palancas), Ep. 3 «La campana que suena a medianoche» (temporada, sólo de noche) y Ep. 4 «Las cartas sin remitente» (4 etapas, cementerio y buzón). 4 NPC: Don Aurelio, Rosa Villalobos, Hermana Inés |
| **Personajes** | Humanos procedurales de proporciones realistas: esqueleto articulado (codos, rodillas, cadera, columna), rostro esculpido (nariz, cejas, pómulos, mentón, labios), ojos con iris y parpadeo, 4 peinados y barba, gabardina con solapas y faldón, camisa y corbata, manos con dedos, botas de cuero, telas con relieve (normal maps), animación de caminar/correr/reposo con respiración. Soporte opcional de modelos **.glb profesionales** con animaciones (ver «Personajes realistas con modelos .glb») |
| **Multijugador** | WebSocket autoritativo, shards de 40, sincronización 10 Hz con radio de interés e interpolación, validación de velocidad, grupos (4), invitaciones, cooperación, pistas compartidas, chat de mundo/grupo, amigos, bloquear, reportar |
| **Cuentas** | Registro, login, recuperación, verificación de correo, perfil, estadísticas, un personaje por cuenta (esquema preparado para varios) |
| **Economía** | Monedas, gemas (sandbox), puntos de recompensa con topes diarios/semanales y presupuesto global, canje con requisitos y revisión manual, rarezas y botín, tienda, pase de temporada gratis/premium, eventos, marketplace (monedas, desactivado), referidos por actividad legítima |
| **Monetización** | Anuncios recompensados/opcionales (sandbox con verificación en servidor, topes, espera, configuración remota, estadísticas), tienda, pase, patrocinios en carteles del mundo |
| **Seguridad** | scrypt, sesiones con hash, roles, zod, CSP, rate limiting, libro mayor idempotente, antifraude con puntuación y retención automática, auditoría |
| **Admin** | Resumen y analíticas (DAU/WAU/MAU, retención, embudo, salud económica), jugadores (estado, fraude, saldo, rol), reportes, sospechas, canjes, transacciones, economía, tienda, misterios (subir JSON), temporadas y eventos, publicidad, patrocinios, marketplace, auditoría |
| **Pruebas** | 24 pruebas Vitest (economía + integración HTTP/WebSocket con dos jugadores resolviendo el Ep. 1 en cooperación + recorridos completos del Ep. 2 y Ep. 4) + E2E con navegador real (Playwright) |

## Requisitos

- **Node.js ≥ 22.13** (usa `node:sqlite` integrado; no requiere instalar base de datos).
- npm 10+.
- Navegador con WebGL (Chrome/Edge/Firefox/Safari recientes; Chrome en Android).
- Opcional para E2E: Chromium de Playwright (`npx playwright install chromium`).

## Instalación

```bash
cd misterios-otro-lado
npm install
cp .env.example .env        # opcional en desarrollo
```

## Ejecución

### Desarrollo (recarga en caliente)

```bash
npm run dev
```

- Cliente: http://localhost:5173 (Vite, con proxy de `/api` y `/ws` al servidor)
- Servidor: http://localhost:8787
- Panel admin: http://localhost:5173/admin.html

Para probar desde un **teléfono** en la misma red Wi-Fi: abre `http://<IP-de-tu-PC>:5173`.

### Producción local (un solo proceso sirve API + WebSocket + cliente)

```bash
npm run build     # compila el cliente a client/dist
npm start         # http://localhost:8787
```

En un servidor real: pon el proceso detrás de HTTPS/WSS (Caddy/Nginx), define `NODE_ENV=production`, `SERVER_SECRET` y `TRUST_PROXY=true`.

### Crear un administrador

No hay administrador por defecto. Registra una cuenta en el juego y luego, en el servidor:

```bash
npm run create-admin -- <usuario_o_correo>             # rol admin
npm run create-admin -- <usuario_o_correo> moderator   # rol moderador
```

### Pruebas

```bash
npm test            # 24 pruebas del servidor (economía, antifraude, multijugador, misterios)
npm run typecheck   # TypeScript estricto en servidor y cliente
npm run build && npm run e2e   # E2E con navegador: 2 jugadores (escritorio + móvil táctil)
```

La E2E guarda capturas en `e2e-output/`. Si Playwright no encuentra Chromium, instala uno con `npx playwright install chromium` o indica uno existente con `PW_CHROMIUM=/ruta/a/chrome`.

## Variables de entorno

Ver [`.env.example`](.env.example). Resumen:

| Variable | Por defecto | Descripción |
|---|---|---|
| `NODE_ENV` | `development` | `production` exige `SERVER_SECRET` |
| `HOST` / `PORT` | `0.0.0.0` / `8787` | Dirección del servidor |
| `DATABASE_PATH` | `data/misterios.db` | Archivo SQLite (se crea solo) |
| `SERVER_SECRET` | (dev: autogenerado en `data/`) | HMAC de dispositivos. **Obligatorio en producción** |
| `PUBLIC_BASE_URL` | `http://localhost:5173` | Base para enlaces de correo |
| `SESSION_TTL_HOURS` | `720` | Duración de la sesión |
| `TRUST_PROXY` | `false` | `true` detrás de un proxy/balanceador |
| `AUTH_RATE_PER_10MIN` | `20` | Intentos de autenticación por IP |
| `SANDBOX_MODE` | `true` | Todo lo monetario es simulado |
| `REAL_PAYOUTS_ALLOWED` | `false` | Candado duro para canjes reales |
| `PAYMENT_PROVIDER` | `sandbox` | `sandbox` \| `none` |
| `AD_PROVIDER` | `sandbox` | `sandbox` \| `none` |
| `MAIL_PROVIDER` | `console` | `console` (enlaces al log) \| `none` |
| `LOG_LEVEL` | `info` | Nivel de log JSON |

El cliente **no usa variables secretas**. En desarrollo, `VITE_API_TARGET` permite cambiar el servidor al que apunta el proxy de Vite.

## Arquitectura (resumen)

```
client/ (Three.js + Vite) ──REST /api──┐
                        └──WebSocket /ws┤→ server/ (Fastify + ws, autoritativo) → SQLite
shared/ (protocolo, constantes, trazado del mundo)   content/ (episodios, objetos, tienda, temporadas)
```

- **Cliente**: render, controles, UI, audio, efectos; predice su movimiento y colisiones; nunca decide recompensas.
- **Servidor**: autenticación, jugadores, sesiones, misiones, inventario, economía, recompensas, transacciones, antifraude, eventos, analíticas y administración. Módulos en `server/src/modules/*`, desacoplados mediante un bus de eventos.
- **Contenido como datos**: añadir un misterio = añadir un JSON en `content/episodes/` (o subirlo desde el panel). Se valida al cargar.
- Motor final recomendado para cliente nativo: **Unity 6 (URP)**, que usará el mismo servidor y protocolo. Justificación completa en [ARCHITECTURE.md](ARCHITECTURE.md).

## Base de datos

`server/src/db/schema.sql` — 41 tablas normalizadas: cuentas (`users`, `sessions`, `devices`…), personajes, objetos e inventario por instancias, monedas/billeteras, transacciones y libro mayor, canjes, tienda y compras, misiones/pistas/progreso, temporadas/pase/eventos, social, referidos, marketplace, anuncios, patrocinios, actividad sospechosa, auditoría y analíticas. Se crea y migra automáticamente al arrancar. Diseñada para migrar a PostgreSQL (ver ARCHITECTURE §7).

## Cómo probar el multijugador

1. `npm run dev`.
2. Abre http://localhost:5173 en **dos navegadores distintos** (o una ventana normal + una de incógnito; cada una necesita su propia sesión). También sirve un teléfono en la misma red.
3. Crea dos cuentas y dos personajes. Ambos aparecen en la plaza y se ven moverse en tiempo real.
4. Pulsa **P** (Grupo y amigos) → **Jugadores** → **Invitar**. El otro jugador acepta en la notificación.
5. Hablen con **Don Aurelio** (junto a la fuente). Vayan juntos al **pozo viejo** (este): cuando uno encuentra la fotografía, el compañero cercano recibe la pista y el avance.
6. Prueben el chat (**Enter**), compartir pistas desde el diario (**J → Pistas**), bloquear y reportar.

Soluciones (spoiler):
- **Ep. 1**: Don Aurelio → pozo → ángel del jardín → puerta del estudio → diario → código **1403** en la trampilla → caja en el túnel → salida → Don Aurelio.
- **Ep. 2** (requiere Ep. 1): Rosa (camino de la mina) → caja del capataz (barreta) → tablas de la entrada → vagoneta (mapa de Tomás) → palancas **2-1-3** → mochila en la cámara → pozo del ascensor → Rosa. Recompensa: casco de minero.
- **Ep. 4** (requiere Ep. 1): Hermana Inés (capilla) → buzón de la plaza → lápida sin nombre en el cementerio → caja junto a la tienda → responder **Elena Morales**.

## Cómo probar las recompensas

- **Misterio**: al completarlo por primera vez se reciben 250 monedas, 150 RP, 400 XP, XP de temporada y un hallazgo aleatorio por rareza. Repetirlo (diario → «Volver a investigar») da 20% de monedas y 0 RP.
- **Anuncios**: Tienda (**B**) → «Gratis (anuncios)» → «Ver anuncio» (anuncio de prueba de 5 s). Cerrarlo antes se rechaza; hay espera de 3 min y tope de 5/día.
- **Gemas**: Tienda → Gemas → paquete (**sandbox**, sin cobro). Úsalas en el pase premium (**V**) o artículos premium.
- **Pase de temporada** (**V**): reclama niveles gratuitos/premium según tu XP de temporada.
- **Puntos de recompensa**: panel «Recompensas» (💠): saldo, límites de hoy/semana, historial y solicitud de canje (sandbox). Para probar un canje completo en desarrollo, como admin: marca el correo como verificado (Jugadores → «Marcar correo verificado»), ajusta el saldo de RP (Jugadores → «Ajustar saldo») y, si hace falta, baja `redemption.minAccountAgeDays` a 0 en **Parámetros económicos**. Luego apruébalo/recházalo en **Canjes** (rechazar devuelve los puntos).
- **Referidos**: panel Grupo → «Invitar amigos» copia un enlace `/?ref=CÓDIGO`. La recompensa llega sólo cuando el invitado completa el Ep. 1 y juega 20 min, y nunca si comparten dispositivo.
- **Episodio 3**: requiere el Ep. 1 y que sea de **noche** en el mundo (18:45–05:30, mira el reloj del HUD). Pista: ¿cuántas personas hay en la fotografía?

## Modo sandbox

Con `SANDBOX_MODE=true` (por defecto):

- **Compras de gemas**: `SandboxPaymentProvider` concede las gemas sin cobrar; cada compra queda en `purchases` con `sandbox=1` y se reporta como «ingreso simulado», separado del real. Límite de 10 compras sandbox/día.
- **Anuncios**: se muestra un «Anuncio de prueba (sandbox)». El flujo (token único emitido por el servidor + tiempo mínimo + topes) es el mismo que se usará en producción.
- **Canjes**: las solicitudes se crean con `sandbox=1`; aprobarlas no tiene valor monetario. Los canjes reales requieren **tres** candados: interruptor admin + `REAL_PAYOUTS_ALLOWED=true` + `SANDBOX_MODE=false`.
- **Correos**: se imprimen en el log del servidor (`[SANDBOX MAIL]`), nunca se envían.
- La interfaz muestra el rótulo «Modo sandbox».

## Integraciones externas (pendientes; requieren configuración manual)

No se simulan integraciones que no existen. Para producción:

| Servicio | Para qué | Cómo obtener credenciales | Dónde se integra |
|---|---|---|---|
| **Google Play Billing** | Compras en Android | Cuenta de Google Play Console (US$25), productos in-app, cuenta de servicio de Google Cloud con acceso a la Play Developer API para verificar `purchaseToken` | Nuevo `PaymentProvider` en `server/src/modules/store/payments.ts` + cliente nativo |
| **Apple App Store** | Compras en iOS (futuro) | Apple Developer Program (US$99/año), App Store Connect, clave `.p8` de App Store Server API | Nuevo `PaymentProvider` |
| **Stripe** | Compras en la versión web | Cuenta Stripe, `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` (webhooks firmados) | Nuevo `PaymentProvider` + endpoint de webhook |
| **Google AdMob** (o LevelPlay) | Anuncios recompensados | Cuenta AdMob, app y unidades de anuncio; activar **Server-Side Verification** con la URL de callback del servidor | `server/src/modules/ads/service.ts`: el callback SSV sustituye a `/ads/complete` del cliente |
| **Correo** (Amazon SES / Resend / SMTP) | Verificación y recuperación | Cuenta del proveedor, dominio verificado (SPF/DKIM) | Implementar `Mailer` en `server/src/modules/auth/mailer.ts` |
| **Premios** (Tremendous / Tango Card / PayPal Payouts) + **KYC** | Canjes de valor real | Contratos y claves API del proveedor; proveedor de KYC | Nuevo servicio de pagos de premios; hoy la aprobación no mueve dinero |
| **Play Integrity API** | Detectar clientes modificados | Google Cloud + Play Console | Antifraude (verificación del token en servidor) |

## Personajes realistas con modelos .glb

El personaje por defecto se genera por código (sin archivos ni licencias). Para usar un **modelo humano profesional** (Mixamo, Ready Player Me, MakeHuman —CC0—, escaneo o arte propio):

1. Exporta el modelo en **.glb** con esqueleto y animaciones de reposo, caminar y correr.
2. Cópialo a `client/public/models/` (p. ej. `investigador.glb`).
3. Crea `client/public/models/manifest.json`:
   ```json
   { "character": { "url": "/models/investigador.glb", "height": 1.78, "rotateY": 3.1416,
                    "clips": { "idle": "Idle", "walk": "Walk", "run": "Run" }, "tint": ["coat", "jacket"] } }
   ```
4. `npm run build`. Si el archivo falta o falla, el juego vuelve al personaje procedural.

⚠️ Revisa la licencia: Mixamo permite usar sus personajes en juegos, pero **no** redistribuir el archivo suelto en un repositorio público. MakeHuman exporta modelos CC0.

## Qué queda pendiente

- Arte definitivo (modelos .glb riggeados con licencia, texturas PBR, música compuesta) — hoy personajes y escenario son procedurales.
- Más episodios y NPC; tutorial guiado.
- Cliente nativo Unity; integraciones reales de pagos, anuncios, correo y premios (tabla anterior).
- PostgreSQL + Redis y despliegue multi-nodo; colisiones autoritativas en servidor.
- Aspectos legales antes de lanzar (privacidad, menores, programa de recompensas, impuestos, KYC).

Detalle completo en [ROADMAP.md](ROADMAP.md).
