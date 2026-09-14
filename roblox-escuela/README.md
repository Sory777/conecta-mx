# Conecta Escuela (Roblox)

Juego educativo para Roblox: una escuela virtual donde cada materia se estudia por
temas. Al entrar a un tema primero se ve un **video tutorial** y después se presenta un
**examen**; si se aprueba, se desbloquea el siguiente tema. Para **Matemáticas**
(y solo para Matemáticas, como se pidió) hay además un **examen de diagnóstico**: si el
alumno ya domina temas como las tablas de multiplicar o las tablas salteadas, el juego lo
coloca automáticamente en el tema que le corresponde en vez de obligarlo a repetir lo que
ya sabe.

## ⚠️ Aviso importante sobre "conectarme a Roblox"

No existe en este entorno ninguna integración/OAuth con la cuenta de Roblox ni con Roblox
Studio, así que no puedo publicar el juego por ti directamente. Lo que te entrego aquí es
**el código fuente completo y funcional** (Lua/Luau) listo para sincronizarse en Roblox
Studio con la herramienta gratuita **Rojo**. Tú (o quien administre la cuenta de Roblox)
necesita hacer la sincronización y publicar el lugar (place). Son ~10 minutos, instrucciones
abajo.

## Qué SÍ está implementado y funcional

- Vestíbulo jugable generado automáticamente (un kiosco por materia con letrero e
  interacción "Mantén E para estudiar").
- Sistema de materias → temas → video tutorial → examen → desbloqueo, 100% dirigido por
  datos (agregar contenido = editar una tabla, no escribir más código).
- Examen de diagnóstico/colocación **solo para Matemáticas**: hace un par de preguntas de
  cada tema en orden y coloca al alumno justo después del último tema que domina.
- Progreso guardado por jugador con DataStore (persiste entre sesiones), con reintentos y
  autoguardado.
- Todo el cálculo de respuestas correctas y el desbloqueo de niveles ocurre **en el
  servidor**: un exploit del lado del cliente no puede leer respuestas ni saltarse temas
  bloqueados.
- Contenido de ejemplo ya cargado: Matemáticas (10 temas, de sumas básicas hasta
  fracciones, cubriendo justo el rango donde iría un niño de 2° de primaria adelantado),
  Español, Ciencias Naturales e Inglés (con 2-3 temas de ejemplo cada una).

## Qué falta por tu parte (no es código, es contenido/administración)

1. **Grabar y subir los videos tutoriales.** Roblox no permite incrustar YouTube ni ningún
   reproductor web dentro del juego (política de la plataforma). Cada video debe subirse
   como asset de video propio desde el **Creator Dashboard** de Roblox
   (create.roblox.com → Videos), pasar la moderación, y su `rbxassetid://...` se pega en el
   campo `VideoId` del tema correspondiente en `src/ServerScriptService/Data/SubjectData.lua`.
   Mientras un tema no tenga video, el juego muestra "Video próximamente" y deja pasar al
   examen igual, para no trabar el avance.
2. **Completar el temario.** Ya está la estructura y el ejemplo de Primaria en varias
   materias. "Todas las materias que existen desde primaria hasta universidad" son miles de
   temas — no es realista tenerlos todos con contenido real en un solo entregable. El motor
   ya soporta cualquier cantidad de materias/grados/temas: agregar Secundaria, Preparatoria
   o Universidad es copiar el patrón de un tema y cambiar `Grade`, `Name` y `Questions` (ver
   la plantilla al final de `SubjectData.lua`).
3. **Decorar el vestíbulo/escuela.** `HubBuilderService.lua` crea kioscos simples de bloque
   para que el juego sea jugable de inmediato. Puedes modelar tu propia escuela en Studio;
   solo conserva en cada entrada el atributo `SubjectId` en la parte y un `ProximityPrompt`
   llamado `StudyPrompt` dentro de ella (o dime y te ayudo a adaptar el script a tu modelo).

## Cómo importarlo a Roblox Studio (con Rojo)

1. Instala el plugin **Rojo** en Roblox Studio (Toolbox → busca "Rojo") y, en tu compu, el
   CLI de Rojo: `cargo install rojo` o descárgalo de https://rojo.space (o `aftman add rojo`
   si usas Aftman).
2. Abre una terminal en la carpeta `roblox-escuela/` de este repositorio y ejecuta:
   ```
   rojo serve
   ```
3. En Roblox Studio, abre un lugar nuevo (o el tuyo), abre el plugin Rojo y dale **Connect**.
   Esto sincroniza automáticamente todos los scripts de `src/` a los servicios correctos
   (ReplicatedStorage, ServerScriptService, StarterPlayerScripts).
4. Dale Play (F5) — el vestíbulo con los kioscos aparece solo, y todo el flujo de
   materias/exámenes/diagnóstico ya funciona con contenido de ejemplo.
5. Cuando quede como quieras, usa **File → Publish to Roblox** para publicarlo.

## Estructura del código

```
roblox-escuela/
  default.project.json          <- config de Rojo
  src/
    ServerScriptService/
      Data/SubjectData.lua      <- TODO el contenido educativo (aquí se agregan materias/temas/preguntas)
      Services/
        RemotesService.lua      <- crea los RemoteFunctions
        PlayerDataService.lua   <- guardar/cargar progreso (DataStore)
        CatalogService.lua      <- versión pública y segura del contenido (sin respuestas)
        ExamService.lua         <- califica exámenes y desbloquea temas (servidor)
        DiagnosticService.lua   <- examen de colocación (solo materias con Diagnostic=true)
        HubBuilderService.lua   <- construye el vestíbulo con un kiosco por materia
      ServerMain.server.lua     <- arranca todo en el orden correcto
    StarterPlayer/StarterPlayerScripts/SchoolClient/
      Main.client.lua           <- conecta los kioscos con el flujo de UI
      LevelMenuUI.lua           <- lista de temas de una materia (bloqueado/disponible/completado)
      TutorialUI.lua            <- pantalla del video tutorial
      QuizUI.lua                <- pantalla de examen (opción múltiple), reusada por examen y diagnóstico
      ResultUI.lua              <- pantalla de resultado / resumen del diagnóstico
      UIUtil.lua                <- helpers para construir la interfaz
```

## Cómo agregar una materia o un grado nuevo

Abre `SubjectData.lua` y agrega un elemento a la tabla `Subjects` (o un elemento a
`Levels` de una materia existente). No hay que tocar ningún otro archivo: el catálogo, el
menú, los exámenes y el guardado de progreso leen esta tabla automáticamente. El orden de
la lista `Levels` es el orden de desbloqueo; `Grade` es solo el texto que se muestra
("2° Primaria", "1° Secundaria", "Universidad - Cálculo I", etc.).

## Notas de seguridad

- Las respuestas correctas (`Correct`) solo existen en `ServerScriptService`, que Roblox
  nunca replica al cliente. Lo que reciben los jugadores (`CatalogService.GetPublicCatalog`)
  no incluye ese campo.
- Todo examen se califica en el servidor contra los datos maestros; el cliente solo manda
  qué opción marcó, nunca si acertó.
- El servidor rechaza (`NIVEL_BLOQUEADO`) cualquier intento de presentar un examen de un
  tema que el jugador no tiene desbloqueado, aunque el cliente lo solicite directamente.
