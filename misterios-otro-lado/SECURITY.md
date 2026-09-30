# SEGURIDAD — Misterios: El Otro Lado

Principio rector: **el cliente no es de confianza**. Todo lo que afecta a recompensas, economía, progreso o a otros jugadores se decide y valida en el servidor.

## 1. Autenticación y sesiones

- Contraseñas con **scrypt** (N=16384, r=8, p=1, sal aleatoria de 16 bytes, clave de 64 bytes) y comparación en tiempo constante (`timingSafeEqual`). Se calcula un hash ficticio cuando el usuario no existe para no revelar cuentas por tiempos de respuesta.
- Requisitos de contraseña: 8–128 caracteres con letras y números.
- Sesiones con **token opaco aleatorio** (32 bytes). En la BD sólo se guarda su **SHA-256**; si la BD se filtra, los tokens no sirven. Caducidad configurable (`SESSION_TTL_HOURS`), revocación en logout, al cambiar la contraseña y al suspender/bloquear una cuenta.
- Recuperación de contraseña: token de un solo uso, 1 hora de validez, hash en BD, respuesta idéntica exista o no el correo (evita enumeración), límite de solicitudes.
- Verificación de correo con token de un solo uso (3 días).
- **Pendiente para producción**: proveedor de correo real (ver README), 2FA para cuentas administrativas, y opcionalmente cookies `HttpOnly; Secure; SameSite=Strict` en lugar de `Authorization: Bearer` desde `localStorage` para reducir el impacto de un XSS (hoy mitigado con CSP estricta y renderizado sólo con `textContent`).

## 2. Autorización por roles

- Roles: `player`, `moderator`, `admin` (`requireRole` en cada ruta de `/api/admin/*`).
- Moderador: ver jugadores, suspender/activar, expulsar de la sesión, reportes y actividad sospechosa.
- Administrador: además economía, contenido, tienda, temporadas, anuncios, patrocinios, canjes, roles, ajustes de saldo.
- No existe ningún administrador por defecto ni credenciales en el código: se promueve una cuenta existente desde el servidor con `npm run create-admin -- <usuario>`.
- Un administrador no puede cambiar su propio rol; un moderador no puede bloquear ni actuar sobre administradores.
- **Auditoría**: toda acción administrativa se guarda en `audit_log` (actor, acción, objetivo, detalles, IP, fecha). Los cambios de economía guardan el antes y el después.

## 3. Validación y sanitización

- Todos los cuerpos HTTP se validan con **zod** (tipos, longitudes, rangos, enums). Límite de cuerpo 64 KB (512 KB sólo para subir episodios).
- Mensajes WebSocket: tamaño máximo 8 KB, validación manual de tipos y rangos por mensaje, números finitos, longitudes truncadas.
- Textos de usuario (chat, reportes, nombres): normalización Unicode, eliminación de caracteres de control e invisibles/bidi, colapso de espacios, longitud máxima y filtro básico de lenguaje ofensivo. El cliente pinta **siempre** con `textContent` (nunca `innerHTML`), por lo que HTML/JS inyectado se muestra como texto.
- Nombres de usuario y de personaje con expresiones regulares estrictas; colores con `#RRGGBB`.
- SQL siempre con parámetros (`?`), nunca concatenación de datos del usuario.
- Contenido de episodios subido por admin: esquema estricto + validación referencial (etapas, pistas, acertijos, objetos existentes, posiciones dentro del mapa, ids únicos entre episodios).

## 4. Limitación de tasa y abuso de APIs

