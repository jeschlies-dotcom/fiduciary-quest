/* ============================================================
   Fiduciary Quest — game engine + UI
   Static SPA. No frameworks. Data: data/*.json. State: localStorage.
   ============================================================ */
'use strict';

/* ---------------- Constants ---------------- */
const DOMAINS = {
  1: { name: 'Professional Practices', short: 'Prof. Practices', weight: 16.6, emoji: '🤝' },
  2: { name: 'Conservatees',           short: 'Conservatees',    weight: 12.6, emoji: '🧑‍🦳' },
  3: { name: 'Surrogate Decision-Making', short: 'Decision-Making', weight: 10.6, emoji: '🧭' },
  4: { name: 'Legal and Courts',       short: 'Legal & Courts',  weight: 14.0, emoji: '🏛️' },
  5: { name: 'Personal Management',    short: 'Personal Mgmt',   weight: 9.0,  emoji: '🏡' },
  6: { name: 'Financial Management',   short: 'Financial Mgmt',  weight: 30.0, emoji: '💰' },
  7: { name: 'Medical Decision-Making', short: 'Medical',        weight: 7.0,  emoji: '🩺' }
};
const RANKS = [
  'Exam Applicant', 'Court Panel Rookie', 'Junior Fiduciary', 'Licensed Fiduciary',
  'Trusted Conservator', 'Estate Strategist', 'Senior Fiduciary', 'Practice Partner',
  'Premier Fiduciary', 'Fiduciary of the Year', 'Legend of the Probate Bar'
];
const QUALITY = {
  best:       { label: 'Best Call',            ico: '🌟', rep: 2, risk: 0, xp: 15 },
  acceptable: { label: 'Defensible… but not the best', ico: '🟡', rep: 1, risk: 1, xp: 8 },
  poor:       { label: 'Poor Judgment',        ico: '🟠', rep: 0, risk: 2, xp: 3 },
  harmful:    { label: 'Breach of Duty!',      ico: '💥', rep: 0, risk: 4, xp: 1 }
};
const GRADE_META = {
  triumph:  { seal: '🏆', label: 'Commended by the Court', cls: 'g-triumph', xp: 60 },
  solid:    { seal: '⚖️', label: 'Approved by the Court',  cls: 'g-solid',   xp: 40 },
  shaky:    { seal: '📋', label: 'Court Takes Notice',     cls: 'g-shaky',   xp: 25 },
  disaster: { seal: '🚨', label: 'Surcharge Hearing Set',  cls: 'g-disaster', xp: 10 }
};
const TRACKS = [
  { prefix: 'CASE_FIN', name: 'Follow the Money', ico: '💰', sub: 'Financial Management — 30% of the exam' },
  { prefix: 'CASE_LAW', name: 'Order in the Court', ico: '🏛️', sub: 'Professional Practices & Legal' },
  { prefix: 'CASE_PER', name: 'The Human Element', ico: '🫶', sub: 'Conservatees, Decisions, Care & Medical' }
];
const FB_URL = 'https://ca-fiduciary-exam-app-default-rtdb.firebaseio.com';
const SPLASH_TIPS = [
  'Golden Rule: when in doubt, pick the answer in the BEST INTEREST of the conservatee.',
  'Financial Management is 30% of the exam. Follow the money.',
  'Two answers will look right. One is better. Train that instinct.',
  'No question asks for code section numbers — know the substance.',
  'Inventory & Appraisal: due 90 days after appointment.',
  'Substituted judgment first, best interest standard second.',
  'Recent takers report: 100 questions, 2 hours, 77 correct to pass.',
  'The real exam gives 3 answer choices — and two often "hold a grain of truth."',
  'Tie-breaker: which step happens FIRST? Does one answer encompass the other?',
  'Watch WHO you represent in each scenario — the trustee serves the beneficiary.',
  'Every test asks it: 15 hours of continuing education each year.',
  'Per passers: substituted judgment, supported decision-making, and relocating a client feature heavily.',
  'Assess before you act: functional assessment comes before any move.',
  'A fiduciary never makes clinical calls — medication decisions belong to medical professionals.'
];

/* ---------------- Globals ---------------- */
let QUESTIONS = [];
let CASES = [];
let GLOSSARY = { terms: [], timelines: [] };
let S = null;                 // state
let activeView = 'home';
let cleanupFns = [];          // per-view timers etc.
let correctRun = 0;           // session-wide consecutive correct
let syncTimer = null;
let audioCtx = null;

/* ---------------- Utilities ---------------- */
const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; };
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function cleanup() { cleanupFns.forEach(f => { try { f(); } catch (e) { } }); cleanupFns = []; }

/* ---------------- Sound ---------------- */
function beep(kind) {
  if (!S || !S.settings.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime;
    const play = (freq, start, dur, type = 'sine', vol = 0.12) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t + start);
      g.gain.exponentialRampToValueAtTime(0.001, t + start + dur);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t + start); o.stop(t + start + dur + 0.02);
    };
    if (kind === 'correct') { play(660, 0, .12); play(880, .09, .15); }
    else if (kind === 'best') { play(660, 0, .1); play(880, .08, .1); play(1175, .16, .2); }
    else if (kind === 'wrong') { play(220, 0, .2, 'square', .07); }
    else if (kind === 'click') { play(520, 0, .05, 'triangle', .06); }
    else if (kind === 'levelup') { [523, 659, 784, 1047].forEach((f, i) => play(f, i * .1, .18)); }
    else if (kind === 'match') { play(740, 0, .1, 'triangle'); }
  } catch (e) { }
}

/* ---------------- State ---------------- */
function defaultState() {
  return {
    v: 1,
    profile: { name: '', examDate: '', created: Date.now() },
    xp: 0,
    streak: { cur: 0, best: 0, lastDay: '' },
    qstats: {},          // qid -> {s:seen, c:correct, w:wrong, last:ts, lw:lastWrong(bool)}
    cases: {},           // caseId -> {stage, picks:[], rep, risk, done, bestGrade, flawless}
    arcade: { lightning: { best: 0, plays: 0 }, survival: { best: 0, plays: 0 }, bettercall: { best: 0, plays: 0 }, termmatch: { bestMs: 0, wins: 0 } },
    dailies: { date: '', quests: [] },
    ach: {},             // achId -> ts
    counters: { correct: 0, wrong: 0, d6correct: 0, reviewCleared: 0, stagesDone: 0 },
    settings: { sound: true, syncUser: '' },
    lastSaved: 0
  };
}
function loadState() {
  try {
    const raw = localStorage.getItem('fq_state');
    if (raw) { const st = JSON.parse(raw); return Object.assign(defaultState(), st); }
  } catch (e) { }
  return null;
}
function saveState() {
  S.lastSaved = Date.now();
  try { localStorage.setItem('fq_state', JSON.stringify(S)); } catch (e) { }
  scheduleSyncPush();
}

/* ---------------- XP / levels / streak ---------------- */
const xpForLevel = lv => 40 * lv * lv + 60 * lv;   // cumulative XP to REACH level lv+1
function levelFromXp(xp) { let lv = 1; while (xpForLevel(lv) <= xp) lv++; return lv; }
function rankForLevel(lv) { return RANKS[Math.min(lv - 1, RANKS.length - 1)]; }

function addXp(amount, label) {
  if (amount <= 0) return;
  const before = levelFromXp(S.xp);
  S.xp += amount;
  const after = levelFromXp(S.xp);
  toast(`+${amount} XP${label ? ' · ' + label : ''}`, 'xp');
  markActivity();
  renderHud();
  if (after > before) {
    setTimeout(() => {
      $('#luLevel').textContent = `Level ${after}`;
      $('#luRank').textContent = rankForLevel(after);
      $('#levelUpModal').classList.remove('hidden');
      beep('levelup'); confettiBurst();
      checkAchievements();
    }, 350);
  }
  saveState();
}
function markActivity() {
  const today = dayKey();
  if (S.streak.lastDay === today) return;
  const y = new Date(); y.setDate(y.getDate() - 1);
  S.streak.cur = (S.streak.lastDay === dayKey(y)) ? S.streak.cur + 1 : 1;
  S.streak.best = Math.max(S.streak.best, S.streak.cur);
  S.streak.lastDay = today;
  checkAchievements();
}

/* ---------------- Toasts / confetti ---------------- */
function toast(msg, cls = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + cls;
  el.textContent = msg;
  $('#toastWrap').appendChild(el);
  setTimeout(() => el.remove(), 2300);
}
function confettiBurst() {
  const cv = $('#confetti'), ctx = cv.getContext('2d');
  cv.width = innerWidth; cv.height = innerHeight;
  const colors = ['#f5b942', '#8b7cf6', '#34d399', '#5aa7ff', '#f87171', '#ffd97a'];
  const parts = Array.from({ length: 120 }, () => ({
    x: innerWidth / 2 + (Math.random() - .5) * 120, y: innerHeight * .38,
    vx: (Math.random() - .5) * 11, vy: -Math.random() * 11 - 3,
    s: Math.random() * 7 + 4, c: colors[Math.floor(Math.random() * colors.length)], r: Math.random() * Math.PI
  }));
  let frame = 0;
  const tick = () => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    parts.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += .32; p.r += .1;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); ctx.restore();
    });
    if (++frame < 90) requestAnimationFrame(tick); else ctx.clearRect(0, 0, cv.width, cv.height);
  };
  tick();
}

