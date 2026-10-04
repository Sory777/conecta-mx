# OFERTALIA — Monetización

> Regla: **solo se implementa un modelo cuando hay un programa o contrato real que lo respalde.** La arquitectura deja preparados los demás, pero apagados.

---

## 1. Modelos soportados

| Modelo | Flujo | Cómo se registra | Fuente de la verdad del ingreso | Estado inicial |
|---|---|---|---|---|
| **A. Afiliación (CPS)** | Usuario → OFERTALIA → `/go/:id` → tienda → compra → comisión | `merchant_programs.monetization_model='cps'` | Reportes/API de la red (`conversions`) | ✅ Activo desde el MVP |
| **B. CPC** | Pago por clic de salida (p. ej. metabuscadores como Kayak o Skyscanner en algunas modalidades) | `'cpc'` + `commission_rates` con importe fijo por clic | Reporte de la red | 🟡 Solo si un programa aprobado lo ofrece |
| **C. CPA** | Pago por acción concreta (registro, primera compra, instalación de app) | `'cpa'` con `event_type` | Red | 🟡 Por programa |
| **D. CPL** | Pago por prospecto (B2B de Lenovo, seguros, finanzas) | `'cpl'` | Red / anunciante | ⏸ Apagado (finanzas/seguros requieren revisión legal) |
| **E. Cashback** | Parte de la comisión se devuelve al usuario | `allows_cashback` por programa + futuro módulo de saldos | Red + contabilidad propia | ⏸ **No se implementa** (requiere KYC de usuarios, pagos y permiso de cada comerciante) |
| **F. Publicidad** | Espacios display independientes de las ofertas | `ad_placements`, `ad_revenue_daily` | Proveedor de anuncios | ⏸ Cuando haya tráfico (los anuncios bajan el CTR hacia ofertas; hay que medirlo) |
| Sponsored deals / tienda destacada / newsletter patrocinado | Pago fijo de una marca | `sponsored_campaigns` (requiere `contract_ref`) | Contrato | ⏸ Fase 4 |
| Comparación de precios | Misma oferta en varias tiendas → el usuario elige | `products` canónico + varias `offers` | Afiliación de cada tienda | 🟡 Fase 3 (sale natural del dedupe) |
| Alertas premium / suscripción | Funciones avanzadas de pago | (futuro) | Pasarela de pago | ⏸ Solo si hay demanda comprobada |

**Extensibilidad:** el modelo de cada programa es un valor de enumeración en `merchant_programs`. Si aparece uno nuevo (p. ej. "pago por instalación de app"), se agrega un valor al `check`, un tipo en `conversions.event_type` y, si hace falta, una regla de cálculo en `packages/core/commission.ts`. No hay que cambiar la arquitectura.

---

## 2. Economía por categoría (supuestos ilustrativos, NO datos reales)

**EPC** (ganancia por clic) = comisión promedio × tasa de conversión.
Las tasas de comisión salen de `AFFILIATE_RESEARCH.md` (reportadas, sin verificar). **Las tasas de conversión y los tickets son supuestos para planear** y se reemplazan por datos propios en cuanto existan.

| Escenario | Ticket supuesto | Comisión | Comisión/venta | Conversión supuesta | EPC estimado |
|---|---|---|---|---|---|
| Mercado Libre (producto medio) | $800 MXN | 12% (extremo bajo) | $96 | 3% | ~$2.9 MXN |
| Amazon MX (tecnología) | $1,500 MXN | ~3% (supuesto dentro del rango 1–10%) | $45 | 5% | ~$2.3 MXN |
| Hotel vía Booking/Expedia | $4,000 MXN | 4% (solo estancia completada) | $160 | 1.5% (menos cancelaciones) | ~$2.4 MXN |
| Experiencia GYG/Viator | $1,800 MXN | 8% | $144 | 2% | ~$2.9 MXN |
| Xcaret (parque) | $2,500 MXN | 6% | $150 | 1.5% | ~$2.3 MXN |
| Samsung (celular) | $7,000 MXN | ~3% | $210 | 1% | ~$2.1 MXN |

**Lectura:** en el arranque, ninguna categoría domina de forma clara sobre el papel. **La diferencia la van a marcar los datos reales de conversión**, por eso el dashboard de rentabilidad es prioritario.

**Punto de equilibrio aproximado:** costos fijos de ~US$50/mes (≈ $900–1,000 MXN, ver ARCHITECTURE.md) ÷ EPC de ~$2.5 MXN ≈ **400 clics de salida al mes**. Es una meta baja y medible para validar el modelo.

---

## 3. "Dónde está el dinero": la tabla del dashboard

| Categoría | Clics | Conversiones | Conv. % | Comisión aprobada | Comisión pendiente | EPC | Costo atribuible | ROI | Nivel |
|---|---|---|---|---|---|---|---|---|---|

- **Costo atribuible** = costo de IA por categoría + publicidad pagada atribuida + horas editoriales × tarifa interna (configurable).
- **ROI** = (comisión aprobada − costo) / costo.
- **Nivel** (para priorizar): cuartiles de EPC por país → *Muy alto / Alto / Medio / Bajo*. Una categoría con muchos clics y EPC bajo es candidata a menos esfuerzo editorial.
- Mismo desglose **por tienda**, **por red** y **por oferta**.
- **Siempre se separa lo "pendiente" de lo "aprobado":** en viajes (estancias no completadas) y en retail (devoluciones), lo pendiente puede caer mucho.

---

## 4. Reglas de rentabilidad en la publicación (Fase 21)

1. **Umbral de score** para publicar automáticamente; lo demás pasa por revisión o se queda en borrador.
2. **Cupo por categoría y día:** p. ej. máximo 20 ofertas nuevas por categoría al día en el MVP. Calidad antes que volumen.
3. **Bonificación por EPC histórico** del comerciante y la categoría (aprendida), con techo para no sesgar todo hacia lo que más paga y perder confianza.
4. **Penalizar** cookies muy cortas (Lenovo: 3 días), ventas excluidas (apps), comerciantes con enlaces rotos y precios sin evidencia.
5. **Potencial SEO:** se priorizan productos y destinos con demanda de búsqueda (búsquedas internas + temporada: Buen Fin, Hot Sale, Black Friday, vacaciones de verano e invierno, Semana Santa).

---

## 5. Transparencia (Fase 15, obligatoria)

- Aviso visible en el encabezado o pie de **cada página que tenga enlaces afiliados**:
  > "Algunos enlaces de esta página son enlaces de afiliado. Si realizas una compra a través de ellos, podemos recibir una comisión sin costo adicional para ti."
- Página `/afiliados` que explica el modelo, lista las redes con las que se trabaja y aclara que **la comisión no cambia el orden** de forma oculta (o, si influye en el score, dice cómo).
- Las ofertas patrocinadas llevan la etiqueta **"Patrocinado"** y nunca se mezclan sin marca con las orgánicas.
- Enlaces con `rel="sponsored nofollow"`.

---

## 6. Cosas que NO se hacen

- Inventar programas, comisiones, precios anteriores o descuentos.
- Cookie stuffing, redirecciones ocultas o abrir enlaces de afiliado sin un clic del usuario.
- Pujar por marcas en SEM cuando el programa lo prohíbe (`allows_brand_bidding=false`).
- Enviar enlaces de Amazon por email (si su acuerdo lo prohíbe) o usar cupones no autorizados.
- Procesar pagos o reservas: el usuario siempre compra en el sitio oficial.
