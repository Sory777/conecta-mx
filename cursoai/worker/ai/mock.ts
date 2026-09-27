// Deterministic offline provider for development and automated tests.
// It never runs in production (see getProvider). Its output follows the same
// schemas as the real model, so every flow can be exercised without an API key.

import type { AIProvider, JSONRequest, ProviderResult, ResearchRequest, ResearchResult, TextRequest, Usage } from './provider';
import type { ActivityInput, ConceptCtx, PlanInput } from './tasks';
import type {
  ActivityContentOut,
  EvaluationOut,
  ExerciseOut,
  IntakeOut,
  PlanOut,
  ProjectEvalOut,
  ProjectOut,
  QuizOut,
  StageOut,
  StageOutlineOut,
} from './schemas';

const USAGE: Usage = { input_tokens: 0, output_tokens: 0, cache_read_tokens: 0 };

type AnyInput = Record<string, unknown>;

export class MockProvider implements AIProvider {
  readonly name = 'mock';

  async generateJSON<T>(req: JSONRequest<T>): Promise<ProviderResult<T>> {
    const input = (req.mockInput ?? {}) as AnyInput;
    const task = req.task.startsWith('activity') ? 'activity' : req.task;
    const gen = GENERATORS[task];
    if (!gen) throw new Error(`MockProvider: no generator for task ${req.task}`);
    return { data: gen(input) as T, usage: USAGE, model: `mock:${req.model}` };
  }

  async generateText(req: TextRequest): Promise<ProviderResult<string>> {
    const input = (req.mockInput ?? {}) as AnyInput;
    if (req.task === 'tutor_summary') {
      return { data: 'El alumno repasó dudas del curso con el tutor (resumen simulado).', usage: USAGE, model: 'mock' };
    }
    const message = String(input.message ?? '').toLowerCase();
    let reply = 'Buena pregunta. Pensemos en tu objetivo: ';
    if (message.includes('no entend') || message.includes('fácil') || message.includes('facil')) {
      reply = 'Te lo explico de otra forma, con una analogía: imagina que cada concepto es una herramienta en una caja; primero aprendes para qué sirve cada una y luego cuándo usarla.';
    } else if (message.includes('ejemplo')) {
      reply = 'Aquí va otro ejemplo concreto, conectado con tu objetivo: aplica el concepto a una situación de tu día a día y observa qué cambia.';
    } else if (message.includes('ejercicio')) {
      reply = '**Ejercicio:** explica con tus palabras el último concepto que viste y da un ejemplo propio. Cuando respondas, te lo corrijo.';
    } else if (message.includes('mal')) {
      reply = 'Tu respuesta anterior mezcló dos ideas. Revisa la definición del concepto y compárala con tu ejemplo paso a paso.';
    } else {
      reply += `sobre "${String(input.message ?? '').slice(0, 80)}", lo importante es practicar con un caso real.`;
    }
    return { data: `${reply}\n\n_(Respuesta simulada: modo de pruebas sin IA real.)_`, usage: USAGE, model: 'mock' };
  }

  async research(req: ResearchRequest): Promise<ProviderResult<ResearchResult>> {
    return {
      data: {
        brief: `[Modo de pruebas] Informe simulado para: ${req.query.slice(0, 120)}`,
        sources: [{ url: 'https://example.com/fuente-simulada', title: 'Fuente simulada (modo de pruebas)', page_age: null }],
      },
      usage: USAGE,
      model: 'mock',
    };
  }
}

// ───────────── Generators ─────────────

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function detectDomain(t: string): IntakeOut['domain'] {
  const s = t.toLowerCase();
  if (/python|javascript|programa|código|codigo|java\b|react|sql|web/.test(s)) return 'programming';
  if (/inglés|ingles|francés|frances|alemán|idioma|portugués|italiano/.test(s)) return 'language';
  if (/excel|word|powerpoint|hojas de cálculo|google sheets/.test(s)) return 'office_tools';
  if (/finanza|trading|invers|bolsa|cripto|ahorro|presupuesto|dinero/.test(s)) return 'finance';
  if (/venta|marketing|negocio|emprend|negociaci/.test(s)) return 'business';
  if (/nutrici|salud|dieta/.test(s)) return 'health';
  if (/derecho|ley|impuesto|legal/.test(s)) return 'law';
  if (/cocina|fotograf|mecánica|mecanica|carpinter/.test(s)) return 'practical_skills';
  if (/matemática|matematica|álgebra|algebra|cálculo|calculo/.test(s)) return 'math';
  if (/historia|filosof|literatura/.test(s)) return 'humanities';
  if (/entrevista|currículum|curriculum|carrera profesional/.test(s)) return 'career';
  if (/inteligencia artificial|\bia\b|tecnolog/.test(s)) return 'technology';
  return 'general';
}

