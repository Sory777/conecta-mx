# DJ MIX PRO: análisis, arquitectura y plan técnico

Estado: **Fase 1 completada** (interfaz, Deck A/B, reproducción, mixer y crossfader).

---

## 1. Análisis de requisitos

Hay dos tipos de requisitos con exigencias muy distintas:

| Grupo | Ejemplos | Exigencia |
|---|---|---|
| **Tiempo real (audio)** | reproducción, pitch, EQ, filtro, crossfader, loops, sync, FX, sampler, grabación | Sin cortes. Latencia baja y estable. Todo el procesamiento ocurre en el hilo de audio. |
| **Análisis (offline)** | waveform, BPM, beatgrid, tonalidad, energía, DJ Assist | Cálculo pesado (segundos por pista). Debe ejecutarse fuera del hilo de la UI y fuera del hilo de audio. |
| **Datos** | biblioteca, playlists, historial, grabaciones, ajustes | Persistencia local (IndexedDB / sistema de archivos) y, más adelante, sincronización en la nube. |
| **Servicios** | cuentas, suscripciones, IA remota opcional | Requieren servidor y tiendas de apps. |

La regla de rendimiento (punto 19) se traduce en una regla de arquitectura: **el audio nunca espera a la UI**. La UI envía órdenes al motor y lee su estado. El motor no depende de React.

## 2. Tecnología recomendada

### Recomendación: Web Audio API + AudioWorklet (TypeScript), UI en React, empaquetado con Capacitor

Opciones evaluadas:

| Opción | Latencia / DSP | Esfuerzo | Veredicto |
|---|---|---|---|
| **Web (Web Audio + AudioWorklet) → PWA + Capacitor** | Nodos nativos del navegador (filtros, compresor, convolución, delay) en C++. DSP propio en AudioWorklet, en el hilo de audio. Latencia típica de 10 a 40 ms en Android/escritorio y unos 5 a 20 ms en iOS. | Un solo código para móvil, tablet y escritorio. | **Elegida para las fases 1 a 6** |
| React Native / Flutter con un motor nativo (Superpowered, JUCE, Oboe/AAudio + AVAudioEngine) | La mejor latencia posible (por debajo de 10 ms) y time-stretch de calidad profesional. | Motor de audio escrito dos veces (iOS y Android) o licencia comercial. Mucho más lento de iterar. | Ruta de migración si la web no alcanza |
| Nativo puro (Swift + Kotlin) | La mejor | Dos aplicaciones completas | Descartada por ahora |

¿Por qué la web es viable para un DJ profesional?

- `AudioWorklet` ejecuta nuestro código en el **hilo de audio en tiempo real**. Ahí vive la posición de lectura de cada deck, con precisión de muestra. Desde ese hilo se pueden implementar loops, sync, scratch y time-stretch sin cortes.
- Los nodos de EQ, filtro, compresor, delay y reverb están implementados en C++ dentro del navegador.
- Todos los decks comparten **un solo `AudioContext`**, es decir, un único reloj. Eso es la base para un sync exacto.

**Plan de escape:** el motor está detrás de una interfaz propia (`Deck`, `Mixer`, `AudioEngine`). Si en dispositivos reales la latencia o el time-stretch no son suficientes, se puede sustituir por un motor nativo (por ejemplo, Superpowered o JUCE vía plugin de Capacitor) sin reescribir la UI.

Stack actual: Vite 7, React 18, TypeScript estricto, Zustand (estado de UI), Vitest (unitarias) y Playwright con Chromium (E2E).

## 3. Limitaciones reales de la plataforma (sin simular)

