// Evaluation runner for the two Claude-powered features.
//
//   node eval/run.js                     # both suites, 1 rep, live model
//   node eval/run.js --suite intake --reps 3
//   node eval/run.js --oracle            # gold answers through the graders (should be 100%)
//   node eval/run.js --null              # trivial baseline (should score low)
//
// Live runs call the app's real entry points (runIntake / runCoach) and need GROQ_API_KEY or ANTHROPIC_API_KEY.
// Each run writes eval/results/<stamp>-<mode>/{results.jsonl,errors.jsonl,summary.json}.
import { readFileSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { runIntake, decide } from '../lib/intake.js';
import { runCoach, checkReply, ruleReply } from '../lib/coach.js';
import { MODEL, PROVIDER } from '../lib/llm.js';
import { iso, today0, DAY, sample } from '../public/engine.js';
import { configured } from '../lib/llm.js';
import { gradeIntake, gradeCoach, summarize } from './graders.js';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i < 0 ? d : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const suite = flag('suite', 'all'), reps = Number(flag('reps', 1)), mode = flag('oracle', false) ? 'oracle' : flag('null', false) ? 'null' : 'live';
// Groq's free tier allows only a few requests per minute, so run it one at a time.
const only = flag('case', null), concurrency = Number(flag('concurrency', PROVIDER === 'groq' ? 1 : 4));

const load = f => readFileSync(new URL(`./cases/${f}`, import.meta.url), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));

// Journeys the coach cases run against, built relative to today so day/week math is stable.
const ago = n => iso(new Date(+today0() - n * DAY));
const weeks = (vals, sec = 0, missed = 0) => vals.map((p, w) => ({ week: w, primary: p, secondary: sec, missed: w ? missed : 0 }));
export const STATES = {
  hair_w7_up: (() => { const s = sample(); return { concern: s.concern, start: s.start, entries: s.entries, flags: s.flags }; })(),
  hair_w12_flat: { concern: 'hair', start: ago(80), entries: weeks([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], 0, 0), flags: ['pattern'] },
  hair_w3: { concern: 'hair', start: ago(16), entries: weeks([1, 1, 1]), flags: [] },
  under_w2_tingle: { concern: 'underarm', start: ago(9), entries: weeks([1, 1], 1), flags: ['newacid'] },
  under_w5: { concern: 'underarm', start: ago(30), entries: weeks([1, 1, 1, 2, 2]), flags: ['friction'] },
};

// Oracle and null "models": they replace only the model call, so the graders and labels are tested.
function oracleIntake(c) {
  const e = c.expect, a = e.answers || {};
  const concern = e.concern || e.concern_any?.[0] || 'unclear';
  return decide(c.text, { concern, hair_type: a.type ?? null, underarm_level: a.level ?? null, skin: a.skin ?? null, acne_severity: a.sev ?? null, fit_flags: e.flags_include || [], summary: 'gold', follow_up: e.follow_up ? 'gold question?' : null });
}
const nullIntake = c => decide(c.text, { concern: 'hair', hair_type: 'thin', underarm_level: null, skin: null, acne_severity: null, fit_flags: [], summary: '', follow_up: null });
function oracleCoach(c) {
  const fixed = ruleReply(c.message);
  if (fixed) return fixed;
  const e = c.expect;
  return { source: 'model', intent: e.intent[0], escalate: e.escalate[0], action: e.action?.[0] || 'none', reply: c.gold };
}
const nullCoach = () => ({ source: 'model', intent: 'other', escalate: 'none', action: 'none', reply: 'Keep going!' });

const client = new Anthropic({ maxRetries: 4 });

