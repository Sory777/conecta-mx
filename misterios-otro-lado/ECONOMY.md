# ECONOMÍA — Misterios: El Otro Lado

> Todas las cifras de ingresos son **estimaciones de referencia** para dimensionar parámetros, no promesas.
> Los valores reales dependen del país, la red de anuncios, la retención y la calidad del juego.
> El panel de administración (`/admin.html → Resumen`) calcula los números **reales** a partir de la base de datos.

## 1. Tres conceptos separados

| Concepto | Código | Cómo se obtiene | Para qué sirve | ¿Valor monetario? |
|---|---|---|---|---|
| **Monedas** | `coins` | Jugando: misterios, anuncios opcionales, referidos, pase de temporada | Tienda (cosméticos, herramientas, vehículos, decoración) y marketplace | **No.** Nunca se convierten a dinero. |
| **Gemas** | `gems` | Compra con dinero real mediante **ofertas** (sandbox sin cobro, o **Telegram Stars** si `TELEGRAM_STARS_ENABLED=true`) | Artículos premium y pase premium | **No reembolsables ni canjeables** por dinero. |
| **Puntos de recompensa** | `rp` | Sólo por actividad validada en servidor (primera vez que se resuelve un misterio, eventos, logros, cooperación, algunos anuncios recompensados, referidos legítimos) | Canje por recompensas de valor real **cuando el programa esté activo** | Potencialmente sí → por eso está fuertemente limitado |

Reglas duras (garantizadas en código y base de datos):

- La tienda **no acepta RP**: `store_products.price_currency CHECK IN ('coins','gems')`.
- Las gemas se compran con dinero real sólo a través de un `PaymentProvider` con verificación en servidor; hoy existen el sandbox (marca todo como `sandbox=1`) y Telegram Stars (verificado por el bot). Los paquetes se definen como ofertas en `content/store.json` (`offers`) y se editan en el panel admin; ver [MONETIZATION.md](MONETIZATION.md). El VIP da +10% de monedas en misiones, 10 gemas diarias y quita interstitials: nunca da puntos de recompensa extra.
- El marketplace entre jugadores sólo admite **monedas** (`marketplace_listings.currency CHECK = 'coins'`). Dinero real entre jugadores: **no soportado**.
- Todo movimiento pasa por el libro mayor (`transactions` + `ledger_entries` + `item_ledger`) con clave de idempotencia única.

## 2. Puntos de recompensa: por qué no pueden generar valor ilimitado

1. **Fuentes finitas o limitadas**: cada misterio da RP **una sola vez** (repetir da 0 RP y 20% de monedas). Anuncios: tope diario por ubicación (5/día) y espera de 3 min.
2. **Límite por usuario**: 300 RP/día y 1,200 RP/semana (lo que ocurra primero).
3. **Presupuesto GLOBAL diario**: `rewardPoints.globalDailyBudgetUsdCents` (por defecto 5,000 ¢ = US$50/día). Superado, ese día ya no se emite RP a nadie (monedas sí). Esto acota el pasivo total **independientemente del número de usuarios**: máx. ≈ US$1,500/mes con la configuración inicial.
4. **Antifraude**: cuentas con `fraud_score ≥ 40` quedan retenidas (`rewards_hold`) y no acumulan RP.
5. **Canje**: mínimo 10,000 RP (US$1.00), máximo 50,000 por solicitud, 1 solicitud cada 7 días, tope US$5/mes, cuenta ≥14 días, correo verificado, ≥1 misterio completado, fraude ≤25 y **revisión manual siempre**.
6. **Tres candados** para que un canje sea real: interruptor admin `redemption.realRewardsEnabled` **y** `REAL_PAYOUTS_ALLOWED=true` **y** `SANDBOX_MODE=false`. Por defecto está todo apagado.
7. Aprobar un canje **no mueve dinero**: no hay proveedor de pagos de premios integrado; el pago se hace fuera del sistema y luego se marca como pagado (auditado).

