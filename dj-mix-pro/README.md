# DJ MIX PRO

Mezcladora DJ profesional para web, móvil y tablet (optimizada para horizontal).
Motor de audio: Web Audio API + AudioWorklet. UI: React + TypeScript.

**Estado:** Fase 1. Dos decks, reproducción, CUE, pitch y pitch bend. Mixer con gain, EQ de 3 bandas, filtro, cue (PFL), faders, crossfader y master. Salida estéreo, split o de 4 canales.

Arquitectura, limitaciones de la plataforma y plan por fases: [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

```bash
npm install
npm run dev        # desarrollo
npm test           # pruebas unitarias
npm run build      # typecheck + build de producción
npm run e2e        # prueba E2E en Chromium con audio real (requiere build)
```

Sólo trabaja con archivos de audio locales que tengas derecho a usar. No descarga música de plataformas ni elude DRM.
