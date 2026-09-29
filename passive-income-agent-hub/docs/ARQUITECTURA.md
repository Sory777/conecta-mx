# Passive Income Agent Hub — Análisis de arquitectura y MVP

Este documento responde al punto 28 de la especificación: análisis previo, problemas detectados,
mejoras, tecnologías, APIs, costos, riesgos y la arquitectura del MVP (Fase 1) que se construyó.

> Convención de este documento: cuando una cifra no se pudo verificar se marca **NO VERIFICADA**.
> Las cifras marcadas **ESTIMACIÓN** son cálculos propios, no datos medidos.

---

## 1. Análisis de la arquitectura propuesta

La especificación describe ~11 agentes especializados + dashboard + experimentos + capital + alertas.
La mayoría de los agentes comparten el mismo ciclo:

```
buscar → verificar legitimidad → registrar datos con fuente → estimar → probar → medir → decidir
```

Por eso el MVP no implementa 11 programas distintos, sino **un motor común** con perfiles:

| Pieza del motor | Implementación en el MVP |
|---|---|
| Búsqueda con fuentes | `agents/researcher.py` (Claude web search o Brave) |
| Verificación de legitimidad | `agents/antifraud.py` (reglas + RDAP + revisión IA con cita obligatoria) |
| Evaluación de automatización | `agents/automation.py` (política + términos de servicio; no ejecuta) |
| Estimación | `agents/profitability.py` (3 escenarios + confianza por tipo de evidencia) |
| Medición real | experimentos + libro de transacciones |
| Aprendizaje | calibración histórica real/estimado por categoría |
| Monitoreo continuo | `agents/monitor.py` (diff de páginas de términos/oficiales) |

Los agentes especializados (microtareas, encuestas, minería, DePIN, afiliados, productos digitales, IA)
existen como **perfiles del investigador** (`agents/registry.py`): consulta predefinida + categoría.
Cuando un dominio necesite lógica propia (p. ej. un calculador de minería con dificultad de red),
se promueve a módulo independiente sin cambiar el resto.

## 2. Problemas detectados en la especificación

1. **"Buscar continuamente en Internet" tiene costo real.** Cada búsqueda con LLM cuesta dinero.
   Sin límites, el sistema puede gastar más de lo que genera. → Límite diario (`MAX_AGENT_RUNS_PER_DAY`),
   agentes programados desactivados por defecto.
2. **Los LLM inventan datos con facilidad** (plataformas, cifras, URLs). Pedirle al modelo "no inventes"
   no basta. → Reglas **por código**: una cifra cuya fuente no está entre las URLs realmente consultadas se
   degrada a NO_VERIFICADA; un candidato sin fuente consultada se descarta; una señal de fraude de la IA
   solo cuenta si su cita textual aparece literalmente en el material.
3. **Una puntuación única oculta la incertidumbre.** → Tres escenarios, tipo de evidencia por dato, nivel
   de confianza calculado y prioridad con fórmula visible.
4. **"Ausencia de señales de fraude" no es "legítimo".** → El riesgo BAJO exige verificaciones *positivas*
   (dominio ≥ 2 años vía RDAP, HTTPS, términos localizados, plataforma verificada por ti, sin inversión).
5. **Automatizar encuestas o microtareas es fraude** aunque sea técnicamente posible: el cliente paga por
   juicio humano. → Techo de automatización 0% en esas categorías, sin excepción.
6. **Scraping vs. términos de servicio.** Muchas plataformas prohíben scraping/bots. → Fase 1 no ejecuta
   automatización; el monitor solo descarga páginas públicas de términos con un User-Agent identificable
   y a baja frecuencia. Si existe API oficial, debe usarse.
7. **La rentabilidad de minería/DePIN depende de datos volátiles** (precio del token, dificultad, emisión,
   tarifa eléctrica). → El sistema se niega a calcular si falta el consumo o la tarifa; nunca asume
   una tarifa CFE (varía por región, tarifa y escalón). Volatilidad del token amplía el rango.
8. **Muestras pequeñas engañan.** 3 días buenos no son un mes bueno. → El intervalo observado se muestra
   con advertencia; la prioridad pondera por tamaño de muestra (días/7).
9. **Ingresos en plataforma ≠ dinero recibido.** → Los ingresos quedan PENDIENTES hasta que un retiro
   RECIBIDO los confirma; el resultado de un experimento advierte si no hubo retiros.