/* ---------------- Question stats / smart picker ---------------- */
function qstat(qid) { return S.qstats[qid] || (S.qstats[qid] = { s: 0, c: 0, w: 0, last: 0, lw: false }); }
function isReview(qid) { const st = S.qstats[qid]; return !!st && (st.lw || st.w > st.c); }
function reviewPool() { return QUESTIONS.filter(q => isReview(q.id)); }

function recordAnswer(q, correct) {
  const st = qstat(q.id);
  st.s++; st.last = Date.now();
  const wasReview = isReview(q.id);
  if (correct) { st.c++; st.lw = false; S.counters.correct++; if (q.domain === 6) S.counters.d6correct++; correctRun++; if (wasReview) { S.counters.reviewCleared++; questEvent('review_clear', 1); } }
  else { st.w++; st.lw = true; S.counters.wrong++; correctRun = 0; }
  questEvent('ans_any', 1);
  if (q.domain === 6) questEvent('ans_d6', 1);
  questEvent('correct_streak', null); // handled via correctRun
  markActivity();
  checkAchievements();
  saveState();
}
function pickQuestions(n, opts = {}) {
  const now = Date.now();
  let pool = QUESTIONS;
  if (opts.domains && opts.domains.length) pool = pool.filter(q => opts.domains.includes(q.domain));
  if (opts.difficulty) pool = pool.filter(q => q.difficulty === opts.difficulty);
  if (opts.review) pool = pool.filter(q => isReview(q.id));
  const weighted = pool.map(q => {
    const st = S.qstats[q.id];
    const domW = (DOMAINS[q.domain] ? DOMAINS[q.domain].weight : 10) / 10;
    const wrongRate = st && st.s ? st.w / st.s : 0;
    let recency = 1.4;                                   // unseen boost
    if (st && st.last) {
      const hrs = (now - st.last) / 36e5;
      recency = hrs < 4 ? 0.25 : hrs < 24 ? 0.6 : hrs < 72 ? 1 : 1.3;
    }
    const w = domW * (1 + 2 * wrongRate) * recency * (0.6 + Math.random());
    return { q, w };
  });
  weighted.sort((a, b) => b.w - a.w);
  return shuffle(weighted.slice(0, Math.min(n * 2, weighted.length))).slice(0, n).map(x => x.q);
}

/* ---------------- Daily quests ---------------- */
const QUEST_DEFS = [
  { id: 'ans_d6', ico: '💰', name: t => `Answer ${t} Financial Management questions`, target: 8 },
  { id: 'ans_any', ico: '📚', name: t => `Answer ${t} questions anywhere`, target: 12 },
  { id: 'correct_streak', ico: '🎯', name: t => `Get ${t} correct in a row`, target: 6 },
  { id: 'case_stages', ico: '🗂️', name: t => `Advance case files ${t} chapters`, target: 3 },
  { id: 'arcade_rounds', ico: '🕹️', name: t => `Finish ${t} arcade rounds`, target: 2 },
  { id: 'review_clear', ico: '♻️', name: t => `Redeem ${t} previously-missed questions`, target: 4 },
  { id: 'termmatch_win', ico: '🧩', name: t => `Win a Term Match round`, target: 1 }
];
function ensureDailies() {
  const today = dayKey();
  if (S.dailies.date === today && S.dailies.quests.length) return;
  const rng = mulberry32(hashStr('fq' + today));
  const picks = [];
  const defs = QUEST_DEFS.slice();
  while (picks.length < 3 && defs.length) {
    const i = Math.floor(rng() * defs.length);
    picks.push(defs.splice(i, 1)[0]);
  }
  S.dailies = { date: today, quests: picks.map(d => ({ id: d.id, target: d.target, prog: 0, claimed: false })) };
  saveState();
}
function questEvent(id, inc) {
  ensureDailies();
  let touched = false;
  S.dailies.quests.forEach(q => {
    if (q.claimed) return;
    if (q.id === 'correct_streak') { const np = Math.min(Math.max(q.prog, correctRun), q.target); if (np !== q.prog) { q.prog = np; touched = true; } }
    else if (q.id === id && inc) { q.prog = Math.min(q.prog + inc, q.target); touched = true; }
  });
  if (touched && activeView === 'home') renderHome();
}
function claimQuest(idx) {
  const q = S.dailies.quests[idx];
  if (!q || q.claimed || q.prog < q.target) return;
  q.claimed = true;
  beep('best');
  addXp(30, 'Daily quest');
  renderHome();
}

/* ---------------- Achievements ---------------- */
const ACH = [
  { id: 'first_answer', ico: '🎯', name: 'First Steps', desc: 'Answer your first question', check: () => S.counters.correct + S.counters.wrong >= 1 },
  { id: 'golden_rule', ico: '⚖️', name: 'The Golden Rule', desc: '10 correct answers in a row', check: () => correctRun >= 10 },
  { id: 'centurion', ico: '💯', name: 'Centurion', desc: '100 lifetime correct answers', check: () => S.counters.correct >= 100 },
  { id: 'd6_50', ico: '💰', name: 'Follow the Money', desc: '50 correct in Financial Management', check: () => S.counters.d6correct >= 50 },
  { id: 'case_first', ico: '🗂️', name: 'Case Closed', desc: 'Complete your first case file', check: () => Object.values(S.cases).some(c => c.done) },
  { id: 'flawless', ico: '🌟', name: 'Flawless File', desc: 'Complete a case with all Best Calls', check: () => Object.values(S.cases).some(c => c.flawless) },
  { id: 'all_cases', ico: '🏛️', name: 'Full Docket', desc: 'Complete every case file', check: () => CASES.length > 0 && CASES.every(c => S.cases[c.id] && S.cases[c.id].done) },
  { id: 'streak3', ico: '🔥', name: 'Warming Up', desc: '3-day streak', check: () => S.streak.cur >= 3 || S.streak.best >= 3 },
  { id: 'streak7', ico: '⚡', name: 'On Fire', desc: '7-day streak', check: () => S.streak.best >= 7 },
  { id: 'streak14', ico: '🌋', name: 'Unstoppable', desc: '14-day streak', check: () => S.streak.best >= 14 },
  { id: 'streak30', ico: '🐉', name: 'Legendary Habit', desc: '30-day streak', check: () => S.streak.best >= 30 },
  { id: 'level5', ico: '🎖️', name: 'Rising Star', desc: 'Reach level 5', check: () => levelFromXp(S.xp) >= 5 },
  { id: 'level10', ico: '👑', name: 'Top of the Bar', desc: 'Reach level 10', check: () => levelFromXp(S.xp) >= 10 },
  { id: 'lightning15', ico: '⚡', name: 'Lightning Reflexes', desc: '15+ correct in one Lightning round', check: () => S.arcade.lightning.best >= 15 },
  { id: 'survival20', ico: '🛡️', name: 'Survivor', desc: 'Reach 20 in Survival', check: () => S.arcade.survival.best >= 20 },
  { id: 'bettercall10', ico: '🤙', name: 'Better Call You', desc: 'Perfect 10/10 in Better Call', check: () => S.arcade.bettercall.best >= 10 },
  { id: 'match45', ico: '⏱️', name: 'Speed Reader', desc: 'Win Term Match in under 45 seconds', check: () => S.arcade.termmatch.bestMs > 0 && S.arcade.termmatch.bestMs < 45000 },
  { id: 'redeemer', ico: '♻️', name: 'The Redeemer', desc: 'Clear 25 previously-missed questions', check: () => S.counters.reviewCleared >= 25 },
  { id: 'gold_d6', ico: '🥇', name: 'Money Master', desc: 'Gold medal in Financial Management', check: () => medalTier(6) >= 3 },
  { id: 'platinum_any', ico: '💎', name: 'Platinum Standard', desc: 'Platinum medal in any domain', check: () => Object.keys(DOMAINS).some(d => medalTier(+d) >= 4) },
  { id: 'all_gold', ico: '🏅', name: 'Heptathlete', desc: 'Gold or better in all 7 domains', check: () => Object.keys(DOMAINS).every(d => medalTier(+d) >= 3) }
];
let achQueue = [];
function checkAchievements() {
  ACH.forEach(a => {
    if (S.ach[a.id]) return;
    let ok = false;
    try { ok = a.check(); } catch (e) { }
    if (ok) { S.ach[a.id] = Date.now(); achQueue.push(a); S.xp += 40; }
  });
  if (achQueue.length && $('#achModal').classList.contains('hidden') && $('#levelUpModal').classList.contains('hidden')) showNextAch();
}
function showNextAch() {
  const a = achQueue.shift();
  if (!a) return;
  $('#achEmoji').textContent = a.ico;
  $('#achName').textContent = a.name;
  $('#achDesc').textContent = a.desc + ' (+40 XP)';
  $('#achModal').classList.remove('hidden');
  beep('levelup'); confettiBurst();
  saveState();
}

