import { DAY, esc, parse, today0, iso, fmt, dayOf, weekOf, C, PRODUCTS, FINDER, VERDICT, recommend, verdict, sample, phaseFor, sortEntries, trend as trendOf } from "./engine.js";
import { sampleArt } from "./sample-art.js";
const KEY = "day90-v1";

let S, view = 'today', step = 0, D = null, photo = null, askReset = false;
try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
if (!S || !C[S.concern]) S = sample();

function save() {
  if (S.sample) return true;
  try { localStorage.setItem(KEY, JSON.stringify(S)); return true; }
  catch (e) { toast('Couldn’t save in this browser (storage full or blocked). This check-in lasts until you close the tab.'); return false; }
}
let toastTimer;
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, 3200); }

function shrink(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 520 / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        res(cv.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = rej; img.src = r.result;
    };
    r.onerror = rej; r.readAsDataURL(file);
  });
}

/* ---------- pieces ---------- */
const sorted = () => sortEntries(S.entries);
const base = () => sorted()[0];
const latest = () => sorted().at(-1);

function track(c, w) {
  const done = new Set(S.entries.map(e => e.week));
  const z = C[c].zones;
  const cells = z.map((zone, i) => `<div class="wk z${zone}${done.has(i + 1) ? ' done' : ''}${i + 1 === w ? ' now' : ''}" title="Week ${i + 1}">${i + 1}</div>`).join('');
  return `<div class="track" role="img" aria-label="Week ${w} of 13">${cells}</div>
  <div class="track-legend"><span style="--c:var(--zone-quiet)">Little to see yet</span><span style="--c:var(--zone-drop)">Where most people quit</span><span style="--c:var(--zone-win)">Results window</span></div>`;
}

function shotHTML(e, label) {
  const date = `<div class="row" style="justify-content:space-between"><b>${esc(label)}</b><span class="muted mono">${e ? fmt(parse(e.date)) : ''}</span></div>`;
  if (e && e.photo) return `<div class="shot"><div class="img"><img src="${e.photo}" alt="${esc(label)} photo"></div>${date}</div>`;
  // The sample journey shows illustrations so the comparison makes sense at a glance.
  if (S.sample && S.concern === 'hair' && e) return `<div class="shot"><div class="img art">${sampleArt(e.week)}<span class="sample-tag">Sample</span></div>${date}</div>`;
  const add = label !== 'Day 0' && !S.sample ? '<button class="btn ghost small" data-nav="checkin">Add a photo at check-in</button>' : '';
  return `<div class="shot"><div class="img empty"><span>${label === 'Day 0' ? 'No day-0 photo' : 'No photo this week'}</span>${add}</div>${date}</div>`;
}

const trend = c => trendOf(c, S.entries);

