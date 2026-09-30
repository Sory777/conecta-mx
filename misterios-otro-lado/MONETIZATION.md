# MONETIZACIÓN — Misterios: El Otro Lado

Guía para ganar dinero con el juego (web + **Telegram Mini App**) y medir **qué te paga más**.

> Las cifras de ingresos por anuncio cambian mucho según país, temporada y red. Aquí no se prometen importes:
> el juego **mide** tus datos reales y el panel **Admin → 💰 Monetización** te dice qué red y formato rinde más.

## 1. Fuentes de ingreso integradas

| Fuente | Dónde | Estado |
|---|---|---|
| **Anuncios recompensados** (el jugador elige verlos a cambio de monedas/puntos) | Tienda → «Gratis (anuncios)» | ✅ Mediación entre Adsgram, Monetag, AdSense H5 y sandbox |
| **Anuncios intersticiales** en pausas naturales (al terminar un misterio) | Automático u opcional (configurable) | ✅ Nunca en mitad de la acción; VIP no los ve |
| **Telegram Stars** (pagos oficiales de Telegram para bienes digitales) | Tienda → «Ofertas» dentro de Telegram | ✅ Factura, validación y entrega en servidor |
| **Paquete de inicio** (oferta única) | Ofertas | ✅ |
| **VIP 30 días** (sin intersticiales, +10% monedas, cofre diario de gemas) | Ofertas | ✅ |
| **Gemas** (moneda premium) | Ofertas | ✅ |
| **Propinas / mecenazgo** («Apoya al creador») | Ofertas | ✅ con insignia de agradecimiento |
| **Pase de temporada premium** (se paga con gemas) | Temporada | ✅ |
| **Cosméticos y objetos** (monedas o gemas) | Tienda | ✅ |
| **Patrocinios**: cartel de la plaza, fachada de la tienda, **pantalla de carga**, **banner del diario** con enlace | Admin → Patrocinios | ✅ con impresiones y clics únicos por día |
| **Comisión del mercado** entre jugadores (sólo monedas del juego) | Admin → Economía | ✅ desactivado por defecto |
| **Referidos** (crecimiento: más jugadores = más ingresos) | Grupo → «Invitar amigos» | ✅ enlace directo a la Mini App |
| Compras web con tarjeta (Stripe), Google Play, App Store | — | ⏳ pendiente (ver README) |

## 2. ¿Qué tipo de anuncio suele pagar más?

Orden habitual (de más a menos por impresión):

1. **Vídeo recompensado**: el jugador lo ve completo y por voluntad propia. Es el formato que mejor paga y el que menos molesta.
2. **Intersticial** (pantalla completa en una pausa): paga menos por impresión, pero se muestra sin que el jugador lo pida. Con demasiada frecuencia hace que la gente deje de jugar.
3. **Banners**: pagan muy poco en juegos móviles y estropean la inmersión. **No están incluidos a propósito.**

Otros factores que pesan tanto como el formato:

- **País del jugador**: EE. UU., Canadá, Europa occidental y Australia pagan varias veces más que Latinoamérica o el sudeste asiático.
- **Tasa de relleno**: una red con eCPM alto pero que casi nunca tiene anuncio disponible puede ganar menos que otra más modesta.
- **Tasa de finalización**: sólo cuenta el anuncio visto completo.

Por eso el panel ordena por **ingreso por cada 1,000 solicitudes**, que combina las tres cosas.

### Redes integradas

| Red | Dónde funciona | Formatos | Verificación de la recompensa |
|---|---|---|---|
| **Adsgram** (adsgram.ai) | Telegram Mini Apps | Recompensado, intersticial | ✅ Servidor a servidor («Reward URL»). Puede dar puntos de recompensa |
| **Monetag** (monetag.com) | Telegram Mini Apps y web | «Rewarded Interstitial» (para ambos formatos) | ✅ Si configuras el postback; sin postback, sólo monedas |
| **Google AdSense H5 Games** | Web (fuera de Telegram) | Recompensado, intersticial | ❌ Sólo en el cliente → paga **sólo monedas** |
| **Sandbox** | Pruebas | Ambos | Simulado y rotulado |

**Regla de seguridad:** si una red no confirma la vista a nuestro servidor, la recompensa es sólo en monedas y nunca en puntos de recompensa. Así un bot no puede generar valor real con anuncios falsos. Se controla con `ads.unverifiedCoinsOnly`.

## 3. Cómo averiguar qué te paga más (paso a paso)

