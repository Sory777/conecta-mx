# CursoAI

Plataforma de aprendizaje personalizada con IA: *tengo un objetivo → la IA entiende lo que necesito → crea mi camino → me enseña → comprueba si aprendí → detecta mis debilidades → adapta el curso → me lleva hasta el objetivo.*

Diseño técnico completo (arquitectura, flujo de generación, base de datos, IA, memoria, riesgos, costos, MVP): [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

## Stack

- **Frontend:** Vite + React 18 + TypeScript + Tailwind (mismo stack que Conecta MX, en este mismo repo).
- **Backend:** Cloudflare Worker (`worker/`) que sirve la SPA y la API `/api/*`.
- **Base de datos:** Cloudflare D1 (SQLite), migraciones en `migrations/`.
- **IA:** interfaz `AIProvider` (`worker/ai/provider.ts`) con dos implementaciones: `AnthropicProvider` (Claude) y `MockProvider` (determinista, solo para desarrollo y pruebas; bloqueado en producción).

## Desarrollo local

```bash
cd cursoai
npm install
cp .dev.vars.example .dev.vars      # AI_PROVIDER=mock por defecto
npm run db:migrate:local
npm run build                        # la SPA que sirve el Worker
npm run dev:api                      # http://localhost:8787 (app + API)
# opcional, con recarga en caliente del frontend:
npm run dev                          # http://localhost:5173 (proxy /api → 8787)
```

Para usar Claude de verdad en local, pon en `.dev.vars`:

```
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

## Pruebas

```bash
npm run typecheck && npm run lint
npm test                             # unitarias: dominio, corrección, seguridad, auth
# con `npm run dev:api` corriendo (AI_PROVIDER=mock):
npm run test:integration             # API: ciclo completo del MVP, biblioteca, tutor, seguridad
npm run test:e2e                     # UI con Playwright en iPhone, tablet y escritorio
# (si ya tienes Chromium instalado: PW_CHROMIUM_PATH=/ruta/a/chrome npm run test:e2e)
```

## Despliegue (Cloudflare)

1. `npx wrangler d1 create cursoai` y copia el `database_id` en `wrangler.jsonc`.
2. `npm run db:migrate:remote`
3. `npx wrangler secret put ANTHROPIC_API_KEY`
4. `npm run deploy`
5. (Opcional) Añade un dominio con `routes` en `wrangler.jsonc`, como hace Conecta MX.

Variables en `wrangler.jsonc` → `vars`: modelos por nivel (`MODEL_FAST`, `MODEL_STANDARD`, `MODEL_DEEP`), presupuesto diario global de IA (`AI_DAILY_BUDGET_USD`) y límite de llamadas a la IA por usuario y minuto (`AI_RATE_PER_MIN`).

## Qué falta para producción

| Falta | Impacto | Dónde se configura |
|---|---|---|
| `ANTHROPIC_API_KEY` | Sin ella, la API responde `503 ai_not_configured` en las funciones de IA (lo demás funciona). El comportamiento real de Claude **no se ha probado** todavía: las pruebas usan el proveedor mock. | `wrangler secret put` |
| `database_id` de D1 | Necesario para desplegar. | `wrangler.jsonc` |
| Proveedor de email | La recuperación de contraseña y la verificación de correo aún no existen. | Pendiente |
| Pagos | Los planes Gratis/Premium y sus límites ya están modelados (`users.plan`, `worker/guard.ts`), pero no hay cobro. | Pendiente |