/* ---------- views ---------- */
function vToday() {
  const c = S.concern, w = weekOf(S), d = dayOf(S), cfg = C[c], ph = phaseFor(c, Math.max(1, w));
  const due = w >= 1 && !S.entries.some(e => e.week === w);
  const t = trend(c), missed = S.entries.reduce((a, e) => a + (e.missed || 0), 0);
  const end = new Date(+parse(S.start) + 89 * DAY);
  const v = verdict(c, S.flags || []);
  const quitZone = cfg.zones[w - 1] === 1;
  let html = `<section class="hero">
    <p class="eyebrow">${esc(cfg.product)} · ${esc(cfg.label)}</p>
    <h1>${d < 1 ? 'Starts ' + fmt(parse(S.start)) : `Day ${Math.min(d, 90)} <span>of 90 · week ${w}</span>`}</h1>
    ${track(c, w)}
  </section>`;
  const L = latest(), wa = cfg.secondary.warnAt;
  if (wa != null && L && L.secondary >= wa) html += `<div class="alert"><b>Your last check-in said stinging or burning.</b> Stop using it. Patch-test on your inner arm for 48 hours before trying again, and see a doctor if the skin stays sore or darkens.</div>`;
  if (due) html +=`<div class="card"><div class="row" style="justify-content:space-between"><div><h3>Week ${w} check-in is due</h3><p class="muted">One photo and two taps. About 30 seconds.</p></div><button class="btn accent" data-nav="checkin">Check in</button></div></div>`;
  if (quitZone) html += `<div class="card guard"><p class="eyebrow">Week ${w} · the drop-off zone</p>
    <h2>This is the week most people give up.</h2>
    <p>${esc(ph.body)}</p>
    <p><b>Your numbers so far:</b> ${cfg.primary.q.toLowerCase()} went <b class="${t.cls}">${esc(t.text)}</b>, with ${missed} missed day${missed === 1 ? '' : 's'} in total. ${t.cls === 'up' ? 'It is already moving.' : 'Not moving yet is normal at this stage.'}</p>
    <p>The fair point to judge is day 90: <b>${fmt(end)}</b>.</p>
    <div class="row"><button class="btn" data-nav="progress">Compare my photos</button><button class="btn ghost" data-nav="timeline">What to expect</button></div></div>`;
  else if (w >= 12) html += `<div class="card ${t.cls === 'up' ? 'verdict-0' : 'verdict-1'}"><p class="eyebrow">Verdict window</p>
    <h2>${t.cls === 'up' ? 'It’s working. Keep the streak going.' : 'No clear change by week 12.'}</h2>
    <p>${t.cls === 'up' ? `${esc(cfg.primary.q)}: ${esc(t.text)}. Reorder before you run out so you don’t break the routine.` : 'You gave it a fair test. Before switching to another brand, see a dermatologist: the cause may need a different treatment, not a different serum.'}</p></div>`;
  else html += `<div class="card"><p class="eyebrow">Weeks ${ph.w[0]}–${ph.w[1]} · ${esc(ph.name)}</p><p>${esc(ph.body)}</p><p class="tip">${esc(ph.tip)}</p></div>`;
  html += `<div class="card"><h3>So far</h3><div class="stats">
    <div class="stat"><span class="muted">${esc(cfg.primary.q)}</span><b class="${t.cls}">${esc(t.text)}</b></div>
    <div class="stat"><span class="muted">Check-ins</span><b class="mono">${S.entries.length - 1} of ${Math.max(w, 1)}</b></div>
    <div class="stat"><span class="muted">Missed days</span><b class="mono">${missed}</b></div>
  </div>
  <div class="pair">${shotHTML(base(), 'Day 0')}${shotHTML(latest(), latest() === base() ? 'Latest' : `Week ${latest().week}`)}</div></div>
  <div class="card verdict-${v.lvl}"><p class="eyebrow">Fit check</p><h3>${VERDICT[v.lvl]}</h3>${v.notes.length ? `<ul class="notes">${v.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}<div><button class="btn ghost small" data-nav="fit">Review fit check</button></div></div>`;
  return html + chatCard();
}

/* ---------- Ask Day 90 (care assistant) ---------- */
let chat = { msgs: [], busy: false };
const QUICK = ['Is it actually working?', 'I missed 3 days. Should I restart?', 'Can I use it with minoxidil?', 'My order hasn’t arrived'];
const NEXT = { compare_photos: ['Compare my photos', 'progress'], check_in: ['Check in now', 'checkin'], keep_going: ['What to expect next', 'timeline'] };

function chatCard() {
  const msgs = chat.msgs.map(m => m.role === 'user'
    ? `<div class="msg me">${esc(m.content)}</div>`
    : `<div class="msg bot${m.error ? ' err' : ''}">${esc(m.content)}
        ${m.escalate === 'doctor' ? '<span class="tag stop">Please see a doctor</span>' : ''}
        ${m.escalate === 'support' ? '<a class="tag" href="https://bebodywise.com/" target="_blank" rel="noopener">Contact Be Bodywise support</a>' : ''}
        ${NEXT[m.action] ? `<button class="btn ghost small" data-nav="${NEXT[m.action][1]}">${NEXT[m.action][0]}</button>` : ''}</div>`).join('');
  return `<div class="card" id="chat"><p class="eyebrow">Ask Day 90</p><h3>Doubts, missed days, how to use it, orders</h3>
    <p class="muted" style="font-size:.9rem">Answers use your own check-ins and the product facts. Photos never leave your phone.</p>
    ${msgs ? `<div class="msgs" aria-live="polite">${msgs}</div>` : ''}
    ${chat.busy ? '<p class="muted">Thinking…</p>' : ''}
    ${chat.msgs.length ? '' : `<div class="chips">${QUICK.map(t => `<button type="button" class="chip" data-ask="${esc(t)}">${esc(t)}</button>`).join('')}</div>`}
    <form id="askForm" class="row"><label for="askText" class="sr">Your question</label><input id="askText" name="q" maxlength="600" autocomplete="off" placeholder="Type your question" ${chat.busy ? 'disabled' : ''}><button class="btn accent small" type="submit" ${chat.busy ? 'disabled' : ''}>Ask</button></form>
  </div>`;
}

function renderChat() {
  const el = document.getElementById('chat');
  if (el) { el.outerHTML = chatCard(); document.querySelector('#chat .msgs')?.lastElementChild?.scrollIntoView({ block: 'nearest' }); }
}

async function ask(text) {
  const history = chat.msgs.filter(m => !m.error).slice(-6).map(({ role, content }) => ({ role, content }));
  chat.msgs.push({ role: 'user', content: text });
  chat.busy = true; renderChat();
  try {
    const r = await postJSON('/api/coach', { message: text, concern: S.concern, start: S.start, flags: S.flags || [], history,
      entries: S.entries.map(({ week, primary, secondary, missed }) => ({ week, primary, secondary, missed })) });
    chat.msgs.push({ role: 'assistant', content: r.reply, action: r.action, escalate: r.escalate });
  } catch (e) {
    chat.msgs.push({ role: 'assistant', content: `${e.message} Meanwhile, the Timeline tab shows what is normal for your week.`, error: true });
  }
  chat.busy = false; renderChat();
}

function measureFields(c, e) {
  const P = C[c].primary, Q = C[c].secondary;
  const pr = P.opts.map((o, i) => `<label><input type="radio" name="primary" value="${i}" required ${e && e.primary === i ? 'checked' : ''}><span>${P.swatch ? `<i class="sw" style="background:${P.swatch[i]}"></i>` : ''}${esc(o)}</span></label>`).join('');
  const se = Q.opts.map((o, i) => `<label><input type="radio" name="secondary" value="${i}" required ${e && e.secondary === i ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('');
  return `<div class="file"><div class="img" id="preview">${e && e.photo ? `<img src="${e.photo}" alt="Photo preview">` : 'No photo yet'}</div>
    <div class="stack" style="gap:8px"><label for="photo"><b>Photo</b></label><input id="photo" type="file" accept="image/*" capture="environment"><p class="tip">${esc(C[c].photoTip)}</p></div></div>
    <fieldset><legend>${esc(P.q)}</legend><div class="chips swatches">${pr}</div></fieldset>
    <fieldset><legend>${esc(Q.q)}</legend><div class="chips">${se}</div></fieldset>`;
}

function vCheckin() {
  const c = S.concern, w = weekOf(S);
  if (w < 1) return `<div class="card"><h2>Your course starts ${fmt(parse(S.start))}</h2><p class="muted">Check-ins open from week 1.</p></div>`;
  const e = S.entries.find(x => x.week === w);
  photo = e ? e.photo : null;
  return `<div class="card"><p class="eyebrow">Week ${w} check-in</p><h2>${e ? 'Update this week' : 'How is week ' + w + ' going?'}</h2>
  <form id="checkForm">${measureFields(c, e)}
    <fieldset><legend>Days missed this week</legend><div class="chips">${['None', '1–2 days', '3 or more'].map((o, i) => `<label><input type="radio" name="missed" value="${[0, 2, 4][i]}" required ${e && e.missed === [0, 2, 4][i] ? 'checked' : ''}><span>${o}</span></label>`).join('')}</div></fieldset>
    <fieldset><legend><label for="note">Note to future you (optional)</label></legend><textarea id="note" name="note" placeholder="Anything you noticed: shedding, texture, mood about it">${esc(e ? e.note : '')}</textarea></fieldset>
    <div class="row"><button class="btn accent" type="submit">Save check-in</button>${S.sample ? '<span class="muted">Sample mode: saving updates this demo only.</span>' : ''}</div>
  </form></div>`;
}

function chart(c) {
  const P = C[c].primary, n = P.opts.length, W = 600, H = 230, L = 108, R = 14, T = 14, B = 34;
  const x = wk => L + (W - L - R) * wk / 13, y = v => T + (H - T - B) * (1 - v / (n - 1));
  const z = C[c].zones, winStart = z.indexOf(2) + 1;
  const pts = sorted();
  let g = `<rect x="${x(winStart - 1)}" y="${T}" width="${x(13) - x(winStart - 1)}" height="${H - T - B}" fill="var(--zone-win)"/>
  <text x="${x(13) - 6}" y="${T + 14}" text-anchor="end" font-size="11" fill="var(--muted)" font-family="var(--body)">results window</text>`;
  for (let v = 0; v < n; v++) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)" font-family="var(--mono)">${esc(P.short[v])}</text>`;
  for (let k = 0; k <= 13; k++) g += `<text x="${x(k)}" y="${H - 12}" text-anchor="middle" font-size="11" fill="var(--muted)" font-family="var(--mono)">${k === 0 ? 'D0' : k}</text>`;
  const w = weekOf(S);
  if (w >= 1) g += `<line x1="${x(w)}" x2="${x(w)}" y1="${T}" y2="${H - B}" stroke="var(--accent)" stroke-dasharray="3 3"/>`;
  if (pts.length > 1) g += `<polyline fill="none" stroke="var(--ink)" stroke-width="2.2" stroke-linejoin="round" points="${pts.map(e => `${x(e.week)},${y(e.primary)}`).join(' ')}"/>`;
  g += pts.map((e, i) => `<circle cx="${x(e.week)}" cy="${y(e.primary)}" r="${i === pts.length - 1 ? 5.5 : 3.5}" fill="${i === pts.length - 1 ? 'var(--accent)' : 'var(--ink)'}"/>`).join('');
  return `<div class="chart-box"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(P.q)} by week">${g}</svg></div>`;
}

