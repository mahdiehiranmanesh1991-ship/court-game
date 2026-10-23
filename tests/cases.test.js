import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import { CASES, caseById } from '../cases/index.js';
import { portrait, background, MOOD_LIST } from '../js/art.js';

test('there are at least 3 cases with unique ids and orders', () => {
  assert.ok(CASES.length >= 3);
  assert.equal(new Set(CASES.map((c) => c.id)).size, CASES.length);
  assert.equal(new Set(CASES.map((c) => c.order)).size, CASES.length);
  assert.equal(caseById('cheque').order, 1);
});

for (const c of CASES) {
  test(`case "${c.id}" passes validateCase (every contradiction references existing, obtainable evidence)`, () => {
    assert.deepEqual(E.validateCase(c), []);
  });

  test(`case "${c.id}" has the required content`, () => {
    const t = c.trial.filter((s) => s.type === 'testimony');
    assert.ok(t.length >= 2, '2+ cross-examinations');
    assert.ok(new Set(t.map((s) => s.witness)).size >= 2, 'at least two different witnesses');
    assert.ok(c.investigation.locations.length >= 3, '3+ investigation locations');
    assert.ok(c.investigation.locations.some((l) => l.actions.some((a) => a.type === 'talk')), 'can talk to witnesses');
    assert.match(c.court, /کرمان/); assert.match(c.court, /خیالی/);
    assert.ok(c.lesson.points.length >= 3);
    assert.ok(c.lesson.points.filter((p) => /ماده|اصل|مواد/.test(p.ref)).length >= 3, '3+ lesson points cite an article');
    assert.ok(c.trial.filter((s) => s.type !== 'scene').every((s) => s.hint), 'every interactive segment has a hint');
  });

  test(`case "${c.id}" is solvable end-to-end with perfect play (3 stars)`, () => {
    const r = E.newRun(c);
    // investigation: keep doing available actions until nothing new happens
    let progressed = true;
    while (progressed) {
      progressed = false;
      for (const loc of c.investigation.locations) for (const a of loc.actions) {
        if (!r.done.includes(a.id) && E.actionAvailable(r, a)) { E.doAction(c, r, loc.id, a.id); progressed = true; }
      }
    }
    assert.ok(E.canGoToCourt(c, r), 'all required evidence obtainable: missing ' + E.missingRequired(c, r));
    const allActions = c.investigation.locations.flatMap((l) => l.actions.map((a) => a.id));
    assert.deepEqual(allActions.filter((id) => !r.done.includes(id)), [], 'every action is reachable');
    r.phase = 'trial';
    while (r.phase === 'trial') {
      const seg = E.segment(c, r);
      if (seg.type === 'testimony') {
        let st = E.visibleStatements(seg, r).find((s) => s.contradiction);
        // contradiction hidden? press statements until it shows up
        while (!st) { for (const s of E.visibleStatements(seg, r)) E.press(seg, r, s.id); st = E.visibleStatements(seg, r).find((s) => s.contradiction); }
        const ev = [].concat(st.contradiction)[0];
        assert.equal(E.presentOnStatement(c, r, st.id, ev).correct, true);
      } else if (seg.type === 'present') {
        assert.equal(E.presentAnswer(c, r, [].concat(seg.answer)[0]).correct, true);
      } else if (seg.type === 'choice') {
        assert.equal(E.chooseOption(c, r, seg.options.findIndex((o) => o.correct)).correct, true);
      }
      E.advance(c, r);
    }
    assert.equal(r.phase, 'verdict'); assert.equal(r.hearts, 5); assert.equal(E.stars(r), 3);
  });

  test(`case "${c.id}" every non-contradicting evidence is punished`, () => {
    const r = E.newRun(c); r.evidence = c.evidence.map((e) => e.id);
    c.trial.forEach((seg, i) => {
      if (seg.type !== 'testimony') return; r.seg = i;
      for (const s of seg.statements) for (const ev of r.evidence) {
        const h = r.hearts; const res = E.presentOnStatement(c, r, s.id, ev);
        assert.equal(res.correct, E.isContradiction(seg, s.id, ev));
        if (!res.correct) assert.equal(r.hearts, Math.max(0, h - 1));
        r.hearts = 5;
      }
    });
  });

  test(`case "${c.id}" art renders for every cast member and background`, () => {
    for (const [k, v] of Object.entries(c.cast)) for (const m of MOOD_LIST) {
      const s = portrait(v.look, m); assert.match(s, /^<svg/); assert.ok(!/undefined|NaN/.test(s), `${k}/${m}`);
    }
    for (const l of c.investigation.locations) assert.ok(!/undefined|NaN/.test(background(l.bg)));
  });
}

test('no copyrighted franchise names leak into case content', () => {
  const all = JSON.stringify(CASES);
  for (const bad of ['Phoenix', 'Wright', 'Edgeworth', 'Capcom', 'Ace Attorney', 'فینیکس', 'رایت', 'اجورث']) assert.ok(!all.includes(bad), bad);
});
