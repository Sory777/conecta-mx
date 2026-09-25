# Backtest del oro (XAU/USD)

> **Aviso importante:** no existe una estrategia infalible. Cualquier sistema que
> gane siempre en un backtest está sobreajustado a los datos pasados y va a fallar
> en real. Lo que sigue es una estrategia con **ventaja estadística razonable y
> riesgo controlado**. Todas las cifras son históricas, no garantizan nada, y
> esto no es asesoría financiera.

## Datos usados

| Serie | Periodo | Fuente |
|---|---|---|
| Diario (D1) | 24‑nov‑2022 → 25‑sep‑2026 (1000 velas) | eToro, instrumento 18 "Gold" |
| 4 horas (H4) | 23‑feb‑2026 → 25‑sep‑2026 (1000 velas) | eToro |
| 1 hora (H1) | 11‑ago‑2026 → 25‑sep‑2026 (1000 velas) | eToro |
| 15 min (M15) | 14‑sep‑2026 → 25‑sep‑2026 | eToro (guardado, no usado) |
| Mensual | 1833 → ago‑2026 (se usa 1971+) | github.com/datasets/gold-prices |

La API de eToro solo da las últimas 1000 velas por temporalidad, así que el
análisis intradía se basa en **muy poca historia** (6 semanas en H1).
Coste simulado: **0.50 USD/oz por operación** (spread de eToro de ~0.20 más deslizamiento).

Para volver a correrlo: `pip install pandas numpy && python3 backtest.py`

## Lo que encontré

### 1. El contexto manda: el oro subió +144 % en 4 años
Comprar y mantener ganó **+144 %**, con una caída máxima de **‑26.6 %**. Todas las
estrategias de solo largos salieron bien porque el mercado subió sin parar.
**Ninguna estrategia le ganó en retorno a solo comprar y mantener**; lo que sí
lograron fue **bajar mucho las caídas** (DD de ‑2 % a ‑9 % en operaciones cerradas).

### 2. Estacionalidad mensual (1971‑2026, 56 años)
- **Enero** es el mejor mes: +2.8 % de media, sube el 66 % de los años (t = 2.65).
- **Febrero** también es positivo (+1.5 %, t = 2.39).
- **Ago‑Sep‑Oct** están ligeramente a favor (t ≈ 1.9‑2.0).
- **Mar, Jun, Jul y Nov** son planos. Mayo sube solo el 39 % de los años (la media es positiva por pocos meses muy grandes).

### 3. Día de la semana
No hay ventaja: todos los días rondan +0.09 % a +0.11 %, y ningún t‑stat pasa de 1.4.

### 4. Horarios (UTC; México centro = UTC‑6)
- **Volatilidad:** la mayor es de **12:00‑15:00 UTC** (apertura de NY y datos de EE. UU.,
  06:00‑09:00 hora de CDMX), con un rango de ~0.5 % por hora. Asia (03‑05 UTC) es la sesión más tranquila.
- **Dirección (H1, 6 semanas):** las velas de **17‑20 UTC** (tarde de NY) fueron
  mayormente bajistas (20 UTC: 33 % alcistas, t = ‑2.4). Probé 24 horas, así que es
  normal que 1 o 2 salgan "significativas" por pura suerte: **no lo tomes como regla**.
- **Bloques de 4 h (7 meses):** el bloque de 16‑20 UTC fue el peor para largos
  (PF 0.63) y el de 20‑24 UTC el mejor (PF 1.25). Coincide con lo que se ve en H1.

### 5. Estrategias probadas

**Diario (4 años)**

