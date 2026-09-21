# GPS Flotilla — rastreo de autos en tiempo real con mensualidad

Proyecto independiente dentro de este repo (no toca el directorio de negocios
`project-bolt-sb1-qr49orc3/`). Es una app para dar seguimiento en vivo a una
flotilla de vehículos y cobrar una mensualidad por el servicio.

## 1. Cómo funciona, de punta a punta

```
┌─────────────────┐        ┌──────────────────┐
│ Celular chofer   │        │ Tracker GPS/GSM   │
│ (navegador, PWA) │        │ físico (GT06)     │
└────────┬─────────┘        └────────┬──────────┘
         │ HTTPS JSON                │ TCP binario (protocolo GT06)
         │                           ▼
         │                  ┌──────────────────┐
         │                  │  device-gateway   │  (Node, este repo)
         │                  │  decodifica GT06  │
         │                  └────────┬──────────┘
         │                           │ HTTPS JSON (mismo formato)
         ▼                           ▼
       ┌─────────────────────────────────┐
       │   Edge Function: ingest-position │  (Supabase)
       │  1. valida device_token          │
       │  2. valida suscripción vigente   │
       │  3. inserta en tabla `positions` │
       └────────────────┬─────────────────┘
                         │ trigger SQL
                         ▼
              tabla `vehicles.last_lat/lng...`
                         │
                         │ Supabase Realtime (WebSocket)
                         ▼
              ┌─────────────────────┐
              │   Dashboard web      │  (React + Leaflet)
              │   mapa en vivo        │
              └─────────────────────┘
```

**Idea central:** no importa si la ubicación viene de un celular o de un
GPS de hardware — ambos terminan llamando al mismo endpoint
(`ingest-position`) con el mismo formato JSON. Todo lo demás (guardar en
base de datos, actualizar el mapa en vivo, cobrar la mensualidad) es una
sola lógica que no se repite por tipo de dispositivo.

## 2. Las dos formas de obtener la ubicación

### a) El celular del conductor (`web/src/pages/DriverPage.tsx`)

Es una página web (funciona como PWA) que usa `navigator.geolocation.watchPosition`
del navegador. El conductor:
1. Abre `/driver` en su celular.
2. Pega el **token del dispositivo** que el dueño generó desde `/vehicles`.
3. Presiona "Empezar a compartir ubicación".

El navegador va mandando la posición cada ~10 segundos directo a la Edge
Function. No necesita instalar nada de una tienda de apps — con "Agregar a
pantalla de inicio" queda como un ícono más.

**Limitación real que debes saber:** los navegadores móviles *limitan* el
GPS en segundo plano (para ahorrar batería). Esto funciona bien mientras la
pantalla está encendida y la pestaña activa. Para rastreo confiable con la
pantalla apagada o la app minimizada, se necesitaría una app nativa (React
Native / Expo con un servicio en segundo plano) — es un paso natural
siguiente, pero es un proyecto aparte de mayor alcance que esta PWA.

### b) Un tracker GPS/GSM físico (`device-gateway/`)

Estos son los aparatitos que se conectan a la batería del auto (o traen
batería propia), tienen un chip SIM, y hablan un protocolo binario por TCP
llamado **GT06** (el que usan la mayoría de trackers chinos baratos, marcas
como GT06N, TK103, etc.). El flujo real:

1. Compras un tracker GPS/GSM (barato, ~$150-400 MXN en línea).
2. Le pones un chip SIM con datos.
3. Lo configuras (por SMS, según el manual del fabricante) con la IP/puerto
   donde corre tu `device-gateway`.
4. El tracker se conecta solo, manda su IMEI, y a partir de ahí empieza a
   reportar ubicación aunque el auto esté apagado (usa su batería interna).

`device-gateway/src/gt06.ts` decodifica esos paquetes binarios (login,
heartbeat, ubicación) y `device-gateway/src/server.ts` los reenvía como
JSON a la misma Edge Function que usa el celular.

Es una implementación **educativa y simplificada** del protocolo — cubre lo
esencial para tener rastreo funcionando, no todas las variantes de todos
los fabricantes. Para producción seria con muchos modelos de hardware,
vale la pena mirar [Traccar](https://www.traccar.org/) (open source, ~200
protocolos soportados).

## 3. Autenticación: por qué "device token" y no la cuenta del dueño

El dueño de la flotilla inicia sesión normal con Supabase Auth (email +
password). Pero el **dispositivo** (celular o hardware) nunca ve esa
sesión — tiene su propio token, generado una vez con la función
`create_device(vehicle_id, type, external_id)`:

- Se genera un token aleatorio de 24 bytes.
- Solo se guarda su **hash SHA-256** en la tabla `devices`.
- El token en texto plano se muestra **una sola vez** en el dashboard (igual
  que una API key de cualquier servicio serio).

¿Por qué no simplemente usar la sesión del dueño? Porque el celular del
conductor o el hardware en el auto son puntos de falla distintos a la
cuenta del dueño: si se pierde el celular o roban el auto con el tracker
adentro, quieres poder revocar *ese* acceso sin tocar la cuenta ni los
demás vehículos.

## 4. Cómo se cobra la mensualidad (hoy simulado, listo para Stripe)

Cada dueño tiene una fila en `subscriptions` con un estado:

