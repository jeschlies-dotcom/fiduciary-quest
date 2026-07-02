# ⚖️ Fiduciary Quest

A gamified study app for the **California Professional Fiduciary Licensing Exam**.

**Live:** https://jeschlies-dotcom.github.io/fiduciary-quest/

Companion to [fiduciary-exam-prep](https://github.com/jeschlies-dotcom/fiduciary-exam-prep) (the classic quiz/flashcard app) — shares the same question bank and Firebase project.

## What's inside

- **🗂️ The Caseload** — career-sim case files. Multi-chapter client stories where every decision point is a disguised exam scenario with *tiered* answers (Best / Acceptable / Poor / Harmful). Trains the "two answers look right — pick the better one" skill the real exam tests. Reputation and Surcharge Risk meters, court review endings, replay for a better ruling.
- **🕹️ Arcade** — Lightning Round (60s), Survival (3 lives, ramping difficulty), Better Call (correct vs. plausible distractor head-to-head), Term Match (glossary pairs). Quiz modes open with a category picker (all domains at exam weighting, or drill one).
- **🐉 The Final Boss** — full exam simulator per 2025–2026 passer intel: 100 questions drawn to real PSI domain weights, 120-minute clock (keeps running across reloads — runs are resumable), 77 to pass. PSI-style tools: flag for review, strike-out, question map. No feedback until submission; then pass/fail verdict, per-domain scoring, and explanations for every miss (which also feed the Redemption queue).
- **📜 Daily quests, XP, levels, ranks, streaks, achievements** — the dopamine layer.
- **📊 Mastery** — per-domain medals (bronze→platinum) weighted by real PSI exam percentages; readiness score; redemption queue of missed questions.
- **☁️ Cloud sync** — Firebase RTDB (same project as the practice app, stored under `users/<name>/quest`), plus JSON export/import.
- **PWA** — installable, offline-capable.

## Architecture

Static site, no build step. `index.html` + `css/style.css` + `js/app.js`.
Data files in `data/`:
- `question_bank.json` — 500 exam-style questions (synced from fiduciary-exam-prep)
- `cases.json` — 12 authored case files (72 decision points)
- `glossary.json` — key terms + deadline timelines from the master study guide

State lives in `localStorage` under `fq_state`.

## Content rules

When generating/editing JSON content: always write **UTF-8 without BOM** (mojibake history — see fiduciary-exam-prep PROJECT_HANDOVER).
