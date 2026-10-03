# Política editorial y de evidencia

Esta política es vinculante para el contenido humano, el generado por IA y el código. Si una función de la app contradice esta política, la función es un error.

## Reglas absolutas

HerbaNatura **nunca**:

1. Inventa estudios, resultados, fuentes, DOI, PMID o registros de ensayos.
2. Inventa propiedades medicinales, mecanismos o interacciones.
3. Presenta resultados en células como eficacia clínica.
4. Presenta estudios en animales como prueba en humanos.
5. Presenta un uso tradicional como prueba de eficacia.
6. Aconseja abandonar, retrasar o sustituir medicamentos o tratamientos (quimioterapia, radioterapia, cirugía, inmunoterapia, terapias dirigidas u hormonales).
7. Diagnostica (“usted tiene…”).
8. Permite que un anunciante o afiliado influya en una clasificación científica.
9. Publica automáticamente conclusiones médicas generadas por IA.

Cuando no hay fuente verificada, el texto es literalmente: **“Pendiente de investigación/verificación.”**
Cuando la evidencia sobre una interacción es insuficiente: **“Información insuficiente.”**

## Niveles de evidencia

El nivel describe la **naturaleza y calidad de la evidencia**, no si una planta “es mejor”.

| Nivel | Nombre | Significado |
|---|---|---|
| **A** | Evidencia clínica consistente | Varios ensayos clínicos de calidad y/o revisiones sistemáticas concordantes en humanos |
| **B** | Evidencia clínica limitada | Algunos ensayos en humanos con limitaciones (tamaño, duración, calidad) |
| **C** | Evidencia preliminar | Estudios piloto, ensayos pequeños o no aleatorizados |
| **D** | Evidencia observacional | Estudios de cohortes, casos y controles; muestran asociación, no causalidad |
| **E** | Evidencia preclínica | Sólo estudios en células (in vitro) y/o animales |
| **F** | Uso tradicional | Uso documentado sin evidencia clínica suficiente |
| **X** | Insuficiente o contradictoria | Datos escasos, de baja calidad o con resultados opuestos; incluye evidencia negativa |

## Categorías visibles

| Icono | Categoría | Clave |
|---|---|---|
| 🟢 | Evidencia clínica sólida | `clinical_strong` |
| 🟡 | Evidencia clínica limitada | `clinical_limited` |
| 🟠 | Evidencia preliminar | `preliminary` |
| 🔵 | Principalmente observacional | `observational` |
| 🧪 | Únicamente preclínica (células + animales) | `preclinical` |
| 🧫 | Sólo en laboratorio | `in_vitro` |
| 🐁 | En animales | `animal` |
| ⚪ | Insuficiente | `insufficient` |
| 🔴 | Negativa / sin beneficio demostrado | `negative` |

## Contextos (nunca mezclar)

* 🛡️ **Prevención** — asociación con menor (o mayor) riesgo.
* 🔬 **Investigación** — estudios experimentales.
* 💊 **Tratamiento complementario** — uso junto con tratamiento médico.
* 🧬 **Tratamiento del cáncer** — máximo rigor; por defecto se asume que *no* hay demostración en humanos.
* ⚠️ **Seguridad** — riesgos, toxicidad, poblaciones especiales.

## “Factor asociado” frente a “causa demostrada”

En prevención, los textos deben usar “se ha asociado con” salvo que una fuente oficial (p. ej. IARC Grupo 1) establezca causalidad, en cuyo caso se cita la clasificación.

## Estados de revisión

| Estado | Significado | Visible al público |
|---|---|---|
| 🟡 `pending_review` | Pendiente de revisión humana | Sí, con distintivo amarillo |
| 🟢 `reviewed` | Revisado por una persona con rol `reviewer` | Sí |
| 🔴 `rejected` | Rechazado | No |
| ⚪ `insufficient_info` | Revisado: la información disponible es insuficiente | Sí |

Todo contenido científico tiene: fuente, fecha, responsable y estado.

## Conjunto demostrativo

El conjunto inicial es **demostrativo**. Las afirmaciones incluidas parafrasean de forma conservadora fichas institucionales públicas (NCCIH, NCI, OMS) y **todas** están en `pending_review`: un revisor debe contrastar cada texto con la fuente enlazada antes de marcarlo como revisado. Los campos sin fuente muestran “Pendiente de investigación/verificación”.