/* ---------------- Mastery ---------------- */
function domainStats(d) {
  const qs = QUESTIONS.filter(q => q.domain === d);
  let attempted = 0, everCorrect = 0, c = 0, s = 0;
  qs.forEach(q => {
    const st = S.qstats[q.id];
    if (st && st.s) { attempted++; c += st.c; s += st.s; if (st.c > 0) everCorrect++; }
  });
  return {
    total: qs.length,
    coverage: qs.length ? everCorrect / qs.length : 0,
    accuracy: s ? c / s : 0,
    attempted
  };
}
function medalTier(d) {
  const st = domainStats(d);
  if (st.coverage >= .9 && st.accuracy >= .85) return 4;   // platinum
  if (st.coverage >= .7 && st.accuracy >= .8) return 3;    // gold
  if (st.coverage >= .45 && st.accuracy >= .7) return 2;   // silver
  if (st.coverage >= .2 && st.accuracy >= .6) return 1;    // bronze
  return 0;
}
const MEDALS = ['⚪', '🥉', '🥈', '🥇', '💎'];
const MEDAL_NAMES = ['Unranked', 'Bronze', 'Silver', 'Gold', 'Platinum'];
function readinessPct() {
  let total = 0;
  Object.keys(DOMAINS).forEach(d => {
    const st = domainStats(+d);
    total += DOMAINS[d].weight * (0.45 * st.coverage + 0.55 * st.accuracy);
  });
  return Math.round(total);
}

/* ---------------- HUD ---------------- */
function renderHud() {
  const lv = levelFromXp(S.xp);
  $('#topName').textContent = S.profile.name || 'Counselor';
  $('#topRank').textContent = `Lv ${lv} · ${rankForLevel(lv)}`;
  $('#xpNum').textContent = S.xp.toLocaleString();
  $('#streakNum').textContent = S.streak.lastDay === dayKey() || S.streak.lastDay === dayKey(new Date(Date.now() - 864e5)) ? S.streak.cur : 0;
  $('#streakPill').classList.toggle('lit', S.streak.lastDay === dayKey());
  const prevCap = lv > 1 ? xpForLevel(lv - 1) : 0;
  const cap = xpForLevel(lv);
  const pct = Math.min(100, Math.round((S.xp - prevCap) / (cap - prevCap) * 100));
  $('#xpBarFill').style.width = pct + '%';
  $('#xpBarLabel').textContent = `${S.xp - prevCap} / ${cap - prevCap} XP to Lv ${lv + 1}`;
}

/* ---------------- Navigation ---------------- */
const renderers = {};
function navigate(view, params) {
  cleanup();
  activeView = view;
  $$('.view').forEach(v => v.classList.remove('active'));
  $('#view-' + view).classList.add('active');
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  if (renderers[view]) renderers[view](params);
  window.scrollTo({ top: 0 });
}

/* ============================================================
   VIEW: HOME
   ============================================================ */
renderers.home = function () {
  ensureDailies();
  const v = $('#view-home');
  const name = S.profile.name || 'Counselor';
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const ready = readinessPct();

  let countdownHtml = '';
  if (S.profile.examDate) {
    const days = Math.ceil((new Date(S.profile.examDate + 'T00:00:00') - new Date()) / 864e5);
    countdownHtml = days >= 0
      ? `<div class="countdown"><div class="cd-num">${days}</div><div class="cd-lbl">days until<br>exam day 📅</div></div>`
      : `<div class="countdown"><div class="cd-lbl">Exam date passed — update it in ⚙️ Settings</div></div>`;
  } else {
    countdownHtml = `<div class="countdown"><div class="cd-lbl">💡 Set your exam date in ⚙️ Settings to start the countdown</div></div>`;
  }

  const reviewN = reviewPool().length;
  const contCase = CASES.find(c => { const p = S.cases[c.id]; return p && !p.done && p.stage > 0; });

  const questsHtml = S.dailies.quests.map((q, i) => {
    const def = QUEST_DEFS.find(d => d.id === q.id);
    const pct = Math.round(q.prog / q.target * 100);
    const right = q.claimed ? `<div class="quest-done">✅</div>`
      : q.prog >= q.target ? `<button class="quest-claim" data-claim="${i}">CLAIM +30</button>`
        : '';
    return `<div class="card quest-card">
      <div class="quest-ico">${def.ico}</div>
      <div class="quest-mid">
        <div class="quest-name">${esc(def.name(q.target))}</div>
        <div class="quest-prog-bar"><div class="quest-prog-fill" style="width:${pct}%"></div></div>
        <div class="quest-prog-txt">${q.prog} / ${q.target}</div>
      </div>${right}</div>`;
  }).join('');

  v.innerHTML = `
    <div class="hero">
      <div class="hero-greet">${greet}, ${esc(name)} ⚖️</div>
      <div class="hero-line">Your practice awaits. The court is watching.</div>
      ${countdownHtml}
      <div class="readiness-wrap">
        <div class="readiness-bar"><div class="readiness-fill" style="width:${ready}%"></div></div>
        <div class="readiness-lbl"><span>Exam readiness</span><span>${ready}%</span></div>
      </div>
    </div>

    <div class="section-title">📜 Daily Quests</div>
    ${questsHtml}

    <div class="section-title">⚡ Jump In</div>
    <div class="home-grid">
      ${contCase ? `<button class="mode-tile featured" data-go="case" data-case="${contCase.id}">
        <span class="mt-ico">${contCase.client.emoji}</span>
        <div class="mt-name">Continue: ${esc(contCase.title)}</div>
        <div class="mt-sub">Chapter ${(S.cases[contCase.id].stage) + 1} of ${contCase.stages.length} — ${esc(contCase.client.name)} is waiting</div>
      </button>` : `<button class="mode-tile featured" data-go="cases">
        <span class="mt-ico">🗂️</span>
        <div class="mt-name">Open a Case File</div>
        <div class="mt-sub">Multi-chapter client stories. Every decision counts.</div>
      </button>`}
      ${reviewN ? `<button class="mode-tile" data-go="play" data-mode="review">
        <span class="mt-ico">♻️</span><div class="mt-name">Redemption</div>
        <div class="mt-sub">${reviewN} missed question${reviewN === 1 ? '' : 's'} to clear</div></button>` : ''}
      <button class="mode-tile" data-go="play" data-mode="lightning"><span class="mt-ico">⚡</span><div class="mt-name">Lightning</div><div class="mt-sub">60 seconds. Go.</div></button>
      <button class="mode-tile" data-go="play" data-mode="survival"><span class="mt-ico">🛡️</span><div class="mt-name">Survival</div><div class="mt-sub">3 lives. Rising difficulty.</div></button>
      <button class="mode-tile" data-go="play" data-mode="bettercall"><span class="mt-ico">🤙</span><div class="mt-name">Better Call</div><div class="mt-sub">3 choices, real-exam style. Pick the better.</div></button>
      <button class="mode-tile" data-go="termmatch"><span class="mt-ico">🧩</span><div class="mt-name">Term Match</div><div class="mt-sub">Match terms to definitions</div></button>
      <button class="mode-tile" data-go="fieldnotes"><span class="mt-ico">📋</span><div class="mt-name">Field Notes</div><div class="mt-sub">Intel from people who passed</div></button>
    </div>`;

  v.querySelectorAll('[data-claim]').forEach(b => b.onclick = () => claimQuest(+b.dataset.claim));
  v.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
    beep('click');
    const go = b.dataset.go;
    if (go === 'case') startCase(b.dataset.case);
    else if (go === 'play') startPlay(b.dataset.mode);
    else navigate(go);
  });
};

/* ============================================================
   VIEW: CASES (list)
   ============================================================ */
renderers.cases = function () {
  const v = $('#view-cases');
  if (!CASES.length) {
    v.innerHTML = `<div class="section-title">🗂️ The Caseload</div><div class="card">Case files are loading… check your connection and refresh.</div>`;
    return;
  }
  let html = `<div class="section-title">🗂️ The Caseload</div>
    <div class="section-sub">Each client is a multi-chapter story. Every decision is exam training — and the court remembers.</div>`;
  TRACKS.forEach(track => {
    const list = CASES.filter(c => c.id.startsWith(track.prefix));
    if (!list.length) return;
    const done = list.filter(c => S.cases[c.id] && S.cases[c.id].done).length;
    html += `<div class="track-h">${track.ico} ${esc(track.name)} <span class="tk">${done}/${list.length}</span></div>
      <div class="section-sub">${esc(track.sub)}</div>`;
    list.forEach((c, i) => {
      const prog = S.cases[c.id];
      const locked = i > 0 && !(S.cases[list[i - 1].id] && S.cases[list[i - 1].id].done);
      const pct = prog ? Math.round((prog.done ? c.stages.length : prog.stage) / c.stages.length * 100) : 0;
      const gradeChip = prog && prog.done && prog.bestGrade
        ? `<span class="chip grade-${prog.bestGrade}">${GRADE_META[prog.bestGrade].seal} ${esc(GRADE_META[prog.bestGrade].label)}</span>` : '';
      html += `<div class="card tappable case-card ${locked ? 'locked' : ''}" data-case="${c.id}" ${locked ? 'data-locked="1"' : ''}>
        <div class="case-emoji">${locked ? '🔒' : c.client.emoji}</div>
        <div class="case-mid">
          <div class="case-title">${esc(c.title)}</div>
          <div class="case-tag">${esc(c.tagline)}</div>
          <div class="case-meta">
            <span class="chip dom">${DOMAINS[c.primaryDomain].emoji} ${esc(DOMAINS[c.primaryDomain].short)}</span>
            <span class="chip">~${c.estMinutes} min</span>
            ${gradeChip}
          </div>
          ${pct && !locked ? `<div class="case-prog"><div class="case-prog-fill" style="width:${pct}%"></div></div>` : ''}
        </div>
        <div class="case-right">${locked ? '' : '›'}</div>
      </div>`;
    });
  });
  v.innerHTML = html;
  v.querySelectorAll('[data-case]').forEach(el => el.onclick = () => {
    if (el.dataset.locked) { toast('🔒 Finish the previous case in this track first'); return; }
    beep('click'); startCase(el.dataset.case);
  });
};