10. **Impuestos (SAT).** Los ingresos por plataformas digitales en México pueden tener obligaciones de ISR/IVA
    y retenciones. El sistema no calcula impuestos: **consulta a un contador**. (Detalle fiscal NO VERIFICADO.)
11. **Datos personales.** Guardar credenciales de plataformas de terceros es un riesgo innecesario en Fase 1.
    → No se almacenan credenciales de plataformas.

## 3. Mejoras incorporadas

- **Tipos de evidencia en cada dato**: OBSERVADO · ESTIMACIÓN · SUPOSICIÓN · PROMESA DE LA PLATAFORMA · NO VERIFICADA.
- **Rangos en vez de puntos** (mínimo / valor / máximo) → escenarios pesimista / base / optimista.
- **Compuerta antifraude**: nada pasa a EN PRUEBA o ACTIVA sin evaluación; DESCARTAR bloquea; ALTO exige
  aceptación explícita. Falsos positivos se marcan con justificación (queda en el historial).
- **Experimentos como fuente de verdad**: la estimación se congela al iniciar y se compara al terminar.
- **Calibración histórica**: la razón real/estimado de experimentos finalizados de una categoría se aplica
  a las nuevas estimaciones de esa categoría (aprendizaje transparente, no una caja negra).
- **Historial de decisiones estructurado**: "Encontré esta oportunidad porque…", "Datos utilizados",
  "Riesgos", "Puede / NO puede automatizarse", "Razón del descarte".

## 4. Tecnologías elegidas

| Capa | Elección | Motivo |
|---|---|---|
| Backend | Python 3.11 + FastAPI | Tipado con Pydantic, ecosistema de datos/IA, SDK oficial de Anthropic |
| BD | SQLite (SQLAlchemy 2) | Cero configuración para uso personal; migrable a PostgreSQL cambiando `DATABASE_URL` |
| Frontend | React + Vite + TypeScript + Tailwind | Mismo stack que tu otro proyecto (conecta-mx) |
| IA | Claude (`claude-opus-5-5`) vía SDK oficial `anthropic` | Herramienta de búsqueda web del servidor + salidas estructuradas validadas |
| Auth | scrypt (stdlib) + JWT en cookie httpOnly SameSite=Strict | Sin contraseñas en texto plano, sin tokens accesibles a JavaScript |
| Programación | Bucle asyncio en el proceso | Suficiente para 1 usuario; Celery/cron si crece |

## 5. APIs utilizadas (todas reales y públicas)

| API | Uso | Autenticación | Estado en MVP |
|---|---|---|---|
| Anthropic Messages API + herramienta `web_search_20260209` | Búsqueda web actual con citas | `ANTHROPIC_API_KEY` | Integrada (opcional) |
| Anthropic Messages API (salida estructurada `messages.parse`) | Extraer candidatos y señales de fraude | misma | Integrada (opcional) |
| Brave Search API `GET /res/v1/web/search` | Búsqueda sin LLM (solo resultados) | `X-Subscription-Token` | Integrada (opcional) |
| Frankfurter `api.frankfurter.app/latest` | Tasas USD/EUR/… → MXN (BCE) | ninguna | Integrada |
| CoinGecko `/api/v3/simple/price` | BTC/ETH/… → MXN | clave demo opcional `x-cg-demo-api-key` | Integrada |
| RDAP (`rdap.org/domain/…`) | Fecha de registro de dominios | ninguna | Integrada |
| Banxico SIE (tipo de cambio FIX) | Tasa oficial USD/MXN | token gratuito | **No integrada** (Fase 2) |

No se usan APIs no documentadas ni endpoints "descubiertos" en sitios de terceros.
Las APIs oficiales de plataformas concretas (afiliados, marketplaces, DePIN) se integrarán por
plataforma en Fase 2 **solo tras verificar su documentación oficial**.

## 6. Costos

