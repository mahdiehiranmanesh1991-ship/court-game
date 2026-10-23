// «اعتراض دارم!» — pure game engine (no DOM). Everything here is unit-tested in tests/engine.test.js.
export const MAX_HEARTS = 5;
export const SAVE_KEY = 'eteraz-daram.v1';

/** A dialogue line is authored as ['who', 'text', 'mood?', 'fx?'] — normalise to an object. */
export function line(l) {
  if (!Array.isArray(l)) return l;
  const [who, text, mood = 'normal', fx = ''] = l;
  return { who, text, mood, fx };
}
export const lines = (arr = []) => arr.map(line);

export function newRun(c) {
  return {
    caseId: c.id, phase: 'intro', seg: 0, hearts: MAX_HEARTS,
    evidence: c.evidence.filter((e) => e.initial).map((e) => e.id),
    done: [], revealed: [], pressed: [], hintsUsed: 0, mistakes: 0, retries: 0, loc: null,
    startedAt: Date.now(),
  };
}

export const hasEvidence = (run, id) => run.evidence.includes(id);
export function addEvidence(run, id) { if (id && !run.evidence.includes(id)) run.evidence.push(id); return run; }
export const evidenceById = (c, id) => c.evidence.find((e) => e.id === id);

// ---------- investigation ----------
export const location = (c, id) => c.investigation.locations.find((l) => l.id === id);
export function actionAvailable(run, a) { return !a.requires || a.requires.every((r) => hasEvidence(run, r) || run.done.includes(r)); }
export function doAction(c, run, locId, actionId) {
  const loc = location(c, locId); if (!loc) throw new Error('no location ' + locId);
  const a = loc.actions.find((x) => x.id === actionId); if (!a) throw new Error('no action ' + actionId);
  if (!actionAvailable(run, a)) return { lines: [], gained: null, locked: true };
  const first = !run.done.includes(a.id);
  if (first) run.done.push(a.id);
  let gained = null;
  if (a.gives && !hasEvidence(run, a.gives)) { addEvidence(run, a.gives); gained = a.gives; }
  return { lines: lines(first || !a.again ? a.lines : a.again), gained, first };
}
export function missingRequired(c, run) { return c.investigation.required.filter((id) => !hasEvidence(run, id)); }
export const canGoToCourt = (c, run) => missingRequired(c, run).length === 0;
export function locationProgress(c, run, locId) {
  const loc = location(c, locId); const total = loc.actions.length;
  return { done: loc.actions.filter((a) => run.done.includes(a.id)).length, total };
}

// ---------- trial ----------
export const segment = (c, run) => c.trial[run.seg];
export function visibleStatements(seg, run) {
  return seg.statements.filter((s) => !s.hidden || run.revealed.includes(seg.id + ':' + s.id));
}
export function press(seg, run, stmtId) {
  const s = seg.statements.find((x) => x.id === stmtId); if (!s) throw new Error('no statement ' + stmtId);
  const key = seg.id + ':' + stmtId; if (!run.pressed.includes(key)) run.pressed.push(key);
  let revealed = null;
  if (s.reveals) { const rk = seg.id + ':' + s.reveals; if (!run.revealed.includes(rk)) { run.revealed.push(rk); revealed = s.reveals; } }
  return { lines: lines(s.press || [['judge', 'دادگاه چیز تازه‌ای از این جمله نفهمید. ادامه دهید.']]), revealed };
}
/** Does presenting `evidenceId` on statement `stmtId` expose the contradiction? */
export function isContradiction(seg, stmtId, evidenceId) {
  const s = seg.statements.find((x) => x.id === stmtId);
  if (!s || !s.contradiction) return false;
  const ok = Array.isArray(s.contradiction) ? s.contradiction : [s.contradiction];
  return ok.includes(evidenceId);
}
export function penalize(run, n = 1) {
  run.hearts = Math.max(0, run.hearts - n); run.mistakes += 1;
  return run.hearts === 0;
}
/** Cross-examination present. Mutates run (hearts) and returns what the UI should play. */
export function presentOnStatement(c, run, stmtId, evidenceId) {
  const seg = segment(c, run);
  if (seg.type !== 'testimony') throw new Error('not a testimony');
  if (!hasEvidence(run, evidenceId)) throw new Error('evidence not in record: ' + evidenceId);
  if (isContradiction(seg, stmtId, evidenceId)) return { correct: true, lines: lines(seg.solve), gameOver: false };
  const gameOver = penalize(run, seg.penalty || 1);
  const s = seg.statements.find((x) => x.id === stmtId);
  return { correct: false, lines: lines((s && s.wrong) || seg.wrong || DEFAULT_WRONG), gameOver };
}
export function presentAnswer(c, run, evidenceId) {
  const seg = segment(c, run);
  if (seg.type !== 'present') throw new Error('not a present segment');
  const ok = (Array.isArray(seg.answer) ? seg.answer : [seg.answer]).includes(evidenceId);
  if (ok) return { correct: true, lines: lines(seg.success), gameOver: false };
  const gameOver = penalize(run, seg.penalty || 1);
  return { correct: false, lines: lines(seg.fail || DEFAULT_WRONG), gameOver };
}
export function chooseOption(c, run, idx) {
  const seg = segment(c, run);
  if (seg.type !== 'choice') throw new Error('not a choice segment');
  const o = seg.options[idx]; if (!o) throw new Error('no option ' + idx);
  if (o.correct) return { correct: true, lines: lines(o.lines || seg.success), gameOver: false };
  const gameOver = penalize(run, seg.penalty || 1);
  return { correct: false, lines: lines(o.lines || seg.fail || DEFAULT_WRONG), gameOver };
}
export const DEFAULT_WRONG = [['judge', 'این مدرک چه ربطی به این موضوع دارد؟ دادگاه را سرگرم نکنید!', 'angry', 'gavel']];