| Estrategia | Ops | % acierto | Retorno | PF | DD máx |
|---|---|---|---|---|---|
| Comprar y mantener | 1 | – | +144 % | – | ‑26.6 % |
| SMA 20/50 solo largos | 10 | 60 % | +78 % | 8.3 | ‑4.3 % |
| SMA 50/200 solo largos | 2 | 50 % | +90 % | 29.8 | – |
| Donchian 20/10 + stop 2 ATR | 24 | 46 % | +40 % | 2.2 | ‑8.8 % |
| **Donchian 55/20 + stop 3 ATR** | 8 | 75 % | +83 % | 9.4 | ‑4.5 % |
| RSI(2) < 10 con precio > SMA200 | 23 | 83 % | +21 % | 2.5 | ‑10.7 % |
| Venta RSI(2) > 90 con precio < SMA200 | 4 | 50 % | ‑5 % | 0.4 | ‑2.0 % |

- Las **36 combinaciones** de parámetros de Donchian fueron rentables, así que no
  depende de un ajuste fino. Aun así, esto refleja sobre todo la tendencia alcista de 2022‑2026.
- **Walk‑forward:** Donchian y SMA ganaron en las dos mitades. RSI(2) también ganó en
  ambas, pero en la segunda tuvo una operación de **‑10.7 %** porque no usa stop.
- **Monte Carlo** (Donchian 20/10): 9 % de probabilidad de terminar en pérdida y un
  DD del peor 5 % de casos de **‑22 %**. Aunque el backtest parezca limpio, rachas malas pueden pasar.
- Vender en corto el oro fue perdedor.

**Intradía (H1, 6 semanas: muestra pequeña)**

| Estrategia | Ops | % acierto | Retorno | PF |
|---|---|---|---|---|
| Ruptura rango asiático 00‑06 UTC, R:R 2 | 39 | 56 % | +8.9 % | 2.4 |
| Ruptura rango asiático R:R 1.5 + filtro tendencia D1 | 23 | 57 % | +4.7 % | 2.6 |
| Corto sesión NY 13‑21 UTC | 43 | 49 % | +5.5 % | 1.6 |
| Largo sesión NY 13‑21 UTC | 43 | 51 % | ‑6.4 % | 0.6 |
| Momentum vela 13 UTC | 43 | 44 % | ‑4.7 % | 0.55 |

La ruptura del rango asiático es el mejor candidato intradía, pero **39 operaciones
no alcanzan para confiar en ella**. Hay que validarla en demo antes de arriesgar dinero.

## La estrategia propuesta

La estrategia tiene dos componentes: uno principal de tendencia y otro táctico intradía.

### A) Principal — seguimiento de tendencia en diario (70 % del riesgo)
1. **Filtro:** solo compras cuando el cierre diario esté por encima de la SMA 200.
2. **Entrada:** compra cuando el precio rompa el **máximo de los últimos 40 días**.
3. **Stop inicial:** 2 × ATR(14) por debajo de la entrada.
4. **Salida:** cierra cuando el precio pierda el **mínimo de los últimos 20 días** o toque el stop, lo que ocurra primero.
5. **Tamaño:** arriesga el **1 % de la cuenta** por operación.
   Unidades = (1 % × capital) / (2 × ATR).
6. **Refuerzo estacional (opcional):** en enero‑febrero y agosto‑octubre puedes subir
   el riesgo a 1.25 %. En marzo, junio, julio y noviembre bájalo a 0.75 %.

**Resultado histórico de A** (sep‑2023 → sep‑2026, tras el calentamiento de la SMA 200):
7 operaciones, 5 ganadoras, retorno de +88 % invirtiendo el 100 % del capital en cada
operación, PF 11 y peor operación de ‑4.6 %. **Siete operaciones son muy pocas**, y la mayor
parte de la ganancia vino de una sola operación de +41 %. Así es como funciona un sistema de
tendencia: muchas pérdidas pequeñas y unas pocas ganancias grandes.

### B) Táctico — ruptura del rango asiático (30 % del riesgo, primero en demo)
1. Marca el máximo y el mínimo de **00:00‑06:00 UTC** (18:00‑00:00 hora de CDMX).
2. Opera solo **a favor de la tendencia diaria**: si el precio está sobre la SMA 50
   diaria, solo compras en la ruptura del máximo; si está debajo, solo vendes en la ruptura del mínimo.