async function attempt(kind, c) {
  const t0 = Date.now();
  if (kind === 'intake') {
    const out = mode === 'oracle' ? oracleIntake(c) : mode === 'null' ? nullIntake(c) : await runIntake(c.text, { client });
    return { out, ms: Date.now() - t0 };
  }
  const state = STATES[c.state];
  const out = mode === 'oracle' ? oracleCoach(c) : mode === 'null' ? nullCoach() : await runCoach({ ...state, message: c.message }, { client });
  return { out, ms: Date.now() - t0 };
}

async function pool(items, n, fn) {
  const results = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; results[k] = await fn(items[k]); } }));
  return results;
}

async function main() {
  if (mode === 'live' && !configured()) {
    console.error(`No key for provider "${PROVIDER}". Add GROQ_API_KEY or ANTHROPIC_API_KEY to .env, or use --oracle / --null to test the harness.`);
    process.exit(1);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = new URL(`./results/${stamp}-${mode}/`, import.meta.url);
  mkdirSync(dir, { recursive: true });
  const suites = suite === 'all' ? ['intake', 'coach'] : [suite];
  const summary = { mode, provider: mode === 'live' ? PROVIDER : mode, model: mode === 'live' ? MODEL : mode, reps, stamp, suites: {} };

  for (const kind of suites) {
    const cases = load(`${kind}.jsonl`).filter(c => !only || c.id === only);
    const jobs = cases.flatMap(c => Array.from({ length: reps }, (_, rep) => ({ c, rep })));
    const rows = await pool(jobs, mode === 'live' ? concurrency : 16, async ({ c, rep }) => {
      try {
        const { out, ms } = await attempt(kind, c);
        if (mode === 'live' && out.model && !String(out.model).includes(MODEL.split('/').pop())) throw Object.assign(new Error(`served by ${out.model}`), { cls: 'model_mismatch' });
        const g = kind === 'intake' ? gradeIntake(c, out) : gradeCoach(c, out, checkReply);
        const row = { suite: kind, id: c.id, rep, ms, pass: g.pass, checks: g.checks, usage: out.usage, model: out.model, output: { ...out, usage: undefined } };
        appendFileSync(new URL('results.jsonl', dir), JSON.stringify(row) + '\n');
        return row;
      } catch (err) {
        const cls = err.cls || (err.status ? `api_${err.status}` : err.kind ? `model_${err.kind}` : 'harness');
        appendFileSync(new URL('errors.jsonl', dir), JSON.stringify({ suite: kind, id: c.id, rep, cls, error: err.message }) + '\n');
        // Refusals and truncations are model outcomes: count them, but never as a pass.
        return { suite: kind, id: c.id, rep, error: cls };
      }
    });
    summary.suites[kind] = summarize(kind, rows);
  }

  writeFileSync(new URL('summary.json', dir), JSON.stringify(summary, null, 2));
  printSummary(summary);
  console.log(`\nSaved to ${fileURLToPathSafe(dir)}`);
}

function printSummary(s) {
  console.log(`
Day 90 eval · mode=${s.mode} · provider=${s.provider} · model=${s.model} · reps=${s.reps}`);
  for (const [kind, m] of Object.entries(s.suites)) {
    console.log(`\n${kind.toUpperCase()}  ${m.passed}/${m.scored} cases passed (${pct(m.pass_rate)})${m.errors ? ` · ${m.errors} errors` : ''}`);
    for (const [k, v] of Object.entries(m.metrics)) console.log(`  ${k.padEnd(28)} ${v.n ? `${pct(v.rate)}  (${v.hit}/${v.n})` : 'n/a'}`);
    if (m.cost_usd != null) console.log(`  ${'cost'.padEnd(28)} $${m.cost_usd.toFixed(3)} · median ${m.median_ms} ms`);
    if (m.failures.length) console.log(`  failing: ${m.failures.join(', ')}`);
  }
}
const pct = x => `${(x * 100).toFixed(1)}%`;
const fileURLToPathSafe = u => decodeURIComponent(u.pathname.replace(/^\/([A-Za-z]:)/, '$1'));

main().catch(e => { console.error(e); process.exit(1); });