export function useHint(c, run) {
  const seg = segment(c, run); run.hintsUsed += 1;
  return seg && seg.hint ? seg.hint : 'جمله‌ها را یکی‌یکی با «فشار بیاور» بررسی کن و پرونده را دوباره بخوان.';
}
export function advance(c, run) {
  run.seg += 1;
  if (run.seg >= c.trial.length) { run.phase = 'verdict'; run.seg = c.trial.length; }
  return run;
}
export function retry(run) { run.hearts = MAX_HEARTS; run.retries += 1; return run; }

// ---------- scoring ----------
export function stars(run) {
  if (run.retries > 0) return 1;
  if (run.hearts === MAX_HEARTS && run.hintsUsed === 0) return 3;
  if (run.hearts >= 3) return 2;
  return 1;
}
export function score(run) {
  return Math.max(0, 1000 + run.hearts * 200 - run.hintsUsed * 75 - run.mistakes * 50 - run.retries * 300);
}
export function rank(sc) {
  if (sc >= 1900) return 'وکیل افسانه‌ای';
  if (sc >= 1600) return 'وکیل پایه‌یک ممتاز';
  if (sc >= 1300) return 'وکیل کاربلد';
  return 'کارآموز امیدوار';
}

// ---------- save / load ----------
export function defaultSave() {
  return { v: 1, settings: { music: true, sfx: true, haptics: true, textSpeed: 'normal', playerName: 'راستین' }, progress: {}, current: null };
}
export function loadSave(storage) {
  try {
    const raw = storage.getItem(SAVE_KEY); if (!raw) return defaultSave();
    const s = JSON.parse(raw); const d = defaultSave();
    if (!s || s.v !== 1) return d;
    return { ...d, ...s, settings: { ...d.settings, ...(s.settings || {}) }, progress: s.progress || {} };
  } catch { return defaultSave(); }
}
export function writeSave(storage, save) { storage.setItem(SAVE_KEY, JSON.stringify(save)); return save; }
export function recordResult(save, run) {
  const prev = save.progress[run.caseId] || { stars: 0, best: 0, plays: 0 };
  const st = stars(run); const sc = score(run);
  save.progress[run.caseId] = { stars: Math.max(prev.stars, st), best: Math.max(prev.best, sc), plays: prev.plays + 1, completed: true, last: sc };
  save.current = null;
  return { stars: st, score: sc, best: save.progress[run.caseId].best, newBest: sc > prev.best };
}

