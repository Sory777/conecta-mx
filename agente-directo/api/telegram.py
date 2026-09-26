"""Agente directo para Telegram, como función serverless de Vercel (modo webhook).

El historial de cada chat se guarda en Supabase (esquema privado `agente`), al que se accede
solo mediante funciones RPC protegidas con AGENTE_DB_SECRETO.

Variables de entorno:
    ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRETO, TELEGRAM_USUARIOS_PERMITIDOS,
    SUPABASE_URL, SUPABASE_ANON_KEY, AGENTE_DB_SECRETO
    Opcionales: AGENTE_MODELO, AGENTE_ESFUERZO, AGENTE_PERFIL

Rutas:
    POST /api/telegram                         webhook que llama Telegram
    GET  /api/telegram?configurar=<secreto>    registra el webhook en Telegram (una sola vez)
"""

import base64
import json
import logging
import os
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import anthropic
import httpx

log = logging.getLogger("agente")
logging.basicConfig(level=logging.INFO)

DIR_PERFILES = Path(__file__).resolve().parent.parent / "perfiles"
MODELO = os.environ.get("AGENTE_MODELO", "claude-opus-5")
ESFUERZO = os.environ.get("AGENTE_ESFUERZO", "high")
PERFIL_POR_DEFECTO = os.environ.get("AGENTE_PERFIL", "general")
TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
SECRETO_WEBHOOK = os.environ.get("TELEGRAM_WEBHOOK_SECRETO", "")
PERMITIDOS = {int(x) for x in os.environ.get("TELEGRAM_USUARIOS_PERMITIDOS", "").replace(" ", "").split(",") if x}
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SECRETO_DB = os.environ.get("AGENTE_DB_SECRETO", "")

MAX_TOKENS = 16000
MAX_MENSAJES = 40
MAX_TELEGRAM = 4000
MAX_DESCARGA = 20 * 1024**2
API_TG = f"https://api.telegram.org/bot{TOKEN}"

NOTA_TELEGRAM = """

Contexto: hablas con el usuario por Telegram desde su celular.
- Aquí solo tienes búsqueda web, lectura de páginas y enviar_archivo; no hay espacio de trabajo ni comandos.
- Tu texto se muestra sin formato: no uses tablas ni encabezados Markdown; usa listas simples y párrafos cortos.
- Para textos largos, código o informes, usa la herramienta enviar_archivo y resume en el chat lo que enviaste."""

HERRAMIENTAS = [
    {"type": "web_search_20260209", "name": "web_search", "max_uses": 8},
    {"type": "web_fetch_20260209", "name": "web_fetch", "max_uses": 8},
    {
        "name": "enviar_archivo",
        "description": (
            "Crea un archivo de texto (md, txt, py, csv, html, json...) y se lo envía al usuario por Telegram. "
            "Úsala para código, informes o textos largos que el usuario querrá guardar."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "nombre": {"type": "string", "description": "Nombre del archivo con extensión, p. ej. informe.md"},
                "contenido": {"type": "string", "description": "Contenido completo del archivo."},
            },
            "required": ["nombre", "contenido"],
            "additionalProperties": False,
        },
        "strict": True,
    },
]

http = httpx.Client(timeout=60)


# --------------------------------------------------------------------------- Telegram

def tg(metodo: str, **datos):
    r = http.post(f"{API_TG}/{metodo}", json=datos)
    if r.status_code != 200:
        log.warning("Telegram %s: %s", metodo, r.text[:300])
    return r.json()


def trozos(texto: str):
    while len(texto) > MAX_TELEGRAM:
        corte = texto.rfind("\n", 0, MAX_TELEGRAM)
        if corte <= 0:
            corte = MAX_TELEGRAM
        yield texto[:corte]
        texto = texto[corte:].lstrip("\n")
    if texto.strip():
        yield texto


def enviar(chat_id: int, texto: str) -> None:
    for parte in trozos(texto):
        tg("sendMessage", chat_id=chat_id, text=parte, link_preview_options={"is_disabled": True})


def enviar_documento(chat_id: int, nombre: str, datos: bytes) -> None:
    r = http.post(f"{API_TG}/sendDocument", data={"chat_id": chat_id}, files={"document": (nombre, datos)})
    r.raise_for_status()


def descargar(file_id: str) -> bytes:
    info = tg("getFile", file_id=file_id)["result"]
    r = http.get(f"https://api.telegram.org/file/bot{TOKEN}/{info['file_path']}")
    r.raise_for_status()
    return r.content


# --------------------------------------------------------------------------- Supabase

def rpc(funcion: str, **args):
    r = http.post(
        f"{SUPABASE_URL}/rest/v1/rpc/{funcion}",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
        json={"p_secreto": SECRETO_DB, **args},
    )
    r.raise_for_status()
    return r.json()


def cargar_chat(chat_id: int) -> dict:
    datos = rpc("agente_cargar", p_chat_id=chat_id) or {}
    return {"perfil": datos.get("perfil") or PERFIL_POR_DEFECTO, "mensajes": datos.get("mensajes") or []}