function intake(input: AnyInput): IntakeOut {
  const request = String(input.request ?? '').trim();
  const lower = request.toLowerCase();
  const blocked = /bomba|explosivo|hackear/.test(lower);
  const m = /(?:quiero\s+)?(?:aprender|dominar|estudiar|mejorar(?:\s+en)?)\s+(.+?)(?:\s+(?:para|porque|con el fin de)\s+(.+))?$/i.exec(
    request.replace(/[.!]+$/, ''),
  );
  let topic = (m?.[1] ?? request).replace(/\s+desde cero/i, '').trim();
  topic = topic.split(/\s+/).slice(0, 6).join(' ');
  const goalText = m?.[2]?.trim() ?? null;
  const domain = detectDomain(request);
  const sensitivity: IntakeOut['sensitivity'] =
    domain === 'finance' ? 'financial' : domain === 'health' ? 'health' : domain === 'law' ? 'legal' : 'none';
  const levelExplicit = /desde cero|principiante|b[aá]sico|intermedio|avanzado/.test(lower);
  const level = /intermedio/.test(lower) ? 'intermediate' : /avanzado/.test(lower) ? 'advanced' : levelExplicit ? 'beginner' : null;
  const minutes = /(\d+)\s*min/.exec(lower);
  const questions: IntakeOut['questions'] = [];
  if (!goalText) {
    questions.push({ id: 'goal', question: `¿Para qué quieres aprender ${topic}?`, options: ['Para mi trabajo', 'Para un proyecto personal', 'Por curiosidad', 'Para un examen'] });
    if (!levelExplicit) {
      questions.push({ id: 'level', question: `¿Cuánto sabes hoy de ${topic}?`, options: ['Nada, empiezo de cero', 'Lo básico', 'Tengo experiencia'] });
    }
  }
  return {
    allowed: !blocked,
    refusal_reason: blocked ? 'No podemos crear cursos sobre actividades que causen daño.' : null,
    topic: cap(topic),
    goal: goalText ? cap(goalText) : `Aprender ${topic}`,
    goal_explicit: Boolean(goalText),
    goal_type: /trabajo|empleo/.test(lower) ? 'employment' : /conversa/.test(lower) ? 'conversation' : /dinero|finanzas personales/.test(lower) ? 'money_management' : /negocio|vender/.test(lower) ? 'business' : 'other',
    level,
    level_explicit: levelExplicit,
    daily_minutes: minutes ? Number(minutes[1]) : null,
    prior_knowledge: null,
    domain,
    sensitivity,
    volatility: ['finance', 'law', 'health', 'technology'].includes(domain) ? 'changing' : 'stable',
    questions,
  };
}

