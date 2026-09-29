# Passive Income Agent Hub

Central de agentes de IA para **investigar, verificar, medir y comparar** fuentes de ingresos
complementarios o semipasivos desde México. No promete dinero: separa siempre
**DATOS OBSERVADOS · ESTIMACIÓN · SUPOSICIÓN · PROMESA DE LA PLATAFORMA · NO VERIFICADA**.

Análisis de arquitectura, problemas detectados, APIs, costos y riesgos: [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

## Qué incluye la Fase 1 (MVP)

| Módulo | Qué hace |
|---|---|
| Dashboard | Ingresos hoy / semana / mes / histórico, estimado vs real, capital, estados, alertas, gráfica de 30 días |
| Oportunidades | Tabla con inversión, ingreso estimado, costo, neto, horas, riesgo, automatización y estado; modos **Sin inversión**, **Bajo riesgo**, **Automatización máxima**, **Dentro de mi capital** |
| Agente Investigador (+ perfiles: microtareas, encuestas, minería, DePIN, afiliados, productos digitales, IA) | Búsqueda web actual con fuentes guardadas (URL, fecha, proveedor, contenido) y extracción estructurada |
| Agente Antifraude | Reglas (garantías, % diario, depósitos para retirar, frases semilla, reclutamiento…), antigüedad del dominio vía RDAP, revisión IA con cita obligatoria → BAJO / MEDIO / ALTO / DESCARTAR |
| Agente de Rentabilidad | Neto mensual, neto por hora, ROI, recuperación, electricidad, depreciación, comisiones; 3 escenarios, confianza por evidencia, calibración con historial |
| Agente de Automatización | Nivel 0/25/50/75/100% respetando términos de servicio; lista de lo que se puede y NO se puede automatizar. **No ejecuta nada en Fase 1** |
| Monitor (investigación continua) | Detecta cambios en términos/páginas oficiales y marca REQUIERE ACCIÓN |
| Experimentos | Duración, objetivo, presupuesto; registro diario; comparación estimación vs resultado real; recomendación CONTINUAR / MODIFICAR / ABANDONAR |
| Ingresos, gastos y retiros | Multimoneda (MXN, USD, EUR, BTC, …) con tasa y fuente guardadas |
| Capital | Disponible, comprometido, invertido, recuperado, ganancia, pérdida; bloquea presupuestos que excedan el límite |
| Alertas | Nueva oportunidad, cambio de plataforma, deja de ser rentable, retiro disponible, objetivo, problema de cuenta, inversión sobre el límite, sospechosa |
| Historial de decisiones | Cada agente explica qué encontró, con qué datos, riesgos y por qué decidió |

**Sin datos semilla**: la base inicia vacía. No se precargan plataformas ni cifras para no presentar
información no verificada como real. Las oportunidades se agregan con el investigador o manualmente.

## Requisitos

- Python 3.11+
- Node.js 18+ (probado con 22)
- Opcional: `ANTHROPIC_API_KEY` (búsqueda web + extracción con Claude) o `BRAVE_API_KEY`

## Instalación

```bash
# Backend
cd passive-income-agent-hub/backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(48))"   # pega el resultado en SECRET_KEY

# Frontend
cd ../frontend
npm install
```

## Ejecución

**Desarrollo** (dos terminales):

```bash
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000
cd frontend && npm run dev          # http://localhost:5173 (proxy /api → :8000)
```

**Un solo proceso** (el backend sirve el frontend compilado):

```bash
cd frontend && npm run build
cd ../backend && uvicorn app.main:app --port 8000   # http://localhost:8000
```

La primera vez, la pantalla de acceso te pide crear la cuenta. Después el registro queda cerrado
(`ALLOW_REGISTRATION=false`).

## Pruebas

```bash
cd backend && source .venv/bin/activate && python -m pytest -q
cd frontend && npm run build      # incluye verificación de tipos
```

Las pruebas nunca salen a Internet (RDAP, tasas de cambio y Claude se simulan).

## Flujo recomendado

1. **Configuración** → define tu capital (p. ej. $5,000 MXN) y tu ingreso mínimo aceptable por hora.
2. **Agentes** → ejecuta el investigador o un perfil (DePIN, encuestas…). Todo entra como INVESTIGANDO / NO VERIFICADO.
3. **Oportunidad** → revisa fuentes, verifica la plataforma (México, términos, pagos), corrige datos
   y agrega los tuyos con su tipo de evidencia. Sin datos de ingreso **no se calcula nada**.
4. **Experimento** → prueba con presupuesto y duración acotados; registra minutos, tareas, ingresos,
   gastos, bloqueos y retiros cada día.
5. **Finaliza** → compara estimación vs real. El resultado alimenta la calibración de la categoría.

## Seguridad

- Contraseñas con scrypt (sal aleatoria); sesión JWT en cookie `httpOnly`, `SameSite=Strict`
  (`COOKIE_SECURE=true` detrás de HTTPS).
- Claves y configuración solo en `backend/.env` (ignorado por git). La API nunca devuelve claves.
- Límite de peticiones por IP (general y login) y límite diario de ejecuciones de investigación.
- Logs en `backend/logs/app.log` (rotación 5 × 5 MB); ejecuciones de agentes en `agent_runs`.
- No se almacenan credenciales de plataformas de terceros.

## Estructura

```
backend/app/
  agents/        researcher, antifraud, profitability, automation, monitor, pipeline, registry
  services/      llm (Claude), web (fetch/RDAP/Brave), fx, capital, records (alertas/decisiones)
  routers/       auth, settings, dashboard, opportunities, experiments, finance, agents, alerts
  models.py      esquema de BD · security.py · ratelimit.py · scheduler.py · main.py
backend/tests/   pruebas (sin red)
frontend/src/    páginas React + componentes
docs/            ARQUITECTURA.md
```

## Límites conocidos del MVP

- Las tablas se crean con `create_all`; no hay migraciones (Alembic en Fase 2). Si cambias el esquema, respalda `data/hub.db`.
- El límite de peticiones es en memoria (una sola instancia).
- Los agentes se ejecutan en segundo plano dentro del proceso web; una búsqueda con Claude puede tardar minutos.
- No calcula impuestos (ISR/IVA). Consulta a un contador.