| Estado      | Significado                                              |
|-------------|-----------------------------------------------------------|
| `trialing`  | Periodo de prueba (7 días al registrarse)                 |
| `active`    | Al corriente, el rastreo funciona                         |
| `past_due`  | Se venció el periodo, hay 3 días de gracia                |
| `expired`   | Venció el periodo de gracia — **se bloquea el rastreo**   |
| `canceled`  | El dueño canceló                                           |

**El bloqueo real ocurre en `ingest-position`**: antes de insertar una
posición nueva, la función revisa el estado y la fecha de vencimiento de la
suscripción del dueño del vehículo. Si no está `active`/`trialing` y
vigente, responde `402 Payment Required` y no guarda nada. Así "se les
cobra mensualidad" no es solo un número en una pantalla: si no pagan, el
GPS deja de funcionar.

Un cron diario (`billing-cycle`, programado con `pg_cron` + `pg_net`, ver
`supabase/migrations/0002_billing_rpc_and_cron.sql`) revisa todas las
suscripciones y las mueve de `active` → `past_due` → `expired` según las
fechas.

Hoy, "pagar" es simular: el botón en `/billing` llama la función SQL
`record_payment(subscription_id, amount_cents, method, note)`, que:
1. Inserta una fila en `payments` (la bitácora de cobros).
2. Extiende `current_period_end` un mes y regresa el estado a `active`.

**Para conectar Stripe real más adelante**, el cambio es quirúrgico:
- Crear un producto/precio en Stripe por cada plan.
- Al registrarse (o desde `/billing`), crear una Stripe Checkout Session.
- Un webhook de Stripe (`invoice.paid`) llama `record_payment(...)` con los
  mismos parámetros que hoy llama el botón — la lógica de negocio (extender
  el periodo, reactivar) no cambia nada.
- El botón de "simular pago" se retira o se deja solo en desarrollo.

## 5. Estructura del proyecto

```
gps-tracker/
├── supabase/
│   ├── migrations/           # esquema SQL completo (tablas, RLS, triggers, cron)
│   └── functions/
│       ├── ingest-position/  # punto de entrada de TODA ubicación GPS
│       └── billing-cycle/    # job diario que vence suscripciones
├── device-gateway/           # servidor TCP, protocolo GT06 -> ingest-position
│   └── device-map.example.json
└── web/                      # dashboard (React + Vite + Tailwind + Leaflet)
    └── src/
        ├── pages/
        │   ├── AuthPage.tsx      # login/registro del dueño
        │   ├── DashboardPage.tsx # mapa en vivo
        │   ├── VehiclesPage.tsx  # CRUD vehículos + generar tokens
        │   ├── BillingPage.tsx   # estado de suscripción + pagos
        │   └── DriverPage.tsx    # celular del conductor como tracker
        └── lib/
            ├── useVehicles.ts     # Realtime (WebSocket) de posiciones
            └── useSubscription.ts
```

## 6. Cómo desplegarlo

### Requisitos
- Cuenta de [Supabase](https://supabase.com) (plan gratuito alcanza para probar).
- Node.js 20+ si vas a correr el `device-gateway` (solo hace falta si usas
  hardware GPS físico; si solo usas el celular como tracker, no lo necesitas).

### Base de datos + backend (Supabase)
```bash
cd gps-tracker
npx supabase login
npx supabase link --project-ref <tu-project-ref>
npx supabase db push                         # aplica las migraciones
npx supabase functions deploy ingest-position
npx supabase functions deploy billing-cycle
```
Luego, en el SQL Editor del dashboard de Supabase, edita el `cron.schedule(...)`
de `0002_billing_rpc_and_cron.sql` con tu `project-ref` real y tu
`service_role key` (Project Settings → API), y ejecútalo una vez (las
migraciones normales no deberían llevar secretos, por eso este paso es
manual).

### Dashboard web
```bash
cd gps-tracker/web
cp .env.example .env      # llena VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm install
npm run dev                # http://localhost:5173
```
Para producción: `npm run build` genera `dist/`, desplegable en cualquier
hosting estático (Cloudflare Pages, Vercel, Netlify...).

### Gateway para hardware GPS (opcional, solo si compras trackers físicos)
```bash
cd gps-tracker/device-gateway
cp device-map.example.json device-map.json   # llena IMEI -> token
npm install
GATEWAY_PORT=5023 \
INGEST_URL=https://<tu-project-ref>.supabase.co/functions/v1/ingest-position \
npm run dev
```
Necesitas exponer el puerto `5023` (o el que uses) a internet — el tracker
físico se conecta por TCP directo, no por HTTPS. En producción normalmente
se despliega en un VPS pequeño (DigitalOcean, un droplet de $5 USD/mes
alcanza) con ese puerto abierto.

## 7. Siguientes pasos naturales (no incluidos todavía)

- **Stripe real** para cobrar de verdad (sección 4 explica el cambio exacto).
- **App nativa para el conductor** (React Native/Expo) si necesitas rastreo
  confiable con la pantalla apagada.
- **Geocercas y alertas** (avisar si un vehículo sale de una zona).
- **Reportes de recorrido** usando el historial completo en `positions`
  (hoy solo se usa el "último punto" para el mapa en vivo).
- **Roles**: hoy cualquier dueño ve solo lo suyo; falta un rol tipo
  "operador" que vea varias flotillas sin ser el dueño de la cuenta.