3. **Stop** en el extremo opuesto del rango. **Objetivo** en 1.5‑2 veces el ancho del rango.
4. Máximo una operación al día. Si a las **16:00 UTC** (10:00 CDMX) sigue abierta, ciérrala.
5. Riesgo del **0.5 %** por operación.

### Reglas de riesgo (las más importantes)
- Evita abrir operaciones nuevas en la hora de noticias fuertes de EE. UU.: NFP, CPI y decisiones de la FOMC, a las 12:30/18:00 UTC.
- No abras largos intradía nuevos entre **16:00 y 20:00 UTC**, que fue la franja más débil.
- Si la cuenta cae **‑10 %** desde su máximo, reduce el riesgo a la mitad. Si cae **‑20 %**, deja de operar y revisa todo.
- Nada de apalancamiento alto: con x20 de eToro, un movimiento de 5 % contra ti borra la cuenta.

## Limitaciones
- Los 4 años de datos diarios fueron un mercado muy alcista, y en un mercado lateral o bajista
  los sistemas de tendencia dan muchas señales falsas seguidas.
- El DD de las estrategias se mide con operaciones cerradas, así que el DD real (flotante) es mayor.
- El intradía tiene muy poca muestra (6 semanas en H1 y 7 meses en H4).
- Los precios de eToro son CFD, y el coste real puede variar (financiación nocturna, spreads en noticias).

**Siguiente paso recomendado:** prueba la estrategia en una cuenta demo de eToro durante 2‑3 meses
y compara los resultados con este backtest antes de usar dinero real.

---

# Scalping (M1 / M5 / M15)

Script: `python3 scalping.py` → `results/scalping_resultados.csv`, `results/scalping_reporte.txt`

## Datos y supuestos
| TF | Periodo (UTC) | Movimiento medio por vela |
|---|---|---|
| M1 | 24‑sep 23:32 → 25‑sep 16:11 (~17 h) | 1.88 USD |
| M5 | 22‑sep 01:55 → 25‑sep 16:10 (~3.5 días) | 4.49 USD |
| M15 | 14‑sep 07:15 → 25‑sep 16:00 (~9 días) | 6.89 USD |

- **Coste:** 0.30 USD/oz por operación (spread de eToro de 0.20 más 0.10 de deslizamiento). Repetí todo con 0.50.
  En M1 el spread se come ~10 % del movimiento medio de una vela, **y ese es el enemigo número uno del scalping**.
- Entrada a la apertura de la vela siguiente a la señal. Si una vela toca el stop y el objetivo a la vez, se cuenta como **stop**.
  Salida forzada por tiempo: 30 velas en M1, 12 en M5 y 8 en M15.
- ⚠️ **Muestra mínima:** 1 día de M1, 4 de M5 y 11 de M15, y los periodos se solapan (M1 ⊂ M5 ⊂ M15).
  Probé 64 combinaciones, así que algunas "ganan" por puro azar. **Nada de esto está validado estadísticamente.**

## Qué se probó
5 estrategias × 5 sesiones × 3 temporalidades (más ORB en M5 y M15):
retroceso a la EMA 9/21/50, reversión con Bollinger y RSI, ruptura con vela de impulso, reversión a una "VWAP" diaria y ruptura del rango de apertura (ORB) de Londres y Nueva York.

## Resultados clave
- **Operar todo el día pierde dinero** en casi todas las estrategias. **El horario lo es todo.**
- **Tarde de NY (17‑21 UTC):** perdió en todas las estrategias de tendencia (PF de 0.03 a 0.32). No hagas scalping ahí.
- **ORB de Nueva York 13:30:** PF 0.16. La apertura de NY en el oro da rupturas falsas y barre stops.
- **Retroceso a la EMA** (el setup "clásico" de YouTube): perdió en el día completo en las 3 temporalidades.

Las **únicas dos** combinaciones que ganaron en las 3 temporalidades, con largos y cortos, y que siguen ganando con coste de 0.50:

| Setup | TF | Ops | % acierto | P&L (USD/oz) | PF (coste 0.30 → 0.50) |
|---|---|---|---|---|---|
| **Vela de impulso en Asia** | M1 | 25 | 60 % | +21 | 2.11 → 1.76 |
| | **M5** | 22 | 59 % | +45 | **2.20 → 2.03** |
| | M15 | 25 | 56 % | +73 | 2.33 → 2.19 |
| **Reversión a la VWAP en NY** | M1 | 52 | 54 % | +26 | 1.36 → 1.20 |
| | **M5** | 30 | 57 % | +58 | **1.82 → 1.70** |
| | M15 | 33 | 42 % | +6 | 1.05 |

## La estrategia de scalping propuesta (en M5)

### Setup 1 — "Impulso asiático" · 00:00‑07:00 UTC (18:00‑01:00 hora de CDMX)
1. Timeframe de 5 minutos. Calcula el ATR(14).
2. **Señal:** una vela cuyo **cuerpo sea ≥ 60 % de su rango** y que **cierre por encima del máximo
   (o por debajo del mínimo) de las 12 velas anteriores**, es decir, de la última hora.
3. **Entrada:** a la apertura de la siguiente vela, a favor de la vela de impulso.
4. **Stop:** 1 × ATR. **Objetivo:** 2 × ATR (en M5 son ~4.5 USD de stop y ~9 USD de objetivo).
5. **Salida por tiempo:** si en 12 velas (1 hora) no tocó ni el stop ni el objetivo, cierra.

### Setup 2 — "Regreso a la VWAP" · 12:00‑17:00 UTC (06:00‑11:00 hora de CDMX)
1. Timeframe de 5 minutos. VWAP del día (si tu plataforma tiene VWAP, úsala; aquí se usó el promedio
   del precio típico desde las 00:00 UTC porque eToro no da volumen) y ATR(14).
2. **Señal:** el cierre queda **a más de 1.5 ATR por debajo de la VWAP → compra**, o **por encima → venta**.
3. **Stop:** 1 × ATR. **Objetivo:** 1.5 × ATR.
4. **Salida por tiempo:** 12 velas (1 hora).
5. **No operes** de 12:25 a 12:45 UTC los días de datos de EE. UU. (NFP, CPI, PPI, ventas minoristas)
   ni a las 18:00 UTC los días de decisión de la FOMC. Ahí el precio se aleja de la VWAP y no regresa.

### Gestión de riesgo (obligatoria en scalping)
- **Riesgo por operación: 0.5 % de la cuenta.** Onzas = (0.5 % × capital) / (1 × ATR en USD).
  Ejemplo: con 2,000 USD de cuenta y un ATR de 4.5, son 10 USD / 4.5 = 2.2 oz (~9,500 USD de exposición, ~x5).
- **Máximo 3 pérdidas seguidas o ‑1.5 % en el día → apaga la pantalla.** En el backtest hubo rachas de 2 a 4 pérdidas.
- **Una sola posición a la vez.** No promedies a la baja.
- **No hagas scalping de 17:00 a 21:00 UTC** (11:00‑15:00 CDMX) ni en la apertura de NY a las 13:30 UTC.
- El spread de eToro se ensancha en noticias y en el rollover (21:00‑22:00 UTC). Si ves un spread mayor a 0.40, no entres.
- eToro no permite órdenes de entrada pendientes en el oro (solo market/MIT), así que entrarás a mercado.
  Con eso el deslizamiento es real, y por eso el backtest se repitió con coste de 0.50.

### Cómo validarlo antes de arriesgar dinero
1. Opera **los dos setups en demo durante al menos 100 operaciones** (unas 4‑6 semanas).
2. Anota cada operación: hora, setup, entrada, stop, objetivo, resultado y spread.
3. Pasa a real solo si el PF de la demo es > 1.3 con al menos 100 operaciones. Si no, el "edge" era ruido.
4. Vuelve a correr `scalping.py` cada semana con datos nuevos de eToro. Si el PF de los últimos 30 días cae
   por debajo de 1.0, deja de operar ese setup.
