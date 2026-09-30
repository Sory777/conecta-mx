# ROADMAP — Misterios: El Otro Lado

Prioridad permanente: **que el juego sea divertido**. La economía complementa la experiencia; no la sustituye.

## ✅ MVP 1 (este entregable)

- [x] Menú principal, registro, inicio de sesión, recuperación de contraseña, verificación de correo (enlaces en consola en sandbox)
- [x] Creación de personaje con vista previa 3D
- [x] Mapa 3D pequeño: pueblo, plaza con fuente, caminos, bosque, casas, capilla con campanario y cementerio, pozo, casa abandonada con estudio, mina tapiada, túnel subterráneo
- [x] Movimiento, cámara en 3ª persona, colisiones, interacción; teclado/ratón, táctil (joystick + cámara) y gamepad
- [x] Día/noche compartido, niebla, lluvia, tormentas con relámpagos, linterna, farolas, sonido ambiental procedural, música dinámica y eventos de misterio (campana lejana, susurros, silueta en la niebla)
- [x] 1 NPC (Don Aurelio) y 1 misterio completo (Ep. 1) + 1 misterio de temporada nocturno (Ep. 3)
- [x] Pistas, diario, acertijos validados en servidor, inventario, rarezas
- [x] Moneda virtual, gemas (sandbox), puntos de recompensa con límites y canje sandbox con revisión
- [x] Guardado de progreso, posición y estado
- [x] Multijugador real (WebSocket autoritativo), shards, chat, grupos, invitaciones, cooperación, pistas compartidas, amigos, bloquear, reportar
- [x] Tienda de prueba, pase de temporada (gratis/premium), eventos con multiplicadores
- [x] Arquitectura de anuncios (sandbox con verificación en servidor), patrocinios en el mundo, marketplace (monedas, desactivado)
- [x] Antifraude, auditoría, rate limiting, roles
- [x] Panel administrativo y analíticas (incluida salud económica)
- [x] Pruebas automáticas (unitarias, integración multijugador, E2E con navegador)

## Fase 2 — Contenido y pulido (1–2 meses)

- [ ] Episodio 2 «La mina donde nadie quiere entrar» (nueva zona interior, tren de mina, acertijo cooperativo que requiere 2 jugadores simultáneos)
- [ ] Arte: modelos humanos riggeados con animaciones, texturas PBR, props; música compuesta
- [ ] Tutorial guiado y primeros 5 minutos optimizados (retención D1)
- [ ] Más NPC y diálogos ramificados; logros
- [ ] Emotes, fotografía in-game, más cosméticos
- [ ] Accesibilidad: subtítulos, tamaño de texto, daltonismo
- [ ] Localización (es-MX base → en, pt-BR)

## Fase 3 — Cliente nativo Unity (2–4 meses, en paralelo)

- [ ] Cliente Unity 6 (URP) para Android y PC contra el mismo servidor (`shared/protocol.ts` → C#)
- [ ] Importar contenido de `content/` (episodios, objetos) sin cambios
- [ ] Integraciones nativas: Google Play Billing (+ verificación de recibos en servidor), AdMob con **SSV** (verificación del lado del servidor), Play Integrity API
- [ ] Mantener el cliente web como versión instantánea/PWA

## Fase 4 — Producción y escala

- [ ] PostgreSQL gestionado + migraciones versionadas
- [ ] Redis: sesiones WS, grupos, limitadores, pub/sub entre nodos de juego
- [ ] Varios nodos de juego con afinidad por shard; balanceador con WSS
- [ ] Proveedor de correo real (SES/Resend/SMTP) y 2FA para administradores
- [ ] Observabilidad: métricas (Prometheus/Grafana), trazas, alertas; pipeline de analíticas a data warehouse
- [ ] Copias de seguridad, recuperación ante desastres, entornos staging/producción
- [ ] Colisiones/física autoritativas en servidor
- [ ] CAPTCHA en registro, WAF

## Fase 5 — Economía de valor real (sólo con cumplimiento legal)

Requisitos **previos** a activar `REAL_PAYOUTS_ALLOWED`:

- [ ] Asesoría legal por país (programas de lealtad, sorteos/premios, protección al consumidor, menores)
- [ ] Términos del programa de recompensas y política fiscal (retenciones, reportes)
- [ ] KYC/AML para canjes por encima de umbrales; proveedor de tarjetas de regalo/pagos (p. ej. Tremendous, Tango Card, PayPal Payouts)
- [ ] Datos reales de ingresos (≥ 60 días) para calibrar `usdCentsPer1000`, topes y presupuesto global
- [ ] Monitoreo de la relación recompensas/ingresos (< 30% objetivo)

Marketplace con dinero real entre jugadores: requiere además licencias/estructura de pagos de marketplace, facturación, disputas y contracargos. **No planificado** hasta que el resto sea sostenible.

## Temporadas (plan de contenido)

| Temporada | Tema | Contenido |
|---|---|---|
| T1 · Ecos de San Bartolo | La campana y la familia Morales | Ep. 1, Ep. 3 (nocturno), pase, Noche de Ánimas |
| T2 · Bajo la montaña | La mina | Ep. 2, zona de la mina, herramientas de minero, eventos cooperativos |
| T3 · El tren que no llega | Estación abandonada | Nueva zona, vehículos (bicicleta usable), misterios por horario |