| Ámbito | Límite |
|---|---|
| Global por IP (`/api/*`) | ráfaga 120, 25 req/s |
| Autenticación por IP | `AUTH_RATE_PER_10MIN` (20 por defecto) |
| Inicio de sesión por IP y por cuenta | 8 intentos / 5 min |
| Recuperación de contraseña | 3 por hora por IP y por correo |
| Endpoints económicos (tienda, anuncios, recompensas, temporada, marketplace) | 20 de ráfaga, 2/s por cuenta |
| Registros por IP | `antifraud.maxRegistrationsPerIpPerDay` (5/día) |
| WebSocket por conexión | 60 de ráfaga, 30 msg/s; exceso → señal `ws_flood` |
| Acciones de juego (interactuar/acertijos) | 8 de ráfaga, 4/s |
| Chat | 5 de ráfaga, 1 cada 2 s |
| Intentos por acertijo | configurable por acertijo (5–6/min) + detección de fuerza bruta |
| Reportes | 15 por día |

Los limitadores son en memoria (un nodo). En despliegue multi-nodo se sustituyen por Redis con la misma interfaz.

## 5. Protección de la economía

- **Libro mayor único**: `Economy.apply()` es el único punto que cambia saldos o inventarios. Cada operación tiene una **clave de idempotencia única** (reintentos/doble clic/replay no duplican) y se ejecuta en una **transacción** (todo o nada). Saldos con `CHECK (balance >= 0)`.
- **Objetos como instancias únicas** con historial (`item_ledger`): no se pueden duplicar; en el marketplace el objeto pasa a `escrow` y no puede usarse ni volver a listarse.
- Recompensas de misiones calculadas en el servidor a partir del contenido; el cliente nunca envía cantidades.
- Aleatoriedad de botín con `crypto.randomInt` en el servidor.
- Anuncios: token de un solo uso emitido por el servidor, tiempo mínimo, límites diarios y espera; completar "demasiado rápido" se rechaza y se marca.
- Puntos de recompensa: topes por usuario y presupuesto global; cuentas retenidas no acumulan; canje con revisión manual y tres candados (ver ECONOMY.md).
- Compras de gemas: sólo con verificación del proveedor en servidor y `UNIQUE(provider, provider_ref)` (un recibo no puede usarse dos veces).

## 6. Antifraude y anti-trampas

| Amenaza | Medida |
|---|---|
| Speed hack / teletransporte | Presupuesto de distancia por tiempo (token bucket de metros), cambio de región sólo por teletransporte del servidor, corrección de posición, señal `speed_hack`/`region_hack` |
| Interactuar a distancia / cliente modificado | El servidor usa SU posición del jugador y la región; interacciones lejanas se rechazan y se registran |
| Saltarse etapas | Condiciones del motor evaluadas en servidor; las respuestas de acertijos nunca se envían al cliente |
| Fuerza bruta de acertijos | Límite por minuto + señal `puzzle_bruteforce` |
| Bots / farming | Límites de tasa, topes de recompensa, recompensas de un solo uso, flood detection |
| Multicuentas | Hash HMAC del identificador de dispositivo (`SERVER_SECRET`), cuentas por dispositivo, registros por IP; señal `multi_account_device` |
| Abuso cooperativo con cuentas propias | Sin replicación cooperativa entre cuentas del mismo dispositivo (`coop_same_device`) |
| Fraude de anuncios | Token único, tiempo mínimo, topes, espera; con AdMob se usará SSV firmado por Google |
| Abuso de referidos | Nada por registrarse; requiere completar el misterio de calificación + tiempo de juego; rechazo por mismo dispositivo; IP compartida → sin RP; tope mensual |
| Manipulación de transacciones | Idempotencia, transacciones atómicas, validación de propiedad, auditoría |
| Duplicación de objetos | Instancias únicas + escrow + transacciones |

Cada señal suma gravedad al `fraud_score`. Al superar `antifraud.holdThreshold` se activa `rewards_hold` automáticamente (auditado): la cuenta sigue jugando, pero no acumula ni canjea recompensas de valor real hasta la revisión.

> El identificador de dispositivo lo genera el cliente y puede falsificarse: se usa como **señal**, no como prueba. Para producción conviene sumar Play Integrity API (Android), App Attest (iOS) y un CAPTCHA en registro.

## 7. Cabeceras y transporte