function stagesFor(topic: string, domain: string): StageOut[] {
  const t = topic;
  const templates: Record<string, [string, string, string[], StageOut['activity_types']][]> = {
    language: [
      ['Presentaciones', 'Situación', ['Saludos', 'Presentarse', 'Datos personales'], ['lesson', 'conversation', 'practice']],
      ['Preguntas básicas', 'Situación', ['Preguntas con be', 'Preguntas con do', 'Respuestas cortas'], ['lesson', 'practice', 'conversation']],
      ['Situaciones cotidianas', 'Situación', ['Rutina diaria', 'Presente simple', 'Horarios'], ['conversation', 'practice']],
      ['Compras y restaurante', 'Situación', ['Pedir en un restaurante', 'Precios y cantidades', 'Cortesía'], ['simulation', 'conversation']],
    ],
    programming: [
      ['Primeros pasos', 'Módulo', ['Variables', 'Tipos de datos', 'Operadores'], ['lesson', 'practice']],
      ['Control de flujo', 'Módulo', ['Condicionales', 'Bucles', 'Rangos'], ['lesson', 'practice', 'challenge']],
      ['Funciones', 'Módulo', ['Definir funciones', 'Parámetros y retorno', 'Alcance'], ['lesson', 'practice', 'challenge']],
      ['Mini proyecto', 'Proyecto', ['Estructurar un programa', 'Depuración'], ['challenge', 'practice']],
    ],
    office_tools: [
      ['Fundamentos de la hoja', 'Conceptos', ['Celdas y rangos', 'Formato de datos', 'Referencias'], ['lesson', 'practice']],
      ['Fórmulas esenciales', 'Conceptos', ['SUMA y PROMEDIO', 'SI', 'BUSCARV'], ['lesson', 'practice', 'case']],
      ['Organizar información', 'Casos reales', ['Tablas', 'Filtros y ordenación', 'Gráficos'], ['case', 'practice']],
      ['Tareas administrativas', 'Proyecto', ['Presupuesto', 'Reportes'], ['challenge', 'case']],
    ],
    finance: [
      ['Conceptos base', 'Etapa', ['Mercados', 'Instrumentos', 'Riesgo y rendimiento'], ['lesson', 'practice']],
      ['Lectura de gráficos', 'Etapa', ['Velas japonesas', 'Tendencias', 'Soportes y resistencias'], ['lesson', 'case', 'practice']],
      ['Gestión del riesgo', 'Etapa', ['Tamaño de posición', 'Stop loss', 'Psicología'], ['lesson', 'simulation']],
      ['Simulación', 'Práctica', ['Plan de operación', 'Diario de operaciones'], ['simulation', 'case']],
    ],
  };
  const fallback: [string, string, string[], StageOut['activity_types']][] = [
    [`Fundamentos de ${t}`, 'Etapa', ['Conceptos clave', 'Vocabulario esencial', 'Primeros pasos'], ['lesson', 'practice']],
    ['Práctica guiada', 'Etapa', ['Técnicas principales', 'Errores comunes', 'Buenas prácticas'], ['lesson', 'practice', 'case']],
    ['Aplicación real', 'Etapa', ['Casos reales', 'Toma de decisiones'], ['case', 'challenge']],
  ];
  const chosen = templates[domain] ?? fallback;
  return chosen.map(([title, kind, concepts, acts], i) => ({
    title,
    kind_label: kind,
    objective: `Poder aplicar ${concepts.slice(0, 2).join(' y ').toLowerCase()} en situaciones reales.`,
    estimated_minutes: 60 + i * 15,
    competencies: [i < 2 ? 'Comprensión de conceptos' : 'Aplicación práctica', i % 2 === 0 ? 'Resolución de problemas' : 'Aplicación práctica'],
    concepts: concepts.map((c) => ({ name: c, description: `Qué es ${c.toLowerCase()} y cómo se usa en ${t}.` })),
    activity_types: acts,
  }));
}

function plan(input: AnyInput): PlanOut {
  const p = input as unknown as PlanInput;
  const topic = p.intake?.topic ?? 'el tema';
  const stages = stagesFor(topic, p.intake?.domain ?? 'general');
  const minutes = p.intake?.daily_minutes ?? p.preferences?.daily_minutes ?? 30;
  const total = stages.reduce((s, st) => s + st.estimated_minutes, 0);
  return {
    title: `${topic}: ${p.intake?.goal ?? 'de cero a la práctica'}`.slice(0, 90),
    goal_outcome: `Al terminar podrás usar ${topic} con confianza para ${String(p.intake?.goal ?? 'tu objetivo').toLowerCase()}, resolviendo tareas reales de principio a fin.`,
    level: (p.intake?.level as PlanOut['level']) ?? 'beginner',
    estimated_hours: Math.round((total / 60) * 10) / 10,
    daily_minutes: minutes,
    approach: 'Aprender haciendo: explicación breve, práctica inmediata y retroalimentación.',
    structure_rationale: 'Se organiza por situaciones y tareas reales relacionadas con tu objetivo, no por un temario teórico.',
    competencies: [
      { name: 'Comprensión de conceptos', description: 'Explica los conceptos clave con sus palabras.' },
      { name: 'Aplicación práctica', description: 'Usa lo aprendido en tareas reales.' },
      { name: 'Resolución de problemas', description: 'Resuelve situaciones nuevas.' },
    ],
    stages,
    final_project: { title: `Proyecto final de ${topic}`, brief: `Demuestra lo aprendido resolviendo un caso real relacionado con: ${p.intake?.goal ?? topic}.` },
    safety_note: p.intake?.sensitivity && p.intake.sensitivity !== 'none' ? 'Contenido educativo; no constituye asesoría profesional.' : null,
  };
}

