import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';

// A tiny synthetic case so engine rules are tested independently of story content.
const mini = () => ({
  id: 'mini', title: 'آزمایشی',
  cast: { judge: { name: 'ق' }, w: { name: 'شاهد' } },
  evidence: [{ id: 'a', name: 'الف', initial: true }, { id: 'b', name: 'ب' }, { id: 'c', name: 'ج' }],
  intro: [['narr', 'شروع']],
  investigation: { start: 'x', required: ['b', 'c'], locations: [{ id: 'x', name: 'X', actions: [
    { id: 'talk1', type: 'talk', label: 't', lines: [['w', 'سلام']], again: [['w', 'دوباره سلام']], gives: 'b' },
    { id: 'look', type: 'examine', label: 'l', requires: ['talk1'], lines: [['narr', 'نگاه']], gives: 'c' },
  ] }] },
  trial: [
    { type: 'testimony', id: 't1', witness: 'w', title: 'ش', hint: 'کمک', solve: [['judge', 'آفرین']], statements: [
      { id: 's1', text: 'یک', press: [['w', 'فشار']], reveals: 's3' },
      { id: 's2', text: 'دو', contradiction: ['b', 'c'] },
      { id: 's3', text: 'سه', hidden: true, contradiction: 'a' },
    ] },
    { type: 'present', id: 'p1', prompt: 'کدام؟', hint: 'h', answer: 'c', success: [['judge', 'درست']], fail: [['judge', 'غلط']] },
    { type: 'choice', id: 'q1', prompt: '؟', options: [{ text: 'غلط' }, { text: 'درست', correct: true }] },
    { type: 'testimony', id: 't2', witness: 'w', title: 'ش۲', hint: 'h', solve: [['judge', 'ok']], statements: [{ id: 's1', text: 'x' }, { id: 's2', text: 'y', contradiction: 'b' }] },
  ],
  verdict: { title: 'برائت', lines: [['judge', 'تمام']] },
  lesson: { title: 'درس', points: [{ ref: 'ماده ۱', text: 'متن' }] },
});

class MemStore { constructor() { this.m = new Map(); } getItem(k) { return this.m.has(k) ? this.m.get(k) : null; } setItem(k, v) { this.m.set(k, String(v)); } }

test('line() normalises tuples with defaults', () => {
  assert.deepEqual(E.line(['w', 'متن']), { who: 'w', text: 'متن', mood: 'normal', fx: '' });
  assert.deepEqual(E.line(['w', 'متن', 'angry', 'shake']), { who: 'w', text: 'متن', mood: 'angry', fx: 'shake' });
});

test('newRun starts with 5 hearts and only initial evidence', () => {
  const r = E.newRun(mini());
  assert.equal(r.hearts, 5); assert.equal(E.MAX_HEARTS, 5);
  assert.deepEqual(r.evidence, ['a']); assert.equal(r.phase, 'intro'); assert.equal(r.seg, 0);
});

test('investigation: gives evidence once, respects requires, uses "again" lines', () => {
  const c = mini(), r = E.newRun(c);
  assert.equal(E.doAction(c, r, 'x', 'look').locked, true, 'look requires talk1');
  assert.equal(E.canGoToCourt(c, r), false);
  const a = E.doAction(c, r, 'x', 'talk1');
  assert.equal(a.gained, 'b'); assert.equal(a.first, true); assert.equal(a.lines[0].text, 'سلام');
  const again = E.doAction(c, r, 'x', 'talk1');
  assert.equal(again.gained, null); assert.equal(again.lines[0].text, 'دوباره سلام');
  assert.deepEqual(E.missingRequired(c, r), ['c']);
  assert.equal(E.doAction(c, r, 'x', 'look').gained, 'c');
  assert.equal(E.canGoToCourt(c, r), true);
  assert.deepEqual(E.locationProgress(c, r, 'x'), { done: 2, total: 2 });
});

test('contradiction checking accepts string or array and rejects others', () => {
  const seg = mini().trial[0];
  assert.equal(E.isContradiction(seg, 's2', 'b'), true);
  assert.equal(E.isContradiction(seg, 's2', 'c'), true);
  assert.equal(E.isContradiction(seg, 's2', 'a'), false);
  assert.equal(E.isContradiction(seg, 's1', 'b'), false, 'statement without contradiction');
  assert.equal(E.isContradiction(seg, 's3', 'a'), true);
  assert.equal(E.isContradiction(seg, 'nope', 'a'), false);
});

test('press reveals hidden statements exactly once', () => {
  const c = mini(), r = E.newRun(c), seg = c.trial[0];
  assert.deepEqual(E.visibleStatements(seg, r).map((s) => s.id), ['s1', 's2']);
  const p = E.press(seg, r, 's1'); assert.equal(p.revealed, 's3'); assert.equal(p.lines[0].text, 'فشار');
  assert.deepEqual(E.visibleStatements(seg, r).map((s) => s.id), ['s1', 's2', 's3']);
  assert.equal(E.press(seg, r, 's1').revealed, null);
  assert.ok(r.pressed.includes('t1:s1'));
  assert.ok(E.press(seg, r, 's2').lines.length > 0, 'default press lines');
});

