// Day 90 rules engine: product data, fit check, timeline and recommendations.
// Pure and shared by the browser UI, the API routes and the tests.
export const DAY = 864e5;
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const today0 = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const fmt = d => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
export const dayOf = s => Math.round((today0() - parse(s.start)) / DAY) + 1;
export const weekOf = s => Math.min(13, Math.max(0, Math.ceil(dayOf(s) / 7)));

// Each concern: what to measure, what's normal each week, and what the fit check looks for.
export const C = {
  hair: {
    label: 'Hair thinning', product: 'Hair Growth Serum Roll-On',
    photoTip: 'Part your hair down the middle. Face a window, hold the phone straight above your head. Same spot, same light, every week.',
    primary: { q: 'Hair fall on wash day', opts: ['Clumps (100+ strands)', 'A lot (50–100)', 'Some (20–50)', 'Little (under 20)'], short: ['100+', '50–100', '20–50', 'under 20'] },
    secondary: { q: 'Baby hairs along your part or hairline', opts: ['None yet', 'A few', 'Lots'] },
    zones: [0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 2, 2],
    phases: [
      { w: [1, 2], name: 'Settling in', body: 'Nothing visible yet, and that is expected. Some people shed a little more in the first weeks as resting hairs make way for new ones.', tip: 'Take your day-0 photo and apply at the same time every day.' },
      { w: [3, 5], name: 'Quiet phase', body: 'Follicles respond before the mirror does. Wash-day hair fall is usually the first number to move.', tip: 'Count hair fall the same way each week: same wash day, same drain.' },
      { w: [6, 8], name: 'The drop-off zone', body: 'New hair grows about 1 cm a month and starts thin and fine, so at weeks 6 to 8 it is hard to see. This is when most people decide it “isn’t working” and switch.', tip: 'Judge by your photos and your numbers, not the mirror.' },
      { w: [9, 11], name: 'Early signs', body: 'Short baby hairs along the part and lower, steadier hair fall are the usual first visible signs.', tip: 'Compare today’s photo with day 0, side by side.' },
      { w: [12, 13], name: 'Verdict window', body: 'The pack promises visible results in 3 months. This is the fair point to decide.', tip: 'No change at all in photos or hair fall? See a dermatologist before trying another brand. The cause may need medical treatment.' }
    ],
    fit: [
      { id: 'look', q: 'What does your hair loss look like?', opts: [['More hair falling all over'], ['Wider part or thinner crown', 'pattern'], ['Round bald patches', 'patch'], ['Breakage at the hairline or from tight styles', 'traction']] },
      { id: 'life', q: 'Any of these in the last year?', multi: true, opts: [['PCOS or irregular periods', 'hormonal'], ['A thyroid problem', 'hormonal'], ['Childbirth, high fever or sudden weight loss', 'shed'], ['None of these']] },
      { id: 'scalp', q: 'Is your scalp itchy, flaky, red or sore?', opts: [['Yes', 'scalp'], ['No']] },
      { id: 'sens', q: 'Do you react easily to new hair or skin products?', opts: [['Yes', 'sensitive'], ['No']] }
    ],
    flags: {
      patch: [2, 'Round bald patches can be alopecia areata, which needs a dermatologist. A topical serum will not treat it.'],
      hormonal: [1, 'Thinning linked to PCOS or thyroid often needs medical treatment too. Get it checked; the serum can support but may not be enough alone.'],
      shed: [1, 'Shedding after childbirth, fever or a crash diet often recovers by itself within 3 to 6 months. Tracking helps you tell the two apart.'],
      scalp: [1, 'Calm an itchy or flaky scalp first. Serums work better on a healthy scalp.'],
      sensitive: [1, 'Patch-test behind your ear for 48 hours before the first full use.'],
      traction: [0, 'Breakage from tight styles stops when the pull stops. Loosen ponytails and braids alongside the serum.'],
      pattern: [0, 'A widening part is the pattern this kind of serum targets. Give it the full 12 weeks.']
    }
  },
  underarm: {
    label: 'Underarm pigmentation', product: 'Underarm Roll-On',
    photoTip: 'Raise your arm fully. Face daylight, no flash. Keep some inner arm in the frame to compare against.',
    primary: { q: 'Shade compared with your inner arm', opts: ['Much darker', 'Darker', 'Somewhat darker', 'Slightly darker', 'About the same'], short: ['much darker', 'darker', 'somewhat darker', 'slightly darker', 'about the same'], swatch: ['#5a3a2a', '#74503b', '#8e684f', '#a98266', '#c29c7e'] },
    secondary: { q: 'How your skin feels after applying', opts: ['Normal', 'Slight tingle', 'Stinging or burning'], warnAt: 2 },
    zones: [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 2],
    phases: [
      { w: [1, 2], name: 'Settling in', body: 'The acids start loosening dead, darker surface cells. A mild tingle is normal. Stinging or burning is not.', tip: 'If it burns, stop and patch-test before trying again.' },
      { w: [3, 4], name: 'Texture first', body: 'Skin usually feels smoother before it looks lighter.', tip: 'Pause blade shaving if you can; it keeps re-darkening the skin.' },
      { w: [5, 8], name: 'The slow fade', body: 'Skin renews roughly every 4 to 6 weeks, so colour shifts one cycle at a time. Daily mirror checks hide this, and many people give up here.', tip: 'Compare photos taken in the same light, not memories.' },
      { w: [9, 11], name: 'Visible window', body: 'Most visible lightening shows up now, compared with your day-0 photo.', tip: 'Use the side-by-side view in Progress.' },
      { w: [12, 13], name: 'Verdict window', body: 'Three months is a fair test. If nothing has changed, the cause may not be cosmetic.', tip: 'No change? Ask a doctor, especially if dark patches also show on your neck or knuckles.' }
    ],
    fit: [
      { id: 'cause', q: 'What do you think is causing it?', opts: [['Shaving, waxing or friction', 'friction'], ['A reaction to a deodorant or product', 'reaction'], ['Not sure']] },
      { id: 'velvet', q: 'Is the skin also dark and velvety on your neck, knuckles or groin?', opts: [['Yes', 'velvet'], ['No']] },
      { id: 'acid', q: 'Have acids like glycolic or lactic acid irritated your skin before?', opts: [['Yes', 'sensitive'], ['Never used them', 'newacid'], ['No']] },
      { id: 'pcos', q: 'Do you have PCOS or irregular periods?', opts: [['Yes', 'hormonal'], ['No']] }
    ],
    flags: {
      velvet: [2, 'Dark, velvety skin in several places can signal insulin resistance. Show a doctor before treating it as a cosmetic problem.'],
      reaction: [1, 'Stop the product you suspect first. Treating skin that is still reacting can make it darker.'],
      sensitive: [1, 'Patch-test on your inner arm for 48 hours, then start every other night.'],
      newacid: [1, 'First time with acids: use it every other night for the first 2 weeks.'],
      hormonal: [1, 'PCOS can drive pigmentation, so results may be slower. Mention it to your doctor.'],
      friction: [0, 'Friction and blade shaving keep re-darkening the skin. Switch to trimming or a gentler method while you treat it.']
    }
  }
};
// Real Be Bodywise products, as listed on bebodywise.com (checked 7 Nov 2026). Review notes paraphrase public Reddit posts.
export const PRODUCTS = {
  serum: { name: 'Advanced Hair Growth Serum Roll-On (25 ml)', url: 'https://bebodywise.com/product/hair-growth-serum-roll-on', actives: '3% Rosemary, 3% Redensyl, 2% Anagain, 2% Aminexil', use: 'On the scalp, twice daily, for 3 months. The brand says baby hairs by month 2.', track: 'hair',
    reviews: ['One long-term user said it worked but “takes 2–3 months”, and liked that the roll-on puts serum on the scalp, not the hair.', 'Another stopped after 2 months and 2 bottles with no change, and suspected hormonal thinning.'] },
  gummies: { name: 'Biotin Hair Gummies', url: 'https://bebodywise.com/product/hair-health-gummies', actives: 'Biotin, zinc and multivitamins', use: 'One a day after a meal, for 3 months. Listed for stage 1 hair loss.' },
  postpartum: { name: 'Hair Gummies for Post-Pregnancy Hair Fall', url: 'https://bebodywise.com/product/biotin-hair-gummies-breastfeeding-moms-30n-xp', actives: 'Biotin', use: 'Made for hair fall after pregnancy.' },
  keto: { name: '1% Ketoconazole Anti-Dandruff Shampoo', url: 'https://bebodywise.com/product/1-ketoconazole-dandruff-shampoo-250ml', actives: '1% Ketoconazole', use: 'Listed for dandruff.' },
  zpto: { name: '1% ZPTO Anti-Dandruff Shampoo', url: 'https://bebodywise.com/product/1-zpto-anti-dandruff-shampoo', actives: '1% ZPTO', use: 'Listed for dandruff with dryness.' },
  strength: { name: 'Hair Strengthening Serum', url: 'https://bebodywise.com/product/hair-strengthening-serum', actives: 'Argan oil', use: 'Listed for frizzy, unruly hair.' },
  frizz: { name: 'Frizz Control and Damage Repair Hair Serum', url: 'https://bebodywise.com/product/anti-frizz-serum', actives: 'Biphasic serum', use: 'Listed for frizzy, damaged hair.' },
  ua4: { name: '4% AHA BHA Underarm Roll-On', url: 'https://bebodywise.com/product/4-aha-bha-underarm-rollon-75', actives: '4% AHA BHA', use: 'Listed for odour and mild pigmentation.', track: 'underarm' },
  ua6: { name: '6% AHA BHA Underarm Roll-On', url: 'https://bebodywise.com/product/6-aha-bha-underarm-roll-on-flora-75ml', actives: '4% lactic, 1% salicylic, 1% kojic, 1% mandelic acid, alpha arbutin', use: 'Daily on clean skin. The brand says change shows within 3 months.', track: 'underarm',
    reviews: ['One reviewer saw pigmentation “fading slowly” over one bottle and plans to rebuy.', 'Another saw no lightening, and found the fragrance faded within 2 hours.', 'One commenter reported a burn on sensitive skin.'] },
  uaNF: { name: 'Underarm Pigmentation Kit, No Fragrance', url: 'https://bebodywise.com/product/underarm-pigmentation-kit-no-fragrance', actives: 'AHA BHA, fragrance-free', use: 'Listed for odour and severe pigmentation.', track: 'underarm',
    reviews: ['Fragrance was the most-mentioned complaint about the scented roll-on, and one commenter reported a burn on sensitive skin.'] },
  bwCer: { name: '1% Salicylic Ceramide Body Wash', url: 'https://bebodywise.com/product/salicylic-ceramide-bodywash', actives: '1% salicylic acid, ceramides, hyaluronic acid, chamomile', use: 'Listed for body acne and dry skin.',
    reviews: ['Reviewers of the brand’s body wash called it gentle and liked that it “does not make big promises”.', 'One saw no change in body acne after a full bottle. Expect help with mild acne, not a cure.'] },
  bwSal: { name: '1% Salicylic Acid Body Wash', url: 'https://bebodywise.com/product/1-salicylic-acid-body-wash-350ml', actives: '1% salicylic acid', use: 'Listed for body acne and bumps.',
    reviews: ['Reviewers of the brand’s body wash called it gentle with a slight glow, and said results on acne were mild.'] }
};
export const FINDER = {
  hair: { label: 'Hair fall or thinning', qs: [{ id: 'type', q: 'What best describes it?', opts: [['thin', 'Thinning or a wider part'], ['post', 'Shedding after pregnancy'], ['scalp', 'Itchy or flaky scalp'], ['break', 'Breakage or frizz'], ['patch', 'Round bald patches']] }] },
  underarm: { label: 'Dark underarms or odour', qs: [
    { id: 'level', q: 'How dark is it?', opts: [['mild', 'Slightly darker, mostly odour'], ['marked', 'Clearly darker than my inner arm']] },
    { id: 'skin', q: 'Your skin type', opts: [['normal', 'Normal or oily'], ['dry', 'Dry'], ['sens', 'Sensitive, reacts easily']] }] },
  body: { label: 'Body acne or bumps', qs: [
    { id: 'skin', q: 'Your skin type', opts: [['dry', 'Dry'], ['normal', 'Normal or oily'], ['sens', 'Sensitive, reacts easily']] },
    { id: 'sev', q: 'What does the acne look like?', opts: [['mild', 'Small bumps, occasional spots'], ['severe', 'Painful, deep or widespread']] }] }
};
export function recommend(a) {
  const r = { picks: [], tips: [], doctor: null };
  if (a.concern === 'hair') {
    if (a.type === 'thin') { r.picks = [['serum', 'Best match'], ['gummies', 'Optional add-on']]; r.tips = ['Plan for the full 3 months. Most “didn’t work” reviews stopped at around 2.', 'Have PCOS or a thyroid problem? Get that checked too. The fit check covers this.']; }
    if (a.type === 'post') { r.picks = [['postpartum', 'Best match']]; r.tips = ['Shedding after pregnancy often settles within 3 to 6 months. If it hasn’t by then, look at the growth serum.']; }
    if (a.type === 'scalp') { r.picks = [['keto', 'Start here'], ['zpto', 'If your scalp is also dry']]; r.tips = ['Calm the scalp first, then add a growth serum. Serums work better on a healthy scalp.']; }
    if (a.type === 'break') { r.picks = [['strength', 'Best match'], ['frizz', 'Alternative']]; r.tips = ['Loosen tight ponytails and braids. Breakage stops when the pull stops.']; }
    if (a.type === 'patch') r.doctor = 'Round bald patches can be alopecia areata. That needs a dermatologist, not a serum.';
  }
  if (a.concern === 'underarm' && a.level && a.skin) {
    if (a.skin === 'sens') { r.picks = [['uaNF', 'Best match for sensitive skin'], [a.level === 'mild' ? 'ua4' : 'ua6', 'Only after a patch test']]; r.tips = ['Patch-test on your inner arm for 48 hours, then start every other night.']; }
    else { r.picks = [[a.level === 'mild' ? 'ua4' : 'ua6', 'Best match'], ['uaNF', 'If you prefer no fragrance']]; }
    r.tips.push('Pause blade shaving if you can. Friction keeps re-darkening the skin.', 'It isn’t a long-lasting deodorant: one reviewer found the scent gone within 2 hours.', 'Dark, velvety skin on the neck or knuckles too? See a doctor first.');
  }
  // Severe acne is a referral whatever the skin type, so it does not wait for that answer.
  if (a.concern === 'body' && a.sev === 'severe') r.doctor = 'Painful, deep or widespread acne needs a dermatologist. A body wash is meant for mild acne.';
  else if (a.concern === 'body' && a.skin && a.sev) {
    if (a.skin === 'normal') r.picks = [['bwSal', 'Best match'], ['bwCer', 'If your skin feels tight after washing']];
    else { r.picks = [['bwCer', 'Best match']]; if (a.skin === 'sens') r.tips = ['If you see redness, dryness or irritation, use it less often or stop. The brand gives the same advice.']; }
  }
  return r;
}

