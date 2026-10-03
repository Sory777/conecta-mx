# DJ MIX PRO

Mezcladora DJ profesional para web, móvil y tablet (optimizada para horizontal).
Motor de audio: Web Audio API + AudioWorklet. UI: React + TypeScript.

**Estado:** Fase 1. Dos decks, reproducción, CUE, pitch y pitch bend. Mixer con gain, EQ de 3 bandas, filtro, cue (PFL), faders, crossfader y master. Salida estéreo, split o de 4 canales.

Arquitectura, limitaciones de la plataforma y plan por fases: [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## Abrirla sin instalar nada

`release/dj-mix-pro.html` es la app completa en **un solo archivo**. Descárgalo y ábrelo con Chrome (también en Android). No necesita servidor.

## Android con Termux

```bash
pkg update && pkg install -y nodejs git
git clone https://github.com/sory777/conecta-mx.git
cd conecta-mx
git checkout ccr-dc3d4fa1-gq8l96   # la app está en esta rama, no en main
cd dj-mix-pro
npm install
npm run dev -- --host
```

Deja Termux abierto y entra en Chrome a **http://localhost:5173**. La app no se abre sola.

## Desarrollo

```bash
npm install
npm run dev        # desarrollo
npm test           # pruebas unitarias
npm run build      # typecheck + build de producción
npm run e2e        # prueba E2E en Chromium con audio real (requiere build)
```

Sólo trabaja con archivos de audio locales que tengas derecho a usar. No descarga música de plataformas ni elude DRM.
