# NOVA KIDS — Tienda online

> **Moda infantil que impulsa su imaginación.** · SUEÑA · JUEGA · VISTE

Tienda online completa para NOVA KIDS: catálogo, ficha de producto, carrito, checkout, favoritos, búsqueda, panel administrativo, inventario por variante y pedidos. Construida con **Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS 4 + Lucide**.

---

## 1. Ejecutar en tu computadora

Requisitos: **Node.js 20 o superior**.

```bash
cd nova-kids
npm install
cp .env.example .env.local      # luego edita ADMIN_PASSWORD y ADMIN_SESSION_SECRET
npm run dev                     # http://localhost:3000
```

- Tienda: <http://localhost:3000>
- Panel: <http://localhost:3000/admin> (entra con tu `ADMIN_PASSWORD`)

Producción:

```bash
npm run build
npm start
```

Otros comandos: `npm run lint`, `npm run typecheck`, `npm run demo:images` (regenera las ilustraciones demo).

---

## 2. Datos: modo local o Supabase

La app usa una sola interfaz de datos (`src/lib/data/repository.ts`) con dos implementaciones:

| `DATA_PROVIDER` | Dónde guarda | Cuándo usarlo |
|---|---|---|
| `local` (por defecto) | `.data/store.json` y fotos en `.data/uploads/` | Desarrollo, o un servidor/VPS con disco persistente |
| `supabase` | Base de datos Postgres + Storage de Supabase | Producción en Vercel u otra plataforma serverless |

### Activar Supabase

1. Crea un proyecto en Supabase.
2. En **SQL Editor** ejecuta `supabase/migrations/0001_nova_kids_schema.sql` (crea tablas, seguridad RLS, funciones atómicas de pedido/inventario, el bucket `product-images` y las 8 categorías iniciales).
3. En `.env.local` (o en las variables de tu hosting):
   ```
   DATA_PROVIDER=supabase
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...      # solo servidor
   ```
4. Sube tus productos desde `/admin`.

> Con las claves anon de Supabase también se activa el inicio de sesión / registro de clientes en `/cuenta` (Supabase Auth).

---

## 3. Productos de demostración (cómo quitarlos)

Los 12 productos demo y sus ilustraciones están **separados de la estructura real**:

- Datos: `src/demo/demo-products.ts`
- Imágenes: `public/demo/` (generadas por `scripts/generate-demo-images.mjs`)

Solo se cargan en modo local cuando `.data/store.json` aún no existe y `SEED_DEMO_DATA` no es `false`. Para empezar con tu catálogo real:

1. Pon `SEED_DEMO_DATA=false` en `.env.local`.
2. Borra `.data/store.json` (o elimina los demo desde `/admin/productos`).
3. Opcional: borra `src/demo/`, `public/demo/` y `scripts/generate-demo-images.mjs`, y quita la importación en `src/lib/data/local.ts` (función `seed`).

Las imágenes de `public/categories/` son ilustraciones provisionales; cámbialas por fotos desde **/admin/categorias**.

---

## 4. Pagos

Arquitectura en `src/lib/payments/`. Cada método **solo aparece en el checkout si tiene sus variables de entorno**. No se incluye ninguna clave.

