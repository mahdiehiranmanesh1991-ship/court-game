// «اعتراض دارم!» — UI layer. Game rules live in engine.js; cases in cases/*.js.
import * as E from './engine.js';
import { CASES, caseById } from '../cases/index.js';
import { portrait, background, desk, PLAYER_LOOK } from './art.js';
import * as A from './audio.js';

const $ = (s, r = document) => r.querySelector(s);
const FA = '۰۱۲۳۴۵۶۷۸۹';
const fa = (n) => String(n).replace(/\d/g, (d) => FA[d]);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// localStorage can throw in private mode — fall back to memory so the game still runs.
const store = (() => {
  try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return localStorage; }
  catch { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }
})();
let save = E.loadSave(store);
let C = null, run = null, mode = 'menu'; // mode: menu | invest | court
const persist = () => { if (run && run.phase !== 'done') save.current = run; E.writeSave(store, save); };
const S = () => save.settings;
const pname = () => (S().playerName || 'راستین').trim() || 'راستین';
const fmt = (t) => String(t).replaceAll('{name}', pname());

// ---------- audio / haptics ----------
const applyAudio = () => A.setEnabled({ music: S().music, sfx: S().sfx });
const vib = (p) => { if (S().haptics && navigator.vibrate) try { navigator.vibrate(p); } catch { /* not supported (e.g. iOS) */ } };
document.addEventListener('pointerdown', () => A.unlock(), { passive: true });

// ---------- screens ----------
function show(id) {
  if (id !== 'scr-verdict') document.querySelectorAll('.confetti').forEach((c) => c.remove());
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  document.body.dataset.screen = id.replace('scr-', '');
}
let toastT = 0;
function toast(msg, ms = 2200) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false; t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms);
}
const block = (on) => { $('#blocker').hidden = !on; };

// ---------- modal ----------
let modalClose = null;
function modal(html, { onClose, testid = 'modal' } = {}) {
  const m = $('#modal'), sh = $('#sheet'); sh.innerHTML = html; sh.dataset.testid = testid; m.hidden = false;
  modalClose = onClose || null; return sh;
}
function closeModal(val) {
  $('#modal').hidden = true; $('#sheet').innerHTML = ''; const f = modalClose; modalClose = null; if (f) f(val);
}
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' && $('#sheet').dataset.testid !== 'gameover') { A.sfx('back'); closeModal(null); } });

