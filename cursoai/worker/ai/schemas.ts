import { z } from 'zod';

// Output schemas for structured AI calls. Kept free of numeric/string length
// constraints (unsupported by structured outputs); sizes are clamped in code.

export const ACTIVITY_TYPES = [
  'lesson',
  'practice',
  'simulation',
  'conversation',
  'case',
  'challenge',
  'reinforcement',
] as const;

export const EXERCISE_KINDS = [
  'multiple_choice',
  'true_false',
  'short_answer',
  'problem',
  'code',
  'scenario',
  'conversation',
] as const;

export const DOMAINS = [
  'programming',
  'language',
  'math',
  'finance',
  'business',
  'office_tools',
  'creative',
  'practical_skills',
  'science',
  'technology',
  'humanities',
  'health',
  'law',
  'career',
  'general',
] as const;

export const IntakeSchema = z.object({
  allowed: z.boolean(),
  refusal_reason: z.string().nullable(),
  topic: z.string(),
  goal: z.string(),
  goal_explicit: z.boolean(),
  goal_type: z.enum(['employment', 'conversation', 'money_management', 'business', 'academic', 'hobby', 'career', 'wellbeing', 'certification', 'other']),
  level: z.enum(['beginner', 'intermediate', 'advanced']).nullable(),
  level_explicit: z.boolean(),
  daily_minutes: z.number().int().nullable(),
  prior_knowledge: z.string().nullable(),
  domain: z.enum(DOMAINS),
  sensitivity: z.enum(['none', 'financial', 'health', 'legal', 'psychology']),
  volatility: z.enum(['stable', 'changing']),
  questions: z.array(
    z.object({
      id: z.enum(['level', 'goal', 'time', 'prior', 'context']),
      question: z.string(),
      options: z.array(z.string()),
    }),
  ),
});
export type IntakeOut = z.infer<typeof IntakeSchema>;

const StageSchema = z.object({
  title: z.string(),
  kind_label: z.string(),
  objective: z.string(),
  estimated_minutes: z.number().int(),
  competencies: z.array(z.string()),
  concepts: z.array(z.object({ name: z.string(), description: z.string() })),
  activity_types: z.array(z.enum(ACTIVITY_TYPES)),
});
export type StageOut = z.infer<typeof StageSchema>;

export const PlanSchema = z.object({
  title: z.string(),
  goal_outcome: z.string(),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  estimated_hours: z.number(),
  daily_minutes: z.number().int(),
  approach: z.string(),
  structure_rationale: z.string(),
  competencies: z.array(z.object({ name: z.string(), description: z.string() })),
  stages: z.array(StageSchema),
  final_project: z.object({ title: z.string(), brief: z.string() }).nullable(),
  safety_note: z.string().nullable(),
});
export type PlanOut = z.infer<typeof PlanSchema>;

export const AddStageSchema = z.object({ stage: StageSchema, insert_after: z.number().int() });

export const StageOutlineSchema = z.object({
  activities: z.array(
    z.object({
      type: z.enum(ACTIVITY_TYPES),
      title: z.string(),
      goal: z.string(),
      concepts: z.array(z.string()),
    }),
  ),
});
export type StageOutlineOut = z.infer<typeof StageOutlineSchema>;

export const ExerciseSchema = z.object({
  kind: z.enum(EXERCISE_KINDS),
  concept: z.string(),
  prompt: z.string(),
  context: z.string(),
  options: z.array(z.string()),
  correct_option_index: z.number().int().nullable(),
  correct_boolean: z.boolean().nullable(),
  reference_answer: z.string(),
  rubric: z.string(),
  explanation: z.string(),
});
export type ExerciseOut = z.infer<typeof ExerciseSchema>;

export const ActivityContentSchema = z.object({
  intro: z.string(),
  blocks: z.array(
    z.object({
      kind: z.enum(['text', 'example', 'analogy', 'tip', 'warning', 'summary', 'code']),
      title: z.string(),
      body: z.string(),
      language: z.string(),
    }),
  ),
  exercises: z.array(ExerciseSchema),
});
export type ActivityContentOut = z.infer<typeof ActivityContentSchema>;

export const EvaluationSchema = z.object({
  verdict: z.enum(['correct', 'partial', 'incorrect']),
  score: z.number(),
  feedback: z.string(),
  misconception: z.string().nullable(),
  next_turn: z.string().nullable(),
});
export type EvaluationOut = z.infer<typeof EvaluationSchema>;

export const QuizSchema = z.object({
  title: z.string(),
  questions: z.array(ExerciseSchema),
});
export type QuizOut = z.infer<typeof QuizSchema>;

export const ProjectSchema = z.object({
  title: z.string(),
  brief: z.string(),
  deliverables: z.array(z.string()),
  criteria: z.array(z.string()),
});
export type ProjectOut = z.infer<typeof ProjectSchema>;

export const ProjectEvalSchema = z.object({
  summary: z.string(),
  criteria: z.array(z.object({ criterion: z.string(), score: z.number(), comment: z.string() })),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  overall_score: z.number(),
});
export type ProjectEvalOut = z.infer<typeof ProjectEvalSchema>;
