// «اعتراض دارم!» — original vector art. Characters are composed from simple SVG parts
// (body, head, hair/hijab, beard, glasses) and nine facial moods. No external assets.

export const PLAYER_LOOK = { kind: 'manto', skin: '#f1c9a5', hair: '#2a1a10', style: 'maghnaeh', scarf: '#121212', outfit: '#1c2740', badge: true };
export const MOOD_LIST = ['normal', 'happy', 'angry', 'shocked', 'sad', 'think', 'smug', 'sweat', 'confident'];

const shade = (hex, amt) => {
  const n = parseInt((hex || '#888888').slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  const r = c(n >> 16), g = c((n >> 8) & 255), b = c(n & 255);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

const BROWS = {
  normal: ['M72 78 Q84 73 94 77', 'M106 77 Q116 73 128 78'],
  happy: ['M72 76 Q84 70 94 75', 'M106 75 Q116 70 128 76'],
  angry: ['M72 71 L95 81', 'M105 81 L128 71'],
  shocked: ['M72 69 Q84 62 94 68', 'M106 68 Q116 62 128 69'],
  sad: ['M72 80 L94 72', 'M106 72 L128 80'],
  think: ['M72 79 Q84 76 94 78', 'M106 74 Q116 67 128 73'],
  smug: ['M72 79 L94 79', 'M106 75 Q116 68 128 74'],
  sweat: ['M72 79 L94 72', 'M106 72 L128 79'],
  confident: ['M72 75 L95 79', 'M105 79 L128 75'],
};
const MOUTH = {
  normal: ['<path d="M92 118 Q100 121 108 118" class="ln"/>', '<ellipse cx="100" cy="119" rx="6" ry="4" class="mf"/>'],
  happy: ['<path d="M87 114 Q100 129 113 114 Z" class="mf"/>', '<path d="M86 113 Q100 133 114 113 Z" class="mf"/>'],
  angry: ['<path d="M89 122 Q100 114 111 122" class="ln"/>', '<path d="M86 114 L114 114 L110 126 L90 126 Z" class="mf"/><path d="M88 116 L112 116" stroke="#fff" stroke-width="3"/>'],
  shocked: ['<ellipse cx="100" cy="120" rx="5" ry="7" class="mf"/>', '<ellipse cx="100" cy="121" rx="7" ry="9" class="mf"/>'],
  sad: ['<path d="M91 122 Q100 115 109 122" class="ln"/>', '<path d="M91 123 Q100 112 109 123 Z" class="mf"/>'],
  think: ['<path d="M93 120 L107 116" class="ln"/>', '<ellipse cx="102" cy="119" rx="5" ry="3" class="mf"/>'],
  smug: ['<path d="M89 118 Q102 123 112 112" class="ln"/>', '<path d="M89 117 Q102 126 112 112 Q100 117 89 117Z" class="mf"/>'],
  sweat: ['<path d="M89 119 q5 -4 11 0 t11 0" class="ln"/>', '<path d="M89 117 q5 -4 11 0 t11 0 L111 122 Q100 127 89 122Z" class="mf"/>'],
  confident: ['<path d="M89 115 Q100 125 111 115" class="ln"/>', '<path d="M88 114 Q100 128 112 114 Z" class="mf"/>'],
};

function eyes(mood) {
  const pair = (fn) => fn(84) + fn(116);
  switch (mood) {
    case 'happy': return pair((x) => `<path d="M${x - 7} 94 Q${x} 86 ${x + 7} 94" class="ln" stroke-width="3"/>`);
    case 'shocked': return pair((x) => `<ellipse cx="${x}" cy="92" rx="8" ry="8" fill="#fff" class="eo"/><circle cx="${x}" cy="92" r="2.2" fill="#111"/>`);
    case 'smug': return pair((x) => `<path d="M${x - 8} 92 Q${x} 99 ${x + 8} 92 Z" fill="#fff" class="eo"/><circle cx="${x + 1}" cy="94" r="2.8" fill="#1a1a1a"/><path d="M${x - 9} 91.5 L${x + 9} 91.5" class="ln" stroke-width="3"/>`);
    default: {
      const dx = mood === 'think' ? -2.5 : 0, dy = mood === 'think' ? -2 : mood === 'sad' ? 1.5 : 0;
      const lid = mood === 'angry' ? (x) => `<path d="M${x - 8} 88 L${x + 8} 91" class="ln" stroke-width="3"/>` : () => '';
      return pair((x) => `<ellipse cx="${x}" cy="92" rx="7.5" ry="5.5" fill="#fff" class="eo"/><circle cx="${x + dx}" cy="${92 + dy}" r="3.6" fill="#1a1a1a"/><circle cx="${x + dx + 1.2}" cy="${90.6 + dy}" r="1.1" fill="#fff"/>` + lid(x));
    }
  }
}

function extras(mood) {
  switch (mood) {
    case 'sweat': return '<path d="M140 66 Q146 78 140 82 Q134 78 140 66Z" fill="#8fd3ff" stroke="#3a8fc7" stroke-width="1.5"/>';
    case 'angry': return '<path d="M128 56 l6 -6 m-2 10 l8 -2 m-14 -6 l2 -8" stroke="#e23" stroke-width="3" stroke-linecap="round"/>';
    case 'happy': return '<ellipse cx="74" cy="106" rx="7" ry="4" fill="#ff7a8a" opacity=".45"/><ellipse cx="126" cy="106" rx="7" ry="4" fill="#ff7a8a" opacity=".45"/>';
    case 'shocked': return '<path d="M48 54 l-10 -8 M54 44 l-4 -12 M152 54 l10 -8 M146 44 l4 -12" stroke="#fff" stroke-width="3" stroke-linecap="round"/>';
    case 'think': return '<circle cx="150" cy="52" r="4" fill="#fff" opacity=".85"/><circle cx="160" cy="40" r="6" fill="#fff" opacity=".85"/>';
    case 'confident': return '<path d="M150 70 l6 -2 l-6 -2 l-2 -6 l-2 6 l-6 2 l6 2 l2 6Z" fill="#ffe07a"/>';
    default: return '';
  }
}

function body(L) {
  const o = L.outfit || '#445', dark = shade(o, -0.12);
  let s = `<path d="M18 240 Q22 170 70 156 L130 156 Q178 170 182 240Z" fill="${o}"/>`;
  if (L.kind === 'suit' || L.kind === 'judge') {
    s += `<path d="M84 156 L100 196 L116 156Z" fill="#f4f1ea"/>`;
    if (L.tie) s += `<path d="M96 162 L104 162 L106 196 L100 204 L94 196Z" fill="${L.tie}"/>`;
    s += `<path d="M70 156 L100 214 L86 240 L60 240 L66 196Z M130 156 L100 214 L114 240 L140 240 L134 196Z" fill="${dark}"/>`;
    if (L.kind === 'judge') s += `<path d="M18 240 Q22 172 66 160 L74 240Z M182 240 Q178 172 134 160 L126 240Z" fill="#111" opacity=".9"/>`;
  } else if (L.kind === 'worker') {
    s += `<path d="M80 156 L100 176 L120 156 L112 152 L100 164 L88 152Z" fill="${shade(o, 0.15)}"/><rect x="122" y="190" width="22" height="16" rx="2" fill="${dark}"/><path d="M100 176 L100 240" stroke="${dark}" stroke-width="2"/>`;
  } else if (L.kind === 'uniform') {
    s += `<path d="M84 156 L100 178 L116 156Z" fill="${shade(o, 0.1)}"/><rect x="40" y="166" width="32" height="8" rx="3" fill="#c9a227"/><rect x="128" y="166" width="32" height="8" rx="3" fill="#c9a227"/><path d="M126 188 l8 -4 l8 4 l-2 10 l-6 4 l-6 -4Z" fill="#e3c35b"/><path d="M100 178 L100 240" stroke="${dark}" stroke-width="2"/>`;
  } else if (L.kind === 'manto') {
    s += `<path d="M100 200 L100 240" stroke="${dark}" stroke-width="2"/><circle cx="100" cy="214" r="2.5" fill="${dark}"/><circle cx="100" cy="230" r="2.5" fill="${dark}"/>`;
  }
  if (L.badge) s += `<g transform="translate(130 196)"><circle r="9" fill="#d9b44a"/><path d="M-5 -2 L5 -2 M0 -5 L0 5 M-6 1 l-2 4 h4z M6 1 l-2 4 h4z" stroke="#5a4310" stroke-width="1.6" fill="#5a4310"/></g>`;
  return s;
}

const HIJAB = new Set(['maghnaeh', 'scarf']);
function hairBack(L) {
  const h = L.hair || '#222';
  if (L.style === 'maghnaeh') {
    const c = L.scarf || '#111';
    return `<path d="M100 32 C150 32 154 86 150 120 C148 146 164 160 176 184 L24 184 C36 160 52 146 50 120 C46 86 50 32 100 32Z" fill="${c}"/><path d="M40 176 Q100 214 160 176 L170 214 Q100 236 30 214Z" fill="${shade(c, 0.06)}"/>`;
  }
  if (L.style === 'scarf') {
    const c = L.scarf || '#7a4b8c';
    return `<path d="M100 34 C148 34 152 84 148 118 C146 140 150 152 140 166 L60 166 C50 152 54 140 52 118 C48 84 52 34 100 34Z" fill="${c}"/><path d="M74 160 Q100 178 126 160 L134 196 Q118 204 112 186 Q100 192 88 186 Q82 204 66 196Z" fill="${shade(c, -0.1)}"/>`;
  }
  return '';
}
function hairFront(L) {
  const h = L.hair || '#222', hl = shade(h, 0.15);
  switch (L.style) {
    case 'maghnaeh': return `<path d="M58 92 C56 52 76 40 100 40 C124 40 144 52 142 92 C136 62 120 52 100 52 C80 52 64 62 58 92Z" fill="${L.scarf || '#111'}"/>`;
    case 'scarf': return `<path d="M64 76 Q80 56 106 60 Q90 64 84 76Z" fill="${h}"/><path d="M60 90 C58 54 76 42 100 42 C124 42 142 54 140 90 C134 64 120 54 100 54 C82 54 66 64 60 90Z" fill="${L.scarf || '#7a4b8c'}"/>`;
    case 'bald': return `<ellipse cx="62" cy="84" rx="7" ry="12" fill="${h}"/><ellipse cx="138" cy="84" rx="7" ry="12" fill="${h}"/><ellipse cx="88" cy="52" rx="10" ry="4" fill="#fff" opacity=".25"/>`;
    case 'slick': return `<path d="M58 88 Q54 40 100 38 Q146 40 142 88 Q138 62 120 60 Q96 56 74 62 Q62 70 58 88Z" fill="${h}"/><path d="M76 50 Q100 42 126 50" stroke="${hl}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    case 'messy': return `<path d="M58 90 L54 60 L66 66 L64 44 L80 54 L84 34 L98 50 L108 32 L116 52 L132 40 L130 60 L146 58 L142 90 Q132 64 100 62 Q70 64 58 90Z" fill="${h}"/>`;
    case 'spiky': return `<path d="M58 88 L50 50 L70 60 L72 28 L90 52 L100 22 L112 52 L130 28 L130 60 L150 50 L142 88 Q130 64 100 62 Q70 64 58 88Z" fill="${h}"/>`;
    case 'side': return `<path d="M58 92 Q52 42 100 38 Q148 40 142 92 Q140 70 132 64 Q104 74 78 56 Q66 66 58 92Z" fill="${h}"/><path d="M78 56 Q104 74 132 64" stroke="${hl}" stroke-width="3" fill="none"/>`;
    case 'cap': { const c = L.cap || shade(L.outfit || '#333', -0.1);
      return `<path d="M58 74 Q60 30 100 30 Q140 30 142 74Z" fill="${c}"/><path d="M54 74 Q100 64 146 74 Q150 82 140 82 Q100 74 60 82 Q50 82 54 74Z" fill="${shade(c, -0.15)}"/><circle cx="100" cy="52" r="7" fill="#e3c35b"/><ellipse cx="62" cy="88" rx="5" ry="9" fill="${h}"/><ellipse cx="138" cy="88" rx="5" ry="9" fill="${h}"/>`; }
    case 'gray': case 'short': default:
      return `<path d="M58 88 Q54 44 100 40 Q146 44 142 88 Q140 66 128 60 Q100 54 72 60 Q60 66 58 88Z" fill="${h}"/>`;
  }
}
function beard(L) {
  const c = L.beardColor || L.hair || '#222';
  const must = `<path d="M84 113 Q100 104 116 113 Q108 111 100 112 Q92 111 84 113Z" fill="${c}"/>`;
  switch (L.beard) {
    case 'full': return `<path d="M60 96 Q60 144 100 150 Q140 144 140 96 Q134 126 114 128 Q100 124 86 128 Q66 126 60 96Z" fill="${c}"/>` + must;
    case 'short': return `<path d="M64 106 Q68 140 100 144 Q132 140 136 106 Q128 130 112 130 Q100 127 88 130 Q72 130 64 106Z" fill="${c}" opacity=".9"/>` + must;
    case 'mustache': return must;
    case 'stubble': return `<path d="M64 104 Q68 140 100 144 Q132 140 136 104 Q128 128 100 128 Q72 128 64 104Z" fill="${c}" opacity=".22"/>`;
    default: return '';
  }
}

/** Returns an SVG string of the character `look` showing `mood`. The mouth has closed/open
 *  variants (.mc/.mo) so CSS can animate talking. */
export function portrait(look, mood = 'normal', cls = '') {
  const L = look || {}; const m = MOOD_LIST.includes(mood) ? mood : 'normal';
  const skin = L.skin || '#e0b090', hij = HIJAB.has(L.style);
  const face = hij
    ? `<ellipse cx="100" cy="98" rx="38" ry="46" fill="${skin}"/>`
    : `<ellipse cx="60" cy="98" rx="7" ry="11" fill="${shade(skin, -0.05)}"/><ellipse cx="140" cy="98" rx="7" ry="11" fill="${shade(skin, -0.05)}"/><ellipse cx="100" cy="94" rx="40" ry="50" fill="${skin}"/>`;
  const glasses = L.glasses ? `<g fill="none" stroke="#222" stroke-width="2.5"><rect x="72" y="83" width="24" height="18" rx="6" fill="#fff" fill-opacity=".12"/><rect x="104" y="83" width="24" height="18" rx="6" fill="#fff" fill-opacity=".12"/><path d="M96 90 Q100 87 104 90"/></g>` : '';
  const [b1, b2] = BROWS[m]; const [mc, mo] = MOUTH[m];
  const browColor = hij ? '#2a1a10' : (L.style === 'bald' ? shade(L.hair || '#555', -0.1) : (L.hair || '#222'));
  return `<svg class="portrait ${cls}" data-mood="${m}" viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<style>.ln{fill:none;stroke:#2b1a14;stroke-width:2.6;stroke-linecap:round}.mf{fill:#5a1e22;stroke:#2b1a14;stroke-width:1.5}</style>
${hairBack(L)}${body(L)}<rect x="86" y="128" width="28" height="30" fill="${shade(skin, -0.08)}"/>${face}
<g>${eyes(m)}</g><g stroke="${browColor}" stroke-width="4.5" stroke-linecap="round" fill="none"><path d="${b1}"/><path d="${b2}"/></g>
<path d="M100 98 Q96 108 101 110" class="ln" stroke-width="2"/>${beard(L)}<g class="mc">${mc}</g><g class="mo">${mo}</g>${glasses}${hairFront(L)}${extras(m)}</svg>`;
}

// ---------- backgrounds ----------
const SKY = '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7ec3f0"/><stop offset="1" stop-color="#f5e3c0"/></linearGradient></defs>';
const KERMAN = '<path d="M0 210 L40 170 L70 190 L110 150 L150 185 L190 160 L240 195 L280 150 L330 180 L400 160 L400 230 L0 230Z" fill="#b9a6c9" opacity=".7"/>';
const BG = {
  court: `<defs><linearGradient id="wd" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#6b4226"/><stop offset="1" stop-color="#3e2414"/></linearGradient></defs>
<rect width="400" height="300" fill="url(#wd)"/>${[0, 1, 2, 3, 4].map((i) => `<rect x="${12 + i * 78}" y="40" width="64" height="170" rx="4" fill="none" stroke="#2a170c" stroke-width="4" opacity=".6"/>`).join('')}
<rect x="0" y="210" width="400" height="90" fill="#2a170c"/><g transform="translate(200 52)"><circle r="30" fill="#c9a227" opacity=".9"/><path d="M0 -18 L0 16 M-18 -8 L18 -8 M-18 -8 l-8 14 h16z M18 -8 l-8 14 h16z M-8 18 h16" stroke="#4a3208" stroke-width="3" fill="#7a5a14"/></g>`,
  office: `<rect width="400" height="300" fill="#efe4cf"/><rect x="20" y="40" width="150" height="120" rx="4" fill="#9fd0ee" stroke="#8a6a44" stroke-width="8"/><path d="M28 150 L28 120 L48 120 L48 100 L60 92 L72 100 L72 120 L100 120 Q112 92 124 120 L162 120 L162 150Z" fill="#c9a77a"/><rect x="54" y="78" width="12" height="22" fill="#b89062"/>
<rect x="220" y="30" width="160" height="200" fill="#7a5233"/>${[0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4, 5, 6, 7, 8].map((k) => `<rect x="${228 + k * 16}" y="${40 + r * 48}" width="12" height="38" fill="${['#b23a48', '#2f6690', '#3a7d44', '#d9a441', '#6a4c93', '#e07a5f'][(k + r) % 6]}"/>`).join('')).join('')}
<rect x="0" y="230" width="400" height="70" fill="#8a6a44"/>`,
  workshop: `<rect width="400" height="300" fill="#c79a6b"/>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${i * 50}" y="0" width="48" height="300" fill="${i % 2 ? '#b98a5c' : '#c99f70'}"/>`).join('')}
<rect x="30" y="40" width="150" height="100" fill="#8a6a44"/><g stroke="#333" stroke-width="5" stroke-linecap="round"><path d="M50 60 L50 120"/><path d="M80 60 L100 110"/><path d="M130 60 L130 100 M120 60 L140 60"/></g><rect x="240" y="120" width="140" height="18" fill="#e6c79c"/><rect x="240" y="140" width="140" height="18" fill="#d8b588"/><rect x="240" y="160" width="140" height="18" fill="#e6c79c"/><rect x="0" y="230" width="400" height="70" fill="#6b4a2c"/>`,
  bank: `<rect width="400" height="300" fill="#d7e3ea"/><rect x="0" y="0" width="400" height="40" fill="#1f4e79"/><rect x="290" y="60" width="90" height="40" rx="6" fill="#111"/><text x="335" y="88" fill="#ff5050" font-size="22" text-anchor="middle" font-family="monospace">0427</text><rect x="20" y="60" width="240" height="100" fill="#fff" opacity=".6"/><rect x="0" y="200" width="400" height="100" fill="#6d8ca3"/><rect x="0" y="196" width="400" height="10" fill="#ccd7de"/>`,
  garden: `${SKY}<rect width="400" height="300" fill="url(#sky)"/>${KERMAN}<rect y="215" width="400" height="85" fill="#d9c08f"/>${[0, 1, 2, 3, 4, 5, 6].map((i) => `<g transform="translate(${20 + i * 60} ${200 + (i % 2) * 8})"><rect x="-3" y="0" width="6" height="22" fill="#6b4a2c"/><ellipse cx="0" cy="-4" rx="24" ry="18" fill="${i % 2 ? '#7aa04a' : '#5f8f3a'}"/><circle cx="-8" cy="-6" r="2.5" fill="#e9c46a"/><circle cx="6" cy="-10" r="2.5" fill="#e76f51"/></g>`).join('')}<g>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => `<rect x="${200 + i * 20}" y="240" width="19" height="12" fill="#9aa0a6" stroke="#6d7378"/><rect x="${210 + i * 20}" y="252" width="19" height="12" fill="#a7adb3" stroke="#6d7378"/>`).join('')}</g>`,
  station: `<rect width="400" height="300" fill="#c9d8c0"/><rect x="0" y="0" width="400" height="30" fill="#3e5a3a"/><rect x="30" y="60" width="120" height="90" fill="#f4f1ea" stroke="#3e5a3a" stroke-width="4"/>${[0, 1, 2, 3].map((i) => `<rect x="42" y="${74 + i * 18}" width="96" height="6" fill="#9aa"/>`).join('')}<rect x="250" y="50" width="110" height="110" rx="55" fill="#e3c35b" opacity=".3"/><rect x="0" y="210" width="400" height="90" fill="#7a8a70"/>`,
  shop: `<rect width="400" height="300" fill="#f3e2c4"/><rect x="0" y="0" width="400" height="36" fill="#7a2d3a"/>${[0, 1, 2].map((r) => `<rect x="20" y="${60 + r * 50}" width="360" height="6" fill="#b08a5a"/>` + [0, 1, 2, 3, 4, 5, 6, 7].map((k) => `<rect x="${32 + k * 44}" y="${36 + r * 50}" width="30" height="24" rx="3" fill="${['#c9a227', '#e9e2d0', '#9aa0a6', '#d9822b'][(k + r) % 4]}"/>`).join('')).join('')}<rect x="0" y="210" width="400" height="90" fill="#8b5a3c"/><rect x="0" y="204" width="400" height="12" fill="#e9d7b0" opacity=".8"/>`,
  bazaar: `<rect width="400" height="300" fill="#c98b5a"/>${[0, 1, 2, 3].map((i) => `<path d="M${i * 100} 230 L${i * 100} 90 Q${i * 100 + 50} 20 ${i * 100 + 100} 90 L${i * 100 + 100} 230Z" fill="#a8693f" stroke="#7a4626" stroke-width="5"/><path d="M${i * 100 + 18} 230 L${i * 100 + 18} 104 Q${i * 100 + 50} 52 ${i * 100 + 82} 104 L${i * 100 + 82} 230Z" fill="#3b2416"/><circle cx="${i * 100 + 50}" cy="120" r="10" fill="#f5c542" opacity=".85"/>`).join('')}<rect y="230" width="400" height="70" fill="#7a4626"/>`,
  title: `<defs><radialGradient id="tg" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="#3b2a6b"/><stop offset="1" stop-color="#120b24"/></radialGradient></defs><rect width="400" height="300" fill="url(#tg)"/>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => `<path d="M200 120 L${200 + 400 * Math.cos(i * Math.PI / 6)} ${120 + 400 * Math.sin(i * Math.PI / 6)} L${200 + 400 * Math.cos(i * Math.PI / 6 + 0.18)} ${120 + 400 * Math.sin(i * Math.PI / 6 + 0.18)}Z" fill="#fff" opacity=".04"/>`).join('')}`,
};
export const BG_NAMES = Object.keys(BG);
export function background(name) {
  return `<svg class="bg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${BG[name] || BG.office}</svg>`;
}