function vProgress() {
  const c = S.concern, cfg = C[c], t = trend(c), l = latest();
  const notes = sorted().filter(e => e.note);
  return `<div class="card"><p class="eyebrow">Side by side</p><h2>Day 0 vs ${l === base() ? 'today' : 'week ' + l.week}</h2>
    <p class="muted">The mirror compares you with yesterday. This compares you with day 0.</p>
    <div class="pair">${shotHTML(base(), 'Day 0')}${shotHTML(l, l === base() ? 'Latest' : `Week ${l.week}`)}</div></div>
  <div class="card"><h3>${esc(cfg.primary.q)}</h3><p class="${t.cls}"><b>${esc(t.text)}</b> <span class="muted">(higher on the chart is better)</span></p>${chart(c)}</div>
  <div class="card"><h3>Consistency</h3><p class="muted">Results need daily use. Weeks with missed days are marked.</p>
    <div class="weeks">${sorted().filter(e => e.week > 0).map(e => `<span class="${e.missed ? 'miss' : ''}">W${e.week} · ${e.missed ? (e.missed > 2 ? '3+ missed' : '1–2 missed') : 'all days'}</span>`).join('') || '<span>No check-ins yet</span>'}</div></div>
  ${notes.length ? `<div class="card"><h3>Your notes</h3><ul class="notes">${notes.map(e => `<li><span class="mono muted">${e.week ? 'W' + e.week : 'D0'}</span> ${esc(e.note)}</li>`).join('')}</ul></div>` : ''}`;
}

