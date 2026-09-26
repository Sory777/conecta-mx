#!/usr/bin/env python3
"""Agente directo como bot de Telegram.

Variables de entorno:
    ANTHROPIC_API_KEY              clave de la API de Claude
    TELEGRAM_BOT_TOKEN             token que te da @BotFather
    TELEGRAM_USUARIOS_PERMITIDOS   IDs de Telegram autorizados, separados por comas
    AGENTE_MODELO / AGENTE_ESFUERZO / AGENTE_PERFIL   opcionales

Comandos en el chat: /nuevo, /perfil [nombre], /id
"""

import asyncio
import base64
import logging
import os
from dataclasses import dataclass, field

import anthropic
from telegram import Update
from telegram.constants import ChatAction
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

from agente import (
    ESFUERZO_POR_DEFECTO,
    HERRAMIENTAS_SERVIDOR,
    MAX_TOKENS,
    MODELO_POR_DEFECTO,
    cargar_sistema,
    perfiles_disponibles,
)

logging.basicConfig(format="%(asctime)s %(levelname)s %(message)s", level=logging.INFO)
logging.getLogger("httpx").setLevel(logging.WARNING)
log = logging.getLogger("bot")

PERFIL_POR_DEFECTO = os.environ.get("AGENTE_PERFIL", "general")
PERMITIDOS = {
    int(x) for x in os.environ.get("TELEGRAM_USUARIOS_PERMITIDOS", "").replace(" ", "").split(",") if x
}
MAX_MENSAJES = 60           # historial máximo por chat antes de recortar los turnos más viejos
MAX_TELEGRAM = 4000         # Telegram corta los mensajes en 4096 caracteres
MAX_DESCARGA = 20 * 1024**2  # límite de descarga de archivos de la API de bots

NOTA_TELEGRAM = """

Contexto: hablas con el usuario por Telegram desde su celular.
- Tu texto se muestra sin formato: no uses tablas ni encabezados Markdown; usa listas simples y párrafos cortos.
- Para textos largos, código o informes, usa la herramienta enviar_archivo y resume en el chat lo que enviaste."""

HERRAMIENTA_ARCHIVO = {
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
}


@dataclass
class Chat:
    perfil: str = PERFIL_POR_DEFECTO
    mensajes: list = field(default_factory=list)
    candado: asyncio.Lock = field(default_factory=asyncio.Lock)


chats: dict[int, Chat] = {}
cliente = anthropic.AsyncAnthropic()


# --------------------------------------------------------------------------- utilidades

def trozos(texto: str):
    """Divide un texto en partes que caben en un mensaje de Telegram, cortando por líneas."""
    while len(texto) > MAX_TELEGRAM:
        corte = texto.rfind("\n", 0, MAX_TELEGRAM)
        if corte <= 0:
            corte = MAX_TELEGRAM
        yield texto[:corte]
        texto = texto[corte:].lstrip("\n")
    if texto.strip():
        yield texto


def es_inicio_de_turno(mensaje: dict) -> bool:
    if mensaje["role"] != "user":
        return False
    contenido = mensaje["content"]
    return isinstance(contenido, str) or not any(b.get("type") == "tool_result" for b in contenido)


def recortar_historial(mensajes: list) -> None:
    """Borra los turnos más antiguos, siempre desde el inicio de un turno para no romper el historial."""
    if len(mensajes) <= MAX_MENSAJES:
        return
    for i in range(len(mensajes) - MAX_MENSAJES, len(mensajes)):
        if es_inicio_de_turno(mensajes[i]):
            del mensajes[:i]
            return
    mensajes.clear()


