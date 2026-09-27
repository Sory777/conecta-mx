import type {
  AnswerResult,
  CertificateDTO,
  CourseDetail,
  CoursePlan,
  CourseSummary,
  DashboardDTO,
  Intake,
  LessonDTO,
  NextStep,
  ProjectDTO,
  QuizDTO,
  QuizResult,
  RegenAction,
  TutorMessage,
  UsageDTO,
  UserDTO,
} from '../../shared/types';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network', 'Sin conexión. Revisa tu internet e inténtalo de nuevo.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, data?.error?.code ?? 'error', data?.error?.message ?? 'Ocurrió un error.');
  }
  return data as T;
}

const get = <T,>(p: string) => request<T>('GET', p);
const post = <T,>(p: string, b: unknown = {}) => request<T>('POST', p, b);

export interface ProfileResponse {
  user: UserDTO;
  preferences: { daily_minutes: number; explanation_style: 'concise' | 'balanced' | 'detailed'; practice_first: boolean };
  profile: { learning_pace: string; background: string } | null;
  usage: UsageDTO;
  achievements: { kind: string; title: string; created_at: string }[];
}

export interface ProgressResponse {
  courses: CourseSummary[];
  history: { kind: string; detail: string; created_at: string; course_id: string | null; course_title: string | null }[];
  stats: { answers: number; correct: number };
}

export const api = {
  me: () => get<{ user: UserDTO | null }>('/auth/me'),
  register: (email: string, password: string, name: string) => post<{ user: UserDTO }>('/auth/register', { email, password, name }),
  login: (email: string, password: string) => post<{ user: UserDTO }>('/auth/login', { email, password }),
  logout: () => post<{ ok: true }>('/auth/logout'),

  dashboard: () => get<DashboardDTO>('/dashboard'),
  profile: () => get<ProfileResponse>('/profile'),
  updateProfile: (patch: Partial<{ name: string; daily_minutes: number; explanation_style: string; practice_first: boolean; background: string }>) =>
    request<ProfileResponse>('PATCH', '/profile', patch),
  progress: () => get<ProgressResponse>('/progress'),

  createCourse: (req: string) => post<{ course_id: string; intake: Intake }>('/courses', { request: req }),
  courses: () => get<{ courses: CourseSummary[] }>('/courses'),
  course: (id: string) => get<CourseDetail>(`/courses/${id}`),
  createPlan: (id: string, answers: Record<string, string>) => post<CourseDetail>(`/courses/${id}/plan`, { answers }),
  revisePlan: (id: string, feedback: string) => post<CourseDetail>(`/courses/${id}/plan/revise`, { feedback }),
  acceptPlan: (id: string) => post<CourseDetail>(`/courses/${id}/plan/accept`),
  updateCourse: (id: string, patch: { title?: string; status?: 'active' | 'paused' }) => request<CourseDetail>('PATCH', `/courses/${id}`, patch),
  deleteCourse: (id: string) => request<{ ok: true }>('DELETE', `/courses/${id}`),
  duplicateCourse: (id: string) => post<{ course_id: string }>(`/courses/${id}/duplicate`),
  resetCourse: (id: string) => post<CourseDetail>(`/courses/${id}/reset`),
  shareCourse: (id: string, enabled: boolean) => post<{ share_code: string | null }>(`/courses/${id}/share`, { enabled }),
  addContent: (id: string, req: string) => post<CourseDetail>(`/courses/${id}/content`, { request: req }),
  shared: (code: string) =>
    get<{ code: string; title: string; topic: string; level: string; plan: CoursePlan; disclaimer: string | null }>(`/shared/${code}`),
  importShared: (code: string) => post<{ course_id: string }>(`/shared/${code}/import`),

  next: (courseId: string) => get<NextStep>(`/courses/${courseId}/next`),
  lesson: (id: string) => get<LessonDTO>(`/lessons/${id}`),
  regenerate: (id: string, action: RegenAction) => post<LessonDTO>(`/lessons/${id}/regenerate`, { action }),
  variant: (id: string, action: RegenAction | null) => post<LessonDTO>(`/lessons/${id}/variant`, { action }),
  completeLesson: (id: string) => post<{ next: NextStep }>(`/lessons/${id}/complete`),
  answer: (exerciseId: string, response: string, conversation?: { role: 'alumno' | 'interlocutor'; text: string }[]) =>
    post<AnswerResult>(`/exercises/${exerciseId}/answer`, { response, conversation }),

  createQuiz: (courseId: string, moduleId: string | null = null) => post<QuizDTO>(`/courses/${courseId}/quiz`, { module_id: moduleId }),
  quiz: (id: string) => get<QuizDTO>(`/quizzes/${id}`),
  submitQuiz: (id: string, answers: Record<string, string>) => post<QuizResult>(`/quizzes/${id}/submit`, { answers }),
  project: (courseId: string) => get<ProjectDTO>(`/courses/${courseId}/project`),
  submitProject: (courseId: string, content: string) => post<ProjectDTO>(`/courses/${courseId}/project/submit`, { content }),
  issueCertificate: (courseId: string, name?: string) => post<CertificateDTO>(`/courses/${courseId}/certificate`, { name }),
  certificate: (code: string) => get<CertificateDTO>(`/certificates/${code}`),

  tutor: (courseId: string) => get<{ messages: TutorMessage[] }>(`/courses/${courseId}/tutor`),
  askTutor: (courseId: string, message: string, lessonId: string | null) =>
    post<{ messages: TutorMessage[] }>(`/courses/${courseId}/tutor`, { message, lesson_id: lessonId }),
};
