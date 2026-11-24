# EduLearn — Plan

A web app where a learner types any topic, answers a few guiding questions, and
gets a personalised curriculum with lessons, quizzes, weakness tracking,
recommendations and flashcards. Progress is persisted in SQLite.

Status: **built.** Decisions taken and deviations from the original plan are in section 8.

## 1. Learner journey

1. **Landing** — one text input: "What do you want to learn?"
2. **Guided intake** (short chat-style wizard, 3–5 steps). The LLM asks
   topic-specific follow-ups; the fixed ones are:
   - Goal / what exactly they want out of it (free text, LLM clarifies scope)
   - Current knowledge of the topic
   - Tone / level: beginner, professional, "explain like I'm 10", custom
   - Length: 5 min · 30 min · 2 hours · 1 week · 2 weeks · 1 month · 2 months
3. **Curriculum preview** — generated outline (modules → lessons, time
   estimates, web resources). Learner can accept or ask for a regeneration
   with a change request ("more practice, less theory").
4. **Course dashboard** — progress bar, module list, next lesson, weak topics,
   flashcards due.
5. **Lesson view** — lesson content generated on first open (then cached),
   written in the chosen tone, with cited resources. "Mark complete" → quiz.
6. **Quiz** — per lesson (3–5 questions) and per module (longer). Multiple
   choice plus short answer graded by the LLM. Each question is tagged with
   the concept(s) it tests.
7. **Results & weaknesses** — wrong answers update per-concept mastery.
   The learner sees weak concepts, an explanation of what went wrong, and
   recommendations: what to re-read, targeted resources, a practice quiz
   focused only on weak concepts.
8. **Flashcards** — one click generates cards for weak concepts. Review mode
   with "knew it / didn't" using simple spaced repetition (Leitner boxes).

A 5-minute course collapses to: one lesson → one quiz → results. A 2-month
course is modules by week with a schedule and a progress bar across the whole
plan.

## 2. Architecture

| Layer | Choice | Why |
|---|---|---|
| App | Next.js (App Router) + TypeScript | UI and API in one deployable, fast to build |
| UI | Tailwind CSS | Quick, clean, responsive |
| DB | SQLite via `better-sqlite3` + Drizzle ORM | Required; typed schema and migrations |
| LLM | Nebius Token Factory (OpenAI-compatible API, `openai` SDK with custom base URL) | Required |
| Search | Tavily search API | Required |
| Validation | Zod schemas for every LLM JSON response | LLM output must be validated before it is stored |

All LLM and Tavily calls happen server-side in API routes; keys never reach
the browser.

### LLM usage

- Base URL `https://api.tokenfactory.nebius.com/v1/` (verified reachable with
  the provided key; 25 models available).
- Two configurable model slots via env: a **strong** model for curriculum and
  lesson generation and grading, and a **fast** model for intake questions,
  quiz generation and flashcards. Final picks are made by testing JSON
  reliability and latency during implementation.
- Structured JSON output for curriculum, quizzes, grading and flashcards;
  streaming for lesson text so the learner is not staring at a spinner.
- One retry with the validation error fed back when JSON fails the schema.

### Web search usage

- At curriculum time: one Tavily search per module to ground the outline and
  collect resources (title, URL, snippet).
- At lesson time: lesson content is generated with those snippets as context
  and links them as "further reading".
- At recommendation time: a targeted search per weak concept.
- Results are cached in the DB so a course is not re-searched on every view.

## 3. Data model (SQLite)

- `learners` — id, display name, created_at
- `courses` — id, learner_id, topic, goal, tone, prior_knowledge,
  length_preset, status, created_at
- `modules` — id, course_id, position, title, summary, est_minutes
- `lessons` — id, module_id, position, title, objectives, content (nullable
  until generated), est_minutes, completed_at
- `concepts` — id, course_id, name (the unit weaknesses are tracked on)
- `lesson_concepts` — lesson_id, concept_id
- `resources` — id, course_id, module_id, concept_id, title, url, snippet
- `quizzes` — id, course_id, lesson_id / module_id, kind
  (lesson | module | weakness-practice), created_at
- `questions` — id, quiz_id, type, prompt, options, correct_answer,
  explanation, concept_id