| Función | ¿Web? | Detalle |
|---|---|---|
| Reproducción, pitch, EQ, filtro, crossfader, medidores | ✅ Sí | Implementado y verificado en Fase 1. |
| Pitch **con** cambio de tono (vinilo) | ✅ Sí | Es el comportamiento actual de la Fase 1. |
| **Key lock / Master Tempo** (cambiar tempo sin cambiar tono) | ⚠️ Requiere DSP propio | Hay que escribir un time-stretch (WSOLA o phase vocoder) en el AudioWorklet, o usar una librería: SoundTouch (portado a JS/WASM, licencia LGPL) o Rubber Band en WASM (licencia GPL/comercial). Calidad aceptable en WASM. La calidad "de club" se logra con un motor nativo comercial. Previsto para la Fase 3. |
| **Auriculares (CUE) separados del master** | ⚠️ Con condiciones | Un `AudioContext` sólo tiene una salida. Ya están implementados tres modos: **Estéreo**, **Split** (cable divisor: master mono a la derecha y cue mono a la izquierda) y **4 canales** (si la interfaz expone ≥ 4 canales, por ejemplo una controladora con tarjeta de sonido). Usar dos dispositivos de salida distintos a la vez exige dos contextos sincronizados, lo que provoca deriva de reloj. No es fiable en web; requiere código nativo. |
| Waveform, BPM, beatgrid y tonalidad | ✅ Procesamiento local | En Web Workers, sobre audio decodificado. Tonalidad: chroma + perfiles de Krumhansl, o Essentia.js (WASM, licencia AGPL, revisar antes de usarla comercialmente). Todo se calcula en local, sin servidor. |
| Formatos MP3, WAV, AAC, M4A | ✅ Sí, con matices | `decodeAudioData` usa los códecs del sistema. MP3 y WAV funcionan en todas partes. AAC y M4A funcionan en Safari y Chrome. En Firefox/Linux dependen del sistema. Los archivos con DRM (por ejemplo, de Apple Music) **no** se pueden decodificar, y no se intentará evitarlo. |
| Grabación de la mezcla | ✅ Sí | `MediaRecorder` (WebM/Opus o MP4/AAC según el navegador) o captura PCM en un worklet para exportar WAV sin pérdida. El nodo `masterTap` ya está preparado. |
| Exportar o compartir archivos | ⚠️ Según la plataforma | Descarga en escritorio. En móvil, Web Share API o Capacitor Filesystem/Share. |
| Biblioteca persistente | ✅ Sí | IndexedDB para metadatos y análisis. Con la File System Access API (sólo Chromium) se guarda el acceso a carpetas. En iOS hay que reimportar los archivos o guardarlos en el almacenamiento de la app (Capacitor). |
| Audio en segundo plano / pantalla bloqueada | ❌ Limitado | iOS suspende el audio web en segundo plano. Requiere app nativa (Capacitor + plugin de audio en segundo plano). |
| Controladoras MIDI | ⚠️ Parcial | Web MIDI funciona en Chrome/Edge/Android, pero no en Safari/iOS. |
| IA DJ / DJ Assist | ✅ Local al inicio | Reglas sobre BPM, tonalidad (rueda Camelot), energía y estructura: todo en local. Modelos más avanzados (detección de secciones, stems) requieren WASM/ONNX en local o un servidor. |
| Cuentas, suscripciones y pagos | ❌ Requiere servidor | Backend (por ejemplo, Supabase/Firebase) y, en móvil, compras dentro de la app (StoreKit / Google Play Billing vía RevenueCat o similar). Las tiendas exigen su propio sistema de pago para contenido digital. |

## 4. Partes técnicamente difíciles

1. **Sync que se mantiene en el tiempo:** igualar el BPM es fácil; mantener la fase de los beats durante minutos exige un beatgrid preciso y una corrección continua de fase en el hilo de audio (PLL suave sobre el rate).
2. **Detección de BPM y beatgrid fiable:** onset detection + autocorrelación o comb filter, más un ajuste fino del primer downbeat. Los géneros con tempo variable o síncopas fuertes fallan. Por eso hay que permitir edición manual del grid.
3. **Key lock de buena calidad** (ver arriba).
4. **Latencia en móviles:** depende del dispositivo. Hay que medirla (ya se muestra en la barra superior) y compensarla en la grabación y en el sync con fuentes externas.
5. **Waveform a 60 fps con zoom** en móviles de gama media: se precalculan picos multirresolución en un Worker y se dibujan en Canvas (WebGL si hace falta). Nunca se recalculan en cada frame.
6. **Memoria:** una pista de 6 minutos decodificada ocupa unos 120 MB en float32 estéreo. Con 4 decks, sampler y análisis hay que liberar el audio de las pistas expulsadas y, en móviles, considerar almacenar en int16.
7. **Multitáctil:** varios dedos sobre faders y knobs a la vez. Resuelto con Pointer Events y pointer capture por control.

