// Headless-Chrome end-to-end test: plays case 1 («چکِ برگشتی») through the real UI to the verdict.
// Usage: python3 -m http.server 8791 -d /workspace & PW_DIR=/tmp/pw node tests/e2e.mjs http://127.0.0.1:8791/court-game/
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const require = createRequire((process.env.PW_DIR || '/tmp/pw') + '/');
const { chromium } = require('playwright-core');

const URL_ = process.argv[2] || 'http://127.0.0.1:8791/court-game/';
const ORIGIN = new URL(URL_).origin;
const SHOTS = new URL('../screenshots/', import.meta.url).pathname; mkdirSync(SHOTS, { recursive: true });
const log = (...a) => console.log('•', ...a);

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fa-IR', timezoneId: 'Asia/Tehran',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
});
const page = await ctx.newPage();
const external = [], errors = [];
page.on('request', (r) => { const u = r.url(); if (!u.startsWith(ORIGIN) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u); });
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0; const shot = async (name, settle = 400) => {
  await sleep(settle);
  // let finite entrance animations finish (headless Chrome can lag behind wall-clock)
  if (settle >= 400) await page.evaluate(() => Promise.race([new Promise((r) => setTimeout(r, 1500)), Promise.all(document.getAnimations().filter((a) => a.effect && a.effect.getComputedTiming().iterations !== Infinity && !String(a.animationName || '').match(/fall|confetti/)).map((a) => a.finished.catch(() => {})))])); const f = `${SHOTS}${String(++n).padStart(2, '0')}-${name}.png`; await page.screenshot({ path: f }); log('screenshot', f); };
const tid = (t) => `[data-testid="${t}"]`;

// Advance dialogue / dismiss "new evidence" popups until `cond` (evaluated in page) is true.
let evidenceShot = false;
async function until(cond, label, timeout = 40000) {
  const t0 = Date.now();
  for (;;) {
    const st = await page.evaluate((c) => {
      const vis = (s) => { const e = document.querySelector(s); return !!e && !e.closest('[hidden]') && e.offsetParent !== null; };
      // eslint-disable-next-line no-new-func
      if (Function('vis', 'return (' + c + ')')(vis)) return 'ok';
      if (vis('[data-testid="new-evidence"]')) return 'evidence';
      if (document.body.dataset.dlg === '1' && document.querySelector('#blocker').hidden && document.querySelector('#modal').hidden) { document.querySelector('#dlg').click(); return 'dlg'; }
      return 'wait';
    }, cond);
    if (st === 'ok') return;
    if (st === 'evidence') { if (!evidenceShot) { evidenceShot = true; await shot('new-evidence'); } await page.click(tid('ok-evidence')); }
    if (Date.now() - t0 > timeout) { await shot('TIMEOUT-' + label); throw new Error('timeout waiting for ' + label); }
    await sleep(st === 'dlg' ? 15 : 40);
  }
}
const idle = (extra) => `document.body.dataset.dlg !== '1' && document.querySelector('#blocker').hidden && document.querySelector('#modal').hidden && (${extra})`;
const G = (fn, arg) => page.evaluate(fn, arg);

// ---------- home ----------
await page.goto(URL_);
await page.waitForSelector('body[data-ready="1"]', { state: 'attached' });
assert.equal(await G(() => document.documentElement.dir), 'rtl');
await page.evaluate(() => document.fonts.ready);
assert.ok(await G(() => document.fonts.check('16px Vazirmatn')), 'Vazirmatn font loaded');
assert.match(await page.textContent(tid('disclaimer')), /مشاوره‌ی حقوقی نیست/);
await shot('home');

// settings: instant text so the test runs fast; also set the surname
await page.click(tid('settings')); await page.waitForSelector(tid('speed-instant'));
await page.click(tid('speed-instant')); await page.fill(tid('set-name'), 'ایرانمنش');
await shot('settings');
await page.click(tid('close-modal'));
assert.equal(await G(() => JSON.parse(localStorage.getItem('eteraz-daram.v1')).settings.textSpeed), 'instant');

// ---------- case select ----------
await page.click(tid('play')); await page.waitForSelector(tid('case-cheque'));
assert.equal(await page.locator('.case-card').count(), await G(() => window.__game.CASES.length));
await shot('cases');
await page.click(tid('case-cheque'));

// ---------- investigation ----------
await until(idle(`vis('[data-testid="go-court"]')`), 'investigation');
assert.equal(await G(() => window.__game.run.phase), 'investigation');
await shot('investigation');
// every visible button is a comfortable tap target
const small = await G(() => [...document.querySelectorAll('#scr-game button')].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 44).map((b) => b.textContent.trim()));
assert.deepEqual(small, [], 'tap targets ≥44px');

const plan = await G(() => window.__game.C.investigation.locations.map((l) => ({ id: l.id, acts: l.actions.map((a) => a.id) })));
// try actions repeatedly in source order; locked ones become available after their prerequisites
for (let pass = 0; pass < 3; pass++) {
  for (const loc of plan) {
    await page.click(tid('loc-' + loc.id)); await until(idle(`vis('[data-testid="act-${loc.acts[0]}"]')`), 'loc ' + loc.id);
    for (const a of loc.acts) {
      const can = await G((a) => { const b = document.querySelector(`[data-testid="act-${a}"]`); return b && !b.disabled && !b.classList.contains('done'); }, a);
      if (!can) continue;
      await page.click(tid('act-' + a));
      await until(idle(`vis('[data-testid="go-court"]')`), 'after ' + a);
    }
  }
}
assert.ok(await G(() => window.__game.E.canGoToCourt(window.__game.C, window.__game.run)), 'all evidence collected');
await shot('investigation-ready');
await page.click(tid('btn-record')); await page.waitForSelector(tid('record'));
const evCount = await page.locator('#sheet .ev:not(.missing)').count();
assert.equal(evCount, await G(() => window.__game.C.evidence.length));
await shot('record');
await page.click(tid('close-modal'));

