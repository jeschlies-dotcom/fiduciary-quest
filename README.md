# ⚖️ Fiduciary Quest

A gamified study app for the **California Professional Fiduciary Licensing Exam**.

**Live:** https://jeschlies-dotcom.github.io/fiduciary-quest/

Companion to [fiduciary-exam-prep](https://github.com/jeschlies-dotcom/fiduciary-exam-prep) (the classic quiz/flashcard app) — shares the same question bank and Firebase project.

## What's inside

- **🗂️ The Caseload** — career-sim case files. Multi-chapter client stories where every decision point is a disguised exam scenario with *tiered* answers (Best / Acceptable / Poor / Harmful). Trains the "two answers look right — pick the better one" skill the real exam tests. Reputation and Surcharge Risk meters, court review endings, replay for a better ruling.
- **🕹️ Arcade** — Lightning Round (60s), Survival (3 lives, ramping difficulty), Better Call (correct vs. plausible distractor head-to-head), Term Match (glossary pairs).
- **📜 Daily quests, XP, levels, ranks, streaks, achievements** — the dopamine layer.
- **📊 Mastery** — per-domain medals (bronze→platinum) weighted by real PSI exam percentages; readiness score; redemption queue of missed questions.
- **☁️ Cloud sync** — Firebase RTDB (same project as the practice app, stored under `users/<name>/quest`), plus JSON export/import.
- **PWA** — installable, offline-capable.

## Architecture

Static site, no build step. `index.html` + `css/style.css` + `js/app.js`.
Data files in `data/`:
- `question_bank.json` — 300 exam-style questions (synced from fiduciary-exam-prep)
- `cases.json` — 12 authored case files (72 decision points)
- `glossary.json` — key terms + deadline timelines from the master study guide

State lives in `localStorage` under `fq_state`.

## Content rules

When generating/editing JSON content: always write **UTF-8 without BOM** (mojibake history — see fiduciary-exam-prep PROJECT_HANDOVER).