### Valor de referencia

`rewardPoints.usdCentsPer1000 = 10` → **1,000 RP = US$0.10** (1 RP = US$0.0001).

| Escenario | RP | Valor |
|---|---|---|
| Resolver Ep. 1 por primera vez | 150 | US$0.015 |
| Resolver Ep. 3 (temporada) | 80 | US$0.008 |
| Anuncio recompensado | 5 | US$0.0005 |
| Referido legítimo (al invitador) | 50 | US$0.005 |
| Tope diario por usuario | 300 | US$0.03 |
| Tope semanal por usuario | 1,200 | US$0.12 |
| Máximo teórico mensual por usuario (topes) | ≈5,200 | ≈US$0.52 |
| Mínimo para canjear | 10,000 | US$1.00 |

Con el contenido actual, la fuente recurrente principal son los anuncios (máx. 25 RP/día): un jugador constante tarda **~13 meses** en llegar al mínimo sólo con anuncios. Esto es intencional mientras no haya ingresos reales medidos; al crecer, el admin puede subir tasas con datos.

## 3. Ingreso vs. costo por usuario (estimación)

Supuestos (México/LatAm, juego casual móvil; ajustar con datos reales):

| Supuesto | Valor |
|---|---|
| eCPM anuncio recompensado | US$6 (rango típico US$3–10) → US$0.006 por vista |
| Vistas recompensadas por DAU/día | 1.5 |
| Conversión a pago (MAU) | 2% |
| ARPPU mensual | US$5 |
| Comisión de tienda (Google/Apple) | 30% (15% en programas para pequeños desarrolladores) |
| Días activos por MAU al mes | 6 (DAU/MAU ≈ 20%) |
| Costo de infraestructura | US$0.003 por DAU/día (config `estimates.infraCostPerDauUsdCents = 0.3`) |

### Por DAU y día

| Línea | US$ / DAU / día |
|---|---|
| Anuncios: 1.5 × 0.006 | **+0.0090** |
| Compras: (2% × 5 × 0.70) / 6 días | **+0.0117** |
| **Ingreso estimado** | **+0.0207** |
| Recompensas RP emitidas (≈30 RP/día, peor caso sin "breakage") | −0.0030 |
| Infraestructura (servidor, BD, ancho de banda) | −0.0030 |
| Servicios externos: procesamiento de premios + revisión manual (amortizado) | −0.0005 |
| **Costo estimado** | **−0.0065** |
| **Margen estimado** | **≈ +0.0142 (≈ 68%)** |

Notas:
- La mayoría de los RP emitidos **nunca se canjea** (no se alcanza el mínimo, expiración futura, cuentas abandonadas): el costo real de recompensas suele ser muy inferior al valor emitido. El cálculo anterior es conservador (asume que todo se canjea).
- Los anuncios recompensados pagan su propio RP: 5 RP (US$0.0005) por una vista que genera ~US$0.006 → las recompensas son **~8%** del ingreso del anuncio.
- Costos de servicios externos a presupuestar cuando se activen: KYC (≈US$1–2 por verificación, sólo para canjes), proveedor de tarjetas de regalo (0–5%), Stripe web (2.9% + US$0.30), procesamiento de reportes/moderación.
- **Costo de infraestructura del MVP**: un único servidor (2 vCPU / 4 GB, ≈US$20–40/mes) sirve cientos de jugadores concurrentes; el protocolo envía ~0.5–2 KB/s por jugador activo.

### Alarma automática

El panel calcula en ventana de 30 días: RP emitidos (en US$), pasivo pendiente, ingreso estimado por anuncios (reales vs. sandbox), ingreso neto por compras, costo de infraestructura y **ratio recompensas/ingreso**. Si supera **50%** muestra una alerta para bajar tasas o límites. Si se emiten RP y no hay ingresos reales (modo sandbox), también avisa.