1. Activa **dos o más redes** en **Admin → 💰 Monetización → Redes de anuncios**.
2. Deja la mediación en `best_ecpm` con un **10% de exploración** (valor por defecto). El servidor manda la mayoría del tráfico a la red que mejor paga y sigue probando las demás.
3. Cada día (o semana), copia de cada red las **impresiones e ingresos por formato**. Pégalos en «Registrar ingresos reportados», uno a uno o por CSV:
   ```
   day,networkId,format,impressions,revenueUsd
   2026-10-01,adsgram,rewarded,1200,3.10
   2026-10-01,monetag,rewarded,900,1.85
   ```
4. Revisa la tabla **«¿Qué anuncios pagan más?»**:
   - **Relleno %**: con qué frecuencia la red tenía un anuncio.
   - **Completados %**: cuántos anuncios se vieron hasta el final.
   - **eCPM real**: ingreso por cada 1,000 impresiones.
   - **Por 1000 solicitudes**: la métrica final para comparar redes.
5. Con al menos **200 impresiones reportadas** de una red y formato, la mediación usa su eCPM real en lugar de tu estimación. Automáticamente envía más tráfico a la que más paga.
6. Ajusta los anuncios en **Admin → Publicidad**: recompensa, tope diario y espera. La salud de la economía la vigilas en **Admin → Resumen**.

## 4. Publicar el juego en Telegram

### 4.1 Requisito: una URL HTTPS pública

Telegram sólo abre Mini Apps por HTTPS. Tienes tres opciones:

- **VPS** (Hetzner, DigitalOcean, Contabo…) con Caddy o Nginx y un dominio.
- **Cloudflare Tunnel**. Funciona incluso desde **Termux**:
  ```bash
  pkg install cloudflared
  cloudflared tunnel --url http://localhost:8787
  ```
  Te da una URL `https://…trycloudflare.com`. Es temporal y sirve para pruebas; para producción crea un túnel con nombre y dominio propio.
- Cualquier hosting de Node.js con WebSockets.

### 4.2 Crear el bot y la Mini App (en Telegram, con @BotFather)

1. `/newbot` → elige nombre y usuario. Guarda el **token**: es SECRETO y sólo va en el `.env` del servidor.
2. `/newapp` → elige tu bot, pon título, descripción, imagen y la **URL HTTPS** del juego. Elige un **nombre corto** (p. ej. `juego`). Tu enlace directo será `https://t.me/<tu_bot>/juego`.
3. (Opcional) `/setuserpic`, `/setdescription` y `/setabouttext` para presentar el bot.
4. Pagos con Stars: **no** necesitas proveedor de pagos ni `provider_token`. Telegram gestiona los Stars. Revisa en BotFather/Fragment cómo retirar tus ganancias.

### 4.3 Configurar el servidor (`.env`)

```bash
TELEGRAM_BOT_TOKEN=123456:ABC...           # de BotFather (secreto)
TELEGRAM_BOT_USERNAME=mi_bot_de_misterios  # sin @
TELEGRAM_APP_SHORT_NAME=juego              # el nombre corto de /newapp
TELEGRAM_WEBAPP_URL=https://tu-dominio.com # la URL HTTPS del juego
PUBLIC_BASE_URL=https://tu-dominio.com
TELEGRAM_UPDATES=polling                   # polling (sencillo) o webhook (producción)
TELEGRAM_WEBHOOK_SECRET=una_cadena_larga_aleatoria   # sólo si usas webhook
TELEGRAM_STARS_ENABLED=true                # activa los cobros reales con Stars
ADS_CALLBACK_SECRET=otra_cadena_larga_aleatoria      # firma de las URLs de recompensa de anuncios
TRUST_PROXY=true                           # si hay proxy/túnel delante
```

Al arrancar, el servidor pone el botón de menú «Jugar» en el bot y atiende `/start`.
- Con `polling` no necesitas abrir puertos.
- Con `webhook`, Telegram envía las actualizaciones firmadas a `https://tu-dominio.com/api/telegram/webhook`.

### 4.4 Qué ve el jugador

- Abre el bot → «🔦 Jugar ahora» o el botón de menú → el juego se abre a pantalla completa.
- **Acceso automático** con su cuenta de Telegram. El servidor verifica la firma del `initData`; no hace falta correo ni contraseña.
- Sugiere su nombre de Telegram al crear el personaje. El botón «Atrás» de Telegram cierra los paneles y hay vibración al encontrar pistas.
- En «Ofertas» paga con **⭐ Stars** dentro de Telegram. La entrega ocurre cuando Telegram confirma el pago al servidor. Es idempotente: no se entrega dos veces aunque Telegram reintente.
- «Invitar amigos» comparte `https://t.me/<bot>/<app>?startapp=CÓDIGO`. El referido se registra solo.