// persistence mid-case: reload and continue
await page.reload(); await page.waitForSelector('body[data-ready="1"]', { state: 'attached' });
await page.waitForSelector(tid('continue'));
await page.click(tid('continue'));
await until(idle(`vis('[data-testid="go-court"]')`), 'resumed');
assert.equal(await G(() => window.__game.run.evidence.length), evCount, 'evidence survives reload');

// ---------- trial ----------
await page.click(tid('go-court'));
let wrongDone = false, holdShot = false, objShot = false, crossShot = false;
for (let guard = 0; guard < 40; guard++) {
  await until(`document.body.dataset.screen === 'verdict' || ` + idle(`vis('[data-testid="stmt"]') || vis('[data-testid="prompt"]')`), 'trial step', 60000);
  if (await G(() => document.body.dataset.screen === 'verdict')) break;
  const seg = await G(() => { const g = window.__game; const s = g.C.trial[g.run.seg]; return JSON.parse(JSON.stringify(s)); });
  const revealed = await G(() => window.__game.run.revealed);
  if (seg.type === 'testimony') {
    const target = seg.statements.find((s) => s.contradiction);
    const goTo = async (id) => { for (let i = 0; i < 12 && (await page.getAttribute(tid('stmt'), 'data-stmt')) !== id; i++) await page.click(tid('next')); assert.equal(await page.getAttribute(tid('stmt'), 'data-stmt'), id); };
    if (!crossShot) { crossShot = true; await shot('cross-examination'); }
    if (target.hidden && !revealed.includes(`${seg.id}:${target.id}`)) {
      const src = seg.statements.find((s) => s.reveals === target.id);
      await goTo(src.id); await page.click(tid('press'));
      await page.waitForSelector(tid('banner-hold')); if (!holdShot) { holdShot = true; await shot('press-banner', 220); }
      await until(idle(`document.querySelector('[data-testid="stmt"]')?.dataset.stmt === '${target.id}'`), 'revealed');
      await shot('revealed-statement');
      continue;
    }
    if (!wrongDone) { // one deliberate mistake: present the complaint against a harmless statement
      const harmless = seg.statements.find((s) => !s.contradiction && !s.hidden);
      await goTo(harmless.id); await page.click(tid('present')); await page.waitForSelector(tid('present-complaint'));
      await page.click(tid('present-complaint'));
      await until(idle(`vis('[data-testid="stmt"]')`), 'after wrong');
      assert.equal(await page.getAttribute(tid('hearts'), 'data-hearts'), '4', 'wrong present costs one heart');
      wrongDone = true; await shot('lost-heart');
    }
    await goTo(target.id); await page.click(tid('present')); await page.waitForSelector(tid('record'));
    const ev = [].concat(target.contradiction)[0];
    if (!objShot) await shot('present-evidence');
    await page.click(tid('present-' + ev));
    await page.waitForSelector(tid('banner-objection'));
    if (!objShot) { objShot = true; await shot('objection-banner', 220); }
  } else if (seg.type === 'present') {
    await page.click(tid('present')); await page.waitForSelector(tid('present-' + [].concat(seg.answer)[0]));
    await page.click(tid('present-' + [].concat(seg.answer)[0]));
  } else if (seg.type === 'choice') {
    await shot('choice');
    await page.click(tid('opt-' + seg.options.findIndex((o) => o.correct)));
  }
}

// ---------- verdict ----------
await page.waitForSelector(tid('verdict-title'));
await sleep(600);
assert.match(await page.textContent(tid('verdict-title')), /برائت/);
const stars = Number(await page.getAttribute('.big-stars', 'data-stars'));
const score = Number(await page.getAttribute(tid('score'), 'data-score'));
assert.equal(stars, 2, '4 hearts, no hints → 2 stars'); assert.equal(score, 1000 + 4 * 200 - 50);
await shot('verdict');
const saved = await G(() => JSON.parse(localStorage.getItem('eteraz-daram.v1')));
assert.equal(saved.progress.cheque.stars, 2); assert.equal(saved.progress.cheque.best, score); assert.equal(saved.progress.cheque.completed, true);
assert.equal(saved.current, null, 'finished run is cleared'); assert.equal(saved.settings.playerName, 'ایرانمنش');
log('verdict', { stars, score });

await page.click(tid('open-lesson')); await page.waitForSelector(tid('lesson-card'));
assert.match(await page.textContent(tid('lesson-card')), /ماده/);
await shot('lesson');
await page.click(tid('lesson-done')); await page.waitForSelector(tid('best-cheque'));
await shot('cases-after');

// ---------- offline ----------
await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
await page.reload(); await page.waitForSelector('body[data-ready="1"]', { state: 'attached' }); await sleep(300);
await ctx.setOffline(true);
await page.reload(); await page.waitForSelector('body[data-ready="1"]', { state: 'attached' }, { timeout: 10000 });
await page.evaluate(() => document.fonts.ready);
assert.ok(await G(() => document.fonts.check('16px Vazirmatn')), 'font works offline');
await page.click(tid('play')); await page.waitForSelector(tid('best-cheque'));
await page.click(tid('case-land')); await until(idle(`vis('[data-testid="go-court"]')`), 'offline case 2');
await shot('offline-case2');
await ctx.setOffline(false);

assert.deepEqual(external, [], 'no external requests');
assert.deepEqual(errors, [], 'no page errors');
await browser.close();
console.log('E2E PASS —', n, 'screenshots in', SHOTS);
