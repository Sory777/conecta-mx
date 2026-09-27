-- CursoAI initial schema (Cloudflare D1 / SQLite).
-- Every user-owned row is reachable through a user_id column or through
-- courses.user_id; the API layer always filters by it (see worker/db.ts).

PRAGMA foreign_keys = ON;

-- ───────────── Identity ─────────────
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  plan          TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,               -- sha256(token); the raw token only lives in the cookie
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- Learning profile: what the platform has learned about the learner.
CREATE TABLE user_profiles (
  user_id          TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  learning_pace    TEXT NOT NULL DEFAULT 'normal' CHECK (learning_pace IN ('slow', 'normal', 'fast')),
  background       TEXT NOT NULL DEFAULT '',   -- prior knowledge in the learner's words
  strengths_json   TEXT NOT NULL DEFAULT '[]',
  weaknesses_json  TEXT NOT NULL DEFAULT '[]',
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Explicit preferences the learner sets.
CREATE TABLE user_preferences (
  user_id            TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  daily_minutes      INTEGER NOT NULL DEFAULT 30,
  explanation_style  TEXT NOT NULL DEFAULT 'balanced' CHECK (explanation_style IN ('concise', 'balanced', 'detailed')),
  practice_first     INTEGER NOT NULL DEFAULT 1,
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ───────────── Courses ─────────────
CREATE TABLE courses (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  topic              TEXT NOT NULL,
  goal               TEXT NOT NULL,
  goal_type          TEXT NOT NULL DEFAULT 'personal',
  goal_outcome       TEXT NOT NULL DEFAULT '',     -- "Al terminar podrás…"
  level              TEXT NOT NULL DEFAULT 'beginner',
  domain             TEXT NOT NULL DEFAULT 'general',
  sensitivity        TEXT NOT NULL DEFAULT 'none' CHECK (sensitivity IN ('none', 'financial', 'health', 'legal', 'psychology')),
  volatility         TEXT NOT NULL DEFAULT 'stable' CHECK (volatility IN ('stable', 'changing')),
  status             TEXT NOT NULL DEFAULT 'diagnosing'
                     CHECK (status IN ('diagnosing', 'planning', 'active', 'paused', 'completed')),
  original_request   TEXT NOT NULL,
  intake_json        TEXT NOT NULL DEFAULT '{}',   -- AI interpretation + diagnostic Q&A
  daily_minutes      INTEGER,
  current_module_id  TEXT,
  current_lesson_id  TEXT,
  source_course_id   TEXT,                          -- set when duplicated / imported
  share_code         TEXT UNIQUE,                   -- set when the owner shares the plan
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_activity_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  completed_at       TEXT
);
CREATE INDEX idx_courses_user ON courses(user_id, last_activity_at DESC);

CREATE TABLE course_plans (
  id          TEXT PRIMARY KEY,
  course_id   TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  version     INTEGER NOT NULL,
  plan_json   TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'accepted', 'superseded')),
  feedback    TEXT,                                 -- the change request that produced this version
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (course_id, version)
);

-- Stages. The AI picks the label ("Etapa", "Situación", "Técnica"…).
CREATE TABLE modules (
  id               TEXT PRIMARY KEY,
  course_id        TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  position         INTEGER NOT NULL,
  title            TEXT NOT NULL,
  kind_label       TEXT NOT NULL DEFAULT 'Etapa',
  objective        TEXT NOT NULL DEFAULT '',
  estimated_minutes INTEGER NOT NULL DEFAULT 60,
  status           TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'available', 'in_progress', 'completed')),
  outline_ready    INTEGER NOT NULL DEFAULT 0,      -- activities generated for this stage?
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_modules_course ON modules(course_id, position);

