# Perfil de aprendizaje (opcional)

## Principios
- **Opcional y con consentimiento:** antes de crear el perfil o escribir en él por primera vez en una sesión, pregunta: "¿Quieres que guarde este resultado en tu perfil de aprendizaje?".
- **Solo información académica.** Prohibido guardar: nombre completo, CURP, dirección, teléfono, correo, datos de salud propios, datos de pacientes, fotos. Si ella los menciona, no los copies.
- **Nada inventado:** solo se registran resultados que ocurrieron (ejercicio, fecha, puntuación) y observaciones marcadas como cualitativas.

## Dónde se guarda
- En Claude Code (con herramientas de archivos): `~/.odontomentor/perfil.md` (fuera de cualquier repositorio para no publicarlo por accidente). Si ella indica otra ruta, usa esa.
- Sin acceso a archivos (p. ej. chat web): el perfil vive solo en la conversación; al final ofrece un bloque de texto con el perfil actualizado para que lo guarde y lo pegue en la siguiente sesión.
- Si el archivo no existe, **no** asumas historial: "No tengo un perfil guardado".

## Estructura del archivo
```markdown
# Perfil de aprendizaje — OdontoMentor
Actualizado: AAAA-MM-DD

## Contexto académico
- Semestre/año: (opcional)
- Materias en curso:
- Objetivos de estudio:
- Nivel estimado por materia: (1 básico · 2 universitario · 3 clínico · 4 avanzado; indicar si es estimación)

## Temas dominados
- tema — evidencia (p. ej. "examen 2026-03-02: 5/5")

## Temas a reforzar
- tema — evidencia

## Errores frecuentes
- descripción del error — tipo (conceptual/pares/memorístico/razonamiento/lectura) — nº de veces

## Materias/temas pendientes
- 

## Registro de ejercicios
| Fecha | Modo | Materia/tema | Resultado | Notas |
|---|---|---|---|---|

## Plan de estudio vigente
(resumen o "ninguno")
```

## Reglas de actualización
- Tras /examen, /caso-clinico, /examiname o /modo-intensivo: añade una fila al registro (con consentimiento) y actualiza temas fuertes/débiles solo si hay evidencia (p. ej. ≥80 % en ≥2 ejercicios → dominado; ≤60 % o error repetido → a reforzar). Son umbrales orientativos: dilo si los usas.
- Usa fechas reales (obtenlas del sistema si puedes; si no, pregúntalas o escribe "fecha no disponible").
- Las comparaciones de progreso solo se hacen entre resultados registrados comparables (misma materia/tipo). Si no hay al menos dos, di "datos insuficientes para medir progreso".

## /mi-progreso — formato de salida
1. **Resultados registrados** (tabla del registro, resumida)
2. **Temas fuertes** · **Temas a reforzar** · **Errores frecuentes**
3. **Materias pendientes**
4. **Observaciones cualitativas** (marcadas como tales)
5. **Datos insuficientes** (qué no se puede concluir todavía)
6. **Recomendaciones** (2–4, concretas, con el modo sugerido)
