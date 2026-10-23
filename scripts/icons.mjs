// Renders the app icons with headless Chrome. Run: PW_DIR=/tmp/pw node scripts/icons.mjs
import { createRequire } from 'node:module';
import { portrait, PLAYER_LOOK } from '../js/art.js';
const require = createRequire((process.env.PW_DIR || '/tmp/pw') + '/');
const { chromium } = require('playwright-core');
const root = new URL('../', import.meta.url).pathname;
const face = portrait(PLAYER_LOOK, 'confident').replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><radialGradient id="g" cx=".5" cy=".4" r=".75"><stop offset="0" stop-color="#4a3290"/><stop offset="1" stop-color="#140d24"/></radialGradient></defs>
<rect width="512" height="512" rx="${pad ? 0 : 112}" fill="url(#g)"/>
<g transform="translate(256 256) scale(${pad ? 0.8 : 1}) translate(-256 -256)">
<path d="M256 40 L300 120 L392 80 L370 170 L470 190 L390 250 L460 330 L360 330 L370 430 L290 370 L256 470 L222 370 L142 430 L152 330 L52 330 L122 250 L42 190 L142 170 L120 80 L212 120Z" fill="#e63946"/>
<g transform="translate(106 118) scale(1.5)">${face}</g>
<g transform="rotate(-8 256 420)"><rect x="96" y="380" width="320" height="84" rx="18" fill="#f2c14e" stroke="#000" stroke-width="6"/>
<text x="256" y="440" font-family="Vazirmatn" font-weight="900" font-size="58" fill="#1a0f00" text-anchor="middle" direction="rtl">اعتراض!</text></g></g></svg>`;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
for (const [name, size, pad] of [['icon-192', 192, false], ['icon-512', 512, false], ['icon-maskable-512', 512, true], ['apple-touch-icon', 180, true]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>@font-face{font-family:Vazirmatn;src:url(file://${root}fonts/Vazirmatn-Variable.woff2)}body{margin:0}</style><div style="width:${size}px;height:${size}px">${svg(pad).replace('<svg ', `<svg width="${size}" height="${size}" `)}</div>`);
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(200);
  await page.screenshot({ path: `${root}icons/${name}.png`, omitBackground: true });
}
// character sheet for visual QA (not shipped in the precache)
const { CASES } = await import('../cases/index.js');
const looks = [['player', PLAYER_LOOK], ...CASES.flatMap((c) => Object.entries(c.cast).map(([k, v]) => [c.id + ':' + k, v.look]))];
const moods = ['normal', 'happy', 'angry', 'shocked', 'sad', 'think', 'smug', 'sweat', 'confident'];
await page.setViewportSize({ width: 1100, height: 1200 });
await page.setContent(`<body style="margin:0;background:#2a1f4a;font:10px sans-serif;color:#fff"><div style="display:grid;grid-template-columns:repeat(10,110px)">${looks.slice(0, 10).map(([n, l]) => `<div style="height:132px">${portrait(l, 'normal').replace('<svg ', '<svg width="110" height="120" ')}<div>${n}</div></div>`).join('')}${looks.slice(10).map(([n, l]) => `<div style="height:132px">${portrait(l, 'happy').replace('<svg ', '<svg width="110" height="120" ')}<div>${n}</div></div>`).join('')}${moods.map((m) => `<div style="height:132px">${portrait(PLAYER_LOOK, m).replace('<svg ', '<svg width="110" height="120" ')}<div>${m}</div></div>`).join('')}${moods.map((m) => `<div style="height:132px">${portrait(CASES[0].cast.judge.look, m).replace('<svg ', '<svg width="110" height="120" ')}<div>${m}</div></div>`).join('')}</div></body>`);
await page.screenshot({ path: `/tmp/court-sheet.png`, fullPage: true });
await browser.close(); console.log('icons ok');