def guardar_chat(chat_id: int, chat: dict) -> None:
    rpc("agente_guardar", p_chat_id=chat_id, p_perfil=chat["perfil"], p_mensajes=chat["mensajes"])


# --------------------------------------------------------------------------- agente

def perfiles_disponibles() -> list[str]:
    return sorted(p.stem for p in DIR_PERFILES.glob("*.md") if p.stem != "base")


def cargar_sistema(perfil: str) -> str:
    if perfil not in perfiles_disponibles():
        perfil = "general"
    base = (DIR_PERFILES / "base.md").read_text(encoding="utf-8")
    return f"{base}\n\n{(DIR_PERFILES / f'{perfil}.md').read_text(encoding='utf-8')}{NOTA_TELEGRAM}"


def es_inicio_de_turno(m: dict) -> bool:
    if m["role"] != "user":
        return False
    return isinstance(m["content"], str) or not any(b.get("type") == "tool_result" for b in m["content"])


def recortar_historial(mensajes: list) -> None:
    if len(mensajes) <= MAX_MENSAJES:
        return
    for i in range(len(mensajes) - MAX_MENSAJES, len(mensajes)):
        if es_inicio_de_turno(mensajes[i]):
            del mensajes[:i]
            return
    mensajes.clear()


def a_json(contenido) -> list:
    return [b.model_dump(mode="json", exclude_none=True) for b in contenido]


def turno(chat_id: int, chat: dict) -> bool:
    """Ejecuta el turno y envía las respuestas. Devuelve False si el modelo rechazó la petición."""
    cliente = anthropic.Anthropic()
    sistema = cargar_sistema(chat["perfil"])
    mensajes = chat["mensajes"]
    while True:
        tg("sendChatAction", chat_id=chat_id, action="typing")
        respuesta = cliente.beta.messages.create(
            model=MODELO,
            max_tokens=MAX_TOKENS,
            system=[{"type": "text", "text": sistema, "cache_control": {"type": "ephemeral"}}],
            tools=HERRAMIENTAS,
            thinking={"type": "adaptive"},
            output_config={"effort": ESFUERZO},
            cache_control={"type": "ephemeral"},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            messages=mensajes,
        )
        if respuesta.stop_reason == "refusal":
            enviar(chat_id, "El modelo no quiso responder a esto. Reformula la petición o da más contexto.")
            return False

        mensajes.append({"role": "assistant", "content": a_json(respuesta.content)})
        resultados = []
        for bloque in respuesta.content:
            if bloque.type == "text":
                enviar(chat_id, bloque.text)
            elif bloque.type == "tool_use":
                resultados.append(ejecutar_herramienta(chat_id, bloque))

        if respuesta.stop_reason == "tool_use":
            mensajes.append({"role": "user", "content": resultados})
            continue
        if respuesta.stop_reason == "pause_turn":
            continue
        if respuesta.stop_reason == "max_tokens":
            enviar(chat_id, "(Respuesta cortada por longitud. Escribe «continúa» para seguir.)")
        return True


def ejecutar_herramienta(chat_id: int, bloque) -> dict:
    resultado = {"type": "tool_result", "tool_use_id": bloque.id}
    if bloque.name != "enviar_archivo":
        return resultado | {"content": f"Error: herramienta desconocida {bloque.name}", "is_error": True}
    nombre = os.path.basename(bloque.input["nombre"]) or "archivo.txt"
    datos = bloque.input["contenido"].encode("utf-8")
    try:
        enviar_documento(chat_id, nombre, datos)
    except httpx.HTTPError as e:
        return resultado | {"content": f"Error al enviar el archivo: {e}", "is_error": True}
    return resultado | {"content": f"Archivo {nombre} enviado ({len(datos)} bytes)."}


# --------------------------------------------------------------------------- mensajes entrantes

def contenido_del_mensaje(msg: dict):
    """Convierte un mensaje de Telegram en bloques para Claude, o devuelve un texto de error (str)."""
    if "text" in msg:
        return [{"type": "text", "text": msg["text"]}]
    adjunto = msg["photo"][-1] if "photo" in msg else msg.get("document")
    if not adjunto:
        return "Solo entiendo texto, fotos, PDFs y archivos de texto."
    if adjunto.get("file_size", 0) > MAX_DESCARGA:
        return "El archivo pesa más de 20 MB; Telegram no deja descargarlo."
    datos = descargar(adjunto["file_id"])
    b64 = base64.b64encode(datos).decode()
    tipo = "image/jpeg" if "photo" in msg else adjunto.get("mime_type", "")
    if tipo.startswith("image/"):
        bloque = {"type": "image", "source": {"type": "base64", "media_type": tipo, "data": b64}}
    elif tipo == "application/pdf":
        bloque = {"type": "document", "source": {"type": "base64", "media_type": tipo, "data": b64}}
    else:
        try:
            bloque = {"type": "text", "text": f"Archivo {adjunto.get('file_name', '')}:\n\n{datos.decode('utf-8')}"}
        except UnicodeDecodeError:
            return "Solo puedo leer fotos, PDFs y archivos de texto."
    return [bloque, {"type": "text", "text": msg.get("caption") or "Analiza esto."}]