## 5. Arquitectura y estructura de carpetas

```
dj-mix-pro/
├─ docs/ARQUITECTURA.md
├─ scripts/smoke-test.mjs          # E2E en Chromium real
└─ src/
   ├─ app/                         # Shell de la app, pantallas, (futuro) rutas
   ├─ ui/                          # SOLO presentación
   │  ├─ controls/                 #   Knob, Fader, Meter, gestos táctiles
   │  ├─ deck/                     #   DeckPanel, TrackStrip (→ Waveform en F2)
   │  ├─ mixer/                    #   MixerPanel
   │  ├─ layout/                   #   TopBar, ajustes
   │  ├─ useFrame.ts               #   bucle rAF único para animaciones
   │  └─ theme.css
   ├─ state/                       # Store de UI (Zustand), enlace UI ↔ motor
   ├─ engine/                      # MOTOR DE AUDIO (sin React)
   │  ├─ core/AudioEngine.ts       #   AudioContext único, crea decks y mixer
   │  ├─ deck/                     #   Deck (transporte, CUE, pitch), DeckPlayer
   │  ├─ worklets/                 #   Procesadores del hilo de audio
   │  ├─ mixer/                    #   ChannelStrip, Mixer, curvas, medidores
   │  ├─ effects/        (F4)      #   Effects Engine: Filter, Echo, Delay, Reverb, Flanger, Phaser, Beat Repeat
   │  ├─ sampler/        (F4)
   │  ├─ sync/           (F2)      #   Reloj maestro, corrección de fase
   │  └─ recorder/       (F5)
   ├─ analysis/          (F2)      # Waveform Engine, BPM Analyzer, Beat Detection, Key (en Web Workers)
   ├─ library/                     # Music Library
   │  └─ metadata/                 #   ID3, nombre de archivo (ya en F1)
   ├─ storage/           (F5)      # IndexedDB: pistas, análisis, playlists, grabaciones
   ├─ settings/          (F3)      # User Settings, modo Principiante/Pro
   ├─ ai/                (F6)      # AI Assistant, DJ Assist, Auto DJ
   ├─ account/           (F7)      # Auth, perfil (opcional, nunca obligatorio)
   ├─ monetization/      (F7)      # Entitlements Free/Pro (feature flags), sin pagos reales
   └─ shared/                      # utilidades puras (math, tiempo)
```

Reglas:

- `engine/` no importa nada de `ui/` ni de React. Se puede probar y reutilizar (o sustituir por un motor nativo).
- La UI **nunca** pasa datos de 60 fps por React. Posición y medidores se leen del motor en `requestAnimationFrame` y se escriben directamente en el DOM o el canvas.
- Las funciones de **mapeo** (curvas de EQ, filtro, faders, crossfader) son puras y tienen tests unitarios.
- Las funciones Pro se gatean con un servicio de **entitlements** (`can('sampler.advanced')`), no con `if` dispersos. Así el modo Principiante/Pro y Free/Pro comparten el mecanismo.

## 6. Motor de audio

```
                  hilo de audio (AudioWorklet)                       nodos nativos (C++)
 ┌─────────────────────────────┐
 │ DeckPlayer A                │   ┌──────── ChannelStrip A ───────────────────────────┐
 │  posición fraccional exacta │──▶│ GAIN → LOW → MID → HIGH → HPF → LPF ─┬─ FADER ─ XF ─┼─┐
 │  interpolación Hermite      │   │                                      ├─ CUE(PFL) ───┼─┼─▶ cue bus ─┐
 │  rate suavizado por muestra │   │                                      └─ medidor     │ │           │
 │  fundidos anti-clic         │   └───────────────────────────────────────────────────┘ │           │
 └─────────────────────────────┘                                                         ▼           ▼
 ┌─────────────────────────────┐   ┌──────── ChannelStrip B ───────┐           master bus      auriculares
 │ DeckPlayer B                │──▶│            (igual)            │──────────▶ MASTER VOL      (CUE/MST mix,
 └─────────────────────────────┘   └───────────────────────────────┘            → limitador      nivel)
                                                                                → masterTap ─┬─▶ medidor
                                                                                            └─▶ salida: Estéreo | Split | 4 canales
```