## 5. Configurar cada red de anuncios

> Las pantallas y nombres de campos de cada red cambian con el tiempo. Si algo no coincide, sigue la documentación actual de la red; en el juego sólo cambias IDs y URLs en el panel.

### Adsgram (Telegram)
1. Regístrate en el panel de socios de Adsgram y añade tu Mini App (el enlace `t.me/<bot>/<app>`).
2. Crea un bloque **Rewarded** y, si quieres, uno **Interstitial**. Copia sus **blockId**.
3. En **Admin → Monetización → Adsgram**, pega la configuración y márcala «Activa» y «Verificación en servidor»:
   ```json
   { "rewardedBlockId": "1234", "interstitialBlockId": "int-1234" }
   ```
4. Copia la **URL de recompensa** que muestra el panel (incluye `[userId]`). Pégala como «Reward URL» del bloque en Adsgram. Adsgram la llamará al terminar cada anuncio.

### Monetag (Telegram y web)
1. Crea una cuenta de publisher y una zona para **Telegram Mini App** (o sitio web). Copia el **zoneId**.
2. En el panel: `{ "zoneId": "1234567" }`.
3. (Recomendado) Configura el **postback** de Monetag con la URL de recompensa del panel. Lleva `token={ymid}`: el juego manda su token de vista como `ymid`. Después marca «Verificación en servidor».

### Google AdSense H5 Games (versión web)
1. Necesitas una cuenta de AdSense **aprobada para juegos H5** (solicitud aparte en AdSense).
2. En el panel: `{ "client": "ca-pub-XXXXXXXXXXXXXXXX" }`, entorno `web`.
3. AdSense no confirma vistas al servidor: sus recompensas son sólo monedas.
4. En modo sandbox se usa `data-adbreak-test="on"`: anuncios de prueba, sin ingresos.

## 6. Patrocinios (vender espacios a negocios)

- **Espacios**: cartel de la plaza (3D), fachada de la tienda (3D), **pantalla de carga** y **banner en el diario** (con enlace).
- Crea campañas en **Admin → Patrocinios** con fechas, colores, texto, enlace `https` y `contractValueCents` (lo que cobras).
- El panel da **impresiones únicas por día**, **clics** y **CTR**: el informe para cobrar o renovar.
- Precio sugerido: por semana o mes, o por cada 1,000 impresiones únicas (CPM) según tu audiencia.
- Todo lo patrocinado se rotula «Patrocinado».

## 7. Reglas y cumplimiento

- **Telegram**: los bienes digitales vendidos dentro de bots y Mini Apps deben cobrarse con **Telegram Stars**. Revisa los términos vigentes para desarrolladores (Terms of Service for Bot Developers).
- **Anuncios**: sin anuncios forzados en mitad de la acción, sin recompensas por hacer clic en anuncios y sin incentivar clics. Respeta las políticas de cada red (prohíben el tráfico incentivado fuera de los formatos recompensados).
- **Menores**: si tu audiencia puede incluir menores, revisa la configuración de anuncios personalizados y la ley local.
- **Impuestos**: los ingresos por anuncios, Stars y patrocinios son ingresos gravables. Consulta a un contador.
- **Reembolsos**: **Admin → Monetización** permite reembolsar Stars. Se retiran las gemas no gastadas y los días VIP.
- **Puntos de recompensa con valor real**: siguen desactivados y con tres candados (ver ECONOMY.md). No los actives sin asesoría legal.

## 8. Parámetros relevantes (Admin → Parámetros económicos)

| Parámetro | Por defecto | Efecto |
|---|---|---|
| `ads.strategy` | `best_ecpm` | Mediación por mejor eCPM real (o `weighted` por pesos) |
| `ads.explorePct` | 10 | % de tráfico que prueba otras redes |
| `ads.interstitialAfterMission` | `optional` | `off` / `optional` (botón) / `auto` (al pulsar «Continuar») |
| `ads.unverifiedCoinsOnly` | true | Redes sin verificación en servidor no dan puntos de recompensa |
| `vip.coinBonusPct` / `vip.dailyGems` / `vip.noInterstitials` | 10 / 10 / true | Beneficios VIP |
| `telegram.starUsdCents` | 1.3 | Valor neto estimado de 1 Star para los informes (**verifica la tasa vigente** al retirar) |