- `Content-Security-Policy` estricta en el cliente compilado (`script-src 'self'`, sin `unsafe-eval`, `frame-ancestors 'none'`, `object-src 'none'`).
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cache-Control: no-store` en la API.
- **Telegram y anuncios**: si hay `TELEGRAM_BOT_TOKEN`, `frame-ancestors` permite sólo los dominios de Telegram (y se omite `X-Frame-Options`). Si hay una red de anuncios real habilitada, la CSP se relaja a `https:` para scripts/frames de esa red (necesario para sus SDK). En modo sólo-sandbox la CSP sigue siendo estricta.
- **Producción**: servir detrás de HTTPS/WSS (Caddy, Nginx o el balanceador del proveedor) con HSTS y `TRUST_PROXY=true`.

## 8. Secretos

- El cliente **no contiene secretos**. Todo secreto vive en variables de entorno del servidor (ver `.env.example`).
- `.env`, la base de datos y el secreto de desarrollo (`data/.dev-server-secret`, permisos 600) están en `.gitignore`.
- En producción `SERVER_SECRET` es obligatorio (el servidor no arranca sin él).
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` y `ADS_CALLBACK_SECRET` sólo viven en el servidor.
- Integraciones futuras (Google Play, App Store, Stripe, AdMob SSV, correo) deben configurarse sólo en el servidor.

## 8.1 Telegram, Stars y anuncios

- **initData**: el login de Telegram verifica la firma HMAC-SHA256 (clave derivada de `WebAppData` + token del bot) y la antigüedad (`TELEGRAM_INITDATA_MAX_AGE_SEC`). Nunca se confía en `initDataUnsafe`.
- **Webhook**: si `TELEGRAM_UPDATES=webhook`, se exige el header `x-telegram-bot-api-secret-token`.
- **Stars**: el cliente nunca otorga compras. Sólo `successful_payment` recibido del bot (con `telegram_payment_charge_id`) entrega la oferta; `pre_checkout_query` revalida precio, usuario y oferta. La entrega es idempotente (`purchases UNIQUE(provider, provider_ref)` + clave del libro mayor). Reembolsos vía `refundStarPayment` revierten lo entregado.
- **Anuncios**: el servidor elige la red y emite un token de un solo uso. Las redes con callback servidor-a-servidor (URL firmada por red con HMAC de `ADS_CALLBACK_SECRET`) son las únicas que pueden pagar puntos de recompensa; las no verificables sólo pagan monedas y exigen tiempo mínimo. Repetir la confirmación no paga dos veces.

## 9. Moderación y seguridad de jugadores

- Bloquear usuarios: no se reciben sus mensajes (mundo y grupo), invitaciones, amistad ni intercambios.
- Reportar: motivo tipificado + detalles; se adjuntan automáticamente los últimos mensajes del reportado como evidencia.
- Moderadores pueden suspender, desconectar y resolver reportes; administradores pueden bloquear.
- Retención de chat para moderación: definir política (p. ej. 30 días) y tarea de purga antes de producción.

## 10. Privacidad y cumplimiento (pendiente antes de lanzar)

- Aviso de privacidad y términos definitivos (el MVP sólo tiene casillas de aceptación de borrador).
- Edad mínima / protección de menores (COPPA, leyes locales), especialmente por anuncios y compras.
- Exportación y borrado de datos del usuario (derechos ARCO/GDPR).
- Programa de recompensas de valor real: revisar legislación sobre sorteos/premios, impuestos, KYC/AML y términos del programa **antes** de activarlo.

## 11. Riesgos conocidos del MVP

- Colisiones del mundo sólo se validan en el cliente (el servidor valida velocidad, región y límites). Un cliente modificado podría atravesar paredes, pero **no** avanzar misiones fuera de orden ni obtener recompensas (las condiciones y distancias se validan en servidor).
- Limitadores y grupos en memoria: se pierden al reiniciar y no escalan a varios nodos (ver ROADMAP).
- Impresiones de patrocinio provienen del cliente (métrica de baja confianza).
- Sin WAF/antibot externo ni CAPTCHA.