CREATE TABLE competencies (
  id          TEXT PRIMARY KEY,
  course_id   TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_competencies_course ON competencies(course_id);

CREATE TABLE concepts (
  id             TEXT PRIMARY KEY,
  course_id      TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_id      TEXT REFERENCES modules(id) ON DELETE SET NULL,
  competency_id  TEXT REFERENCES competencies(id) ON DELETE SET NULL,
  position       INTEGER NOT NULL DEFAULT 0,
  name           TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_concepts_course ON concepts(course_id);
CREATE INDEX idx_concepts_module ON concepts(module_id);

CREATE TABLE concept_mastery (
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  concept_id   TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  course_id    TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  state        TEXT NOT NULL DEFAULT 'not_started'
               CHECK (state IN ('not_started', 'learning', 'needs_reinforcement', 'mastered')),
  score        REAL NOT NULL DEFAULT 0,
  attempts     INTEGER NOT NULL DEFAULT 0,
  correct      INTEGER NOT NULL DEFAULT 0,
  wrong_streak INTEGER NOT NULL DEFAULT 0,
  last_error   TEXT,
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, concept_id)
);
CREATE INDEX idx_mastery_course ON concept_mastery(user_id, course_id);

-- Activities. type decides how the player renders them.
CREATE TABLE lessons (
  id                TEXT PRIMARY KEY,
  course_id         TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_id         TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  position          INTEGER NOT NULL,
  type              TEXT NOT NULL CHECK (type IN
                    ('lesson', 'practice', 'simulation', 'conversation', 'case', 'challenge', 'project', 'reinforcement', 'quiz')),
  title             TEXT NOT NULL,
  goal              TEXT NOT NULL DEFAULT '',
  concept_ids_json  TEXT NOT NULL DEFAULT '[]',
  content_json      TEXT,                           -- NULL until generated on demand
  variants_json     TEXT NOT NULL DEFAULT '{}',     -- regenerations keyed by action; original kept in content_json
  active_variant    TEXT,                           -- NULL = original
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready')),
  info_kind         TEXT NOT NULL DEFAULT 'general' CHECK (info_kind IN ('general', 'current')),
  verified_at       TEXT,
  generated_at      TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_lessons_module ON lessons(module_id, position);
CREATE INDEX idx_lessons_course ON lessons(course_id);

CREATE TABLE lesson_progress (
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id      TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_id      TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  started_at     TEXT,
  completed_at   TEXT,
  PRIMARY KEY (user_id, lesson_id)
);
CREATE INDEX idx_progress_course ON lesson_progress(user_id, course_id);

-- Open or auto-graded exercises attached to an activity.
CREATE TABLE exercises (
  id           TEXT PRIMARY KEY,
  lesson_id    TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_id    TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  concept_id   TEXT REFERENCES concepts(id) ON DELETE SET NULL,
  position     INTEGER NOT NULL,
  variant      TEXT NOT NULL DEFAULT '',            -- '' = original content, else the regeneration action
  kind         TEXT NOT NULL CHECK (kind IN
               ('multiple_choice', 'true_false', 'short_answer', 'problem', 'code', 'scenario', 'conversation')),
  prompt       TEXT NOT NULL,
  context      TEXT NOT NULL DEFAULT '',            -- data, client message, dialogue line…
  options_json TEXT NOT NULL DEFAULT '[]',
  answer_json  TEXT NOT NULL DEFAULT 'null',        -- NEVER sent to the client
  rubric       TEXT NOT NULL DEFAULT '',            -- NEVER sent to the client
  explanation  TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_exercises_lesson ON exercises(lesson_id, variant, position);

CREATE TABLE quizzes (
  id          TEXT PRIMARY KEY,
  course_id   TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_id   TEXT REFERENCES modules(id) ON DELETE CASCADE,
  lesson_id   TEXT REFERENCES lessons(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('mini', 'stage', 'final', 'on_demand')),
  title       TEXT NOT NULL,
  pass_score  REAL NOT NULL DEFAULT 0.7,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_quizzes_course ON quizzes(course_id);

CREATE TABLE questions (
  id           TEXT PRIMARY KEY,
  quiz_id      TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  concept_id   TEXT REFERENCES concepts(id) ON DELETE SET NULL,
  position     INTEGER NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN
               ('multiple_choice', 'true_false', 'short_answer', 'problem', 'code', 'scenario', 'conversation')),
  prompt       TEXT NOT NULL,
  context      TEXT NOT NULL DEFAULT '',
  options_json TEXT NOT NULL DEFAULT '[]',
  answer_json  TEXT NOT NULL DEFAULT 'null',        -- NEVER sent to the client
  rubric       TEXT NOT NULL DEFAULT '',
  explanation  TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_questions_quiz ON questions(quiz_id, position);

CREATE TABLE answers (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id      TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  exercise_id    TEXT REFERENCES exercises(id) ON DELETE CASCADE,
  question_id    TEXT REFERENCES questions(id) ON DELETE CASCADE,
  concept_id     TEXT,
  response       TEXT NOT NULL,
  score          REAL NOT NULL,
  verdict        TEXT NOT NULL CHECK (verdict IN ('correct', 'partial', 'incorrect')),
  feedback_json  TEXT NOT NULL DEFAULT '{}',
  graded_by      TEXT NOT NULL DEFAULT 'rule' CHECK (graded_by IN ('rule', 'ai')),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_answers_user_course ON answers(user_id, course_id, created_at DESC);
CREATE INDEX idx_answers_exercise ON answers(exercise_id);

CREATE TABLE projects (
  id                 TEXT PRIMARY KEY,
  course_id          TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  brief              TEXT NOT NULL,
  deliverables_json  TEXT NOT NULL DEFAULT '[]',
  criteria_json      TEXT NOT NULL DEFAULT '[]',   -- visible evaluation criteria
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE project_submissions (
  id               TEXT PRIMARY KEY,
  project_id       TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content          TEXT NOT NULL,
  evaluation_json  TEXT NOT NULL DEFAULT '{}',
  score            REAL NOT NULL DEFAULT 0,
  passed           INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_submissions_project ON project_submissions(project_id, user_id);

-- ───────────── Tutor memory ─────────────
CREATE TABLE ai_conversations (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id   TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  summary     TEXT NOT NULL DEFAULT '',             -- rolling summary of older turns
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, course_id)
);

CREATE TABLE ai_messages (
  id               TEXT PRIMARY KEY,
  conversation_id  TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role             TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content          TEXT NOT NULL,
  lesson_id        TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_messages_conversation ON ai_messages(conversation_id, created_at);

-- ───────────── Outcomes ─────────────
CREATE TABLE certificates (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id       TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  code            TEXT NOT NULL UNIQUE,             -- public verification code
  recipient_name  TEXT NOT NULL,
  course_title    TEXT NOT NULL,
  goal_outcome    TEXT NOT NULL,
  result_summary  TEXT NOT NULL,
  score           REAL NOT NULL,
  hours           REAL NOT NULL,
  issued_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, course_id)
);

CREATE TABLE achievements (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id   TEXT REFERENCES courses(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  title       TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, course_id, kind)
);

CREATE TABLE sources (
  id            TEXT PRIMARY KEY,
  course_id     TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id     TEXT REFERENCES lessons(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  title         TEXT NOT NULL DEFAULT '',
  page_age      TEXT,                               -- publication/update date reported by the search tool
  retrieved_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_sources_lesson ON sources(lesson_id);

-- ───────────── Memory, cost control, abuse protection ─────────────
CREATE TABLE activity_log (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id   TEXT REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id   TEXT,
  kind        TEXT NOT NULL,
  detail      TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_activity_user ON activity_log(user_id, created_at DESC);

CREATE TABLE usage_events (
  id                TEXT PRIMARY KEY,
  user_id           TEXT REFERENCES users(id) ON DELETE SET NULL,
  task              TEXT NOT NULL,
  model             TEXT NOT NULL,
  input_tokens      INTEGER NOT NULL DEFAULT 0,
  output_tokens     INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cost_micro_usd    INTEGER NOT NULL DEFAULT 0,
  cached            INTEGER NOT NULL DEFAULT 0,     -- 1 = served from ai_cache, no provider call
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_usage_user_day ON usage_events(user_id, created_at);
CREATE INDEX idx_usage_day ON usage_events(created_at);

CREATE TABLE ai_cache (
  key         TEXT PRIMARY KEY,                     -- sha256(task|model|normalized input)
  task        TEXT NOT NULL,
  value_json  TEXT NOT NULL,
  hits        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE rate_limits (
  key           TEXT PRIMARY KEY,
  window_start  INTEGER NOT NULL,
  count         INTEGER NOT NULL
);
