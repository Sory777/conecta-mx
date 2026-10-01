# 10 tiendas de dropshipping con un solo sistema

Un servidor Node.js sirve **10 tiendas online** con la misma estructura y funcionalidad,
pero con identidad visual propia, y un **panel central** para administrarlas todas.

| Tienda | Estilo | Tipografía | Logotipo |
|---|---|---|---|
| Voltia | tech oscuro, cuadrícula neón | Space Grotesk / Inter | rayo |
| Lumé Boutique | moda elegante, botones contorno | Playfair Display / Lato | círculo con inicial |
| Kiro Market | minimalista japonés, sin redondeo | Zen Kaku Gothic New | cuadrado |
| Brisa Store | fresco, formas orgánicas, botones píldora | Nunito | ola |
| Zócalo Shop | mercado mexicano, puntos | Rubik / Work Sans | hexágono |
| Nébula | galáctico oscuro, MAYÚSCULAS | Orbitron / Exo 2 | estrella |
| Raíz & Co. | natural, tierra | Fraunces / DM Sans | hoja |
| Pixel Pop | neo-brutalista, sombras duras | Fredoka / Poppins | triángulo |
| Mar Azul | costero, rayas | Montserrat / Source Sans 3 | anillo |
| Ámbar Urbano | streetwear oscuro | Bebas Neue / Barlow | diamante |

Cada marca se define en `src/config/stores.js` (nombre, paleta, fuentes, estilo de cabecera,
banner, tarjetas, botones, isotipo, margen). Para cambiar una marca o crear otra, edita ese archivo.

## Cómo funciona el dinero

```
Cliente paga $299 ──► tu cuenta de pagos (Stripe)
                        │
Sistema envía pedido ──► proveedor (CJ) cobra su costo, p. ej. $176, de tu saldo en CJ
                        │
Panel registra: venta $299 − proveedor $176 − comisión $14 = ganancia $109
```

Ningún proveedor chino cobra directamente al cliente y te transfiere solo el margen: **tú cobras la
venta completa y el sistema le paga al proveedor solo el costo** (CJ descuenta de tu saldo prepagado
con `payType=2`). Lo que te queda es el margen, y el panel lo muestra por pedido, por tienda y en total.
Mantén saldo suficiente en tu cuenta de CJ: si no alcanza, el pedido queda en «Error con proveedor»
y puedes reintentarlo desde el panel (también se reintenta solo cada hora).

## Flujo de un pedido

1. El cliente agrega productos (el carrito guarda solo id y cantidad; **el precio siempre lo calcula el servidor**).
2. Llena sus datos de envío (validados para México: 32 estados, C.P. de 5 dígitos, teléfono de 10).
3. Paga en Stripe Checkout. Al volver, el servidor **verifica el pago con Stripe** (monto, moneda y pedido).
4. El pedido se envía automáticamente al proveedor con la dirección del cliente.
5. Cada hora se consulta el rastreo: *Enviado al proveedor → En camino (con guía) → Entregado*.
6. El cliente consulta su pedido en `/pedido` con su número y correo.

## Arranque rápido (modo demostración)

Requiere Node.js 22.5 o superior (usa la base SQLite integrada en Node, sin servicios externos).

```bash
cd tiendas
cp .env.example .env        # define ADMIN_PASSWORD y SESSION_SECRET
npm install
npm start
```

- Tiendas: `http://localhost:3000/s/voltia/`, `/s/lume/`, … (portada con las 10 en `http://localhost:3000/`)
- Panel central: `http://localhost:3000/admin`

En modo demo (`SUPPLIER=mock`, `PAYMENTS=mock`) se cargan 36 productos de ejemplo
(gadgets, ropa y accesorios), los pagos se aprueban solos y los pedidos «avanzan» de estado en
minutos. En producción (`NODE_ENV=production`) los pagos demo se bloquean.

## Pasar a producción