function vTimeline() {
  const c = S.concern, w = Math.max(1, weekOf(S));
  return `<div class="card"><p class="eyebrow">${esc(C[c].product)}</p><h2>What’s normal, week by week</h2>
  <p class="muted">Slow is not the same as nothing. Here is what usually happens, so a quiet week doesn’t feel like failure.</p>
  <ol class="phases">${C[c].phases.map(p => {
    const here = w >= p.w[0] && w <= p.w[1];
    return `<li class="phase${here ? ' here' : ''}"><div class="when">Wk ${p.w[0]}–${p.w[1]}</div><div class="stack" style="gap:6px">${here ? '<span class="here-tag">You are here</span>' : ''}<h3>${esc(p.name)}</h3><p>${esc(p.body)}</p><p class="tip">${esc(p.tip)}</p></div></li>`;
  }).join('')}</ol></div>`;
}

function fitForm(c, answers) {
  return `<form id="fitForm">${C[c].fit.map(q => `<fieldset><legend>${esc(q.q)}</legend><div class="chips">${q.opts.map((o, i) => {
    const val = `${q.id}:${i}`, on = (answers[q.id] || []).includes(i);
    return `<label><input type="${q.multi ? 'checkbox' : 'radio'}" name="${q.id}" value="${i}" ${q.multi ? '' : 'required'} ${on ? 'checked' : ''}><span>${esc(o[0])}</span></label>`;
  }).join('')}</div></fieldset>`).join('')}
  <div><button class="btn accent" type="submit">See my result</button></div></form>`;
}