function planRevision(input: AnyInput): PlanOut {
  const current = input.plan as PlanOut;
  const fb = String(input.feedback ?? '').toLowerCase();
  const next: PlanOut = structuredClone(current);
  if (/corto|breve|menos/.test(fb) && next.stages.length > 2) {
    next.stages = next.stages.slice(0, next.stages.length - 1);
  }
  if (/pr[aá]ctic/.test(fb)) {
    next.stages = next.stages.map((s) => ({ ...s, activity_types: [...new Set([...s.activity_types, 'practice', 'challenge'] as const)] }));
    next.approach = 'Muy práctico: mínima teoría y ejercicios desde el primer minuto.';
  }
  if (/profundi|m[aá]s largo|avanzad/.test(fb)) {
    next.stages.push({ ...next.stages[next.stages.length - 1], title: 'Profundización', kind_label: 'Etapa' });
  }
  const minutes = /(\d+)\s*min/.exec(fb);
  if (minutes) next.daily_minutes = Number(minutes[1]);
  next.estimated_hours = Math.round((next.stages.reduce((s, st) => s + st.estimated_minutes, 0) / 60) * 10) / 10;
  return next;
}

function addContent(input: AnyInput): { stage: StageOut; insert_after: number } {
  const current = input.plan as PlanOut;
  const req = String(input.request ?? 'Tema adicional').slice(0, 60);
  return {
    stage: {
      title: cap(req),
      kind_label: 'Etapa',
      objective: `Aplicar ${req.toLowerCase()} dentro del objetivo del curso.`,
      estimated_minutes: 45,
      competencies: [current.competencies[0]?.name ?? 'Aplicación práctica'],
      concepts: [
        { name: `${cap(req)}: fundamentos`, description: `Base de ${req.toLowerCase()}.` },
        { name: `${cap(req)}: práctica`, description: `Uso práctico de ${req.toLowerCase()}.` },
      ],
      activity_types: ['lesson', 'practice'],
    },
    insert_after: current.stages.length - 1,
  };
}

function outline(input: AnyInput): StageOutlineOut {
  const stage = input.stage as { title: string; activity_types: string[] };
  const concepts = (input.concepts as ConceptCtx[]).map((c) => c.name);
  const types = (stage.activity_types?.length ? stage.activity_types : ['lesson', 'practice']) as StageOutlineOut['activities'][number]['type'][];
  const names: Record<string, string> = {
    lesson: 'Entiende',
    practice: 'Practica',
    simulation: 'Simulación',
    conversation: 'Conversa',
    case: 'Caso real',
    challenge: 'Reto',
    reinforcement: 'Refuerzo',
  };
  return {
    activities: types.map((type, i) => {
      const cs = type === 'lesson' ? [concepts[i % concepts.length]] : concepts.slice(0, 2);
      return { type, title: `${names[type]}: ${cs.join(' y ')}`, goal: `Aplicar ${cs.join(' y ').toLowerCase()}.`, concepts: cs };
    }),
  };
}

