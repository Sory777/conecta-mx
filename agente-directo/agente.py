#!/usr/bin/env python3
"""Agente directo: asistente de terminal sobre la API de Claude con perfiles y herramientas.

Uso:
    python agente.py                  # perfil general
    python agente.py -p programador   # otro perfil
    python agente.py -p redactor --modelo claude-sonnet-5

Comandos dentro del chat:
    /perfil <nombre>   cambia de perfil (reinicia la conversación)
    /perfiles          lista los perfiles disponibles
    /nuevo             borra el historial
    /salir             termina
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

import anthropic

RAIZ = Path(__file__).resolve().parent
DIR_PERFILES = RAIZ / "perfiles"
ESPACIO = Path(os.environ.get("AGENTE_ESPACIO", RAIZ / "espacio")).resolve()

MODELO_POR_DEFECTO = os.environ.get("AGENTE_MODELO", "claude-opus-5")
ESFUERZO_POR_DEFECTO = os.environ.get("AGENTE_ESFUERZO", "high")
MAX_TOKENS = 16000
MAX_SALIDA_HERRAMIENTA = 50_000  # caracteres devueltos al modelo por herramienta

# Herramientas de servidor: se ejecutan en la infraestructura de Anthropic.
HERRAMIENTAS_SERVIDOR = [
    {"type": "web_search_20260209", "name": "web_search", "max_uses": 8},
    {"type": "web_fetch_20260209", "name": "web_fetch", "max_uses": 8},
]

# Herramientas locales: se ejecutan en tu máquina, limitadas a ESPACIO.
HERRAMIENTAS_LOCALES = [
    {
        "name": "listar_archivos",
        "description": "Lista archivos y carpetas del espacio de trabajo. Úsala para ver qué hay antes de leer o escribir.",
        "input_schema": {
            "type": "object",
            "properties": {
                "ruta": {"type": "string", "description": "Carpeta relativa al espacio de trabajo. Usa '.' para la raíz."}
            },
            "required": ["ruta"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "name": "leer_archivo",
        "description": "Lee un archivo de texto del espacio de trabajo y devuelve su contenido.",
        "input_schema": {
            "type": "object",
            "properties": {"ruta": {"type": "string", "description": "Ruta relativa al espacio de trabajo."}},
            "required": ["ruta"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "name": "escribir_archivo",
        "description": "Crea o sobrescribe un archivo de texto en el espacio de trabajo. Crea las carpetas que falten.",
        "input_schema": {
            "type": "object",
            "properties": {
                "ruta": {"type": "string", "description": "Ruta relativa al espacio de trabajo."},
                "contenido": {"type": "string", "description": "Contenido completo del archivo."},
            },
            "required": ["ruta", "contenido"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "name": "ejecutar_comando",
        "description": (
            "Ejecuta un comando de shell dentro del espacio de trabajo y devuelve stdout, stderr y el código de salida. "
            "El usuario debe aprobar cada comando antes de que se ejecute. Tiempo máximo: 120 s."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "comando": {"type": "string", "description": "Comando a ejecutar."},
                "motivo": {"type": "string", "description": "Una frase que explique al usuario para qué sirve."},
            },
            "required": ["comando", "motivo"],
            "additionalProperties": False,
        },
        "strict": True,
    },
]


# --------------------------------------------------------------------------- herramientas locales

class ErrorHerramienta(Exception):
    pass


def _resolver(ruta: str) -> Path:
    destino = (ESPACIO / ruta).resolve()
    if destino != ESPACIO and ESPACIO not in destino.parents:
        raise ErrorHerramienta(f"Ruta fuera del espacio de trabajo: {ruta}")
    return destino


def _recortar(texto: str) -> str:
    if len(texto) <= MAX_SALIDA_HERRAMIENTA:
        return texto
    return texto[:MAX_SALIDA_HERRAMIENTA] + f"\n\n[... recortado: {len(texto) - MAX_SALIDA_HERRAMIENTA} caracteres más]"


def listar_archivos(ruta: str) -> str:
    carpeta = _resolver(ruta)
    if not carpeta.is_dir():
        raise ErrorHerramienta(f"No es una carpeta: {ruta}")
    entradas = sorted(carpeta.iterdir(), key=lambda p: (p.is_file(), p.name.lower()))
    lineas = [f"{p.name}/" if p.is_dir() else f"{p.name}  ({p.stat().st_size} bytes)" for p in entradas]
    return "\n".join(lineas) or "(carpeta vacía)"


def leer_archivo(ruta: str) -> str:
    archivo = _resolver(ruta)
    if not archivo.is_file():
        raise ErrorHerramienta(f"No existe el archivo: {ruta}")
    return _recortar(archivo.read_text(encoding="utf-8", errors="replace"))


def escribir_archivo(ruta: str, contenido: str) -> str:
    archivo = _resolver(ruta)
    archivo.parent.mkdir(parents=True, exist_ok=True)
    archivo.write_text(contenido, encoding="utf-8")
    return f"Guardado {ruta} ({len(contenido)} caracteres)."


def ejecutar_comando(comando: str, motivo: str) -> str:
    print(f"\n\033[33m⚠ El agente quiere ejecutar:\033[0m {comando}\n  Motivo: {motivo}")
    if input("  ¿Permitir? [s/N] ").strip().lower() not in ("s", "si", "sí", "y", "yes"):
        raise ErrorHerramienta("El usuario rechazó el comando.")
    try:
        r = subprocess.run(comando, shell=True, cwd=ESPACIO, capture_output=True, text=True, timeout=120)
    except subprocess.TimeoutExpired:
        raise ErrorHerramienta("El comando superó los 120 s y se canceló.")
    return _recortar(f"código de salida: {r.returncode}\n--- stdout ---\n{r.stdout}\n--- stderr ---\n{r.stderr}")


FUNCIONES = {
    "listar_archivos": listar_archivos,
    "leer_archivo": leer_archivo,
    "escribir_archivo": escribir_archivo,
    "ejecutar_comando": ejecutar_comando,
}


def ejecutar_herramienta(bloque) -> dict:
    resultado = {"type": "tool_result", "tool_use_id": bloque.id}
    funcion = FUNCIONES.get(bloque.name)
    try:
        if funcion is None:
            raise ErrorHerramienta(f"Herramienta desconocida: {bloque.name}")
        entrada = bloque.input if isinstance(bloque.input, dict) else json.loads(bloque.input)
        resultado["content"] = funcion(**entrada)
    except (ErrorHerramienta, OSError, TypeError, ValueError) as e:
        resultado["content"] = f"Error: {e}"
        resultado["is_error"] = True
    return resultado


# --------------------------------------------------------------------------- perfiles

def perfiles_disponibles() -> list[str]:
    return sorted(p.stem for p in DIR_PERFILES.glob("*.md") if p.stem != "base")


def cargar_sistema(perfil: str) -> str:
    archivo = DIR_PERFILES / f"{perfil}.md"
    if not archivo.is_file():
        raise SystemExit(f"Perfil '{perfil}' no encontrado. Disponibles: {', '.join(perfiles_disponibles())}")
    base = (DIR_PERFILES / "base.md").read_text(encoding="utf-8")
    return f"{base}\n\n{archivo.read_text(encoding='utf-8')}"


# --------------------------------------------------------------------------- bucle del agente

def mostrar_respuesta(respuesta) -> None:
    for bloque in respuesta.content:
        if bloque.type == "text" and bloque.text.strip():
            print(f"\n{bloque.text}")
        elif bloque.type == "server_tool_use":
            detalle = bloque.input.get("query") or bloque.input.get("url") or ""
            print(f"\033[2m  · {bloque.name}: {detalle}\033[0m")
        elif bloque.type == "tool_use":
            print(f"\033[2m  · {bloque.name}: {json.dumps(bloque.input, ensure_ascii=False)[:120]}\033[0m")


def turno(cliente, modelo: str, esfuerzo: str, sistema: str, mensajes: list) -> bool:
    """Ejecuta un turno completo: llama al modelo y resuelve herramientas hasta que termine.

    Devuelve False si el modelo rechazó la petición.
    """
    while True:
        print("\033[2m  pensando...\033[0m", end="\r", flush=True)
        respuesta = cliente.beta.messages.create(
            model=modelo,
            max_tokens=MAX_TOKENS,
            system=[{"type": "text", "text": sistema, "cache_control": {"type": "ephemeral"}}],
            tools=HERRAMIENTAS_SERVIDOR + HERRAMIENTAS_LOCALES,
            thinking={"type": "adaptive"},
            output_config={"effort": esfuerzo},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            messages=mensajes,
        )
        print(" " * 20, end="\r")

        if respuesta.stop_reason == "refusal":
            print("\n\033[31mEl modelo no quiso responder a esto.\033[0m Reformula la petición o da más contexto.")
            return False

        mensajes.append({"role": "assistant", "content": respuesta.content})
        mostrar_respuesta(respuesta)

        if respuesta.stop_reason == "tool_use":
            resultados = [ejecutar_herramienta(b) for b in respuesta.content if b.type == "tool_use"]
            mensajes.append({"role": "user", "content": resultados})
            continue
        if respuesta.stop_reason == "pause_turn":
            continue  # herramienta de servidor larga: se reanuda enviando el historial tal cual
        if respuesta.stop_reason == "max_tokens":
            print("\n\033[33m(Respuesta cortada por longitud. Escribe «continúa» para seguir.)\033[0m")
        return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Agente directo sobre la API de Claude")
    parser.add_argument("-p", "--perfil", default="general", help="perfil: " + ", ".join(perfiles_disponibles()))
    parser.add_argument("--modelo", default=MODELO_POR_DEFECTO)
    parser.add_argument("--esfuerzo", default=ESFUERZO_POR_DEFECTO, choices=["low", "medium", "high", "xhigh", "max"])
    args = parser.parse_args()

    ESPACIO.mkdir(parents=True, exist_ok=True)
    cliente = anthropic.Anthropic()
    perfil = args.perfil
    sistema = cargar_sistema(perfil)
    mensajes: list = []

    print(f"Agente directo · perfil: {perfil} · modelo: {args.modelo} · espacio: {ESPACIO}")
    print("Escribe /perfiles, /perfil <nombre>, /nuevo o /salir.\n")

    while True:
        try:
            entrada = input(f"\033[36m[{perfil}] tú>\033[0m ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not entrada:
            continue
        if entrada in ("/salir", "/exit"):
            break
        if entrada == "/nuevo":
            mensajes.clear()
            print("Historial borrado.")
            continue
        if entrada == "/perfiles":
            print(", ".join(perfiles_disponibles()))
            continue
        if entrada.startswith("/perfil "):
            nuevo = entrada.split(maxsplit=1)[1]
            if nuevo not in perfiles_disponibles():
                print(f"No existe ese perfil. Disponibles: {', '.join(perfiles_disponibles())}")
                continue
            perfil = nuevo
            sistema = cargar_sistema(perfil)
            mensajes.clear()
            print(f"Perfil cambiado a {perfil}. Historial borrado.")
            continue

        # Si el turno falla se deshace entero, para que el historial quede siempre válido.
        inicio = len(mensajes)
        mensajes.append({"role": "user", "content": entrada})
        ok = False
        try:
            ok = turno(cliente, args.modelo, args.esfuerzo, sistema, mensajes)
        except anthropic.AuthenticationError:
            sys.exit("Falta una clave válida. Define ANTHROPIC_API_KEY (ver README).")
        except anthropic.RateLimitError:
            print("\nLímite de uso alcanzado; espera un momento y reintenta.")
        except anthropic.APIStatusError as e:
            print(f"\nError de la API ({e.status_code}): {e.message}")
        except anthropic.APIConnectionError:
            print("\nSin conexión con la API. Revisa tu internet.")
        except KeyboardInterrupt:
            print("\n(Interrumpido.)")
        if not ok:
            del mensajes[inicio:]
        print()


if __name__ == "__main__":
    main()