function verdictCard(c, flags) {
  const v = verdict(c, flags);
  return `<div class="card verdict-${v.lvl}"><p class="eyebrow">Your result</p><h2>${VERDICT[v.lvl]}</h2>
  ${v.notes.length ? `<ul class="notes">${v.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : '<p>Nothing in your answers points away from this product. The main risk now is stopping too early.</p>'}</div>`;
}

let fitEditing = false;
function vFit() {
  const c = S.concern;
  if (fitEditing) return `<div class="card"><p class="eyebrow">Fit check · ${esc(C[c].label)}</p><h2>Does this product fit your cause?</h2><p class="muted">Many “it didn’t work” stories start with a product that was never right for the cause. Four questions.</p>${fitForm(c, S.answers || {})}</div>`;
  return `${verdictCard(c, S.flags || [])}<div><button class="btn ghost" data-act="refit">Retake the fit check</button></div>`;
}

let F = { concern: 'hair', type: 'thin' };
// Free-text intake state: the model fills the finder; rules still decide.
let I = { state: 'idle', text: '', result: null, error: '' };

async function postJSON(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ error: 'Unexpected response from the server.' }));
  if (!r.ok) throw new Error(j.error || 'Request failed.');
  return j;
}

function intakeCard() {
  const res = I.result, busy = I.state === 'loading';
  return `<div class="card"><p class="eyebrow">Describe it in your own words</p>
  <form id="intakeForm" class="stack" style="gap:10px">
    <label for="intakeText" class="muted">English, Hindi or Hinglish is fine. Please leave out your name and contact details.</label>
    <textarea id="intakeText" name="text" maxlength="1000" required minlength="8" placeholder="e.g. My hair has been falling a lot since my baby was born, mostly when I wash it.">${esc(I.text)}</textarea>
    <div class="row"><button class="btn accent" type="submit" ${busy ? 'disabled' : ''}>${busy ? 'Reading…' : 'Find my match'}</button><span class="muted" style="font-size:.85rem">We fill in the questions below for you. You can change any answer.</span></div>
  </form>
  ${I.state === 'error' ? `<p class="alert">${esc(I.error)} You can answer the questions below instead.</p>` : ''}
  ${res ? `<div class="understood"><p><b>What we understood:</b> ${esc(res.summary)}</p>${res.follow_up ? `<p class="ask">${esc(res.follow_up)}</p>` : ''}${res.safety.map(s => `<p class="alert">${esc(s)}</p>`).join('')}</div>` : ''}
  </div>`;
}

function vFinder() {
  const q = FINDER[F.concern] ? FINDER[F.concern].qs : [];
  const radios = (name, opts, cur) => `<div class="chips">${opts.map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}" ${cur === v ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>`;
  let r = recommend(F);
  const complete = q.every(x => F[x.id]);
  // Fit-check findings from the description apply only while the concern still matches.
  const fit = I.result && I.result.concern === F.concern ? I.result.fit : null;
  if (complete && fit && fit.lvl === 2) r = { ...r, doctor: r.doctor || fit.notes[0], picks: [] };
  if (complete && fit && fit.lvl === 1) r = { ...r, tips: [...fit.notes, ...r.tips] };
  const cards = r.picks.map(([id, why]) => {
    const p = PRODUCTS[id];
    return `<div class="prod"><span class="eyebrow">${esc(why)}</span><h3>${esc(p.name)}</h3>
      <p class="muted" style="font-size:.92rem"><b>Key actives:</b> ${esc(p.actives)}. ${esc(p.use)}</p>
      ${p.reviews ? `<div class="rev"><span class="eyebrow">From customer reviews</span><ul class="notes">${p.reviews.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
      <div class="row"><a class="btn ghost small" href="${p.url}" target="_blank" rel="noopener">View on bebodywise.com</a>${p.track ? `<button class="btn accent small" data-act="track" data-c="${p.track}">Track it for 90 days</button>` : ''}</div></div>`;
  }).join('');
  return `<div class="card"><p class="eyebrow">Find my product</p><h2>Which Be Bodywise product fits you?</h2>
  <p class="muted">Matched on your concern and skin type from the brand’s own range, with what real customers said about each one.</p></div>
  ${intakeCard()}
  <div class="card"><p class="eyebrow">Or answer two quick questions</p>
  <form id="finderForm" class="stack" style="gap:16px">
    <fieldset><legend>What do you want to treat?</legend>${radios('concern', Object.entries(FINDER).map(([k, v]) => [k, v.label]), F.concern)}</fieldset>
    ${q.map(x => `<fieldset><legend>${esc(x.q)}</legend>${radios(x.id, x.opts, F[x.id])}</fieldset>`).join('')}
  </form></div>
  ${!complete ? '<p class="muted">Answer the questions above to see your match.</p>' : ''}
  ${r.doctor ? `<div class="card verdict-2"><p class="eyebrow">Our suggestion</p><h2>See a doctor first</h2><p>${esc(r.doctor)}</p></div>` : ''}
  ${cards ? `<div class="stack" style="gap:12px">${cards}</div>` : ''}
  ${r.tips.length ? `<div class="card"><h3>Before you start</h3><ul class="notes">${r.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
  ${complete ? '<p class="muted" style="font-size:.85rem">Product details are from bebodywise.com, checked in November 2026. Review notes paraphrase public Reddit posts. Not medical advice.</p>' : ''}`;
}

function vSetup() {
  if (step === 0) return `<div class="card"><p class="eyebrow">Step 1 of 3</p><h2>What are you treating?</h2>
  <form id="concernForm"><div class="choices">${Object.entries(C).map(([k, v]) => `<label><input type="radio" name="concern" value="${k}" required ${D.concern === k ? 'checked' : ''}><span class="opt"><b>${esc(v.label)}</b><span class="muted">${esc(v.product)}</span></span></label>`).join('')}</div>
  <fieldset><legend><label for="start">When did you start (or will you start)?</label></legend><input id="start" name="start" type="date" value="${D.start}" required><p class="muted" style="font-size:.9rem">Already a few weeks in? Pick the day you began; we’ll place you on the timeline.</p></fieldset>
  <div class="row"><button class="btn accent" type="submit">Next: fit check</button><button class="btn ghost" type="button" data-nav="finder">Not sure which product? Find yours</button><button class="btn ghost" type="button" data-act="cancel-setup">Back to sample</button></div></form></div>`;
  const back = `<div><button class="btn ghost small" data-act="cancel-setup">← Cancel setup</button></div>`;
  if (step === 1) return `${back}<div class="card"><p class="eyebrow">Step 2 of 3 · fit check</p><h2>Does this product fit your cause?</h2><p class="muted">Four questions. If something needs a doctor, it is better to know now than at week 8.</p>${fitForm(D.concern, D.answers)}</div>
  ${D.flags ? verdictCard(D.concern, D.flags) + `<div><button class="btn accent" data-act="to-baseline">${verdict(D.concern, D.flags).lvl === 2 ? 'Track anyway while I see a doctor' : 'Next: day-0 photo'}</button></div>` : ''}`;
  return `${back}<div class="card"><p class="eyebrow">Step 3 of 3 · day 0</p><h2>Your starting point</h2><p class="muted">This is the photo you’ll compare against at week 8, when the mirror says nothing has changed.</p>
  <form id="baseForm">${measureFields(D.concern, null)}<div><button class="btn accent" type="submit">Start my 90 days</button></div></form></div>`;
}

const NAV = [['today', 'Today'], ['finder', 'Find product'], ['checkin', 'Check in'], ['progress', 'Progress'], ['timeline', 'Timeline'], ['fit', 'Fit check']];
function render() {
  document.getElementById('nav').innerHTML = view === 'setup' ? '' : NAV.map(([k, l]) => `<button data-nav="${k}" ${view === k ? 'aria-current="page"' : ''}>${l}</button>`).join('');
  document.getElementById('banner').innerHTML = S.sample && view !== 'setup'
    ? `<div class="banner"><span>You’re viewing a <b>sample journey</b>: week 7 on the hair roll-on, mirror says nothing’s changed.</span><button class="btn accent small" data-act="start-own">Start my own</button></div>` : '';
  document.getElementById('reset').innerHTML = S.sample ? '' : askReset
    ? `<div class="row"><span>Delete all your check-ins and photos from this browser?</span><button class="btn danger small" data-act="reset-yes">Delete</button><button class="btn ghost small" data-act="reset-no">Keep</button></div>`
    : `<div><button class="btn ghost small" data-act="reset-ask">Start over</button></div>`;
  const V = { today: vToday, finder: vFinder, checkin: vCheckin, progress: vProgress, timeline: vTimeline, fit: vFit, setup: vSetup };
  document.getElementById('app').innerHTML = V[view]();
}

/* ---------- events ---------- */
document.addEventListener('click', ev => {
  const n = ev.target.closest('[data-nav]');
  if (n) { view = n.dataset.nav; fitEditing = false; render(); scrollTo(0, 0); return; }
  const q = ev.target.closest('[data-ask]');
  if (q) { ask(q.dataset.ask); return; }
  const a = ev.target.closest('[data-act]'); if (!a) return;
  const act = a.dataset.act;
  if (act === 'start-own') { D = { concern: null, start: iso(today0()), answers: {}, flags: null }; step = 0; view = 'setup'; }
  if (act === 'track') { const c = a.dataset.c; D = { concern: c, start: iso(today0()), answers: {}, flags: I.result && I.result.concern === c && I.result.flags.length ? I.result.flags : null }; step = 1; view = 'setup'; }
  if (act === 'cancel-setup') view = 'today';
  if (act === 'to-baseline') step = 2;
  if (act === 'refit') fitEditing = true;
  if (act === 'reset-ask') askReset = true;
  if (act === 'reset-no') askReset = false;
  if (act === 'reset-yes') { try { localStorage.removeItem(KEY); } catch (e) {} S = sample(); askReset = false; view = 'today'; toast('Deleted. Showing the sample journey.'); }
  render(); scrollTo(0, 0);
});

document.addEventListener('change', async ev => {
  if (ev.target.form && ev.target.form.id === 'finderForm') {
    const { name, value } = ev.target;
    F = name === 'concern' ? { concern: value } : { ...F, [name]: value };
    render(); return;
  }
  if (ev.target.id !== 'photo' || !ev.target.files[0]) return;
  try {
    photo = await shrink(ev.target.files[0]);
    document.getElementById('preview').innerHTML = `<img src="${photo}" alt="Photo preview">`;
  } catch (e) { toast('That file couldn’t be read as a photo. Try a JPG or PNG.'); }
});

function readFit(form, c) {
  const answers = {}, flags = [];
  for (const q of C[c].fit) {
    const picked = [...form.querySelectorAll(`[name="${q.id}"]:checked`)].map(i => +i.value);
    answers[q.id] = picked;
    picked.forEach(i => q.opts[i][1] && flags.push(q.opts[i][1]));
  }
  return { answers, flags };
}

document.addEventListener('submit', async ev => {
  ev.preventDefault();
  const f = ev.target, fd = new FormData(f);
  if (f.id === 'askForm') {
    const text = String(fd.get('q') || '').trim();
    if (text) ask(text);
    return;
  }
  if (f.id === 'intakeForm') {
    I = { ...I, text: String(fd.get('text')).trim(), state: 'loading', error: '' };
    render();
    try {
      const res = await postJSON('/api/intake', { text: I.text });
      I = { ...I, state: 'done', result: res };
      if (res.answers) F = { ...res.answers };
    } catch (e) { I = { ...I, state: 'error', error: e.message } }
    render();
    return;
  }
  if (f.id === 'concernForm') { D.concern = fd.get('concern'); D.start = fd.get('start'); step = 1; }
  if (f.id === 'fitForm') {
    if (view === 'setup') { Object.assign(D, readFit(f, D.concern)); render(); document.querySelector('.verdict-0, .verdict-1, .verdict-2')?.scrollIntoView({ behavior: 'smooth' }); return; }
    Object.assign(S, readFit(f, S.concern)); fitEditing = false; save();
  }
  if (f.id === 'baseForm') {
    S = { concern: D.concern, start: D.start, answers: D.answers, flags: D.flags || [], entries: [{ week: 0, date: D.start, primary: +fd.get('primary'), secondary: +fd.get('secondary'), missed: 0, photo, note: '' }] };
    photo = null; view = 'today';
    if (save()) toast('Day 0 saved. See you next week.');
  }
  if (f.id === 'checkForm') {
    const w = weekOf(S), entry = { week: w, date: iso(today0()), primary: +fd.get('primary'), secondary: +fd.get('secondary'), missed: +fd.get('missed'), photo, note: fd.get('note').trim() };
    S.entries = S.entries.filter(e => e.week !== w).concat(entry);
    const burn = C[S.concern].secondary.warnAt != null && entry.secondary >= C[S.concern].secondary.warnAt;
    photo = null; view = 'today';
    if (save()) toast(burn ? 'Saved. Stinging or burning: stop using it and patch-test before you continue.' : `Week ${w} saved.`);
    // A note often carries a doubt ("thinking of switching"): answer it right away.
    if (entry.note) { render(); scrollTo(0, 0); ask(entry.note); return; }
  }
  render(); scrollTo(0, 0);
});

render();