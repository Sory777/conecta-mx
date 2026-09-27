// Types shared between the Worker API and the React client.
// Only data that is safe to send to the browser appears here
// (no answer keys, rubrics or password hashes).

export type MasteryState = 'not_started' | 'learning' | 'needs_reinforcement' | 'mastered';
export type CourseStatus = 'diagnosing' | 'planning' | 'active' | 'paused' | 'completed';
export type Sensitivity = 'none' | 'financial' | 'health' | 'legal' | 'psychology';
export type ActivityType =
  | 'lesson'
  | 'practice'
  | 'simulation'
  | 'conversation'
  | 'case'
  | 'challenge'
  | 'project'
  | 'reinforcement'
  | 'quiz';
export type ExerciseKind =
  | 'multiple_choice'
  | 'true_false'
  | 'short_answer'
  | 'problem'
  | 'code'
  | 'scenario'
  | 'conversation';
export type RegenAction =
  | 'simpler'
  | 'advanced'
  | 'more_examples'
  | 'more_practical'
  | 'eli10';

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  plan: 'free' | 'premium';
}

export interface DiagnosticQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface Intake {
  topic: string;
  goal: string;
  goal_type: string;
  level: string | null;
  daily_minutes: number | null;
  prior_knowledge: string | null;
  domain: string;
  sensitivity: Sensitivity;
  volatility: 'stable' | 'changing';
  questions: DiagnosticQuestion[];
}

export interface PlanStage {
  title: string;
  kind_label: string;
  objective: string;
  estimated_minutes: number;
  competencies: string[];
  concepts: { name: string; description: string }[];
  activity_types: ActivityType[];
}

export interface CoursePlan {
  title: string;
  goal_outcome: string;
  level: string;
  estimated_hours: number;
  daily_minutes: number;
  approach: string;
  structure_rationale: string;
  competencies: { name: string; description: string }[];
  stages: PlanStage[];
  final_project: { title: string; brief: string } | null;
  safety_note: string | null;
}

export interface CourseSummary {
  id: string;
  title: string;
  topic: string;
  goal: string;
  goal_outcome: string;
  level: string;
  status: CourseStatus;
  sensitivity: Sensitivity;
  progress: number; // 0..100
  shared: boolean;
  source_course_id: string | null;
  last_activity_at: string;
  created_at: string;
  current_lesson: { id: string; title: string } | null;
  weak_concepts: number;
  mastered_concepts: number;
  total_concepts: number;
}

export interface ConceptDTO {
  id: string;
  name: string;
  description: string;
  module_id: string | null;
  competency_id: string | null;
  state: MasteryState;
  score: number;
}

export interface CompetencyDTO {
  id: string;
  name: string;
  description: string;
  state: MasteryState;
  score: number;
  concepts: number;
}

export interface LessonSummary {
  id: string;
  module_id: string;
  position: number;
  type: ActivityType;
  title: string;
  goal: string;
  status: 'not_started' | 'in_progress' | 'completed';
  ready: boolean;
}

export interface ModuleDTO {
  id: string;
  position: number;
  title: string;
  kind_label: string;
  objective: string;
  estimated_minutes: number;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  lessons: LessonSummary[];
}

export interface CourseDetail {
  course: CourseSummary & {
    domain: string;
    volatility: 'stable' | 'changing';
    daily_minutes: number | null;
    intake: Intake | null;
    diagnostic_answers: Record<string, string>;
  };
  plan: { id: string; version: number; status: string; plan: CoursePlan; feedback: string | null } | null;
  modules: ModuleDTO[];
  competencies: CompetencyDTO[];
  concepts: ConceptDTO[];
  project: ProjectDTO | null;
  certificate: { code: string } | null;
  disclaimer: string | null;
}

export type ContentBlock =
  | { kind: 'text' | 'example' | 'analogy' | 'tip' | 'warning' | 'summary'; title: string; body: string }
  | { kind: 'code'; title: string; body: string; language: string };

export interface ExerciseDTO {
  id: string;
  kind: ExerciseKind;
  prompt: string;
  context: string;
  options: string[];
  concept_id: string | null;
  last_answer: AnswerResult | null;
}

export interface SourceDTO {
  url: string;
  title: string;
  page_age: string | null;
  retrieved_at: string;
}

export interface LessonDTO {
  id: string;
  course_id: string;
  module_id: string;
  type: ActivityType;
  title: string;
  goal: string;
  status: 'not_started' | 'in_progress' | 'completed';
  intro: string;
  blocks: ContentBlock[];
  exercises: ExerciseDTO[];
  active_variant: RegenAction | null;
  available_variants: RegenAction[];
  info_kind: 'general' | 'current';
  verified_at: string | null;
  verification_note: string | null;
  sources: SourceDTO[];
  concepts: { id: string; name: string; state: MasteryState }[];
  disclaimer: string | null;
}

export interface AnswerResult {
  verdict: 'correct' | 'partial' | 'incorrect';
  score: number;
  feedback: string;
  correct_answer: string | null;
  misconception: string | null;
  next_turn: string | null; // conversation exercises: the counterpart's reply
  mastery: { concept_id: string; state: MasteryState; score: number } | null;
}

export interface QuizDTO {
  id: string;
  kind: 'mini' | 'stage' | 'final' | 'on_demand';
  title: string;
  course_id: string;
  module_id: string | null;
  pass_score: number;
  questions: {
    id: string;
    kind: ExerciseKind;
    prompt: string;
    context: string;
    options: string[];
  }[];
  last_result: QuizResult | null;
}

export interface QuizResult {
  score: number;
  passed: boolean;
  results: ({ question_id: string } & AnswerResult)[];
  next?: NextStep | null;
}

export interface ProjectDTO {
  id: string;
  title: string;
  brief: string;
  deliverables: string[];
  criteria: string[];
  last_submission: {
    content: string;
    score: number;
    passed: boolean;
    evaluation: ProjectEvaluation;
    created_at: string;
  } | null;
}

export interface ProjectEvaluation {
  summary: string;
  criteria: { criterion: string; score: number; comment: string }[];
  strengths: string[];
  improvements: string[];
}

export type NextStep =
  | { kind: 'lesson'; lesson_id: string; title: string; reason: string }
  | { kind: 'quiz'; quiz_id: string; title: string; reason: string }
  | { kind: 'project'; reason: string }
  | { kind: 'certificate'; reason: string }
  | { kind: 'done'; reason: string };

export interface TutorMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface DashboardDTO {
  user: UserDTO;
  resume: {
    course_id: string;
    course_title: string;
    lesson_id: string | null;
    lesson_title: string | null;
    last_activity_at: string;
    message: string;
  } | null;
  courses: CourseSummary[];
  recommendations: { course_id: string; text: string; lesson_id?: string }[];
}

export interface UsageDTO {
  plan: 'free' | 'premium';
  limits: { active_courses: number; ai_generations_per_day: number; tutor_messages_per_day: number };
  used: { active_courses: number; ai_generations_today: number; tutor_messages_today: number };
}

export interface CertificateDTO {
  code: string;
  recipient_name: string;
  course_title: string;
  goal_outcome: string;
  result_summary: string;
  score: number;
  hours: number;
  issued_at: string;
  disclaimer: string;
}