/* ============================================================
   VIEW: CASE (play one case)
   ============================================================ */
let curCase = null;

function startCase(caseId) {
  curCase = CASES.find(c => c.id === caseId);
  if (!curCase) return;
  let p = S.cases[caseId];
  if (!p || p.done) {
    // fresh run (or replay)
    S.cases[caseId] = p = { stage: 0, picks: [], rep: 0, risk: 0, done: p ? p.done : false, bestGrade: p ? p.bestGrade : null, flawless: p ? p.flawless : false, replay: !!(p && p.done) };
  }
  navigate('case');
}

renderers.case = function () {
  const v = $('#view-case');
  const c = curCase;
  if (!c) { navigate('cases'); return; }
  const p = S.cases[c.id];
  const maxRep = c.stages.length * 2;
  const maxRisk = c.stages.length * 3;

  const head = `
    <div class="case-head">
      <button class="back" id="caseBack">‹</button>
      <div class="case-head-title">${c.client.emoji} ${esc(c.title)}</div>
      <span class="chip dom">${DOMAINS[c.primaryDomain].emoji} ${esc(DOMAINS[c.primaryDomain].short)}</span>
    </div>
    <div class="meters">
      <div class="meter"><div class="meter-lbl"><span>⭐ Reputation</span><span>${p.rep}</span></div>
        <div class="meter-bar"><div class="meter-fill rep" style="width:${Math.min(100, p.rep / maxRep * 100)}%"></div></div></div>
      <div class="meter"><div class="meter-lbl"><span>⚠️ Surcharge Risk</span><span>${p.risk}</span></div>
        <div class="meter-bar"><div class="meter-fill risk" style="width:${Math.min(100, p.risk / maxRisk * 100)}%"></div></div></div>
    </div>
    <div class="stage-dots">${c.stages.map((_, i) =>
      `<div class="sdot ${i < p.stage ? 'done' : i === p.stage ? 'cur' : ''}"></div>`).join('')}</div>`;

  if (p.stage >= c.stages.length) { renderCourtReview(v, head); return; }

  const st = c.stages[p.stage];
  const introHtml = p.stage === 0 && !p.picks.length
    ? `<div class="narrative"><b>${esc(c.client.name)}, ${c.client.age}</b> — ${esc(c.client.snapshot)}\n\n${esc(c.intro)}</div>` : '';
  const opts = shuffle(st.options.map((o, i) => ({ o, i })));
  v.innerHTML = head + introHtml + `
    <div class="narrative">${esc(st.narrative)}</div>
    <div class="q-meta"><span class="chip dom">${DOMAINS[st.domain] ? DOMAINS[st.domain].emoji : '📌'} ${esc(st.subtopic)}</span><span class="chip">Chapter ${p.stage + 1}/${c.stages.length}</span></div>
    <div class="prompt-q">${esc(st.prompt)}</div>
    <div id="caseOpts">${opts.map((x, k) =>
      `<button class="opt" data-oi="${x.i}"><span class="opt-key">${'ABC'[k]}</span>${esc(x.o.text)}</button>`).join('')}</div>
    <div id="caseVerdict"></div>`;

  $('#caseBack').onclick = () => { beep('click'); navigate('cases'); };
  v.querySelectorAll('.opt').forEach(btn => btn.onclick = () => caseChoose(+btn.dataset.oi));
}

function caseChoose(optIdx) {
  const c = curCase, p = S.cases[c.id];
  const st = c.stages[p.stage];
  const o = st.options[optIdx];
  const q = QUALITY[o.quality];

  p.picks.push(o.quality);
  p.rep += q.rep; p.risk += q.risk;
  S.counters.stagesDone++;
  questEvent('case_stages', 1);

  // live meter update
  const maxRep = c.stages.length * 2, maxRisk = c.stages.length * 3;
  const repFill = $('.meter-fill.rep'), riskFill = $('.meter-fill.risk');
  if (repFill) { repFill.style.width = Math.min(100, p.rep / maxRep * 100) + '%'; repFill.closest('.meter').querySelector('.meter-lbl span:last-child').textContent = p.rep; }
  if (riskFill) { riskFill.style.width = Math.min(100, p.risk / maxRisk * 100) + '%'; riskFill.closest('.meter').querySelector('.meter-lbl span:last-child').textContent = p.risk; }

  // reveal
  const wrap = $('#caseOpts');
  wrap.querySelectorAll('.opt').forEach(b => {
    const bo = st.options[+b.dataset.oi];
    b.disabled = true;
    b.classList.add('reveal-' + bo.quality);
    if (+b.dataset.oi !== optIdx) b.classList.add('dim');
    else if (o.quality === 'best') b.classList.add('correct-flash');
    else if (o.quality !== 'acceptable') b.classList.add('wrong-flash');
  });
  beep(o.quality === 'best' ? 'best' : o.quality === 'acceptable' ? 'correct' : 'wrong');

  const bestOpt = st.options.find(x => x.quality === 'best');
  const showBest = o.quality !== 'best'
    ? `<div class="verdict-expl"><b>The best call:</b> ${esc(bestOpt.text)} — ${esc(bestOpt.explanation)}</div>` : '';
  $('#caseVerdict').innerHTML = `
    <div class="verdict v-${o.quality}">
      <div class="verdict-head">${q.ico} ${esc(q.label)} <span style="margin-left:auto">+${q.xp} XP</span></div>
      <div class="verdict-outcome">${esc(o.outcome)}</div>
      <div class="verdict-expl">${esc(o.explanation)}</div>
      ${showBest}
    </div>
    <button class="btn btn-primary btn-big" id="caseNext">${p.stage + 1 >= c.stages.length ? '⚖️ Hear the Court’s Review' : 'Next Chapter ›'}</button>`;
  $('#caseNext').onclick = () => {
    p.stage++;
    saveState();
    renderers.case();
  };
  $('#caseNext').scrollIntoView({ behavior: 'smooth', block: 'center' });

  const mult = p.replay ? 0.25 : 1;
  addXp(Math.max(1, Math.round(q.xp * mult)), o.quality === 'best' ? 'Best call!' : null);
}

function renderCourtReview(v, head) {
  const c = curCase, p = S.cases[c.id];
  const n = c.stages.length;
  const score = p.rep / (n * 2);
  const harmful = p.picks.filter(x => x === 'harmful').length;
  const bests = p.picks.filter(x => x === 'best').length;
  let grade = 'disaster';
  if (score >= .85 && harmful === 0) grade = 'triumph';
  else if (score >= .6) grade = 'solid';
  else if (score >= .35) grade = 'shaky';
  const gm = GRADE_META[grade];

  const firstDone = !p.done;
  if (firstDone) {
    p.done = true;
    p.bestGrade = grade;
    if (bests === n) p.flawless = true;
    addXp(gm.xp, 'Case complete');
    if (grade === 'triumph') confettiBurst();
  } else {
    const order = ['disaster', 'shaky', 'solid', 'triumph'];
    if (order.indexOf(grade) > order.indexOf(p.bestGrade || 'disaster')) p.bestGrade = grade;
    if (bests === n) p.flawless = true;
    addXp(Math.round(gm.xp * .25), 'Case replay');
  }
  checkAchievements();
  saveState();

  v.innerHTML = head + `
    <div class="card court-review">
      <div class="court-seal">${gm.seal}</div>
      <div class="court-grade ${gm.cls}">${esc(gm.label)}</div>
      <div class="court-stats">
        <div class="cstat"><div class="cstat-num">🌟 ${bests}/${n}</div><div class="cstat-lbl">Best calls</div></div>
        <div class="cstat"><div class="cstat-num">⭐ ${p.rep}</div><div class="cstat-lbl">Reputation</div></div>
        <div class="cstat"><div class="cstat-num">⚠️ ${p.risk}</div><div class="cstat-lbl">Risk</div></div>
      </div>
      <div class="court-text">${esc(c.epilogues[grade])}</div>
      <div style="display:flex; gap:10px; justify-content:center; margin-top:14px; flex-wrap:wrap">
        <button class="btn btn-ghost" id="crReplay">↻ Retry for a better ruling</button>
        <button class="btn btn-primary" id="crDone">Back to the Caseload</button>
      </div>
    </div>`;
  $('#crDone').onclick = () => { beep('click'); navigate('cases'); };
  $('#crReplay').onclick = () => { beep('click'); startCase(c.id); };
}

/* ============================================================
   VIEW: ARCADE hub
   ============================================================ */
