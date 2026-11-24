# EduLearn

Type any topic and get a course built around you: a guided intake, a generated
curriculum, lessons written in the tone you pick, quizzes that find your weak
spots, recommendations to fix them, and flashcards. Progress is saved in SQLite.

## Run it

```bash
cp .env.example .env.local   # then fill in NEBIUS_API_KEY and TAVILY_API_KEY
npm install
npm run dev                  # http://localhost:3000
```

Production: `npm run build && npm start`. The database is created on first use
at `data/edulearn.db` (override with `DATABASE_PATH`), so the host needs a
persistent disk.

## What it does

- **Intake** — topic → 2 topic-specific clarifying questions → teaching style
  (Explain like I'm 10 / Beginner / Some experience / Professional / your own
  words) → length (5 minutes to 2 months).
- **Curriculum** — modules, lessons, time estimates and trackable concepts,
  grounded in Tavily web search, with web resources per module.
- **Lessons** — written on first open (streamed), then served from the DB.
  A tutor chat on every lesson answers questions and re-explains.
- **Quizzes** — multiple choice plus an LLM-graded short answer, every
  question tagged with a concept. Submitting a lesson quiz completes the lesson.
- **Weak spots** — per-concept mastery; a concept is weak below 60%. Each weak
  concept gets a diagnosis, concrete steps, lessons to revisit and web
  resources, plus a practice quiz that targets only weak concepts.
- **Flashcards** — generated from weak spots, reviewed with Leitner boxes.
- **Dashboard** — progress ring, 12-week study heatmap and streak, a "Next up"
  card with an illustration the model draws for the course (SVG line art,
  generated once in the background and stored), a lesson-by-lesson path, daily
  plan for multi-day courses, and a log of study sessions with the weak spots
  at the end of each.

## Debug mode

Switch on **Debug** in the header to open a live activity panel: every model
call (purpose, model, tokens, duration), web search (query and results) and
database write, as it happens. Click a row to see the full prompt and reply.
The switch is remembered per browser. The log is the server's last 300 events,
held in memory, so it resets on restart.

Set `EDULEARN_DEBUG=1` to also print each event to the server console.

## Stack

Next.js (App Router) + TypeScript + Tailwind, SQLite via `better-sqlite3`,
Nebius Token Factory through the OpenAI SDK, Tavily for search, Zod to validate
every model reply. All model and search calls run server-side.

| Path | What |
|---|---|
| `lib/db.ts` | schema and connection |
| `lib/logic.ts` | pure rules: mastery, progress, scheduling, streak, daily plan |
| `lib/courses.ts` | intake, curriculum, lessons, tutor |
| `lib/quiz.ts` | quiz generation, grading, mastery updates |
| `lib/review.ts` | weak spots, recommendations, flashcards |
| `lib/session.ts` | study sessions and streak |
| `app/api/**` | JSON / streaming route handlers |
| `app/**/page.tsx` | pages |

## Checks

```bash
npm test          # unit tests for the rules in lib/logic.ts and the schema
npm run lint
npm run typecheck
```
