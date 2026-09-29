# 🦷 OdontoMentor

Tutor académico inteligente de odontología para Claude Code. Está pensado para acompañar a una estudiante durante la carrera: explica por niveles, enseña a razonar con preguntas, simula casos clínicos, aplica exámenes, crea flashcards, detecta temas débiles y arma planes de estudio.

> Es un **tutor**, no un sustituto del odontólogo supervisor ni de la evaluación clínica de un paciente.

---

## Instalación

OdontoMentor tiene dos partes:

| Parte | Ruta | Para qué sirve |
|---|---|---|
| Skill | `.claude/skills/odontomentor/` | Toda la lógica: identidad, reglas, modos y referencias |
| Comandos | `.claude/commands/*.md` (28 archivos pequeños) | Hacen que `/examen`, `/flashcards`, etc. funcionen como comandos directos |

### Ya instalado en este repositorio (nivel proyecto)
Al abrir Claude Code dentro de este repositorio, el skill y los comandos se cargan solos. Escribe `/` y verás los comandos de OdontoMentor.

### En tu computadora (nivel personal, para usarlo en cualquier carpeta)
```bash
# desde la raíz de este repositorio
mkdir -p ~/.claude/skills ~/.claude/commands
cp -r .claude/skills/odontomentor ~/.claude/skills/
cp .claude/commands/{odontologia,explicame,desde-cero,profesor,maestro,caso-clinico,examen,examiname,flashcards,repaso,resumen,modo-intensivo,plan-estudio,mi-progreso,diagnostico,radiologia,anatomia,farmacologia,patologia,endodoncia,periodoncia,cirugia,ortodoncia,protesis,odontopediatria,materiales,oclusion,preventiva}.md ~/.claude/commands/
```
Reinicia Claude Code, o usa `/reload-skills`. Consejo: crea una carpeta de estudio (por ejemplo `~/odontologia`) y abre Claude Code ahí.

### En claude.ai (web o app)
Comprime la carpeta `odontomentor/` en un `.zip` y súbela en *Settings → Capabilities → Skills*. Ahí no hay comandos `/`, pero puedes escribir "/examen 10 endodoncia" o "hazme un examen" y el skill lo interpreta igual.

---

## Uso

Puedes preguntar de forma natural, porque el skill se activa solo con cualquier tema de odontología:

```
¿Qué es la dentina?
No entiendo la diferencia entre pulpitis reversible e irreversible.
```

O usar un comando:

```
/caso-clinico endodoncia
/examen 10 periodoncia
/flashcards materiales resinas compuestas 15
/desde-cero endodoncia
/plan-estudio parcial de cirugía el 20 de noviembre
```

Durante cualquier pregunta o caso puedes escribir **"dame una pista"**, que da hasta 3 niveles, o **"¿por qué?"**, que explica el mecanismo causal.

## Comandos

| Comando | Qué hace |
|---|---|
| `/odontologia` | Menú de modos o duda libre |
| `/explicame [tema]` | Explicación progresiva: qué es, dónde, por qué, cómo, cómo se reconoce, con qué se confunde, ejemplos, punto de examen |
| `/desde-cero [tema]` | De la anatomía a los casos, capa por capa, con chequeos |
| `/profesor [tema]` | Tú explicas y el profesor marca lo correcto, incompleto, incorrecto y las confusiones frecuentes |
| `/maestro [tema]` | Modo socrático exigente: pregunta, error, pista y otro intento |
| `/caso-clinico [materia]` | Caso simulado que se revela por etapas, con preguntas una a una y cierre con una regla para recordar |
| `/diagnostico [datos]` | Diagnóstico diferencial en tabla (apoya, contradice, información útil) |
| `/radiologia [imagen]` | Separa observación, interpretación y conclusión académica, y evalúa la calidad de la imagen |
| `/examen [n] [materia]` | Examen de 5, 10, 20 preguntas o personalizado (opción múltiple, V/F, respuesta corta, relación, casos), con corrección al final |
| `/examiname [tema]` | Examen oral, una pregunta a la vez |
| `/flashcards [materia] [tema] [n]` | Tarjetas con pregunta, respuesta, dato clave y error frecuente. Se pueden exportar a CSV para Anki |
| `/repaso` | Repaso progresivo de los errores de la sesión: concepto, pregunta sencilla, intermedia, avanzada y mini caso |
| `/resumen` | Resume tus apuntes sin alterar su significado y señala las contradicciones |
| `/modo-intensivo` | Sesión de 15, 30 o 60 minutos: explicación, preguntas, ejercicio, caso, evaluación y repaso |
| `/plan-estudio` | Plan día por día a partir de 5 preguntas (examen, fecha, temas, tiempo, dificultades) |
| `/mi-progreso` | Fortalezas, debilidades, errores y recomendaciones, solo con datos reales |
| `/anatomia` `/farmacologia` `/patologia` `/endodoncia` `/periodoncia` `/cirugia` `/ortodoncia` `/protesis` `/odontopediatria` `/materiales` `/oclusion` `/preventiva` | Módulos por materia |

