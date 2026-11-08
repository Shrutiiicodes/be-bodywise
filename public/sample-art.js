// Illustrations for the sample journey's photo slots: a top-down view of a centre
// parting that narrows from day 0 to the latest week, with a few baby hairs.
// Deterministic (seeded), so the sample looks the same on every load.

const HAIR = '#3b2a20', STRAND = '#5b4232', BABY = '#7a5640', SCALP = '#e9c7ab', BG = '#eef2f5';

export function sampleArt(week) {
  const t = Math.min(1, Math.max(0, week / 12));      // 0 at day 0, 1 at week 12
  const top = 6 - 2 * t, crown = 28 - 16 * t;          // part width at the hairline and at the crown
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // Half-width of the parting at height y: widest at the crown (y = 130).
  const half = y => y <= 130 ? top / 2 + (crown - top) / 2 * ((y - 34) / 96) : crown / 2 - (crown * 0.15) * ((y - 130) / 92);

  const part = `M ${100 - top / 2} 34 Q ${100 - crown / 2} 130 ${100 - crown * 0.35} 222 L ${100 + crown * 0.35} 222 Q ${100 + crown / 2} 130 ${100 + top / 2} 34 Z`;
  let strands = '';
  for (let i = 0; i < 90; i++) {
    const y = 40 + rnd() * 172, side = i % 2 ? 1 : -1, len = 22 + rnd() * 42;
    const x0 = 100 + side * (half(y) + 0.5);
    strands += `<path d="M ${x0.toFixed(1)} ${y.toFixed(1)} Q ${(x0 + side * len * 0.55).toFixed(1)} ${(y + len * 0.15).toFixed(1)} ${(x0 + side * len).toFixed(1)} ${(y + len * 0.6).toFixed(1)}"/>`;
  }
  let baby = '';
  const n = week >= 5 ? Math.round(26 * t) : 0;
  for (let i = 0; i < n; i++) {
    const y = 70 + rnd() * 120, side = i % 2 ? 1 : -1, x = 100 + side * half(y) * (0.2 + rnd() * 0.7), l = 5 + rnd() * 5;
    baby += `<path d="M ${x.toFixed(1)} ${y.toFixed(1)} l ${(-side * l * 0.6).toFixed(1)} ${(-l * 0.5).toFixed(1)}"/>`;
  }
  return `<svg viewBox="0 0 200 250" role="img" aria-label="Sample illustration of a hair parting at ${week ? `week ${week}` : 'day 0'}" preserveAspectRatio="xMidYMid slice">
    <defs><clipPath id="head${week}"><ellipse cx="100" cy="132" rx="82" ry="104"/></clipPath></defs>
    <rect width="200" height="250" fill="${BG}"/>
    <ellipse cx="100" cy="132" rx="82" ry="104" fill="${HAIR}"/>
    <path d="${part}" fill="${SCALP}"/>
    <g clip-path="url(#head${week})" fill="none" stroke="${STRAND}" stroke-width="1.1" stroke-linecap="round" opacity=".75">${strands}</g>
    <g fill="none" stroke="${BABY}" stroke-width="1" stroke-linecap="round">${baby}</g>
  </svg>`;
}