function exercisesFor(domain: string, concepts: ConceptCtx[], type: string): ExerciseOut[] {
  const c0 = concepts[0]?.name ?? 'Concepto';
  const c1 = concepts[1]?.name ?? c0;
  const open: ExerciseOut =
    domain === 'programming'
      ? {
          kind: 'code',
          concept: c0,
          prompt: `Escribe una función llamada \`doble\` que reciba un número y devuelva el doble. Usa ${c0.toLowerCase()}.`,
          context: '',
          options: [],
          correct_option_index: null,
          correct_boolean: null,
          reference_answer: 'def doble(n):\n    return n * 2',
          rubric: 'Define la función con un parámetro y devuelve n * 2.',
          explanation: 'Una función recibe datos por parámetros y devuelve un resultado con return.',
        }
      : domain === 'language'
        ? {
            kind: 'conversation',
            concept: c0,
            prompt: 'Responde en inglés a esta persona que acabas de conocer.',
            context: 'Hi! I am Anna. What is your name and where are you from?',
            options: [],
            correct_option_index: null,
            correct_boolean: null,
            reference_answer: 'Hi Anna! My name is Carlos and I am from Mexico.',
            rubric: 'Saluda, dice su nombre y su país con una estructura correcta.',
            explanation: 'Para presentarte: My name is … / I am from …',
          }
        : {
            kind: type === 'simulation' || domain === 'business' ? 'scenario' : 'short_answer',
            concept: c0,
            prompt: `Explica con tus palabras qué es ${c0.toLowerCase()} y da un ejemplo relacionado con tu objetivo.`,
            context: '',
            options: [],
            correct_option_index: null,
            correct_boolean: null,
            reference_answer: `${c0} es un elemento clave que se usa para resolver tareas concretas; por ejemplo, al organizar información de trabajo.`,
            rubric: 'Define el concepto correctamente y da un ejemplo pertinente.',
            explanation: `${c0} se entiende mejor cuando lo aplicas a un caso propio.`,
          };
  return [
    {
      kind: 'multiple_choice',
      concept: c0,
      prompt: `¿Cuál de estas opciones describe mejor ${c0.toLowerCase()}?`,
      context: '',
      options: [`La forma correcta de aplicar ${c0.toLowerCase()} en una tarea real`, 'Algo que solo importa en teoría', 'Un paso opcional sin efecto', 'Ninguna de las anteriores'],
      correct_option_index: 0,
      correct_boolean: null,
      reference_answer: '',
      rubric: '',
      explanation: `${c0} importa porque se aplica en tareas reales.`,
    },
    {
      kind: 'true_false',
      concept: c1,
      prompt: `Verdadero o falso: ${c1} solo se aprende memorizando definiciones.`,
      context: '',
      options: [],
      correct_option_index: null,
      correct_boolean: false,
      reference_answer: '',
      rubric: '',
      explanation: 'Se aprende practicando y aplicándolo, no solo memorizando.',
    },
    open,
  ];
}

function activity(input: AnyInput): ActivityContentOut {
  const a = input as unknown as ActivityInput;
  const concepts = a.concepts ?? [];
  const names = concepts.map((c) => c.name).join(', ');
  const variantNote = a.variant ? ` (versión: ${a.variant})` : '';
  const brief = concepts.every((c) => c.state === 'mastered') && concepts.length > 0;
  const blocks: ActivityContentOut['blocks'] = [
    { kind: 'text', title: 'La idea clave', body: `**${names}**: en esta actividad verás para qué sirve y cómo aplicarlo a tu objetivo (${a.course?.goal ?? ''}).${variantNote}`, language: '' },
  ];
  if (!brief) {
    blocks.push(
      { kind: 'example', title: 'Ejemplo', body: `Un caso real: aplicas ${concepts[0]?.name.toLowerCase() ?? 'el concepto'} para resolver una tarea concreta paso a paso.`, language: '' },
      { kind: 'tip', title: 'Consejo', body: 'Practica con un caso propio justo después de leer: así se fija mejor.', language: '' },
    );
    if (a.course?.domain === 'programming') {
      blocks.push({ kind: 'code', title: 'Código de ejemplo', body: 'edad = 30\nprint(edad + 1)', language: 'python' });
    }
    if (a.variant === 'eli10' || a.variant === 'simpler') {
      blocks.push({ kind: 'analogy', title: 'Analogía', body: 'Es como una receta de cocina: sigues pasos en orden para obtener un resultado.', language: '' });
    }
    if (a.variant === 'more_examples') {
      blocks.push(
        { kind: 'example', title: 'Otro ejemplo', body: 'Un segundo caso con otros datos.', language: '' },
        { kind: 'example', title: 'Un ejemplo más', body: 'Un tercer caso para comparar.', language: '' },
      );
    }
  }
  if (a.research) blocks.push({ kind: 'warning', title: 'Datos actuales', body: a.research.brief, language: '' });
  blocks.push({ kind: 'summary', title: 'Resumen', body: `Recuerda: ${names}.`, language: '' });
  return {
    intro: `Vamos con "${a.activity?.title ?? 'la actividad'}". Conecta directamente con tu objetivo.`,
    blocks,
    exercises: exercisesFor(a.course?.domain ?? 'general', concepts, a.activity?.type ?? 'lesson'),
  };
}