async def escribiendo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Mantiene visible «escribiendo...» mientras el agente trabaja."""
    while True:
        await context.bot.send_chat_action(update.effective_chat.id, ChatAction.TYPING)
        await asyncio.sleep(4)


# --------------------------------------------------------------------------- agente

async def turno(chat: Chat, update: Update) -> bool:
    """Ejecuta el turno completo y va enviando las respuestas. Devuelve False si el modelo rechazó la petición."""
    sistema = cargar_sistema(chat.perfil) + NOTA_TELEGRAM
    while True:
        respuesta = await cliente.beta.messages.create(
            model=MODELO_POR_DEFECTO,
            max_tokens=MAX_TOKENS,
            system=[{"type": "text", "text": sistema, "cache_control": {"type": "ephemeral"}}],
            tools=HERRAMIENTAS_SERVIDOR + [HERRAMIENTA_ARCHIVO],
            thinking={"type": "adaptive"},
            output_config={"effort": ESFUERZO_POR_DEFECTO},
            cache_control={"type": "ephemeral"},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            messages=chat.mensajes,
        )
        if respuesta.stop_reason == "refusal":
            await update.message.reply_text("El modelo no quiso responder a esto. Reformula la petición o da más contexto.")
            return False

        chat.mensajes.append({"role": "assistant", "content": respuesta.content})
        resultados = []
        for bloque in respuesta.content:
            if bloque.type == "text":
                for parte in trozos(bloque.text):
                    await update.message.reply_text(parte, disable_web_page_preview=True)
            elif bloque.type == "tool_use":
                resultados.append(await ejecutar_herramienta(bloque, update))

        if respuesta.stop_reason == "tool_use":
            chat.mensajes.append({"role": "user", "content": resultados})
            continue
        if respuesta.stop_reason == "pause_turn":
            continue
        if respuesta.stop_reason == "max_tokens":
            await update.message.reply_text("(Respuesta cortada por longitud. Escribe «continúa» para seguir.)")
        return True


async def ejecutar_herramienta(bloque, update: Update) -> dict:
    resultado = {"type": "tool_result", "tool_use_id": bloque.id}
    if bloque.name != "enviar_archivo":
        return resultado | {"content": f"Error: herramienta desconocida {bloque.name}", "is_error": True}
    nombre = os.path.basename(bloque.input["nombre"]) or "archivo.txt"
    datos = bloque.input["contenido"].encode("utf-8")
    try:
        await update.message.reply_document(document=datos, filename=nombre)
    except Exception as e:  # noqa: BLE001 - cualquier fallo de Telegram se le devuelve al modelo
        return resultado | {"content": f"Error al enviar el archivo: {e}", "is_error": True}
    return resultado | {"content": f"Archivo {nombre} enviado ({len(datos)} bytes)."}


async def procesar(update: Update, context: ContextTypes.DEFAULT_TYPE, contenido: list) -> None:
    chat = chats.setdefault(update.effective_chat.id, Chat())
    async with chat.candado:
        recortar_historial(chat.mensajes)
        inicio = len(chat.mensajes)
        chat.mensajes.append({"role": "user", "content": contenido})
        indicador = asyncio.create_task(escribiendo(update, context))
        ok = False
        try:
            ok = await turno(chat, update)
        except anthropic.AuthenticationError:
            await update.message.reply_text("La clave de la API no es válida. Revisa ANTHROPIC_API_KEY en el servidor.")
        except anthropic.RateLimitError:
            await update.message.reply_text("Límite de uso alcanzado; espera un momento y reintenta.")
        except anthropic.APIStatusError as e:
            log.exception("Error de la API")
            await update.message.reply_text(f"Error de la API ({e.status_code}). Intenta de nuevo.")
        except anthropic.APIConnectionError:
            await update.message.reply_text("El servidor no pudo conectarse con la API. Intenta de nuevo.")
        finally:
            indicador.cancel()
            if not ok:
                del chat.mensajes[inicio:]  # deshace el turno fallido para que el historial siga siendo válido


# --------------------------------------------------------------------------- manejadores de Telegram

def autorizado(update: Update) -> bool:
    return update.effective_user is not None and update.effective_user.id in PERMITIDOS


async def rechazar(update: Update) -> None:
    await update.message.reply_text(
        f"No tienes acceso a este bot.\nTu ID de Telegram es {update.effective_user.id}; "
        "el dueño debe añadirlo a TELEGRAM_USUARIOS_PERMITIDOS."
    )


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not autorizado(update):
        return await rechazar(update)
    chat = chats.setdefault(update.effective_chat.id, Chat())
    await update.message.reply_text(
        f"Hola. Soy tu agente directo (perfil: {chat.perfil}).\n\n"
        "Escríbeme lo que necesites, o mándame fotos y PDFs para analizarlos.\n\n"
        "/nuevo – empieza una conversación nueva\n"
        f"/perfil – cambia de perfil ({', '.join(perfiles_disponibles())})\n"
        "/id – muestra tu ID de Telegram"
    )


async def cmd_id(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(f"Tu ID de Telegram es {update.effective_user.id}")


async def cmd_nuevo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not autorizado(update):
        return await rechazar(update)
    chat = chats.setdefault(update.effective_chat.id, Chat())
    async with chat.candado:
        chat.mensajes.clear()
    await update.message.reply_text("Conversación nueva. ¿En qué te ayudo?")


async def cmd_perfil(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not autorizado(update):
        return await rechazar(update)
    chat = chats.setdefault(update.effective_chat.id, Chat())
    disponibles = perfiles_disponibles()
    if not context.args or context.args[0] not in disponibles:
        return await update.message.reply_text(
            f"Perfil actual: {chat.perfil}\nUsa /perfil <nombre>. Disponibles: {', '.join(disponibles)}"
        )
    async with chat.candado:
        chat.perfil = context.args[0]
        chat.mensajes.clear()
    await update.message.reply_text(f"Perfil cambiado a {chat.perfil}. Conversación nueva.")


async def al_texto(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not autorizado(update):
        return await rechazar(update)
    await procesar(update, context, [{"type": "text", "text": update.message.text}])


async def al_archivo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Fotos, PDFs y archivos de texto: se descargan y se pasan al modelo junto con el pie de foto."""
    if not autorizado(update):
        return await rechazar(update)
    mensaje = update.message
    adjunto = mensaje.photo[-1] if mensaje.photo else mensaje.document
    if adjunto.file_size and adjunto.file_size > MAX_DESCARGA:
        return await mensaje.reply_text("El archivo pesa más de 20 MB; Telegram no deja descargarlo.")
    datos = bytes(await (await adjunto.get_file()).download_as_bytearray())

    if mensaje.photo:
        bloque = {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg",
                                              "data": base64.b64encode(datos).decode()}}
    elif mensaje.document.mime_type == "application/pdf":
        bloque = {"type": "document", "source": {"type": "base64", "media_type": "application/pdf",
                                                 "data": base64.b64encode(datos).decode()}}
    elif mensaje.document.mime_type and mensaje.document.mime_type.startswith("image/"):
        bloque = {"type": "image", "source": {"type": "base64", "media_type": mensaje.document.mime_type,
                                              "data": base64.b64encode(datos).decode()}}
    else:
        try:
            texto = datos.decode("utf-8")
        except UnicodeDecodeError:
            return await mensaje.reply_text("Solo puedo leer fotos, PDFs y archivos de texto.")
        bloque = {"type": "text", "text": f"Archivo {mensaje.document.file_name}:\n\n{texto}"}

    instruccion = mensaje.caption or "Analiza esto."
    await procesar(update, context, [bloque, {"type": "text", "text": instruccion}])


def main() -> None:
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        raise SystemExit("Falta TELEGRAM_BOT_TOKEN (ver README).")
    if not PERMITIDOS:
        log.warning("TELEGRAM_USUARIOS_PERMITIDOS está vacío: nadie podrá usar el bot. "
                    "Escríbele /id al bot para conocer tu ID.")

    app = Application.builder().token(token).concurrent_updates(True).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("id", cmd_id))
    app.add_handler(CommandHandler("nuevo", cmd_nuevo))
    app.add_handler(CommandHandler("perfil", cmd_perfil))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, al_texto))
    app.add_handler(MessageHandler(filters.PHOTO | filters.Document.ALL, al_archivo))
    log.info("Bot en marcha (modelo %s, perfil %s)", MODELO_POR_DEFECTO, PERFIL_POR_DEFECTO)
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