- `attempts` — id, quiz_id, started_at, finished_at, score
- `answers` — id, attempt_id, question_id, response, is_correct, feedback
- `concept_mastery` — course_id, concept_id, correct, incorrect, mastery
  (0–1), last_seen_at → **the weakness store**
- `recommendations` — id, course_id, concept_id, text, resource ids,
  created_at, dismissed_at
- `flashcards` — id, course_id, concept_id, front, back, box, due_at
- `study_sessions` — id, course_id, started_at, ended_at, lessons_done,
  quizzes_done, weaknesses_snapshot (JSON)

Progress = completed lessons ÷ total lessons (weighted by estimated minutes),
shown as the progress bar. A concept is "weak" when mastery is below a
threshold after at least two answers.

## 4. API routes

- `POST /api/intake` — next guiding question or "ready" with collected profile
- `POST /api/courses` — generate and store a curriculum (search + LLM)
- `GET /api/courses`, `GET /api/courses/:id` — list / detail with progress
- `POST /api/lessons/:id/generate` (streamed), `POST /api/lessons/:id/complete`
- `POST /api/quizzes` — generate for lesson, module or weak concepts
- `POST /api/quizzes/:id/attempts` — submit answers, grade, update mastery
- `GET /api/courses/:id/weaknesses` — weak concepts + recommendations
- `POST /api/courses/:id/flashcards` — generate from weaknesses
- `POST /api/flashcards/:id/review` — record result, reschedule

## 5. Build order

1. Scaffold: Next.js, Tailwind, Drizzle schema + migrations, `.env.example`,
   LLM and Tavily clients with Zod validation
2. Intake wizard → curriculum generation → course dashboard with progress bar
3. Lesson generation (streamed, cached) and completion tracking
4. Quizzes, grading, concept mastery, study sessions
5. Weakness view, recommendations, weakness-practice quiz
6. Flashcards with review mode
7. Polish: loading and error states, empty states, mobile layout, README
8. Verification: unit tests for mastery/progress/scheduling logic, and an
   end-to-end browser run of the full journey against the real APIs

## 6. Secrets

API keys live only in `.env.local` (git-ignored). The repo gets a
`.env.example` with empty `NEBIUS_API_KEY` and `TAVILY_API_KEY`. Keys are never
committed, logged, or sent to the client.

## 7. Suggested improvements (beyond the brief)

- **Diagnostic quiz before the curriculum** — a short pre-test so the course
  skips what the learner already knows.
- **Adaptive curriculum** — after a module quiz, insert a remedial lesson for
  weak concepts or let strong learners skip ahead.
- **"Explain it differently"** button on any lesson paragraph or quiz answer.
- **Ask-a-tutor chat** scoped to the current lesson.
- **Daily plan and streak** for long courses ("today: 20 minutes, 2 lessons").
- **Export** flashcards to Anki / CSV.

## 8. Decisions and what changed while building

Answers to the open questions:

- **Stack** — Next.js + TypeScript.
- **Users** — no login; one local learner.
- **Branch** — `main`.
- **Extras in the first build** — tutor chat (with "explain this differently")
  and daily plan + streak. Diagnostic pre-quiz and adaptive curriculum are not
  built.

Deviations from the sections above:

- **No Drizzle** — plain `better-sqlite3` with the schema in `lib/db.ts`.
- **No `learners` table** — there is a single local learner.
- **Mastery lives on `concepts`** (`correct`, `incorrect`, `mastery`,
  `last_seen_at`) instead of a separate `concept_mastery` table. Mastery is a
  moving average: the first answer sets it, each later answer moves it halfway.
  A concept is weak below 60%, so one miss is weak until two correct answers.
- **Quiz kinds** — lesson quizzes and weak-spot practice quizzes. Module quizzes
  are not built.
- **Curriculum preview / regenerate with a change request** — not built; the
  course page is the preview and a course can be deleted and rebuilt.
- **Models** — `openai/gpt-oss-120b` for everything by default. A stronger
  reasoning model (Kimi K3.1 Pro) wrote a slightly richer outline but took
  ~3 minutes for a 2-month course against ~20 seconds, so it is an opt-in via
  `LLM_MODEL_STRONG`.
- **Added** — `tutor_messages` table; flashcard export is not built.