renderers.arcade = function () {
  const v = $('#view-arcade');
  const a = S.arcade;
  v.innerHTML = `
    <div class="section-title">🕹️ The Arcade</div>
    <div class="section-sub">Quick rounds, real exam questions. Perfect for a 5-minute brain snack.</div>
    <div class="card tappable arcade-tile" data-mode="lightning">
      <div class="arcade-ico a1">⚡</div>
      <div class="arcade-mid"><div class="arcade-name">Lightning Round</div>
      <div class="arcade-sub">60 seconds on the clock. Answer as many as you can — streaks multiply your score.</div>
      <div class="arcade-best">Best: ${a.lightning.best} correct · ${a.lightning.plays} plays</div></div></div>
    <div class="card tappable arcade-tile" data-mode="survival">
      <div class="arcade-ico a2">🛡️</div>
      <div class="arcade-mid"><div class="arcade-name">Survival</div>
      <div class="arcade-sub">Three lives. Questions get harder as you go. How deep can you get?</div>
      <div class="arcade-best">Best run: ${a.survival.best} · ${a.survival.plays} plays</div></div></div>
    <div class="card tappable arcade-tile" data-mode="bettercall">
      <div class="arcade-ico a3">🤙</div>
      <div class="arcade-mid"><div class="arcade-name">Better Call</div>
      <div class="arcade-sub">Three choices, just like the real exam — one clearly wrong, two with a grain of truth. Pick the BETTER one.</div>
      <div class="arcade-best">Best: ${a.bettercall.best}/10 · ${a.bettercall.plays} plays</div></div></div>
    <div class="card tappable arcade-tile" data-mode="termmatch">
      <div class="arcade-ico a4">🧩</div>
      <div class="arcade-mid"><div class="arcade-name">Term Match</div>
      <div class="arcade-sub">Match glossary terms to definitions against the clock.</div>
      <div class="arcade-best">${a.termmatch.bestMs ? 'Best: ' + (a.termmatch.bestMs / 1000).toFixed(1) + 's' : 'No wins yet'} · ${a.termmatch.wins} wins</div></div></div>
    <div class="section-title">📖 Reference</div>
    <div class="card tappable arcade-tile" data-mode="fieldnotes">
      <div class="arcade-ico a2">📋</div>
      <div class="arcade-mid"><div class="arcade-name">Field Notes</div>
      <div class="arcade-sub">Real-exam intel from people who passed: format, question style, hot topics, test-day checklist.</div></div></div>
    <div class="card tappable arcade-tile" data-mode="glossary">
      <div class="arcade-ico a4">📚</div>
      <div class="arcade-mid"><div class="arcade-name">Glossary & Deadlines</div>
      <div class="arcade-sub">Every key term and timeline, one tap away.</div></div></div>`;
  v.querySelectorAll('[data-mode]').forEach(el => el.onclick = () => {
    beep('click');
    const m = el.dataset.mode;
    if (m === 'termmatch' || m === 'glossary' || m === 'fieldnotes') navigate(m);
    else startPlay(m);
  });
};

/* ============================================================
   VIEW: PLAY — shared quiz runner (lightning / survival / bettercall / review)
   ============================================================ */
let play = null;

function startPlay(mode) {
  const titles = { lightning: '⚡ Lightning', survival: '🛡️ Survival', bettercall: '🤙 Better Call', review: '♻️ Redemption' };
  play = {
    mode, title: titles[mode], score: 0, streak: 0, bestStreak: 0, lives: 3,
    idx: 0, total: 0, timeLeft: 60, answered: 0, correct: 0, done: false, q: null, used: new Set()
  };
  if (mode === 'bettercall') play.total = 10;
  if (mode === 'review') {
    play.queue = shuffle(reviewPool()).slice(0, 10);
    play.total = play.queue.length;
    if (!play.total) { toast('Nothing to review — go miss some questions first 😄'); return; }
  }
  navigate('play');
}

function nextPlayQuestion() {
  const m = play.mode;
  let q = null;
  if (m === 'review') q = play.queue[play.idx];
  else if (m === 'survival') {
    const diff = play.answered < 5 ? 'easy' : play.answered < 12 ? 'medium' : 'hard';
    let cands = pickQuestions(6, { difficulty: diff }).filter(x => !play.used.has(x.id));
    if (!cands.length) cands = pickQuestions(6).filter(x => !play.used.has(x.id));
    if (!cands.length) { play.used.clear(); cands = pickQuestions(6); }
    q = cands[0];
  } else {
    let cands = pickQuestions(6).filter(x => !play.used.has(x.id));
    if (!cands.length) { play.used.clear(); cands = pickQuestions(6); }
    q = cands[0];
  }
  if (!q) { endPlay(); return; }
  play.used.add(q.id);
  play.q = q;
  renderPlayQuestion();
}

renderers.play = function () {
  if (!play) { navigate('home'); return; }
  if (play.mode === 'lightning') {
    const iv = setInterval(() => {
      if (!play || play.done) { clearInterval(iv); return; }
      play.timeLeft--;
      const el = $('#playTimer');
      if (el) { el.textContent = play.timeLeft + 's'; el.classList.toggle('time-low', play.timeLeft <= 10); }
      if (play.timeLeft <= 0) { clearInterval(iv); endPlay(); }
    }, 1000);
    cleanupFns.push(() => clearInterval(iv));
  }
  nextPlayQuestion();
};

function playHud() {
  const m = play.mode;
  let hud = '';
  if (m === 'lightning') hud = `<div class="hud-box" id="playTimer">${play.timeLeft}s</div><div class="hud-box">✓ ${play.correct}</div>`;
  else if (m === 'survival') hud = `<div class="hud-box lives">${'❤️'.repeat(play.lives)}${'🖤'.repeat(3 - play.lives)}</div><div class="hud-box">✓ ${play.correct}</div>`;
  else hud = `<div class="hud-box">${play.idx + 1} / ${play.total}</div><div class="hud-box">✓ ${play.correct}</div>`;
  return hud;
}

function renderPlayQuestion() {
  const v = $('#view-play');
  const q = play.q;
  let options;
  if (play.mode === 'bettercall') {
    // real-exam format: 3 choices — the correct answer + 2 random distractors
    const wrongIdxs = shuffle(q.options.map((_, i) => i).filter(i => i !== q.correctAnswer));
    options = shuffle([q.correctAnswer, ...wrongIdxs.slice(0, 2)]);
  } else {
    options = q.options.map((_, i) => i);
  }
  play.optionOrder = options;

  v.innerHTML = `
    <div class="play-head">
      <button class="back icon-btn" id="playQuit">✕</button>
      <div class="play-title">${play.title}</div>
      <div class="play-hud">${playHud()}</div>
    </div>
    ${play.streak >= 3 ? `<div class="section-sub combo-pop">🔥 ${play.streak} streak — keep it rolling!</div>` : ''}
    <div class="q-meta">
      <span class="chip dom">${DOMAINS[q.domain].emoji} ${esc(DOMAINS[q.domain].short)}</span>
      <span class="chip">${esc(q.difficulty)}</span>
      ${isReview(q.id) ? '<span class="chip" style="color:var(--warn)">♻️ redemption</span>' : ''}
    </div>
    <div class="q-text">${esc(q.question)}</div>
    <div id="playOpts">${options.map((oi, k) =>
      `<button class="opt" data-oi="${oi}"><span class="opt-key">${'ABC'[k]}</span>${esc(q.options[oi])}</button>`).join('')}</div>
    <div id="playFeedback"></div>`;

  $('#playQuit').onclick = () => { beep('click'); endPlay(true); };
  v.querySelectorAll('.opt').forEach(b => b.onclick = () => playAnswer(+b.dataset.oi));
}