def atender(update: dict) -> None:
    msg = update.get("message")
    if not msg or "from" not in msg:
        return
    chat_id, usuario = msg["chat"]["id"], msg["from"]["id"]
    texto = msg.get("text", "").strip()
    comando, _, argumento = texto.partition(" ")
    comando = comando.split("@")[0]

    if comando == "/id":
        return enviar(chat_id, f"Tu ID de Telegram es {usuario}")
    if usuario not in PERMITIDOS:
        return enviar(chat_id, f"No tienes acceso a este bot.\nTu ID de Telegram es {usuario}; "
                               "el dueño debe añadirlo a TELEGRAM_USUARIOS_PERMITIDOS.")
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return enviar(chat_id, "El bot aún no tiene configurada la clave de la API de Anthropic.")

    chat = cargar_chat(chat_id)
    if comando == "/start":
        return enviar(chat_id, f"Hola. Soy tu agente directo (perfil: {chat['perfil']}).\n\n"
                               "Escríbeme lo que necesites, o mándame fotos y PDFs para analizarlos.\n\n"
                               "/nuevo – empieza una conversación nueva\n"
                               f"/perfil – cambia de perfil ({', '.join(perfiles_disponibles())})\n"
                               "/id – muestra tu ID de Telegram")
    if comando == "/nuevo":
        chat["mensajes"] = []
        guardar_chat(chat_id, chat)
        return enviar(chat_id, "Conversación nueva. ¿En qué te ayudo?")
    if comando == "/perfil":
        argumento = argumento.strip()
        if argumento not in perfiles_disponibles():
            return enviar(chat_id, f"Perfil actual: {chat['perfil']}\n"
                                   f"Usa /perfil <nombre>. Disponibles: {', '.join(perfiles_disponibles())}")
        chat.update(perfil=argumento, mensajes=[])
        guardar_chat(chat_id, chat)
        return enviar(chat_id, f"Perfil cambiado a {argumento}. Conversación nueva.")

    contenido = contenido_del_mensaje(msg)
    if isinstance(contenido, str):
        return enviar(chat_id, contenido)

    recortar_historial(chat["mensajes"])
    inicio = len(chat["mensajes"])
    chat["mensajes"].append({"role": "user", "content": contenido})
    ok = False
    try:
        ok = turno(chat_id, chat)
    except anthropic.AuthenticationError:
        enviar(chat_id, "La clave de la API de Anthropic no es válida.")
    except anthropic.RateLimitError:
        enviar(chat_id, "Límite de uso alcanzado; espera un momento y reintenta.")
    except anthropic.APIStatusError as e:
        log.exception("Error de la API")
        enviar(chat_id, f"Error de la API ({e.status_code}). Intenta de nuevo.")
    except anthropic.APIConnectionError:
        enviar(chat_id, "El servidor no pudo conectarse con la API. Intenta de nuevo.")
    if not ok:
        del chat["mensajes"][inicio:]  # deshace el turno fallido para que el historial siga siendo válido
    guardar_chat(chat_id, chat)


# --------------------------------------------------------------------------- servidor HTTP

class handler(BaseHTTPRequestHandler):
    def _responder(self, codigo: int, cuerpo: str = "ok") -> None:
        self.send_response(codigo)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(cuerpo.encode())

    def do_GET(self):
        consulta = parse_qs(urlparse(self.path).query)
        if SECRETO_WEBHOOK and consulta.get("configurar", [""])[0] == SECRETO_WEBHOOK:
            url = f"https://{self.headers.get('host')}/api/telegram"
            r = tg("setWebhook", url=url, secret_token=SECRETO_WEBHOOK,
                   allowed_updates=["message"], drop_pending_updates=True)
            yo = tg("getMe")
            return self._responder(200, json.dumps({"setWebhook": r, "bot": yo.get("result")}, ensure_ascii=False))
        self._responder(200, "Agente directo en marcha.")

    def do_POST(self):
        if self.headers.get("X-Telegram-Bot-Api-Secret-Token") != SECRETO_WEBHOOK:
            return self._responder(403, "no autorizado")
        largo = int(self.headers.get("content-length", 0))
        update = json.loads(self.rfile.read(largo) or b"{}")
        try:
            # Telegram reintenta si tardamos; se atiende cada update una sola vez.
            if rpc("agente_marcar_update", p_update_id=update.get("update_id", 0)):
                atender(update)
        except Exception:  # noqa: BLE001 - siempre devolvemos 200 para que Telegram no reintente en bucle
            log.exception("Error atendiendo el update")
        self._responder(200)