export const VERDICT = ['Good fit. Commit to the full 12 weeks.', 'Good to start, with a check.', 'See a doctor first.'];

export function verdict(c, flags) {
  const f = [...new Set(flags)].filter(k => C[c]?.flags[k]);
  return { lvl: Math.max(0, ...f.map(k => C[c].flags[k][0])), notes: f.map(k => C[c].flags[k][1]) };
}

export function sample() {
  const start = new Date(today0() - 45 * DAY);
  const p = [1, 1, 1, 1, 2, 1, 2], s = [0, 0, 0, 0, 0, 1, 1], m = [0, 0, 1, 0, 2, 0, 1];
  return {
    sample: true, concern: 'hair', start: iso(start), flags: ['pattern'],
    entries: p.map((v, i) => ({ week: i, date: iso(new Date(+start + i * 7 * DAY)), primary: v, secondary: s[i], missed: m[i], photo: null, note: i === 6 ? 'Mirror looks the same. Thinking of switching brands.' : '' }))
  };
}

export const phaseFor = (c, w) => C[c].phases.find(p => w >= p.w[0] && w <= p.w[1]) || C[c].phases[0];
export const sortEntries = entries => [...entries].sort((a, b) => a.week - b.week);

// Direction of the main measure from day 0 to the latest check-in (higher index = better).
export function trend(c, entries) {
  const s = sortEntries(entries), b = s[0], l = s.at(-1), P = C[c].primary;
  if (!b || !l || b === l) return { cls: "flat", delta: 0, text: "Check in to see a trend" };
  const d = l.primary - b.primary;
  return { cls: d > 0 ? "up" : d < 0 ? "down" : "flat", delta: d, text: d === 0 ? `Still ${P.short[l.primary]}` : `${P.short[b.primary]} → ${P.short[l.primary]}` };
}