- **DeckPlayer (worklet):** recibe las muestras transferidas (sin copia extra) y mantiene la posición de lectura con precisión de submuestra. Aplica el rate con suavizado (sin "zipper"), usa interpolación cúbica y aplica fundidos de unos 3 ms en play, pausa y seek. Informa la posición cada unos 12 ms. El hilo principal la extrapola con `AudioContext.currentTime` para mostrarla a 60 fps.
  En las fases siguientes se le añaden, **dentro del mismo procesador**: loops (con crossfade en el punto de retorno), beat-jump, hot cues instantáneos, scratch (rate negativo) y time-stretch.
- **Deck:** lógica de transporte estilo reproductor de club:
  - CUE en pausa fija el punto.
  - CUE en reproducción vuelve al punto y pausa.
  - Mantener CUE previsualiza la pista.
  - PLAY mientras se mantiene CUE continúa la reproducción.
  - Pitch de ±8/16/50 % y pitch bend.
- **Mixer:**
  - EQ de 3 bandas: +6 dB / −40 dB, que es casi un kill. En la Fase 3 se añadirá un modo *isolator* con crossover Linkwitz-Riley para un kill total.
  - Filtro de un knob (izquierda LPF, derecha HPF) con zona muerta central.
  - Crossfader con curvas suave (potencia constante) y corte (scratch), y asignación A/THRU/B por canal, preparado para 4 decks.
  - Limitador de seguridad en el master.
  - Bus de cue (PFL) independiente.
- **Parámetros:** todos usan `setTargetAtTime` (unos 12 ms) para evitar clics al mover controles.
- **Análisis (F2):** Web Worker que recibe una copia mono submuestreada. Calcula picos de waveform multirresolución, onsets, BPM, beatgrid y tonalidad, y devuelve resultados que se guardan en IndexedDB (clave: hash del archivo) para no repetir el análisis.

## 7. Fases

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Interfaz, Deck A/B, reproducción, mixer (gain, EQ, filtro, fader, cue), crossfader, master | ✅ Hecha y verificada |
| 2 | Waveform (zoom, scroll, colores por deck), BPM, beatgrid, sync (tempo + fase) | Pendiente |
| 3 | 8 hot cues, loops 1–32 beats y manuales, key lock, EQ isolator, modos Principiante/Pro | Pendiente |
| 4 | FX (Filter, Echo, Delay, Reverb, Flanger, Phaser, Beat Repeat) sincronizados al BPM, sampler de 8 pads | Pendiente |
| 5 | Biblioteca (IndexedDB), playlists, favoritos, historial, grabación (REC/pausa/stop, Mis grabaciones, exportar) | Pendiente |
| 6 | Compatibilidad IA (BPM, Camelot, puntos de entrada y salida como *sugerencias*), DJ Assist, Auto DJ | Pendiente |
| 7 | Cuentas opcionales, entitlements Free/Pro, arquitectura de suscripción (sin cobros reales) | Pendiente |

### Verificación de la Fase 1

- `npm test`: 16 pruebas unitarias (curvas del mixer, formato de tiempo, ID3 y nombres de archivo).
- `npm run build && npm run e2e`: 26 comprobaciones en Chromium real con audio generado. Se mide el audio que sale por el master, no sólo la UI:
  - El deck avanza en tiempo real.
  - Con el pitch a +8 %, la velocidad medida es 1.0800.
  - EQ LOW kill: −11 → −49 dBFS sobre un tono de 60 Hz.
  - Filtro LPF: −9 → −79 dBFS sobre un tono de 5 kHz.
  - El crossfader y el fader de canal silencian el canal correspondiente.
  - CUE: fijar punto, volver, previsualizar mientras se mantiene y regresar al soltar.
  - Seek por la barra de posición.
  - Modo de salida Split.
  - Sin desbordamiento de layout en 844×390, 1024×768, 1920×1080 y 390×844.
  - Sin errores de consola.