| Concepto | Costo | Tipo |
|---|---|---|
| Hosting local | $0 | — |
| Frankfurter, RDAP | $0 | Servicios públicos gratuitos |
| CoinGecko demo | $0 (límite 30 llamadas/min, 10 000/mes según su documentación) | PROMESA DE LA PLATAFORMA |
| Claude Opus 5.5 | $4 USD / 1M tokens de entrada, $20 USD / 1M de salida | Precio publicado |
| Búsquedas web de Claude | cobro por búsqueda adicional a los tokens | **NO VERIFICADA** — revisar la página de precios de Anthropic |
| Brave Search API | según plan | **NO VERIFICADA** — revisar su página de precios |
| Ejecución del investigador | ≈ 0.3 – 1 USD por ejecución (hasta 8 búsquedas + extracción) | **ESTIMACIÓN** — medir con uso real |

Con el límite por defecto (30 ejecuciones/día) el peor caso sería del orden de decenas de USD al día
(ESTIMACIÓN): **ajusta `MAX_AGENT_RUNS_PER_DAY` a tu presupuesto**. Los agentes antifraude (sin IA),
rentabilidad, automatización y monitor no tienen costo de API.

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| Datos inventados por el LLM | Validación por código de fuentes y citas; todo entra como NO VERIFICADO |
| Falsos positivos del antifraude | Se muestran la regla y el fragmento; el usuario puede marcar falso positivo con justificación |
| Falsos negativos (estafa sin palabras clave) | Riesgo BAJO requiere verificaciones positivas; experimentos con presupuesto acotado |
| Violación de términos de servicio | Sin ejecución en Fase 1; techo por categoría; 0% si los términos no están verificados |
| Gasto descontrolado en APIs | Límite diario, scheduler apagado por defecto |
| Pérdida de capital | Presupuesto de experimentos bloqueado por el capital disponible; alertas de inversión |
| Tasas de cambio no disponibles | No se inventa tasa: se usa la última conocida (con su fecha) o se exige tasa manual |
| Seguridad de la app | Hash scrypt, cookie httpOnly, límites de peticiones, secretos en `.env`, logs |
| Cambios de condiciones de plataformas | Monitor con diff; marca REQUIERE ACCIÓN si cambian automatización o países |

## 8. Arquitectura del MVP (Fase 1)

```
                         ┌──────────────────────────── Frontend (React) ────────────────────────────┐
                         │ Dashboard · Oportunidades · Detalle · Experimentos · Finanzas · Agentes  │
                         │ Historial de decisiones · Alertas · Configuración                       │
                         └───────────────────────────────┬─────────────────────────────────────────┘
                                                         │ /api (cookie httpOnly)
┌────────────────────────────────────── Backend FastAPI ─┴────────────────────────────────────────┐
│ auth · rate limit · logs                                                                       │
│                                                                                                │
│  Investigador (+ perfiles) ──► research_results ──► candidatos ──┐                              │
│        │ Claude web_search / Brave                                ▼                             │
│        │                                          ┌──── pipeline.evaluate ────┐                 │
│  Usuario (manual) ────────────────────────────────►  1. Antifraude            │──► alerts       │
│                                                   │  2. Automatización        │──► decision_logs│
│  Experimentos / transacciones ──► observado ──────►  3. Rentabilidad          │                 │
│                                                   └───────────────────────────┘                 │
│  Monitor (programado) ──► platform_changes ──► REQUIERE_ACCION + alerta                         │
│  Capital ──► bloquea presupuestos que excedan lo disponible                                     │
│  FX (Frankfurter / CoinGecko) ──► fx_rates                                                      │
└───────────────────────────────────────────── SQLite ───────────────────────────────────────────┘
```

### Tablas

`users, opportunities, platforms, agents, agent_runs, experiments, experiment_logs, transactions,
earnings, expenses, withdrawals, risk_assessments, automation_tasks, alerts, research_results,
platform_changes, data_points, decision_logs, fx_rates`.

`transactions` es el libro mayor (monto original, moneda, tasa, fuente de la tasa, monto en MXN);
`earnings / expenses / withdrawals` guardan el detalle específico de cada tipo.

## 9. Hoja de ruta

- **Fase 1 (este MVP)**: todo lo anterior. Sin ejecución de automatizaciones.
- **Fase 2**: integraciones con APIs oficiales por plataforma (reportes de afiliados, saldos, marketplaces),
  tasa FIX de Banxico, calculador de minería con datos de red de fuentes oficiales, notificaciones
  (correo / Telegram Bot API), migraciones con Alembic, PostgreSQL.
- **Fase 3**: ejecución de automatizaciones *permitidas* (solo API oficial o cliente oficial), con
  aprobación humana por tarea, bitácora y botón de paro.
