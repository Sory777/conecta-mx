# Operación

## Puesta en marcha con Supabase

1. Crea un proyecto en Supabase (plan Pro recomendado en producción por PITR y backups).
2. Aplica las migraciones en orden: `supabase db push` (CLI) o pega cada archivo de `supabase/migrations/` en el editor SQL.
3. Carga los datos demostrativos: `npm run seed:sql` y ejecuta `supabase/seed.sql`.
4. Copia `.env.example` a `.env.local` y rellena `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y, sólo en el servidor, `SUPABASE_SERVICE_ROLE_KEY`.
5. Crea tu usuario (página **Entrar**) y asígnale rol desde el editor SQL:
   ```sql
   insert into public.admin_users (user_id, role)
   select id, 'admin' from auth.users where email = 'tu@correo';
   ```
6. En Supabase Auth, añade `https://TU-DOMINIO/auth/callback` a las URLs de redirección.

## Despliegue

* **Vercel**: importar el directorio `herbanatura/`, configurar variables de entorno. Cron: `vercel.json` incluido (`/api/cron/literature` diario) — define `CRON_SECRET`; Vercel envía `Authorization: Bearer <CRON_SECRET>`.
* **Cloudflare Workers**: `npm i -D @opennextjs/cloudflare wrangler`, `npx opennextjs-cloudflare build && npx opennextjs-cloudflare deploy`. Programa el cron con Cron Triggers llamando a `/api/cron/literature` con la cabecera `Authorization`.
* En ambos casos activa reglas de rate limiting del proveedor para `/api/*` (el limitador en memoria es sólo la primera barrera).

## Tareas programadas

| Tarea | Frecuencia | Cómo |
|---|---|---|
| Detección de nuevos estudios | diaria | `GET /api/cron/literature` con `Authorization: Bearer $CRON_SECRET` |
| Purga de consultas de IA (>30 días) | diaria | `select public.purge_old_ai_queries();` (pg_cron o cron de la plataforma con service role) |

## Copias de seguridad

* Supabase PITR (Pro) para restauración puntual.
* Copia lógica semanal adicional fuera del proveedor:
  ```bash
  pg_dump "$DATABASE_URL" --format=custom --no-owner --file=herbanatura-$(date +%F).dump
  # subir a R2/S3 con retención de 90 días
  ```
* Probar la restauración trimestralmente en un proyecto de staging.

## Pruebas

```bash
npm test            # unitarias: datos, buscador, triaje, guardas de IA
npm run db:test     # migraciones + seed + aserciones RLS en PostgreSQL local
HN_TEST_DB=herbanatura_test npm test   # paridad SQL ↔ TypeScript
npm run typecheck && npm run build
```

## Respuesta ante incidentes de contenido

Si se detecta una afirmación incorrecta: un revisor la marca como **rechazada** en `/admin/revision` (desaparece inmediatamente del público por RLS), se corrige y vuelve a revisión. Todo queda en `audit_logs` y `content_reviews`.