## 4. Parámetros configurables (en caliente, validados y auditados)

`/admin.html → Parámetros económicos` (o `PUT /api/admin/economy`). Cada cambio queda en `audit_log` con el antes/después.

| Grupo | Parámetros |
|---|---|
| `starter` | monedas y objetos iniciales |
| `missions` | `coinMultiplier`, `rpMultiplier`, `xpMultiplier`, `repeatCoinFactor`, `coopBonusPct` |
| `rewardPoints` | `enabled`, `dailyCap`, `weeklyCap`, `usdCentsPer1000`, `globalDailyBudgetUsdCents` |
| `redemption` | `realRewardsEnabled`, `minPoints`, `maxPointsPerRequest`, `cooldownDays`, `minAccountAgeDays`, `maxFraudScore`, `monthlyCapUsdCents`, `requireVerifiedEmail`, `minCompletedMissions`, `rewardTypes` |
| `ads` | `enabled`, `estimatedEcpmUsdCents` (+ por ubicación en **Publicidad**: monedas, RP, tope diario, espera, visión mínima) |
| `marketplace` | `enabled`, `commissionPct`, `maxActiveListings`, `minPrice`, `maxPrice`, `dailyPurchaseLimit`, `minAccountAgeDays` |
| `referral` | recompensas, misión de calificación, minutos mínimos de juego, máximo por mes |
| `dropTables` | probabilidades (pesos) de hallazgos por rareza |
| `antifraud` | `maxAccountsPerDevice`, `maxRegistrationsPerIpPerDay`, `holdThreshold` |
| `estimates` | `infraCostPerDauUsdCents`, `storeFeePct` |
| Tienda | precios por producto (sección **Tienda**) |
| Eventos | multiplicadores de monedas/XP (topados a ×3; **los eventos no multiplican RP**) |

## 5. Rarezas y probabilidades

Tabla `episode_complete` (sólo la primera vez que se resuelve un misterio; aleatoriedad del **servidor** con `crypto.randomInt`):

| Rareza | Objeto | Peso | Probabilidad |
|---|---|---|---|
| Común | Botón de nácar | 600 | 60.0% |
| Poco común | Moneda de 1920 | 280 | 28.0% |
| Raro | Medalla sin nombre | 90 | 9.0% |
| Épico | Reloj de bolsillo detenido | 27 | 2.7% |
| Legendario | Camafeo de la familia Morales | 3 | 0.3% |

**No se venden cajas de botín** con dinero real ni con gemas (evita riesgos regulatorios de apuestas). Si en el futuro se añadieran, habría que publicar probabilidades y revisar la legislación de cada país.

## 6. Monedas (economía interna)

- **Fuentes**: misterios (250/150 primera vez; 20% al repetir), anuncios (25 y 10), referidos (300/150), pase de temporada, kit inicial (100).
- **Sumideros**: tienda (80–2,000), comisión del marketplace (10%, se destruye).
- Las monedas no tienen valor monetario: la inflación sólo afecta al equilibrio de juego y se corrige con precios/multiplicadores.

## 7. Pase de temporada

- Pista gratuita y premium (200 gemas). 7 niveles por XP de temporada.
- Recompensas: monedas y cosméticos. **Nunca RP** (el pase no se puede convertir en dinero indirectamente).

## 8. Marketplace (preparado, desactivado)

- Sólo monedas; custodia del objeto (estado `escrow`), comisión de plataforma, límites diarios y de publicaciones, antigüedad mínima de cuenta, bloqueo entre usuarios respetado, detección de mismo dispositivo (bloquea la transacción y marca fraude), retirada por moderación, historial.
- **Dinero real entre jugadores**: requiere licencia/estructura de pagos, facturación e impuestos, KYC/AML, términos específicos y probablemente un proveedor tipo *marketplace payments*. No se habilitará hasta cumplirlo.