/** Foreground desk drawn in front of the character in court. */
export function desk(kind) {
  const wood = '<defs><linearGradient id="dk" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#8a5a34"/><stop offset="1" stop-color="#4a2c16"/></linearGradient></defs>';
  const svg = (inner) => `<svg class="desk" viewBox="0 0 400 110" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${wood}${inner}</svg>`;
  switch (kind) {
    case 'bench': return svg('<rect x="0" y="34" width="400" height="76" fill="url(#dk)"/><rect x="0" y="28" width="400" height="10" fill="#a8744a"/><g transform="translate(300 18)"><rect x="-26" y="-6" width="40" height="14" rx="4" fill="#5a3a20"/><rect x="10" y="-2" width="34" height="6" rx="3" fill="#7a4a28"/></g><rect x="40" y="16" width="70" height="14" fill="#f4f1ea"/>');
    case 'defense': case 'prosecution': return svg(`<rect x="0" y="50" width="400" height="60" fill="url(#dk)"/><rect x="0" y="44" width="400" height="10" fill="#a8744a"/><rect x="${kind === 'defense' ? 260 : 40}" y="30" width="90" height="16" fill="#f4f1ea" transform="rotate(-4 300 40)"/>`);
    case 'stand': return svg('<rect x="110" y="56" width="180" height="54" fill="url(#dk)"/><rect x="100" y="48" width="200" height="12" rx="4" fill="#a8744a"/><rect x="120" y="70" width="8" height="40" fill="#3b2412"/><rect x="272" y="70" width="8" height="40" fill="#3b2412"/>');
    default: return '';
  }
}