1. **Proveedor**: crea cuenta en [CJ Dropshipping](https://cjdropshipping.com), genera tu API key y recarga saldo.
   ```
   SUPPLIER=cj
   CJ_API_KEY=...
   CJ_KEYWORDS=gadgets:wireless earbuds,smart watch;ropa:hoodie,dress;accesorios:sunglasses,wallet
   USD_TO_MXN=18.5
   ```
   Luego `npm run sync` (o el botón «Sincronizar catálogo»). El catálogo se resincroniza solo cada 6 h:
   los cambios de costo se reflejan en los precios y lo que CJ deja de vender se desactiva.
   > El adaptador de CJ (`src/suppliers/cj.js`) sigue la documentación de su API v2.0, pero no se
   > probó contra una cuenta real. Haz un pedido de prueba antes de abrir al público y ajusta el
   > mapeo de campos si CJ responde con algún error.
2. **Pagos**: `PAYMENTS=stripe` y `STRIPE_SECRET_KEY=sk_live_...` (cuenta de Stripe México, cobra en MXN).
   Ajusta `PAYMENT_FEE_PCT` / `PAYMENT_FEE_FIXED_MXN` a tu tarifa para que la ganancia sea exacta.
3. **Seguridad**: `ADMIN_PASSWORD` fuerte, `SESSION_SECRET` fijo y largo, `NODE_ENV=production`,
   HTTPS, y `TRUST_PROXY=1` si estás detrás de un proxy (Render, Railway, Nginx).
4. **Dominios propios** (opcional): agrega el dominio en `domains` de cada tienda en
   `src/config/stores.js` y apunta su DNS al servidor. Ej.: `domains: ['voltia.mx', 'www.voltia.mx']`.
5. **Hospedaje**: cualquier servidor con Node 22 y disco persistente para `data/tiendas.db`
   (Render, Railway, Fly.io, un VPS). Respalda ese archivo: contiene pedidos y ganancias.

Para agregar otro proveedor (AliExpress Dropshipping, Spocket, etc.) crea un módulo en
`src/suppliers/` con `fetchCatalog`, `createOrder` y `getOrderStatus` y regístralo en `src/suppliers/index.js`.

## Panel central (`/admin`)

- **Resumen**: tu ganancia, ventas cobradas, pagado a proveedores y ticket promedio; ganancia por tienda;
  filtros por tienda y periodo.
- **Pedidos**: todos los pedidos de las 10 tiendas, filtrables; detalle con desglose de ganancia,
  historial, reenvío al proveedor, actualización de rastreo y cancelación.
- **Productos**: costo, precio de venta y ganancia por producto, y en qué tiendas está.
- **Tiendas**: margen de cada tienda (recalcula precios al guardar), activar/desactivar, logotipo SVG.

## Antes de vender (México)

- Darte de alta en el SAT y facturar tus ventas (por ejemplo, en RESICO).
- Revisar que los textos de envíos/devoluciones (`/envios`) y el aviso de privacidad (`/privacidad`)
  correspondan a tu política real (PROFECO y LFPDPPP). Hay versiones base en `src/views/store.js`.
- Informar tiempos reales de entrega: desde China suelen ser 10–20 días hábiles.
- Verificar que los productos no infrinjan marcas registradas y que los gadgets eléctricos cumplan las NOM.

## Estructura

```
src/config/stores.js    las 10 marcas
src/views/brand.js      logotipos, iconos, ilustraciones de producto y tema CSS por marca
src/views/store.js      páginas de la tienda (mismas para todas)
src/views/admin.js      panel central
src/services/catalog.js sincronización de catálogo y precios por tienda
src/services/orders.js  pedidos, envío al proveedor, rastreo y ganancia
src/suppliers/          proveedores (mock, CJ)
src/payments/           pagos (mock, Stripe)
public/store.css        estructura visual común + variantes por marca
public/cart.js          carrito del navegador
```

Pruebas: `npm test` (recorre las 10 tiendas y un pedido completo de punta a punta).