function playAnswer(oi) {
  const q = play.q;
  const correct = oi === q.correctAnswer;
  play.answered++;
  if (correct) { play.correct++; play.streak++; play.bestStreak = Math.max(play.bestStreak, play.streak); }
  else { play.streak = 0; if (play.mode === 'survival') play.lives--; }
  recordAnswer(q, correct);

  const v = $('#view-play');
  v.querySelectorAll('.opt').forEach(b => {
    b.disabled = true;
    const i = +b.dataset.oi;
    if (i === q.correctAnswer) { b.classList.add('reveal-best'); if (i === oi) b.classList.add('correct-flash'); }
    else if (i === oi) b.classList.add('reveal-harmful', 'wrong-flash');
    else b.classList.add('dim');
  });
  beep(correct ? 'correct' : 'wrong');

  const xp = correct ? (q.difficulty === 'hard' ? 10 : q.difficulty === 'easy' ? 5 : 7) : 1;
  addXp(xp);

  const fast = play.mode === 'lightning';
  if (fast && correct) { setTimeout(() => { if (play && !play.done) advancePlay(); }, 420); return; }

  $('#playFeedback').innerHTML = `
    <div class="expl-box"><b>${correct ? '✅ Correct.' : '❌ Not quite.'}</b> ${esc(q.explanation)}</div>
    <button class="btn btn-primary btn-big" id="playNext">${nextLabel()}</button>`;
  $('#playNext').onclick = advancePlay;
  $('#playNext').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function nextLabel() {
  if (play.mode === 'survival' && play.lives <= 0) return 'See Results';
  if (play.total && play.idx + 1 >= play.total) return 'See Results';
  return 'Next ›';
}
function advancePlay() {
  if (!play || play.done) return;
  play.idx++;
  if (play.mode === 'survival' && play.lives <= 0) { endPlay(); return; }
  if (play.total && play.idx >= play.total) { endPlay(); return; }
  if (play.mode === 'lightning' && play.timeLeft <= 0) { endPlay(); return; }
  nextPlayQuestion();
}

function endPlay(quit = false) {
  if (!play || play.done) return;
  play.done = true;
  cleanup();
  const m = play.mode, a = S.arcade;
  let bestLine = '', newBest = false, bonus = 0;

  if (!quit) {
    questEvent('arcade_rounds', 1);
    if (m === 'lightning') {
      a.lightning.plays++;
      if (play.correct > a.lightning.best) { a.lightning.best = play.correct; newBest = true; }
      bonus = play.correct * 2;
      bestLine = `Best ever: ${a.lightning.best}`;
    } else if (m === 'survival') {
      a.survival.plays++;
      if (play.correct > a.survival.best) { a.survival.best = play.correct; newBest = true; }
      bonus = play.correct * 2 + play.bestStreak * 2;
      bestLine = `Best run: ${a.survival.best}`;
    } else if (m === 'bettercall') {
      a.bettercall.plays++;
      if (play.correct > a.bettercall.best) { a.bettercall.best = play.correct; newBest = true; }
      bonus = play.correct * 2 + (play.correct === 10 ? 20 : 0);
      bestLine = `Best: ${a.bettercall.best}/10`;
    } else if (m === 'review') {
      bonus = play.correct * 3;
      bestLine = `${play.correct} question${play.correct === 1 ? '' : 's'} redeemed ♻️`;
    }
    if (bonus) addXp(bonus, 'Round bonus');
    checkAchievements();
    saveState();
  }

  const v = $('#view-play');
  const pct = play.answered ? Math.round(play.correct / play.answered * 100) : 0;
  const emoji = quit ? '🚪' : pct >= 90 ? '🏆' : pct >= 70 ? '🎉' : pct >= 50 ? '💪' : '📚';
  v.innerHTML = `
    <div class="result-screen">
      <div class="result-big">${emoji}</div>
      <div class="result-score">${play.correct}${play.total ? ' / ' + play.total : ''}</div>
      <div class="result-line">${play.title} — ${play.answered} answered, ${pct}% accuracy</div>
      ${play.bestStreak >= 3 ? `<div class="result-line">🔥 Longest streak: ${play.bestStreak}</div>` : ''}
      <div class="result-line">${bestLine}</div>
      ${newBest ? '<div class="newbest">★ NEW PERSONAL BEST ★</div>' : ''}
      <div style="display:flex; gap:10px; justify-content:center; margin-top:20px; flex-wrap:wrap">
        <button class="btn btn-ghost" id="resHome">Home</button>
        <button class="btn btn-primary" id="resAgain">Play Again</button>
      </div>
    </div>`;
  if (newBest) confettiBurst();
  $('#resHome').onclick = () => { beep('click'); navigate('home'); };
  $('#resAgain').onclick = () => { beep('click'); startPlay(m); };
}

/* ============================================================
   VIEW: TERM MATCH
   ============================================================ */
renderers.termmatch = function () {
  const v = $('#view-termmatch');
  const pairs = shuffle(GLOSSARY.terms).slice(0, 8);
  const tiles = shuffle([
    ...pairs.map((p, i) => ({ kind: 'term', pair: i, txt: p.t })),
    ...pairs.map((p, i) => ({ kind: 'def', pair: i, txt: p.d.length > 110 ? p.d.slice(0, 107) + '…' : p.d }))
  ]);
  let sel = null, matched = 0, errors = 0, t0 = Date.now(), ended = false;

  v.innerHTML = `
    <div class="play-head">
      <button class="back icon-btn" id="tmQuit">✕</button>
      <div class="play-title">🧩 Term Match</div>
      <div class="play-hud"><div class="hud-box" id="tmTimer">0.0s</div></div>
    </div>
    <div class="section-sub">Tap a term, then its definition. ${S.arcade.termmatch.bestMs ? 'Best: ' + (S.arcade.termmatch.bestMs / 1000).toFixed(1) + 's' : ''}</div>
    <div class="tm-grid" id="tmGrid">${tiles.map((t, i) =>
      `<button class="tm-tile ${t.kind}" data-i="${i}" data-pair="${t.pair}" data-kind="${t.kind}">${esc(t.txt)}</button>`).join('')}</div>`;

  const iv = setInterval(() => { if (!ended) $('#tmTimer').textContent = ((Date.now() - t0) / 1000).toFixed(1) + 's'; }, 100);
  cleanupFns.push(() => clearInterval(iv));

  $('#tmQuit').onclick = () => { beep('click'); navigate('arcade'); };
  $('#tmGrid').querySelectorAll('.tm-tile').forEach(tile => tile.onclick = () => {
    if (ended || tile.classList.contains('matched')) return;
    if (sel === tile) { tile.classList.remove('sel'); sel = null; return; }
    if (!sel) { sel = tile; tile.classList.add('sel'); beep('click'); return; }
    if (sel.dataset.kind === tile.dataset.kind) { sel.classList.remove('sel'); sel = tile; tile.classList.add('sel'); beep('click'); return; }
    if (sel.dataset.pair === tile.dataset.pair) {
      sel.classList.remove('sel');
      sel.classList.add('matched'); tile.classList.add('matched');
      matched++; sel = null; beep('match');
      if (matched === 8) {
        ended = true; clearInterval(iv);
        const ms = Date.now() - t0;
        S.arcade.termmatch.wins++;
        const newBest = !S.arcade.termmatch.bestMs || ms < S.arcade.termmatch.bestMs;
        if (newBest) S.arcade.termmatch.bestMs = ms;
        questEvent('termmatch_win', 1);
        questEvent('arcade_rounds', 1);
        const bonus = Math.max(10, 40 - errors * 5);
        addXp(bonus, 'Term Match');
        checkAchievements(); saveState();
        setTimeout(() => {
          v.innerHTML = `<div class="result-screen">
            <div class="result-big">🧩</div>
            <div class="result-score">${(ms / 1000).toFixed(1)}s</div>
            <div class="result-line">${errors} mismatch${errors === 1 ? '' : 'es'}</div>
            ${newBest ? '<div class="newbest">★ NEW BEST TIME ★</div>' : `<div class="result-line">Best: ${(S.arcade.termmatch.bestMs / 1000).toFixed(1)}s</div>`}
            <div style="display:flex; gap:10px; justify-content:center; margin-top:20px">
              <button class="btn btn-ghost" id="resHome">Arcade</button>
              <button class="btn btn-primary" id="resAgain">Rematch</button>
            </div></div>`;
          if (newBest) confettiBurst();
          $('#resHome').onclick = () => navigate('arcade');
          $('#resAgain').onclick = () => renderers.termmatch();
        }, 450);
      }
    } else {
      errors++;
      tile.classList.add('err'); sel.classList.add('err');
      beep('wrong');
      const s = sel;
      setTimeout(() => { tile.classList.remove('err'); s.classList.remove('err', 'sel'); }, 380);
      sel = null;
    }
  });
};

/* ============================================================
   VIEW: MASTERY
   ============================================================ */
renderers.mastery = function () {
  const v = $('#view-mastery');
  const ready = readinessPct();
  const total = S.counters.correct + S.counters.wrong;
  const acc = total ? Math.round(S.counters.correct / total * 100) : 0;
  const casesDone = Object.values(S.cases).filter(c => c.done).length;

  let rows = '';
  Object.keys(DOMAINS).map(Number).sort((a, b) => DOMAINS[b].weight - DOMAINS[a].weight).forEach(d => {
    const ds = domainStats(d);
    const tier = medalTier(d);
    rows += `<div class="card dom-row">
      <div class="dom-medal" title="${MEDAL_NAMES[tier]}">${MEDALS[tier]}</div>
      <div class="dom-mid">
        <div class="dom-name"><span>${DOMAINS[d].emoji} ${esc(DOMAINS[d].name)}</span><span class="pct">${DOMAINS[d].weight}% of exam</span></div>
        <div class="dom-bars">
          <div class="dom-bar"><div class="dom-bar-fill cov" style="width:${Math.round(ds.coverage * 100)}%"></div></div>
          <div class="dom-bar"><div class="dom-bar-fill acc" style="width:${Math.round(ds.accuracy * 100)}%"></div></div>
          <div class="dom-lbls"><span>coverage ${Math.round(ds.coverage * 100)}%</span><span>accuracy ${Math.round(ds.accuracy * 100)}%</span></div>
        </div>
      </div></div>`;
  });

  v.innerHTML = `
    <div class="section-title">📊 Mastery</div>
    <div class="stat-grid">
      <div class="stat-tile"><div class="stat-num">${ready}%</div><div class="stat-lbl">Readiness</div></div>
      <div class="stat-tile"><div class="stat-num">${acc}%</div><div class="stat-lbl">Accuracy</div></div>
      <div class="stat-tile"><div class="stat-num">${S.counters.correct}</div><div class="stat-lbl">Correct</div></div>
      <div class="stat-tile"><div class="stat-num">${S.streak.best}</div><div class="stat-lbl">Best streak</div></div>
      <div class="stat-tile"><div class="stat-num">${casesDone}/${CASES.length || '—'}</div><div class="stat-lbl">Cases closed</div></div>
      <div class="stat-tile"><div class="stat-num">${reviewPool().length}</div><div class="stat-lbl">To redeem</div></div>
    </div>
    <div class="section-sub">Medal tiers per domain: 🥉 bronze → 🥈 silver → 🥇 gold → 💎 platinum. Earn them with coverage <i>and</i> accuracy. Domains sorted by exam weight.</div>
    ${rows}
    ${reviewPool().length ? `<button class="btn btn-purple btn-big" id="masteryReview">♻️ Redeem ${reviewPool().length} missed questions</button>` : ''}`;
  const mr = $('#masteryReview');
  if (mr) mr.onclick = () => startPlay('review');
};

/* ============================================================
   VIEW: AWARDS
   ============================================================ */
renderers.awards = function () {
  const v = $('#view-awards');
  const unlocked = Object.keys(S.ach).length;
  v.innerHTML = `
    <div class="section-title">🏆 Awards</div>
    <div class="section-sub">${unlocked} of ${ACH.length} unlocked · each worth 40 XP</div>
    <div class="award-grid">${ACH.map(a => `
      <div class="award ${S.ach[a.id] ? '' : 'locked'}">
        <div class="award-ico">${a.ico}</div>
        <div class="award-name">${esc(a.name)}</div>
        <div class="award-desc">${esc(a.desc)}</div>
      </div>`).join('')}</div>`;
};

/* ============================================================
   VIEW: GLOSSARY
   ============================================================ */
renderers.glossary = function () {
  const v = $('#view-glossary');
  const render = (filter = '') => {
    const f = filter.toLowerCase();
    const terms = GLOSSARY.terms.filter(t => !f || t.t.toLowerCase().includes(f) || t.d.toLowerCase().includes(f));
    $('#glossList').innerHTML = terms.map(t => `
      <div class="card gloss-item">
        <div class="gloss-term">${esc(t.t)} <span class="chip dom" style="float:right">${DOMAINS[t.dom] ? DOMAINS[t.dom].emoji + ' D' + t.dom : ''}</span></div>
        <div class="gloss-def">${esc(t.d)}</div>
      </div>`).join('') || '<div class="card">No matches.</div>';
  };
  v.innerHTML = `
    <div class="play-head">
      <button class="back icon-btn" id="glBack">✕</button>
      <div class="play-title">📚 Glossary & Deadlines</div>
    </div>
    <input type="text" id="glSearch" placeholder="Search terms…" autocomplete="off" style="margin-bottom:12px">
    <div id="glossList"></div>
    <div class="section-title">⏱️ Key Deadlines</div>
    ${GLOSSARY.timelines.map(t => `
      <div class="card gloss-item">
        <div class="gloss-term">${esc(t.p)}</div>
        <div class="gloss-def">${esc(t.r)}</div>
      </div>`).join('')}`;
  render();
  $('#glBack').onclick = () => navigate('arcade');
  $('#glSearch').oninput = e => render(e.target.value);
};

/* ============================================================
   VIEW: FIELD NOTES — intel from people who passed
   ============================================================ */
const FIELD_NOTES = [
  {
    emoji: '🎯', title: 'The Real Exam',
    items: [
      '100 questions in a single 2-hour sitting. 77 correct = "Pass CA."',
      'Only THREE answer choices (A/B/C) — not four.',
      'The PSI software gives you cross-out, flag-for-review, and per-question notes. Use all three.',
      'Results post roughly every two weeks. Take it Wednesday, you might know Friday.',
      'Most passers finish in 30–60 minutes, then use the rest to review flagged questions.'
    ]
  },
  {
    emoji: '🧠', title: 'How the Questions Think',
    items: [
      'About 2/3 are "most-correct" questions: one obviously wrong answer, two that each hold a grain of truth.',
      'Tie-breaker #1: which step happens FIRST? (Assess before act. Meet the person before the logistics.)',
      'Tie-breaker #2: does one answer ENCOMPASS the other?',
      'Track WHO you represent — an SNT trustee\'s duty runs to the beneficiary, not the relative asking.',
      'One or two words in the stem can flip the answer. Read twice.',
      'Nobody asks for code section numbers. Ever. Know the substance.',
      'It\'s scenarios all the way down — "lots of Sally and Fred."'
    ]
  },
  {
    emoji: '🔥', title: 'Hot Topics (per recent passers)',
    items: [
      'Every test asks it: 15 hours of continuing education per year.',
      'Substituted judgment, supported decision-making, and moving/relocating a client "featured heavily."',
      'Liabilities: where they go on an accounting, and what to do when liabilities exceed assets.',
      'More conservatorship questions than people expect; very little Medicare detail.',
      'Roughly half the exam draws on NGA Standards and Ethics. Know them cold.',
      'License renewal = annual statement. Functional assessment before any move. SNT before a family gift.'
    ]
  },
  {
    emoji: '🧳', title: 'Test Day Checklist',
    items: [
      'Everything goes in a locker: no phone, no bracelets, nothing in top pockets.',
      'Sweater or hoodie must have NO pockets — or you\'re testing in your t-shirt. Rooms run cold.',
      'Your ID must match your registration name exactly. No nicknames.',
      'Headphones/earplugs are offered — take them if quiet helps you.',
      'Hydrate and hit the restroom first; it\'s up to two hours dialed in.',
      'On the second pass, re-read your flagged notes and ask: do I still agree with my first instinct?'
    ]
  },
  {
    emoji: '⚖️', title: 'The Golden Rules',
    items: [
      'When two answers both look right, pick the one in the BEST INTEREST of the conservatee.',
      'Favor the person\'s autonomy — the answer giving the most self-determination usually wins.',
      'The fiduciary never plays doctor or lawyer. Clinical and legal calls belong to professionals.',
      'Don\'t overthink: take the question at face value. The traps are in careful reading, not wordplay.'
    ]
  }
];
renderers.fieldnotes = function () {
  const v = $('#view-fieldnotes');
  v.innerHTML = `
    <div class="play-head">
      <button class="back icon-btn" id="fnBack">✕</button>
      <div class="play-title">📋 Field Notes</div>
    </div>
    <div class="section-sub">Intel from the Fiduciary Newbies who already passed (2025–2026 cohort). This is the stuff the books don't tell you.</div>
    ${FIELD_NOTES.map(s => `
      <div class="section-title">${s.emoji} ${esc(s.title)}</div>
      ${s.items.map(i => `<div class="card gloss-item"><div class="gloss-def" style="color:var(--txt)">${esc(i)}</div></div>`).join('')}
    `).join('')}
    <div class="section-sub" style="text-align:center; margin-top:16px">Compiled June 2026 · sourced from real exam debriefs</div>`;
  $('#fnBack').onclick = () => navigate('arcade');
};

/* ============================================================
   VIEW: SETTINGS
   ============================================================ */
renderers.settings = function () {
  const v = $('#view-settings');
  v.innerHTML = `
    <div class="play-head">
      <button class="back icon-btn" id="setBack">✕</button>
      <div class="play-title">⚙️ Settings</div>
    </div>
    <div class="card">
      <label class="field-label" for="setName">Name</label>
      <input type="text" id="setName" maxlength="20" value="${esc(S.profile.name)}">
      <label class="field-label" for="setDate">Exam date</label>
      <input type="date" id="setDate" value="${esc(S.profile.examDate)}">
      <button class="btn btn-primary" id="setSaveProfile" style="margin-top:14px">Save</button>
    </div>
    <div class="card">
      <div class="set-row">
        <div><div class="set-lbl">🔊 Sound effects</div></div>
        <button class="btn btn-ghost" id="setSound">${S.settings.sound ? 'On' : 'Off'}</button>
      </div>
    </div>
    <div class="card">
      <div class="set-lbl">☁️ Cloud Sync</div>
      <div class="set-sub">Use the same username as your practice-app sync (or any name) to back up progress across devices.</div>
      <label class="field-label" for="setSync">Username</label>
      <input type="text" id="setSync" maxlength="40" value="${esc(S.settings.syncUser)}" placeholder="e.g. joe">
      <div style="display:flex; gap:10px; margin-top:12px">
        <button class="btn btn-purple" id="setSyncConnect">${S.settings.syncUser ? 'Sync Now' : 'Connect'}</button>
        ${S.settings.syncUser ? '<button class="btn btn-ghost" id="setSyncOff">Disconnect</button>' : ''}
      </div>
      <div class="sync-status ${S.settings.syncUser ? 'on' : 'off'}" id="syncStatus">${S.settings.syncUser ? '● Syncing as “' + esc(S.settings.syncUser) + '”' : '○ Not connected — progress is on this device only'}</div>
    </div>
    <div class="card">
      <div class="set-lbl">📦 Data</div>
      <div style="display:flex; gap:10px; margin-top:12px; flex-wrap:wrap">
        <button class="btn btn-ghost" id="setExport">Export progress</button>
        <button class="btn btn-ghost" id="setImport">Import progress</button>
        <button class="btn btn-ghost" id="setReset" style="color:var(--bad)">Reset everything</button>
      </div>
      <input type="file" id="setImportFile" accept=".json" class="hidden">
    </div>
    <div class="section-sub" style="text-align:center; margin-top:16px">Fiduciary Quest · made for one determined future fiduciary ⚖️</div>`;

  $('#setBack').onclick = () => navigate('home');
  $('#setSaveProfile').onclick = () => {
    S.profile.name = $('#setName').value.trim() || S.profile.name;
    S.profile.examDate = $('#setDate').value;
    saveState(); renderHud(); toast('Saved ✓'); beep('click');
  };
  $('#setSound').onclick = e => { S.settings.sound = !S.settings.sound; saveState(); e.target.textContent = S.settings.sound ? 'On' : 'Off'; beep('click'); };
  $('#setSyncConnect').onclick = async () => {
    const u = $('#setSync').value.trim();
    if (!u) { toast('Enter a username first', 'warn'); return; }
    $('#syncStatus').textContent = '… connecting';
    const ok = await syncConnect(u);
    renderers.settings();
    toast(ok ? '☁️ Synced!' : 'Sync failed — check connection', ok ? '' : 'warn');
  };
  const off = $('#setSyncOff');
  if (off) off.onclick = () => { S.settings.syncUser = ''; saveState(); renderers.settings(); };
  $('#setExport').onclick = () => {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fiduciary-quest-progress-${dayKey()}.json`;
    a.click();
  };
  $('#setImport').onclick = () => $('#setImportFile').click();
  $('#setImportFile').onchange = e => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const incoming = JSON.parse(r.result);
        S = mergeStates(S, incoming);
        saveState(); renderHud(); toast('Imported & merged ✓');
      } catch (err) { toast('Import failed — bad file', 'warn'); }
    };
    r.readAsText(f);
  };
  $('#setReset').onclick = () => {
    if (confirm('Reset ALL progress? This cannot be undone.')) {
      localStorage.removeItem('fq_state');
      location.reload();
    }
  };
};

/* ---------------- Cloud sync (Firebase RTDB REST) ---------------- */
/* Progress lives at users/<name>-quest with a `meta` child (required by the
   shared Firebase project's validation rules). Keeps quest data fully separate
   from the practice app's node even when the same username is used. */
function syncPath(u) { return `${FB_URL}/users/${encodeURIComponent(u)}-quest.json`; }
async function syncConnect(u) {
  try {
    const res = await fetch(syncPath(u));
    if (!res.ok) return false;
    const node = await res.json();
    const remote = node && node.quest;
    S.settings.syncUser = u;
    if (remote) S = mergeStates(S, remote);
    saveState();
    await syncPush();
    renderHud();
    return true;
  } catch (e) { return false; }
}
function scheduleSyncPush() {
  if (!S || !S.settings.syncUser) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncPush, 4000);
}
async function syncPush() {
  if (!S.settings.syncUser) return;
  try {
    const body = JSON.stringify({ meta: { app: 'fiduciary-quest', updated: Date.now() }, quest: S });
    await fetch(syncPath(S.settings.syncUser), { method: 'PUT', body });
  } catch (e) { /* offline is fine */ }
}
async function syncPull() {
  if (!S.settings.syncUser) return;
  try {
    const res = await fetch(syncPath(S.settings.syncUser));
    if (!res.ok) return;
    const node = await res.json();
    if (node && node.quest) { S = mergeStates(S, node.quest); saveState(); }
  } catch (e) { }
}
function mergeStates(a, b) {
  if (!b || !b.v) return a;
  const out = Object.assign(defaultState(), a);
  out.xp = Math.max(a.xp || 0, b.xp || 0);
  out.profile = (b.profile && b.profile.name && !a.profile.name) ? b.profile : a.profile;
  if (b.profile && b.profile.examDate && !out.profile.examDate) out.profile.examDate = b.profile.examDate;
  // streak: prefer the one with the most recent lastDay
  out.streak = (b.streak && b.streak.lastDay > (a.streak.lastDay || '')) ? b.streak : a.streak;
  out.streak.best = Math.max(a.streak.best || 0, b.streak && b.streak.best || 0);
  // question stats: take entry with more attempts
  out.qstats = Object.assign({}, a.qstats);
  Object.entries(b.qstats || {}).forEach(([k, vs]) => {
    const cur = out.qstats[k];
    if (!cur || (vs.s || 0) > cur.s) out.qstats[k] = vs;
  });
  // cases: prefer done > stage progress
  out.cases = Object.assign({}, a.cases);
  Object.entries(b.cases || {}).forEach(([k, vc]) => {
    const cur = out.cases[k];
    if (!cur) { out.cases[k] = vc; return; }
    const order = ['disaster', 'shaky', 'solid', 'triumph'];
    if (vc.done && !cur.done) out.cases[k] = vc;
    else if (vc.done && cur.done) {
      cur.bestGrade = order.indexOf(vc.bestGrade) > order.indexOf(cur.bestGrade) ? vc.bestGrade : cur.bestGrade;
      cur.flawless = cur.flawless || vc.flawless;
    } else if (!cur.done && (vc.stage || 0) > (cur.stage || 0)) out.cases[k] = vc;
  });
  // arcade bests
  const ba = b.arcade || {};
  out.arcade.lightning.best = Math.max(a.arcade.lightning.best, ba.lightning && ba.lightning.best || 0);
  out.arcade.lightning.plays = Math.max(a.arcade.lightning.plays, ba.lightning && ba.lightning.plays || 0);
  out.arcade.survival.best = Math.max(a.arcade.survival.best, ba.survival && ba.survival.best || 0);
  out.arcade.survival.plays = Math.max(a.arcade.survival.plays, ba.survival && ba.survival.plays || 0);
  out.arcade.bettercall.best = Math.max(a.arcade.bettercall.best, ba.bettercall && ba.bettercall.best || 0);
  out.arcade.bettercall.plays = Math.max(a.arcade.bettercall.plays, ba.bettercall && ba.bettercall.plays || 0);
  out.arcade.termmatch.wins = Math.max(a.arcade.termmatch.wins, ba.termmatch && ba.termmatch.wins || 0);
  const bms = ba.termmatch && ba.termmatch.bestMs || 0;
  out.arcade.termmatch.bestMs = (a.arcade.termmatch.bestMs && bms) ? Math.min(a.arcade.termmatch.bestMs, bms) : (a.arcade.termmatch.bestMs || bms);
  // achievements union (earliest)
  out.ach = Object.assign({}, b.ach, a.ach);
  // counters: take max of each
  Object.keys(out.counters).forEach(k => { out.counters[k] = Math.max(a.counters[k] || 0, (b.counters || {})[k] || 0); });
  // dailies: same date → take more progress
  out.dailies = a.dailies;
  if (b.dailies && b.dailies.date === a.dailies.date) {
    b.dailies.quests.forEach((bq, i) => {
      const aq = a.dailies.quests[i];
      if (aq && aq.id === bq.id) { aq.prog = Math.max(aq.prog, bq.prog); aq.claimed = aq.claimed || bq.claimed; }
    });
  } else if (b.dailies && b.dailies.date > (a.dailies.date || '')) out.dailies = b.dailies;
  out.settings = a.settings;
  return out;
}

/* ---------------- Keyboard ---------------- */
document.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea, select')) return;
  const key = e.key.toLowerCase();
  const optWrap = $('#playOpts') || $('#caseOpts');
  if (optWrap && (activeView === 'play' || activeView === 'case')) {
    const opts = [...optWrap.querySelectorAll('.opt:not(:disabled)')];
    if (opts.length) {
      let idx = -1;
      if (['1', '2', '3', '4'].includes(key)) idx = +key - 1;
      if (['a', 'b', 'c', 'd'].includes(key)) idx = 'abcd'.indexOf(key);
      if (idx >= 0 && opts[idx]) { opts[idx].click(); e.preventDefault(); return; }
    }
  }
  if (key === 'enter' || key === ' ') {
    const next = $('#playNext') || $('#caseNext');
    if (next) { next.click(); e.preventDefault(); }
  }
});

/* ---------------- Init ---------------- */
async function loadData() {
  const tryFetch = async (url, fallback) => {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch (e) { }
    return fallback;
  };
  [QUESTIONS, CASES, GLOSSARY] = await Promise.all([
    tryFetch('data/question_bank.json', []),
    tryFetch('data/cases.json', []),
    tryFetch('data/glossary.json', { terms: [], timelines: [] })
  ]);
}

function bindShell() {
  $$('.nav-btn').forEach(b => b.onclick = () => { beep('click'); navigate(b.dataset.view); });
  $('#settingsBtn').onclick = () => { beep('click'); navigate('settings'); };
  $('#luClose').onclick = () => { $('#levelUpModal').classList.add('hidden'); showNextAch(); };
  $('#achClose').onclick = () => { $('#achModal').classList.add('hidden'); showNextAch(); };
}

async function init() {
  $('#splashTip').textContent = SPLASH_TIPS[Math.floor(Math.random() * SPLASH_TIPS.length)];
  await loadData();
  S = loadState();

  if (!S) {
    // onboarding
    S = defaultState();
    $('#splash').classList.add('fade');
    $('#onboarding').classList.remove('hidden');
    $('#obStart').onclick = () => {
      S.profile.name = $('#obName').value.trim() || 'Counselor';
      S.profile.examDate = $('#obDate').value || '';
      saveState();
      $('#onboarding').classList.add('hidden');
      startApp();
    };
    return;
  }
  await syncPull();
  $('#splash').classList.add('fade');
  startApp();
}

function startApp() {
  $('#appShell').classList.remove('hidden');
  bindShell();
  ensureDailies();
  renderHud();
  navigate('home');
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
}
init();