// ---------- case validation (used by tests and in dev console) ----------
const MOODS = new Set(['normal', 'happy', 'angry', 'shocked', 'sad', 'think', 'smug', 'sweat', 'confident']);
export function validateCase(c) {
  const errs = []; const E = (m) => errs.push(`[${c && c.id}] ${m}`);
  if (!c || !c.id || !c.title) { E('missing id/title'); return errs; }
  const ev = new Set((c.evidence || []).map((e) => e.id));
  if (ev.size !== (c.evidence || []).length) E('duplicate evidence ids');
  const cast = new Set(['narr', 'player', ...Object.keys(c.cast || {})]);
  const chkLines = (arr, where) => (arr || []).forEach((l, i) => {
    const o = line(l);
    if (!cast.has(o.who)) E(`${where}[${i}] unknown speaker "${o.who}"`);
    if (!o.text || typeof o.text !== 'string') E(`${where}[${i}] empty text`);
    if (o.mood && !MOODS.has(o.mood)) E(`${where}[${i}] unknown mood "${o.mood}"`);
  });
  chkLines(c.intro, 'intro');
  const inv = c.investigation; if (!inv) E('no investigation');
  const gives = new Set(c.evidence.filter((e) => e.initial).map((e) => e.id)); const actIds = new Set();
  (inv?.locations || []).forEach((loc) => {
    if (!loc.actions?.length) E(`location ${loc.id} has no actions`);
    loc.actions.forEach((a) => {
      if (actIds.has(a.id)) E(`duplicate action id ${a.id}`); actIds.add(a.id);
      if (a.gives) { if (!ev.has(a.gives)) E(`action ${a.id} gives unknown evidence ${a.gives}`); gives.add(a.gives); }
      chkLines(a.lines, `action ${a.id}`);
    });
  });
  (inv?.locations || []).forEach((loc) => loc.actions.forEach((a) => (a.requires || []).forEach((r) => { if (!ev.has(r) && !actIds.has(r)) E(`action ${a.id} requires unknown ${r}`); })));
  (inv?.required || []).forEach((id) => { if (!ev.has(id)) E(`required unknown evidence ${id}`); if (!gives.has(id)) E(`required evidence ${id} is never obtainable`); });
  if (!c.trial?.length) E('no trial');
  const segIds = new Set(); let testimonies = 0;
  (c.trial || []).forEach((s, i) => {
    const w = `trial[${i}]${s.id ? '(' + s.id + ')' : ''}`;
    if (s.id) { if (segIds.has(s.id)) E(`duplicate segment id ${s.id}`); segIds.add(s.id); }
    chkLines(s.lines, w + '.lines');
    if (s.type === 'scene') { if (!s.lines?.length) E(`${w} empty scene`); }
    else if (s.type === 'testimony') {
      testimonies++;
      if (!s.id) E(`${w} testimony needs id`);
      if (!cast.has(s.witness)) E(`${w} unknown witness ${s.witness}`);
      if ((s.statements || []).length < 2) E(`${w} needs ≥2 statements`);
      const sids = new Set(s.statements.map((x) => x.id));
      const contra = s.statements.filter((x) => x.contradiction);
      if (!contra.length) E(`${w} has no contradiction`);
      contra.forEach((x) => (Array.isArray(x.contradiction) ? x.contradiction : [x.contradiction]).forEach((id) => {
        if (!ev.has(id)) E(`${w}.${x.id} contradiction references missing evidence ${id}`);
        else if (!gives.has(id)) E(`${w}.${x.id} contradiction evidence ${id} is never obtainable`);
      }));
      s.statements.forEach((x) => { if (x.reveals && !sids.has(x.reveals)) E(`${w}.${x.id} reveals unknown statement ${x.reveals}`); chkLines(x.press, `${w}.${x.id}.press`); chkLines(x.wrong, `${w}.${x.id}.wrong`); });
      s.statements.filter((x) => x.hidden).forEach((x) => { if (!s.statements.some((y) => y.reveals === x.id)) E(`${w}.${x.id} hidden but never revealed`); });
      chkLines(s.solve, w + '.solve'); if (!s.solve?.length) E(`${w} needs solve lines`);
      if (!s.hint) E(`${w} needs a hint`);
    } else if (s.type === 'present') {
      (Array.isArray(s.answer) ? s.answer : [s.answer]).forEach((id) => { if (!ev.has(id)) E(`${w} answer references missing evidence ${id}`); else if (!gives.has(id)) E(`${w} answer ${id} never obtainable`); });
      if (!s.prompt) E(`${w} needs prompt`); chkLines(s.success, w + '.success'); chkLines(s.fail, w + '.fail');
    } else if (s.type === 'choice') {
      if (!s.prompt) E(`${w} needs prompt`);
      if ((s.options || []).filter((o) => o.correct).length !== 1) E(`${w} must have exactly one correct option`);
      (s.options || []).forEach((o, j) => chkLines(o.lines, `${w}.opt${j}`));
    } else E(`${w} unknown type ${s.type}`);
  });
  if (testimonies < 2) E('needs ≥2 testimonies (cross-examinations)');
  if (!c.verdict?.lines?.length) E('no verdict');
  chkLines(c.verdict?.lines, 'verdict');
  if (!c.lesson?.points?.length) E('no lesson points');
  (c.lesson?.points || []).forEach((p, i) => { if (!p.ref || !p.text) E(`lesson.points[${i}] needs ref+text`); });
  return errs;
}