test('wrong presents cost a heart; 5 mistakes is game over; correct costs nothing', () => {
  const c = mini(), r = E.newRun(c); r.evidence.push('b', 'c');
  const ok = E.presentOnStatement(c, r, 's2', 'b');
  assert.equal(ok.correct, true); assert.equal(r.hearts, 5); assert.equal(ok.lines[0].text, 'آفرین');
  for (let i = 1; i <= 4; i++) { const w = E.presentOnStatement(c, r, 's1', 'a'); assert.equal(w.correct, false); assert.equal(w.gameOver, false); assert.equal(r.hearts, 5 - i); }
  const last = E.presentOnStatement(c, r, 's2', 'a');
  assert.equal(last.gameOver, true); assert.equal(r.hearts, 0); assert.equal(r.mistakes, 5);
  E.penalize(r); assert.equal(r.hearts, 0, 'hearts never go negative');
  E.retry(r); assert.equal(r.hearts, 5); assert.equal(r.retries, 1);
});

test('cannot present evidence that is not in the record', () => {
  const c = mini(), r = E.newRun(c);
  assert.throws(() => E.presentOnStatement(c, r, 's2', 'b'), /not in record/);
});

test('present and choice segments + advance to verdict', () => {
  const c = mini(), r = E.newRun(c); r.evidence.push('b', 'c');
  E.advance(c, r); assert.equal(E.segment(c, r).type, 'present');
  assert.equal(E.presentAnswer(c, r, 'a').correct, false); assert.equal(r.hearts, 4);
  assert.equal(E.presentAnswer(c, r, 'c').correct, true);
  E.advance(c, r); assert.equal(E.chooseOption(c, r, 0).correct, false); assert.equal(r.hearts, 3);
  assert.equal(E.chooseOption(c, r, 1).correct, true);
  E.advance(c, r); E.advance(c, r); assert.equal(r.phase, 'verdict');
});

test('hints are counted and returned', () => {
  const c = mini(), r = E.newRun(c);
  assert.equal(E.useHint(c, r), 'کمک'); assert.equal(r.hintsUsed, 1);
});

test('stars, score and rank', () => {
  const r = E.newRun(mini());
  assert.equal(E.stars(r), 3); assert.equal(E.score(r), 2000); assert.equal(E.rank(2000), 'وکیل افسانه‌ای');
  r.hintsUsed = 1; assert.equal(E.stars(r), 2);
  r.hintsUsed = 0; r.hearts = 3; r.mistakes = 2; assert.equal(E.stars(r), 2); assert.equal(E.score(r), 1500);
  r.hearts = 2; assert.equal(E.stars(r), 1);
  r.hearts = 5; r.retries = 1; assert.equal(E.stars(r), 1, 'any retry caps at one star');
  r.hearts = 0; r.mistakes = 30; assert.equal(E.score(r), 0, 'score never negative');
  assert.equal(E.rank(1000), 'کارآموز امیدوار');
});

test('save/load round trip and tolerance of corrupt data', () => {
  const s = new MemStore();
  assert.deepEqual(E.loadSave(s), E.defaultSave());
  const sv = E.defaultSave(); sv.settings.music = false; sv.settings.playerName = 'ایرانمنش';
  const r = E.newRun(mini()); sv.current = r; E.writeSave(s, sv);
  const back = E.loadSave(s);
  assert.equal(back.settings.music, false); assert.equal(back.settings.playerName, 'ایرانمنش');
  assert.equal(back.settings.textSpeed, 'normal', 'missing settings are filled from defaults');
  assert.deepEqual(back.current, JSON.parse(JSON.stringify(r)));
  s.setItem(E.SAVE_KEY, '{broken'); assert.deepEqual(E.loadSave(s), E.defaultSave());
  s.setItem(E.SAVE_KEY, JSON.stringify({ v: 99 })); assert.deepEqual(E.loadSave(s), E.defaultSave());
  s.setItem(E.SAVE_KEY, JSON.stringify({ v: 1, settings: { sfx: false } }));
  assert.equal(E.loadSave(s).settings.sfx, false); assert.equal(E.loadSave(s).settings.music, true);
});

test('recordResult keeps best stars/score and clears current run', () => {
  const sv = E.defaultSave(); const r = E.newRun(mini()); sv.current = r;
  r.hearts = 3; const a = E.recordResult(sv, r);
  assert.equal(a.stars, 2); assert.equal(a.newBest, true); assert.equal(sv.current, null);
  const r2 = E.newRun(mini()); r2.hearts = 1; r2.mistakes = 4; const b = E.recordResult(sv, r2);
  assert.equal(b.newBest, false); assert.equal(sv.progress.mini.stars, 2); assert.equal(sv.progress.mini.best, a.score); assert.equal(sv.progress.mini.plays, 2);
});

test('validateCase accepts the mini case and catches broken references', () => {
  assert.deepEqual(E.validateCase(mini()), []);
  const bad = mini(); bad.trial[0].statements[1].contradiction = 'ghost';
  assert.ok(E.validateCase(bad).some((e) => /missing evidence ghost/.test(e)));
  const bad2 = mini(); bad2.trial[2].options[0].correct = true;
  assert.ok(E.validateCase(bad2).some((e) => /exactly one correct/.test(e)));
  const bad3 = mini(); bad3.trial[0].statements[2].hidden = true; delete bad3.trial[0].statements[0].reveals;
  assert.ok(E.validateCase(bad3).some((e) => /hidden but never revealed/.test(e)));
  const bad4 = mini(); bad4.intro.push(['stranger', 'hi']);
  assert.ok(E.validateCase(bad4).some((e) => /unknown speaker/.test(e)));
  const bad5 = mini(); bad5.investigation.locations[0].actions[1].gives = null; 
  assert.ok(E.validateCase(bad5).some((e) => /never obtainable/.test(e)));
  const bad6 = mini(); bad6.trial = bad6.trial.slice(0, 3);
  assert.ok(E.validateCase(bad6).some((e) => /≥2 testimonies/.test(e)));
});