// ---------- stage ----------
const stage = $('#stage');
let curWho = null, curBg = null;
function setBg(name) { if (name !== curBg) { $('#bgwrap').innerHTML = background(name); curBg = name; } }
function lookOf(who) { return who === 'player' ? PLAYER_LOOK : C?.cast?.[who]?.look; }
function nameOf(who) { return who === 'player' ? `${pname()} (شما)` : who === 'narr' ? '' : C?.cast?.[who]?.name || who; }
function deskFor(who) {
  if (mode !== 'court') return '';
  if (who === 'judge') return 'bench'; if (who === 'player') return 'defense'; if (who === 'opp') return 'prosecution'; return 'stand';
}
function showChar(who, mood = 'normal', talking = false) {
  const look = lookOf(who); const el = $('#char');
  if (!look) { el.innerHTML = ''; curWho = null; $('#deskwrap').innerHTML = ''; return; }
  el.innerHTML = portrait(look, mood, talking ? 'talking' : '');
  el.dataset.who = who; el.dataset.mood = mood;
  el.classList.remove('enter'); // only slide in when the speaker changes (re-renders must not replay it)
  if (who !== curWho) { void el.offsetWidth; el.classList.add('enter'); }
  curWho = who; $('#deskwrap').innerHTML = desk(deskFor(who));
}
function setPlace(t) { $('#place').textContent = t || ''; $('#place').hidden = !t; }
function shake() { stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake'); }
function flash() { const f = $('#flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }

const BANNER_TEXT = { objection: 'اعتراض!', hold: 'صبر کن!', gotit: 'گرفتمش!' };
async function banner(kind, text, sub) {
  block(true); const b = $('#banner');
  const instant = S().textSpeed === 'instant';
  if (kind === 'objection' || kind === 'hold' || kind === 'gotit') {
    b.innerHTML = `<div class="b ${kind}" data-testid="banner-${kind}">${esc(text || BANNER_TEXT[kind])}</div>`;
    A.sfx(kind === 'hold' ? 'hold' : 'objection'); flash(); shake(); vib(kind === 'hold' ? [40, 30, 40] : [90, 40, 140]);
    await wait(instant ? 450 : 1050);
  } else {
    b.innerHTML = `<div class="strip" data-testid="banner-${kind}">${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
    A.sfx('select'); await wait(instant ? 350 : 1300);
  }
  b.innerHTML = ''; block(false);
}

// ---------- dialogue ----------
const dlg = $('#dlg');
let typing = null, nextFn = null;
const SPEED = { slow: 48, normal: 26, fast: 11, instant: 0 };
function pitchOf(who) { let h = 0; for (const c of who) h = (h * 31 + c.charCodeAt(0)) % 997; return 0.75 + (h % 60) / 100; }
function fx(l) {
  for (const f of String(l.fx || '').split(/\s+/).filter(Boolean)) {
    if (f === 'gavel') { A.sfx('gavel'); vib(30); stage.classList.remove('gavel-hit'); void stage.offsetWidth; stage.classList.add('gavel-hit'); }
    else if (f === 'shake') { A.sfx('shock'); shake(); vib([60, 30, 60]); }
    else if (f === 'flash') flash();
    else if (f.startsWith('music:')) A.music(f.slice(6));
    else if (f.startsWith('evidence:')) { const ev = E.evidenceById(C, f.slice(9)); if (ev) toast(`${ev.icon} ${ev.name}`); }
  }
}
function sayOne(raw) {
  const l = E.line(raw);
  return new Promise((resolve) => {
    dlg.hidden = false; document.body.dataset.dlg = '1';
    dlg.className = 'dlg ' + (l.who === 'narr' ? 'narr' : l.who === 'player' ? 'player' : '');
    $('#dlgName').textContent = nameOf(l.who);
    if (l.who !== 'narr') showChar(l.who, l.mood, true);
    fx(l);
    const text = fmt(l.text), tx = $('#dlgText'); const sp = SPEED[S().textSpeed] ?? 26;
    const finish = () => { clearInterval(typing); typing = null; tx.textContent = text; dlg.classList.remove('typing'); if (curWho) showChar(curWho, l.mood, false); };
    nextFn = () => { if (typing) { finish(); return; } nextFn = null; resolve(); };
    if (!sp) { tx.textContent = ''; finish(); return; }
    let i = 0; tx.textContent = ''; dlg.classList.add('typing'); const p = pitchOf(l.who);
    typing = setInterval(() => { i += 1; tx.textContent = text.slice(0, i); if (i % 3 === 1 && text[i - 1] !== ' ') A.sfx('blip', p); if (i >= text.length) finish(); }, sp);
  });
}
async function say(arr) {
  for (const l of arr || []) await sayOne(l);
  dlg.hidden = true; document.body.dataset.dlg = '0';
}
const advanceDlg = () => { if (nextFn && !dlg.hidden) { nextFn(); } };
dlg.addEventListener('click', advanceDlg);
stage.addEventListener('click', advanceDlg);

// ---------- hearts ----------
function renderHearts(lost = -1) {
  const el = $('#hearts'); el.hidden = mode !== 'court'; el.dataset.hearts = run ? run.hearts : 0;
  el.innerHTML = Array.from({ length: E.MAX_HEARTS }, (_, i) => `<span class="h ${run && i < run.hearts ? '' : 'off'} ${i === lost ? 'lose' : ''}">♥</span>`).join('');
}
async function damage() {
  A.sfx('damage'); shake(); flash(); vib([120, 60, 200]); renderHearts(run.hearts); persist(); await wait(450);
}

// ---------- record (پرونده) ----------
function openRecord({ present = false, title } = {}) {
  return new Promise((resolve) => {
    const have = run.evidence.map((id) => E.evidenceById(C, id)).filter(Boolean);
    const missing = mode === 'invest' ? C.investigation.required.filter((id) => !E.hasEvidence(run, id)).length : 0;
    const items = have.map((e) => `<div class="ev" data-testid="ev-${e.id}"><div class="ic">${e.icon || '📄'}</div><div><b>${esc(e.name)}</b><p>${esc(fmt(e.desc))}</p></div>${present ? `<button class="btn danger" data-present="${e.id}" data-testid="present-${e.id}">✋ ارائه‌ی این مدرک</button>` : ''}</div>`).join('');
    const miss = Array.from({ length: missing }, () => '<div class="ev missing"><div class="ic">❔</div><div><b>مدرک پیدانشده</b><p>هنوز جایی را خوب نگشته‌ای…</p></div></div>').join('');
    const sh = modal(`<h3>📁 ${esc(title || (present ? 'کدام مدرک را ارائه می‌کنی؟' : 'پرونده'))}<span class="label">${fa(have.length)} مدرک</span><button class="icon-btn x" data-testid="close-modal" aria-label="بستن">✕</button></h3><div class="ev-list">${items}${miss}</div>`, { onClose: resolve, testid: 'record' });
    sh.querySelector('.x').onclick = () => { A.sfx('back'); closeModal(null); };
    sh.querySelectorAll('[data-present]').forEach((b) => { b.onclick = () => closeModal(b.dataset.present); });
    A.sfx('select');
  });
}
$('#btnRecord').onclick = () => { if (run && !nextFn) openRecord(); };

// ---------- settings ----------
function settingsHTML() {
  const t = (k, label, ic) => `<div class="set-row"><span>${ic} ${label}</span><button class="toggle" role="switch" aria-checked="${!!S()[k]}" data-k="${k}" data-testid="set-${k}" aria-label="${label}"></button></div>`;
  const speeds = [['slow', 'آهسته'], ['normal', 'معمولی'], ['fast', 'تند'], ['instant', 'فوری']];
  return `<h3>⚙️ تنظیمات<button class="icon-btn x" data-testid="close-modal" aria-label="بستن">✕</button></h3>
  ${t('music', 'موسیقی', '🎵')}${t('sfx', 'جلوه‌های صوتی', '🔊')}${t('haptics', 'لرزش', '📳')}
  <div class="set-row"><span>💬 سرعت متن</span><div class="seg">${speeds.map(([v, l]) => `<button data-speed="${v}" data-testid="speed-${v}" aria-pressed="${S().textSpeed === v}">${l}</button>`).join('')}</div></div>
  <div class="set-row"><span>👩‍⚖️ نام خانوادگی وکیل</span><input class="name-in" data-testid="set-name" maxlength="16" value="${esc(pname())}"></div>
  <p class="label">لرزش فقط در مرورگرهایی کار می‌کند که از آن پشتیبانی کنند. Safari آیفون فعلاً لرزش وب را پشتیبانی نمی‌کند. برای نصب روی آیفون: دکمه‌ی اشتراک‌گذاری ← «Add to Home Screen».</p>
  <button class="btn ghost block" data-testid="reset">🗑️ پاک‌کردن همه‌ی پیشرفت‌ها</button>`;
}
function openSettings() {
  const sh = modal(settingsHTML(), { testid: 'settings' });
  sh.querySelector('.x').onclick = () => closeModal();
  sh.querySelectorAll('.toggle').forEach((b) => { b.onclick = () => { const k = b.dataset.k; S()[k] = !S()[k]; b.setAttribute('aria-checked', S()[k]); applyAudio(); persist(); A.sfx('select'); if (k === 'haptics' && S()[k]) vib(40); }; });
  sh.querySelectorAll('[data-speed]').forEach((b) => { b.onclick = () => { S().textSpeed = b.dataset.speed; sh.querySelectorAll('[data-speed]').forEach((x) => x.setAttribute('aria-pressed', x === b)); persist(); A.sfx('select'); }; });
  const nm = sh.querySelector('.name-in'); nm.oninput = () => { S().playerName = nm.value.slice(0, 16); persist(); };
  let armed = false; const rs = sh.querySelector('[data-testid=reset]');
  rs.onclick = () => {
    if (!armed) { armed = true; rs.textContent = '⚠️ مطمئنید؟ دوباره بزنید'; rs.classList.add('danger'); return; }
    const keep = save.settings; save = E.defaultSave(); save.settings = keep; run = null; E.writeSave(store, save); closeModal(); toast('پیشرفت‌ها پاک شد'); home();
  };
}

// ---------- pause ----------
$('#btnMenu').onclick = () => {
  if (nextFn && !dlg.hidden && typing) return;
  const sh = modal(`<h3>⏸️ مکث<button class="icon-btn x" data-testid="close-modal">✕</button></h3><div class="acts">
    <button class="btn primary" data-a="resume">▶️ ادامه</button><button class="btn" data-a="settings" data-testid="pause-settings">⚙️ تنظیمات</button>
    <button class="btn" data-a="exit" data-testid="pause-exit">🏠 خروج به منو <small>(پیشرفت ذخیره می‌شود)</small></button></div>`, { testid: 'pause' });
  sh.querySelector('.x').onclick = () => closeModal();
  sh.querySelector('[data-a=resume]').onclick = () => closeModal();
  sh.querySelector('[data-a=settings]').onclick = () => { closeModal(); openSettings(); };
  sh.querySelector('[data-a=exit]').onclick = () => { closeModal(); persist(); location.reload(); };
};

// ---------- home & case select ----------
function home() {
  mode = 'menu'; C = null; show('scr-home'); A.music('court');
  const cur = save.current && caseById(save.current.caseId);
  $('#scr-home').innerHTML = `<div class="hero">${background('title')}${portrait(PLAYER_LOOK, 'confident')}<div class="logo"><h1>اعتراض دارم!</h1><p>بازی دادگاه — پرونده‌های خیالی کرمان، قانون واقعی ایران</p></div></div>
  <div class="home-menu">
    ${cur ? `<button class="btn primary" data-testid="continue">▶️ ادامه: ${esc(cur.title)}</button>` : ''}
    <button class="btn ${cur ? '' : 'primary'}" data-testid="play">⚖️ پرونده‌ها</button>
    <div class="row"><button class="btn" data-testid="settings">⚙️ تنظیمات</button><button class="btn" data-testid="about">ℹ️ درباره</button></div>
  </div>
  <p class="disclaimer" data-testid="disclaimer">⚠️ این بازی <b>آموزشی و سرگرمی</b> است و <b>مشاوره‌ی حقوقی نیست</b>. همه‌ی نام‌ها، شعبه‌ها و پرونده‌ها خیالی‌اند و هر شباهتی تصادفی است. مواد قانونی برای آموزش خلاصه شده‌اند؛ برای پرونده‌ی واقعی با وکیل مشورت کنید.</p>`;
  const h = $('#scr-home');
  if (cur) h.querySelector('[data-testid=continue]').onclick = () => { A.sfx('select'); startCase(cur.id, false); };
  h.querySelector('[data-testid=play]').onclick = () => { A.sfx('select'); cases(); };
  h.querySelector('[data-testid=settings]').onclick = openSettings;
  h.querySelector('[data-testid=about]').onclick = () => {
    const sh = modal(`<h3>ℹ️ درباره‌ی «اعتراض دارم!»<button class="icon-btn x" data-testid="close-modal">✕</button></h3>
    <p style="line-height:2">در هر پرونده، اول <b>تحقیق</b> می‌کنید: به محل‌ها می‌روید، با آدم‌ها حرف می‌زنید و مدرک‌ها را در <b>پرونده</b> جمع می‌کنید. بعد در <b>دادگاه</b> شاهدها را بازجویی می‌کنید. روی هر جمله <b>«فشار بیاور»</b> تا جزئیات بیشتری بیرون بیاید. هرجا تناقضی دیدید، مدرک مناسب را <b>ارائه</b> کنید و «اعتراض!» بزنید. هر اشتباه یک قلب از <b>اعتبار</b> شما کم می‌کند.</p>
    <p style="line-height:2">بازی کاملاً آفلاین است، تبلیغ ندارد و پیشرفت شما خودکار روی همین دستگاه ذخیره می‌شود. همه‌ی تصویرها و صداها اختصاصی همین بازی‌اند و با کد ساخته شده‌اند.</p>
    <p class="hint-box">⚠️ این بازی آموزشی است و مشاوره‌ی حقوقی نیست. شخصیت‌ها و پرونده‌ها خیالی‌اند.</p>`, { testid: 'about' });
    sh.querySelector('.x').onclick = () => closeModal();
  };
}
function starsHTML(n, cls = 'stars') { return `<span class="${cls}" data-stars="${n}">${[0, 1, 2].map((i) => `<span class="${i < n ? '' : 'off'}">★</span>`).join('')}</span>`; }
function cases() {
  mode = 'menu'; show('scr-cases');
  const total = CASES.reduce((s, c) => s + (save.progress[c.id]?.stars || 0), 0);
  $('#scr-cases').innerHTML = `<div class="head"><button class="icon-btn" data-testid="back">→</button><h2>پرونده‌ها</h2><span class="stars">★ ${fa(total)}/${fa(CASES.length * 3)}</span></div>
  <div class="case-list">${CASES.map((c) => { const p = save.progress[c.id] || {};
    return `<div class="case-card" role="button" tabindex="0" data-testid="case-${c.id}" data-case="${c.id}"><div class="strip" style="background:${c.color}"></div><div class="body">
      <div class="num" style="background:${c.color}">${fa(c.order)}</div>
      <div><h3>${esc(c.title)}</h3><div class="sub">${esc(c.subtitle)}</div>
      <div class="meta">${starsHTML(p.stars || 0)}${p.best ? `<span class="tag" data-testid="best-${c.id}">بهترین: ${fa(p.best)}</span>` : ''}${c.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}<span class="tag">سختی ${'⚖️'.repeat(c.difficulty)}</span></div></div>
      <div class="court">🏛️ ${esc(c.court)}${p.completed ? ` · <button class="btn ghost" style="min-height:40px;padding:0 10px" data-lesson="${c.id}">📚 نکته‌ی حقوقی</button>` : ''}</div></div></div>`; }).join('')}</div>`;
  const sc = $('#scr-cases');
  sc.querySelector('[data-testid=back]').onclick = () => { A.sfx('back'); home(); };
  sc.querySelectorAll('[data-lesson]').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); C = caseById(b.dataset.lesson); lesson(true); }; });
  sc.querySelectorAll('[data-case]').forEach((el) => { el.onclick = () => {
    A.sfx('select');
    const id = el.dataset.case;
    if (save.current && save.current.caseId === id) {
      const sh = modal(`<h3>${esc(caseById(id).title)}<button class="icon-btn x">✕</button></h3><div class="acts"><button class="btn primary" data-testid="resume-case">▶️ ادامه از جای قبلی</button><button class="btn" data-testid="restart-case">🔄 شروع دوباره</button></div>`);
      sh.querySelector('.x').onclick = () => closeModal();
      sh.querySelector('[data-testid=resume-case]').onclick = () => { closeModal(); startCase(id, false); };
      sh.querySelector('[data-testid=restart-case]').onclick = () => { closeModal(); startCase(id, true); };
    } else startCase(id, true);
  }; });
}

// ---------- game flow ----------
function startCase(id, fresh) {
  C = caseById(id); if (!C) return home();
  run = !fresh && save.current && save.current.caseId === id ? save.current : E.newRun(C);
  persist(); show('scr-game'); $('#gameTitle').textContent = C.title; curWho = null; route();
}
function route() {
  if (run.phase === 'intro') return intro();
  if (run.phase === 'investigation') return investigate();
  if (run.phase === 'trial') return trial();
  if (run.phase === 'verdict') return verdict();
  return home();
}
const panel = $('#panel');
const setPanel = (html) => { panel.innerHTML = html; panel.scrollTop = 0; return panel; };

async function intro() {
  mode = 'invest'; renderHearts(); setPanel(''); A.music('investigation');
  const start = E.location(C, C.investigation.start); setBg(start.bg); setPlace(start.name); showChar(start.people?.[0] || 'nilo');
  await banner('strip', C.title, C.subtitle);
  await say(C.intro);
  run.phase = 'investigation'; run.loc = C.investigation.start; persist(); investigate();
}

function investigate() {
  mode = 'invest'; renderHearts(); A.music('investigation');
  const loc = E.location(C, run.loc) || E.location(C, C.investigation.start); run.loc = loc.id;
  setBg(loc.bg); setPlace(`${loc.icon || '📍'} ${loc.name}`);
  if (!curWho || !(loc.people || []).includes(curWho)) showChar(loc.people?.[0]);
  const req = C.investigation.required; const got = req.filter((id) => E.hasEvidence(run, id)).length; const ready = E.canGoToCourt(C, run);
  const p = setPanel(`<div class="label">📍 کجا برویم؟</div>
    <div class="locs">${C.investigation.locations.map((l) => { const pr = E.locationProgress(C, run, l.id);
      return `<button class="loc ${l.id === loc.id ? 'cur' : ''}" data-loc="${l.id}" data-testid="loc-${l.id}">${l.icon || '📍'} ${esc(l.name)}<small>${fa(pr.done)}/${fa(pr.total)} بررسی</small></button>`; }).join('')}</div>
    <div class="label">🔎 چه کنیم؟</div>
    <div class="acts">${loc.actions.map((a) => { const av = E.actionAvailable(run, a), done = run.done.includes(a.id);
      return `<button class="act ${done ? 'done' : av ? 'new' : ''}" data-act="${a.id}" data-testid="act-${a.id}" ${av ? '' : 'disabled'}>${a.type === 'talk' ? '💬' : '🔍'} ${esc(a.label)}<span class="st">${done ? '✓' : av ? 'تازه' : '🔒 بعداً'}</span></button>`; }).join('')}</div>
    <div class="court-go"><div class="label">مدارک لازم برای دادگاه: ${fa(got)} از ${fa(req.length)}</div><div class="progress"><i style="width:${(got / req.length) * 100}%"></i></div></div>
    <button class="btn ${ready ? 'primary' : ''} block" data-testid="go-court" ${ready ? '' : 'disabled'}>⚖️ رفتن به دادگاه</button>`);
  p.querySelectorAll('[data-loc]').forEach((b) => { b.onclick = () => { A.sfx('select'); run.loc = b.dataset.loc; persist(); const l = E.location(C, run.loc); showChar(l.people?.[0]); investigate(); }; });
  p.querySelectorAll('[data-act]').forEach((b) => { b.onclick = () => doAct(loc.id, b.dataset.act); });
  p.querySelector('[data-testid=go-court]').onclick = goCourt;
}
async function doAct(locId, actId) {
  A.sfx('select'); const wasReady = E.canGoToCourt(C, run);
  const res = E.doAction(C, run, locId, actId);
  if (res.locked) { toast('🔒 هنوز زود است؛ جای دیگری را بگرد'); return; }
  persist();
  await say(res.lines);
  if (res.gained) {
    const ev = E.evidenceById(C, res.gained); A.sfx('evidence'); vib(50);
    await new Promise((resolve) => {
      const sh = modal(`<h3>✨ مدرک تازه</h3><div class="ev" data-testid="new-evidence"><div class="ic">${ev.icon}</div><div><b>${esc(ev.name)}</b><p>${esc(fmt(ev.desc))}</p></div></div><p class="label" style="text-align:center">مدرک به پرونده اضافه شد</p><button class="btn primary block" data-testid="ok-evidence">👍 باشه</button>`, { onClose: resolve, testid: 'gain' });
      sh.querySelector('[data-testid=ok-evidence]').onclick = () => closeModal();
    });
  }
  if (!wasReady && E.canGoToCourt(C, run)) { investigate(); await say(C.investigation.ready); toast('⚖️ آماده‌ی دادگاه هستید!'); }
  investigate();
}
async function goCourt() {
  A.sfx('select'); run.phase = 'trial'; run.seg = 0; persist(); trial();
}

async function trial() {
  mode = 'court'; setBg('court'); setPlace('🏛️ ' + C.court); renderHearts(); setPanel('');
  const seg = E.segment(C, run);
  if (!seg) { run.phase = 'verdict'; persist(); return verdict(); }
  if (seg.type === 'scene') { A.music('court'); await say(seg.lines); return next(); }
  if (seg.type === 'testimony') return testimony(seg);
  if (seg.type === 'present') { A.music('court'); await say(seg.lines); return presentUI(seg); }
  if (seg.type === 'choice') { A.music('court'); await say(seg.lines); return choiceUI(seg); }
  return next();
}
function next() { E.advance(C, run); persist(); if (run.phase === 'verdict') return verdict(); return trial(); }

async function testimony(seg) {
  A.music('court'); showChar(seg.witness, 'normal');
  await banner('testimony', '— شهادت —', `${nameOf(seg.witness)}: «${seg.title}»`);
  await say(E.visibleStatements(seg, run).map((s) => [seg.witness, s.text, 'normal']));
  await banner('cross', '⚔️ بازجویی متقابل ⚔️', 'روی جمله‌ها فشار بیاور یا تناقض را با مدرک رو کن');
  A.music('cross'); crossUI(seg, 0);
}
function crossUI(seg, idx) {
  const vis = E.visibleStatements(seg, run); idx = ((idx % vis.length) + vis.length) % vis.length; const s = vis[idx];
  showChar(seg.witness, s.contradiction ? 'normal' : 'normal');
  const pressed = run.pressed.includes(seg.id + ':' + s.id); const isNew = s.hidden;
  const p = setPanel(`<div class="xbox" data-testid="stmt" data-stmt="${s.id}" data-seg="${seg.id}"><div class="tt">⚔️ بازجویی: ${esc(seg.title)}</div><span class="cnt">${fa(idx + 1)} / ${fa(vis.length)}</span>
      <div class="st">«${esc(fmt(s.text))}»${isNew ? '<span class="new">تازه</span>' : ''}</div></div>
    <div class="xctl">
      <button class="btn" data-testid="prev">→ قبلی</button><button class="btn" data-testid="next">بعدی ←</button>
      <button class="btn blue" data-testid="press">✋ فشار بیاور${pressed ? ' ✓' : ''}</button><button class="btn danger" data-testid="present">📁 ارائه‌ی مدرک</button>
    </div><button class="btn ghost" data-testid="hint">💡 راهنما <small>(از امتیاز کم می‌کند)</small></button>`);
  p.querySelector('[data-testid=prev]').onclick = () => { A.sfx('select'); crossUI(seg, idx - 1); };
  p.querySelector('[data-testid=next]').onclick = () => { A.sfx('select'); crossUI(seg, idx + 1); };
  p.querySelector('[data-testid=hint]').onclick = () => showHint();
  p.querySelector('[data-testid=press]').onclick = async () => {
    await banner('hold'); const r = E.press(seg, run, s.id); persist();
    await say([['player', 'صبر کنید! این جمله را بیشتر توضیح دهید.', 'confident'], ...r.lines]);
    if (r.revealed) {
      A.sfx('evidence'); toast('📝 جمله‌ی تازه به شهادت اضافه شد!');
      const st = seg.statements.find((x) => x.id === r.revealed);
      await say([[seg.witness, st.text, 'sweat']]);
      return crossUI(seg, E.visibleStatements(seg, run).findIndex((x) => x.id === r.revealed));
    }
    crossUI(seg, idx);
  };
  p.querySelector('[data-testid=present]').onclick = async () => {
    const ev = await openRecord({ present: true, title: 'کدام مدرک با این جمله تناقض دارد؟' }); if (!ev) return;
    await banner('objection');
    const r = E.presentOnStatement(C, run, s.id, ev); persist();
    if (r.correct) { A.sfx('success'); vib([30, 30, 30, 30, 200]); await say(r.lines); A.music('court'); return next(); }
    await say(r.lines); await damage();
    if (r.gameOver) return gameOver();
    crossUI(seg, idx);
  };
}
function showHint() {
  const h = E.useHint(C, run); persist(); A.sfx('select');
  const sh = modal(`<h3>💡 راهنما<button class="icon-btn x" data-testid="close-modal">✕</button></h3><div class="hint-box" data-testid="hint-text">${esc(fmt(h))}</div>`, { testid: 'hint' });
  sh.querySelector('.x').onclick = () => closeModal();
}
function presentUI(seg) {
  showChar('judge', 'normal');
  const p = setPanel(`<div class="prompt" data-testid="prompt" data-seg="${seg.id}">📌 ${esc(fmt(seg.prompt))}</div>
    <button class="btn danger block" data-testid="present">📁 ارائه‌ی مدرک</button><button class="btn ghost" data-testid="hint">💡 راهنما</button>`);
  p.querySelector('[data-testid=hint]').onclick = () => showHint();
  p.querySelector('[data-testid=present]').onclick = async () => {
    const ev = await openRecord({ present: true, title: seg.prompt }); if (!ev) return;
    await banner('objection', 'بفرمایید!');
    const r = E.presentAnswer(C, run, ev); persist();
    if (r.correct) { A.sfx('success'); await say(r.lines); return next(); }
    await say(r.lines); await damage(); if (r.gameOver) return gameOver(); presentUI(seg);
  };
}
function choiceUI(seg) {
  showChar('judge', 'think');
  const p = setPanel(`<div class="prompt" data-testid="prompt" data-seg="${seg.id}">❓ ${esc(fmt(seg.prompt))}</div>
    ${seg.options.map((o, i) => `<button class="btn opt" data-opt="${i}" data-testid="opt-${i}">${esc(fmt(o.text))}</button>`).join('')}<button class="btn ghost" data-testid="hint">💡 راهنما</button>`);
  p.querySelector('[data-testid=hint]').onclick = () => showHint();
  p.querySelectorAll('[data-opt]').forEach((b) => { b.onclick = async () => {
    const r = E.chooseOption(C, run, Number(b.dataset.opt)); persist();
    if (r.correct) { await banner('gotit', 'گرفتمش!'); A.sfx('success'); await say(r.lines); return next(); }
    await say(r.lines); await damage(); if (r.gameOver) return gameOver(); choiceUI(seg);
  }; });
}
function gameOver() {
  A.music('tension'); A.sfx('fail'); vib([300, 100, 300]); showChar('judge', 'angry'); setPanel('');
  const sh = modal(`<h3>💔 اعتبار شما تمام شد</h3><div class="go-face">${portrait(PLAYER_LOOK, 'sad')}</div>
    <p style="text-align:center;line-height:2">دادگاه دیگر به دفاعیات شما اعتنا نمی‌کند… اما هر وکیلی یک بار زمین می‌خورد. از همین مرحله دوباره شروع کنید.</p>
    <div class="acts"><button class="btn primary" data-testid="retry">🔄 تلاش دوباره از همین مرحله</button><button class="btn" data-testid="give-up">🏠 بازگشت به منو</button></div>`, { testid: 'gameover' });
  sh.querySelector('[data-testid=retry]').onclick = () => { closeModal(); E.retry(run); persist(); trial(); };
  sh.querySelector('[data-testid=give-up]').onclick = () => { closeModal(); persist(); home(); };
}

async function verdict() {
  mode = 'court'; setBg('court'); renderHearts(); setPanel(''); A.music('court');
  await say(C.verdict.lines);
  const rec = E.recordResult(save, run); run.phase = 'done'; E.writeSave(store, save);
  A.music('victory'); A.sfx('success'); vib([50, 50, 50, 50, 300]);
  show('scr-verdict');
  $('#scr-verdict').innerHTML = `<div class="label">${esc(C.title)} — ${esc(C.court)}</div>
    <div class="stamp" data-testid="verdict-title">${esc(C.verdict.title)}</div>
    ${starsHTML(rec.stars, 'big-stars')}
    <div class="score" data-testid="score" data-score="${rec.score}">امتیاز: ${fa(rec.score)}</div>
    <div class="rank">🏅 ${esc(E.rank(rec.score))}</div>${rec.newBest ? '<span class="newbest">رکورد تازه!</span>' : ''}
    <div class="stats"><div><b>${fa(run.hearts)}</b>قلب باقی‌مانده</div><div><b>${fa(run.hintsUsed)}</b>راهنما</div><div><b>${fa(run.mistakes)}</b>اشتباه</div></div>
    <div class="verdict-actions"><button class="btn primary" data-testid="open-lesson">📚 نکته‌ی حقوقی این پرونده</button><button class="btn" data-testid="to-cases">⚖️ پرونده‌ها</button></div>`;
  $('#scr-verdict').querySelector('[data-testid=open-lesson]').onclick = () => { A.sfx('select'); lesson(false); };
  $('#scr-verdict').querySelector('[data-testid=to-cases]').onclick = () => { A.sfx('select'); run = null; cases(); };
  confetti();
}
function confetti() {
  const c = document.createElement('div'); c.className = 'confetti';
  const cols = ['#f2c14e', '#e63946', '#2ec4b6', '#3a86ff', '#ffffff', '#ff8a3d'];
  c.innerHTML = Array.from({ length: 60 }, () => `<i style="left:${Math.random() * 100}%;background:${cols[(Math.random() * cols.length) | 0]};animation-duration:${2 + Math.random() * 2.5}s;animation-delay:${Math.random() * 0.8}s"></i>`).join('');
  document.body.appendChild(c); setTimeout(() => c.remove(), 5500);
}
function lesson(fromCases) {
  show('scr-lesson'); const L = C.lesson;
  $('#scr-lesson').innerHTML = `<div class="head"><button class="icon-btn" data-testid="back">→</button><h2>📚 نکته‌ی حقوقی</h2></div>
  <div class="lesson-wrap"><div class="lesson-card" data-testid="lesson-card"><h3>${esc(L.title)}</h3><p class="sum">${esc(L.summary)}</p>
    ${L.points.map((p) => `<div class="point"><span class="ref">${esc(p.ref)}</span><div>${esc(p.text)}</div></div>`).join('')}</div>
    <p class="disclaimer" style="margin:0">⚠️ متن مواد برای آموزش خلاصه و ساده شده است و مشاوره‌ی حقوقی نیست. برای متن کامل و رسمی، به منابع رسمی مثل «سامانه‌ی ملی قوانین» مراجعه کنید و در پرونده‌ی واقعی با وکیل مشورت کنید.</p>
    <button class="btn primary block" data-testid="lesson-done">✔️ فهمیدم</button></div>`;
  const back = () => { A.sfx('select'); cases(); };
  $('#scr-lesson').querySelector('[data-testid=back]').onclick = back;
  $('#scr-lesson').querySelector('[data-testid=lesson-done]').onclick = back;
  void fromCases;
}

// ---------- boot ----------
applyAudio(); home();
window.__game = { E, CASES, get C() { return C; }, get run() { return run; }, get save() { return save; }, get mode() { return mode; } };
document.body.dataset.ready = '1';
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