// Deterministic safety screen for free text (intake descriptions, check-in notes, chat).
// It runs on the server before and regardless of any model output, so a missed
// extraction can never hide a red flag. It errs toward flagging: "no burning" still
// matches, which costs one extra caution message, never a missed one.
export const RED_FLAGS = {
  burn: {
    re: /\b(burn(s|ing|ed|t)?|sting(s|ing)?|blister(s|ed)?|rash(es)?|swell(ing)?|swollen|bleed(s|ing)?|ooz(e|es|ing)|raw skin|hives)\b/i,
    message: 'Stop using it now. Rinse the area with cool water, and see a doctor if the skin stays sore, swollen or blistered. Patch-test for 48 hours before you try it again.'
  },
  patch: {
    re: /\b(bald (patch|patches|spot|spots)|round (patch|patches|spot|spots)|coin[- ]sized|alopecia)\b/i,
    message: 'Round bald patches can be alopecia areata, which needs a dermatologist. A topical serum will not treat it.'
  },
  velvet: {
    re: /\b(velvety|velvet[- ]like|dark(ening)?( skin)? (on|around) (my |the )?(neck|knuckles|groin))\b/i,
    message: 'Dark, velvety skin in several places can signal insulin resistance. Show a doctor before treating it as a cosmetic problem.'
  },
  severe_acne: {
    re: /\b(cyst(s|ic)?|nodule(s)?|boil(s)?|painful (acne|bumps|pimples|spots)|acne (that )?hurts)\b/i,
    message: 'Painful, deep or cystic acne needs a dermatologist. A body wash is meant for mild acne.'
  }
};
// A match is ignored only when a negation sits in the three words right before it
// ("no bald patches", "it doesn't burn"), so "not sure, but there's a bald patch" still counts.
const NEGATION = /\b(no|not|never|without|nor|zero|nahi|nahin)\b|n['’]t\b/i;
export function screen(text) {
  const s = String(text || '');
  return Object.keys(RED_FLAGS).filter(k => {
    const re = new RegExp(RED_FLAGS[k].re.source, 'gi');
    for (const m of s.matchAll(re)) {
      const before = s.slice(0, m.index).split(/[.!?;,\n]/).pop().trim().split(/\s+/).slice(-3).join(' ');
      if (!NEGATION.test(before)) return true;
    }
    return false;
  });
}