function reinforcement(input: AnyInput): ActivityContentOut {
  const concept = input.concept as ConceptCtx;
  const course = input.course as { domain: string };
  return {
    intro: `Reforcemos ${concept.name} desde otro ángulo.`,
    blocks: [
      { kind: 'text', title: 'Otra forma de verlo', body: `Olvida la definición anterior: ${concept.name} se entiende mejor viendo qué problema resuelve.`, language: '' },
      { kind: 'analogy', title: 'Analogía', body: 'Piensa en ello como ordenar tu armario: cada cosa en su lugar para encontrarla rápido.', language: '' },
      { kind: 'example', title: 'Ejemplo resuelto', body: '1. Identifica el dato. 2. Aplica la regla. 3. Comprueba el resultado.', language: '' },
    ],
    exercises: exercisesFor(course?.domain ?? 'general', [concept], 'practice'),
  };
}

const STOPWORDS = new Set(['para', 'como', 'este', 'esta', 'que', 'con', 'una', 'los', 'las', 'del', 'por', 'and', 'the']);
const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .split(/[^a-z0-9_]+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w)),
  );

function evaluate(input: AnyInput): EvaluationOut {
  const response = String(input.response ?? '');
  const ex = input.exercise as { kind: string; reference_answer: string };
  if (/ignora|ponme (un )?10|calificaci[oó]n perfecta|ignore previous/i.test(response) || response.trim().length < 8) {
    return { verdict: 'incorrect', score: 0.1, feedback: 'Tu respuesta no resuelve el ejercicio. Vuelve a leer el enunciado e intenta aplicar el concepto.', misconception: 'No se aplicó el concepto pedido.', next_turn: null };
  }
  const ref = words(ex.reference_answer);
  const overlap = [...words(response)].filter((w) => ref.has(w)).length;
  const next_turn = ex.kind === 'conversation' ? 'Nice to meet you! What do you do?' : null;
  if (overlap >= 2) {
    return { verdict: 'correct', score: 0.9, feedback: '¡Bien! Aplicaste el concepto correctamente.', misconception: null, next_turn };
  }
  return {
    verdict: 'partial',
    score: 0.5,
    feedback: 'Vas por buen camino, pero falta aplicar la idea central con más precisión.',
    misconception: 'La respuesta no incluye el elemento clave del concepto.',
    next_turn,
  };
}

function quiz(input: AnyInput): QuizOut {
  const concepts = (input.concepts as ConceptCtx[]) ?? [];
  const course = input.course as { domain: string };
  const qs = exercisesFor(course?.domain ?? 'general', concepts, 'practice');
  const extra = exercisesFor(course?.domain ?? 'general', concepts.slice(1).concat(concepts.slice(0, 1)), 'practice')[0];
  return { title: `Evaluación: ${String(input.scope ?? '')}`.slice(0, 80), questions: [...qs, extra] };
}

function project(input: AnyInput): ProjectOut {
  const pp = input.plan_project as { title: string; brief: string } | null;
  return {
    title: pp?.title ?? 'Proyecto final',
    brief: pp?.brief ?? 'Aplica lo aprendido en un caso real.',
    deliverables: ['Descripción del problema que resuelves', 'Tu solución paso a paso', 'Reflexión: qué harías diferente'],
    criteria: ['Aplica correctamente los conceptos del curso', 'La solución resuelve el problema planteado', 'Explica sus decisiones con claridad'],
  };
}

function projectEval(input: AnyInput): ProjectEvalOut {
  const submission = String(input.submission ?? '');
  const good = submission.length >= 200 && !/ponme (un )?10|ignora/i.test(submission);
  const s = good ? 0.85 : 0.4;
  const criteria = ((input.project as ProjectOut)?.criteria ?? []).map((c) => ({ criterion: c, score: s, comment: good ? 'Cumple el criterio.' : 'Falta desarrollar este punto.' }));
  return {
    summary: good ? 'Entrega completa que demuestra el objetivo del curso.' : 'La entrega es demasiado breve para demostrar el objetivo.',
    criteria,
    strengths: good ? ['Aplica los conceptos', 'Estructura clara'] : ['Intento inicial'],
    improvements: good ? ['Añade un ejemplo adicional'] : ['Desarrolla cada entregable', 'Explica tus decisiones'],
    overall_score: s,
  };
}

const GENERATORS: Record<string, (input: AnyInput) => unknown> = {
  intake,
  plan,
  plan_revision: planRevision,
  add_content: addContent,
  stage_outline: outline,
  activity,
  reinforcement,
  evaluate,
  quiz,
  project,
  project_eval: projectEval,
};
