# Agente directo

Asistente de terminal sobre la API de Claude. Responde sin rodeos ni sermones y tiene perfiles especializados y herramientas: búsqueda web, lectura de páginas, archivos y comandos.

Es independiente del resto del repositorio; puedes copiar esta carpeta a donde quieras.

## Instalación

```bash
cd agente-directo
python3 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
export ANTHROPIC_API_KEY="sk-ant-..."                # Windows: set ANTHROPIC_API_KEY=sk-ant-...
```

Consigue la clave en https://console.anthropic.com → API Keys. Se cobra por uso.

## Uso

```bash
python agente.py                     # perfil general
python agente.py -p investigador     # investiga en la web y cita fuentes
python agente.py -p programador      # escribe, guarda y prueba código
python agente.py -p redactor         # textos, ficción, marketing
python agente.py --esfuerzo low      # más rápido y barato
python agente.py --modelo claude-sonnet-5   # modelo más económico
```

Dentro del chat: `/perfiles`, `/perfil <nombre>`, `/nuevo` (borra el historial) y `/salir`.

## Herramientas

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