| Método | Variables | Confirmación de pago |
|---|---|---|
| Mercado Pago (Checkout Pro) | `MERCADOPAGO_ACCESS_TOKEN` | Webhook `/api/webhooks/mercadopago` (consulta el pago a la API de MP antes de marcarlo como pagado) |
| Stripe Checkout | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Webhook `/api/webhooks/stripe` (evento `checkout.session.completed`, firma verificada) |
| PayPal | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV` | Captura al regresar en `/api/payments/paypal/return` |
| Transferencia | `BANK_TRANSFER_CLABE` (+ banco y titular) | Manual: cambia el pedido a **Pagado** en el panel |

La transferencia siempre está disponible; si no hay CLABE configurada, el cliente ve que se le enviarán los datos de pago.

**Importante:** las integraciones con Mercado Pago, Stripe y PayPal están escritas contra sus APIs REST oficiales pero **no se han probado con cuentas reales** (no había credenciales). Pruébalas primero con claves sandbox/test y `NEXT_PUBLIC_SITE_URL` apuntando a una URL https pública (los webhooks no llegan a `localhost`).

Flujo de un pedido: el servidor recalcula precios, valida inventario y cupón → crea el pedido como **Pendiente** apartando inventario → redirige a la pasarela → el webhook lo marca **Pagado**. Si un pedido se **cancela**, las piezas regresan al inventario.

---

## 5. Configuración de la tienda

| Qué | Archivo |
|---|---|
| Nombre, frase, contacto, WhatsApp, redes sociales, orden de tallas | `src/config/store.ts` |
| Métodos y costos de envío, envío gratis | `src/config/store.ts` → `shippingMethods` |
| Cupones de descuento (solo servidor) | `src/config/coupons.ts` |
| Textos de envíos, devoluciones, privacidad, términos | `src/content/pages.ts` (revísalos con tu asesor legal) |
| Colores, tipografías, botones, animaciones (design system) | `src/app/globals.css` |
| Logotipo | `public/brand/` |

---

## 6. Qué incluye

**Tienda**
- Inicio con hero espacial, beneficios, categorías, novedades, ofertas y más vendidos.
- Catálogo con filtros (categoría, niño/niña, talla, precio, color, disponibilidad, novedades, ofertas) y orden (recientes, precio, más vendidos). Los filtros viven en la URL (se pueden compartir).
- Páginas de categoría `/categoria/[slug]`, `/novedades`, `/ofertas`.
- Ficha `/producto/[slug]` (alias SEO `/catalogo/[slug]`): galería deslizable, selector de color/talla/cantidad, disponibilidad por variante, “Agregar al carrito”, “Comprar ahora”, relacionados.
- Tarjetas con segunda foto al pasar el cursor, etiquetas NUEVO / OFERTA, favorito y selector rápido de talla.
- Carrito lateral persistente (localStorage) con cambio de talla/color, cantidades, ahorro, envío y total; pantalla completa en móvil; animación del producto volando al carrito.
- Checkout en 4 pasos (datos, dirección, envío, pago) con cupón y resumen; el servidor revalida todo.
- Página de pedido con estado y datos de transferencia; consulta de pedido por número + correo en `/cuenta`.
- Buscador global instantáneo (entiende “niña”, “playera”, “talla 8”…).
- Favoritos (en el dispositivo; listos para asociarse a una cuenta).
- Nosotros, contacto, FAQ, envíos, devoluciones, privacidad, términos, 404.
- SEO: metadatos por página, Open Graph, JSON-LD de producto, `sitemap.xml`, `robots.txt`, URLs amigables, campos SEO por producto.

**Panel `/admin`** (protegido con contraseña y sesión firmada)
- Resumen: ventas, pedidos por atender, inventario bajo.
- Productos: crear, editar, eliminar, activar/desactivar, varias fotos (arrastrar y soltar, elegir principal, reordenar, texto alternativo), precio, descuento rápido %, tallas, colores, inventario por talla × color, SKU, SEO.
- Categorías: crear, editar, ocultar, imagen, orden; tipos “prenda”, “género”, “novedades” y “ofertas”.
- Pedidos: lista con filtros por estado y búsqueda, detalle con cliente, dirección, productos, total, historial y cambio de estado (Pendiente, Pagado, Preparando, Enviado, Entregado, Cancelado).

Las fotos subidas se optimizan automáticamente (WebP, máx. 1600 px) y se sirven en AVIF/WebP responsivo con lazy loading.

---

## 7. Estructura

```
nova-kids/
├─ public/brand/            logotipo oficial, favicon, imagen social
├─ public/demo/             ilustraciones demo (borrables)
├─ public/categories/       imágenes provisionales de categorías
├─ scripts/                 generador de imágenes demo
├─ supabase/migrations/     esquema SQL para Supabase
└─ src/
   ├─ app/(shop)/           páginas públicas
   ├─ app/admin/            panel administrativo
   ├─ app/api/              API (pedidos, catálogo, admin, webhooks)
   ├─ components/           UI (layout, producto, catálogo, checkout, admin)
   ├─ config/               configuración de la tienda y cupones
   ├─ content/              textos de páginas informativas
   ├─ demo/                 productos de demostración (borrables)
   └─ lib/                  dominio, datos, pagos, almacenamiento, validación
```

---

## 8. Siguientes pasos sugeridos

- Probar pagos con credenciales sandbox y configurar los webhooks.
- Asociar pedidos y favoritos a cuentas de cliente (la columna `orders.user_id` ya existe en el esquema).
- Correos transaccionales (confirmación de pedido / envío) con Resend, Postmark o similar.
- Sustituir las ilustraciones demo por fotografías reales.