## Perfil de aprendizaje (opcional)
Si aceptas, OdontoMentor guarda **solo datos académicos** en `~/.odontomentor/perfil.md`: resultados de ejercicios, temas fuertes y débiles, errores frecuentes y plan vigente. Nunca guarda nombre completo, CURP, datos de pacientes ni fotos. Si no puede escribir el archivo, te da el perfil como bloque de texto para que lo guardes tú. `/mi-progreso` separa los **resultados registrados**, las **observaciones cualitativas** y los **datos insuficientes**, y no inventa porcentajes de mejora.

## Reglas clave que sigue
- **Enseña a razonar:** hace una pregunta diagnóstica antes de explicar cuando el objetivo es aprender a fondo.
- **Adapta el nivel:** 1 básico, 2 universitario, 3 clínico académico, 4 avanzado.
- **No inventa** artículos, DOI, autores, estadísticas ni protocolos. Cuando no está seguro dice: *"No tengo suficiente información para afirmarlo con seguridad."*
- **Usa búsqueda web** para guías, dosis y evidencia recientes. Para conceptos básicos no busca.
- **Seguridad clínica:** detecta pacientes reales, marca las señales de alarma y no da diagnósticos definitivos sin datos suficientes ni prescripciones personalizadas.
- **Privacidad:** recomienda anonimizar los casos reales.

---

## Estructura

```
.claude/
├── skills/odontomentor/
│   ├── SKILL.md                  # núcleo: identidad, reglas, modos, seguridad (se carga al activarse)
│   ├── README.md                 # este archivo
│   └── references/               # se leen solo cuando el tema lo requiere
│       ├── modos.md              # protocolos detallados de cada modo
│       ├── metodologia_estudio.md
│       ├── perfil_aprendizaje.md
│       ├── anatomia.md   farmacologia.md   radiologia.md   diagnostico.md
│       ├── patologia.md  endodoncia.md     periodoncia.md  cirugia.md
│       ├── ortodoncia.md protesis.md       odontopediatria.md
│       └── materiales.md oclusion.md       preventiva.md
└── commands/                     # 28 envoltorios de 7 líneas: /examen, /flashcards, …
```

**Carga bajo demanda:** Claude solo ve siempre el nombre y la descripción del skill. `SKILL.md` se carga cuando se activa, y cada archivo de `references/` únicamente cuando el tema lo necesita. Los comandos llevan `disable-model-invocation: true`, así que no ocupan contexto hasta que tú los usas.

---

## Cómo añadir una materia
1. Crea `references/<materia>.md` con esta estructura: **Mapa de temas**, tablas de alto rendimiento, **pares que se confunden**, **errores frecuentes**, **puntos de examen**, **qué verificar con búsqueda** y **fuentes recomendadas** (solo fuentes reales). Mantenlo por debajo de ~200 líneas.
2. Añádelo a la tabla de comandos y a la lista de referencias en `SKILL.md` (§5 y §6).
3. Crea el comando copiando cualquier archivo de `.claude/commands/`, por ejemplo `endodoncia.md`, y cambia el nombre, la `description` y el modo en el texto.
4. Si quieres que se active con palabras nuevas, añádelas a la `description` de `SKILL.md`. Máximo 1024 caracteres y entre comillas simples.

## Cómo modificar el Skill
- **Personalidad o reglas generales:** `SKILL.md`. Mantenlo corto, porque se carga completo cada vez.
- **Comportamiento de un modo:** su sección en `references/modos.md`.
- **Contenido de una materia:** su archivo en `references/`.
- **Cuándo se activa:** el campo `description` del frontmatter.
- **Validar el formato:** el frontmatter debe ser YAML válido. Puedes comprobarlo con `python3 -c "import yaml;yaml.safe_load(open('SKILL.md').read().split('---')[1])"`.
- Después de editar, abre una sesión nueva o ejecuta `/reload-skills`.

## Limitaciones
- Las referencias son guías de estudio, no libros de texto. Contrasta siempre con la bibliografía y las clasificaciones que use tu facultad.
- Los tiempos del modo intensivo son orientativos, porque Claude no mide el reloj real.
- La información sobre fármacos y guías cambia. OdontoMentor la verifica con búsqueda web cuando está disponible.
