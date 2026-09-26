# Agente directo

Asistente sobre la API de Claude, para usar desde **Telegram** o desde la terminal. Responde sin rodeos ni sermones y tiene perfiles especializados y herramientas: búsqueda web, lectura de páginas, archivos y comandos.

Es independiente del resto del repositorio; puedes copiar esta carpeta a donde quieras.

## Bot de Telegram (recomendado para el celular)

### 1. Crea el bot
1. En Telegram, abre **@BotFather** y envía `/newbot`.
2. Elige un nombre y un usuario que termine en `bot`.
3. BotFather te da un **token** del tipo `123456:ABC...`. Guárdalo y no lo compartas.

### 2. Publícalo en Railway (se puede hacer desde el celular)
1. Entra en https://railway.com e inicia sesión con GitHub.
2. **New Project → Deploy from GitHub repo** y elige este repositorio y la rama.
3. En **Settings → Root Directory**, escribe `agente-directo`. Railway detecta el `Dockerfile`.
4. En **Variables**, añade:
   - `ANTHROPIC_API_KEY`: tu clave de https://console.anthropic.com
   - `TELEGRAM_BOT_TOKEN`: el token de BotFather
   - `TELEGRAM_USUARIOS_PERMITIDOS`: déjalo vacío por ahora
5. Despliega. Escríbele `/id` a tu bot: te responde con tu ID numérico.
6. Pon ese número en `TELEGRAM_USUARIOS_PERMITIDOS` (varios, separados por comas) y vuelve a desplegar.

Solo los IDs de esa lista pueden usar el bot. Así nadie más gasta tu saldo de la API.

Cualquier servidor que ejecute Docker o Python sirve igual (Render, Fly.io, un VPS o tu PC). El bot usa *long polling*, así que no necesita dominio ni HTTPS.

### 3. Úsalo
- Escríbele normalmente. También puedes mandarle **fotos, PDFs y archivos de texto** con una instrucción en el pie.
- `/nuevo` empieza una conversación nueva; `/perfil programador` cambia de perfil; `/perfil` muestra los disponibles.
- Los textos largos y el código te llegan como archivo adjunto.
- Opcional: `AGENTE_PERFIL`, `AGENTE_MODELO` (p. ej. `claude-sonnet-5`, más barato) y `AGENTE_ESFUERZO` (`low`, `medium` o `high`).

El historial se guarda en memoria: se borra si el servidor se reinicia.

## Terminal: instalación

```bash
cd agente-directo
python3 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
export ANTHROPIC_API_KEY="sk-ant-..."                # Windows: set ANTHROPIC_API_KEY=sk-ant-...
```

Consigue la clave en https://console.anthropic.com → API Keys. Se cobra por uso.

## Terminal: uso

```bash
python agente.py                     # perfil general
python agente.py -p investigador     # investiga en la web y cita fuentes
python agente.py -p programador      # escribe, guarda y prueba código
python agente.py -p redactor         # textos, ficción, marketing
python agente.py --esfuerzo low      # más rápido y barato
python agente.py --modelo claude-sonnet-5   # modelo más económico
```

Dentro del chat: `/perfiles`, `/perfil <nombre>`, `/nuevo` (borra el historial) y `/salir`.

## Herramientas (terminal)

| Herramienta | Qué hace |
|---|---|
| `web_search` / `web_fetch` | Busca en internet y lee páginas (se ejecuta en los servidores de Anthropic) |
| `listar_archivos`, `leer_archivo`, `escribir_archivo` | Trabajan solo dentro de `espacio/` |
| `ejecutar_comando` | Ejecuta comandos en `espacio/`, **siempre con tu aprobación** |

## Personalizar

- **Estilo general:** edita `perfiles/base.md`. Ahí está definido el tono directo.
- **Nuevo perfil:** crea `perfiles/<nombre>.md` con sus instrucciones y úsalo con `-p <nombre>`.
- **Variables de entorno:** `AGENTE_MODELO`, `AGENTE_ESFUERZO`, `AGENTE_ESPACIO` (carpeta de trabajo).

## Límites

El agente habla con franqueza de temas adultos, polémicos o técnicos, pero sigue sujeto a las políticas de uso de Anthropic. Si el modelo rechaza una petición, la API pasa primero a un modelo alternativo (`fallbacks: "default"`). Si ese también la rechaza, verás un aviso y la conversación sigue.
