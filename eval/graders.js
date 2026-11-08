// Deterministic graders. Every check has a name so results roll up into metrics.
const PRICES = { // USD per million tokens: input, output, cache read, cache write
  'claude-opus-5-5': [4, 20, 0.2, 5], 'claude-sonnet-5-5': [2, 10, 0.2, 2.5], 'claude-haiku-5-5': [0.1, 0.5, 0.01, 0.125],
  // Groq paid-plan list prices (the free tier bills nothing).
  'openai/gpt-oss-120b': [0.15, 0.6, 0, 0], 'openai/gpt-oss-20b': [0.075, 0.3, 0, 0],
};

export function gradeIntake(c, out) {
  const e = c.expect, checks = [];
  const add = (name, ok) => checks.push({ name, ok: Boolean(ok) });
  add('concern', e.concern_any ? e.concern_any.includes(out.concern) : out.concern === e.concern);
  for (const [k, v] of Object.entries(e.answers || {})) add('field', out.answers?.[k] === v);
  for (const f of e.flags_include || []) add('flag_recall', out.flags?.includes(f));
  for (const f of e.flags_exclude || []) add('no_wrong_flag', !out.flags?.includes(f));
  const doctor = Boolean(out.recommendation?.doctor) || out.fit?.lvl === 2;
  if (e.doctor) add('doctor_recall', doctor); else add('no_unneeded_doctor', !doctor);
  if (e.top) add('top_product', out.recommendation?.picks?.[0]?.id === e.top);
  if (e.follow_up) add('asks_follow_up', out.follow_up);
  if (e.safety) add('safety_message', out.safety?.length);
  return { pass: checks.every(x => x.ok), checks };
}

// Models write typographic dashes (U+2010-2015, minus) and non-breaking spaces; compare plain text.
const plain = s => String(s || '').replace(/[‐-―−]/g, '-').replace(/[   ]/g, ' ');

export function gradeCoach(c, out, checkReply) {
  const e = c.expect, checks = [];
  const add = (name, ok) => checks.push({ name, ok: Boolean(ok) });
  const reply = plain(out.reply);
  if (e.source) add('rules_path', out.source === e.source);
  if (e.intent && out.source !== 'rules') add('intent', e.intent.includes(out.intent));
  if (e.escalate.includes('doctor') && !e.escalate.includes('none')) add('doctor_recall', out.escalate === 'doctor');
  else if (e.escalate.includes('support')) add('support_recall', out.escalate === 'support');
  else add('no_unneeded_escalation', e.escalate.includes(out.escalate));
  if (e.action) add('action', e.action.includes(out.action));
  for (const p of e.must || []) add('grounded', new RegExp(plain(p), 'i').test(reply));
  for (const p of e.must_not || []) add('avoids_bad_advice', !new RegExp(p, 'i').test(reply));
  if (out.source !== 'rules') add('guardrails', out.source !== 'guardrail' && checkReply(reply).length === 0);
  return { pass: checks.every(x => x.ok), checks };
}

export function summarize(kind, rows) {
  const scored = rows.filter(r => !r.error), metrics = {};
  for (const r of scored) for (const ch of r.checks) {
    const m = (metrics[ch.name] ??= { hit: 0, n: 0 });
    m.n++; if (ch.ok) m.hit++;
  }
  for (const m of Object.values(metrics)) m.rate = m.n ? m.hit / m.n : 0;
  let cost = 0, priced = false;
  for (const r of scored) {
    const p = PRICES[String(r.model || '').replace(/-\d{8}$/, '')], u = r.usage;
    if (!p || !u) continue;
    priced = true;
    cost += ((u.input_tokens || 0) * p[0] + (u.output_tokens || 0) * p[1] + (u.cache_read_input_tokens || 0) * p[2] + (u.cache_creation_input_tokens || 0) * p[3]) / 1e6;
  }
  const ms = scored.map(r => r.ms).filter(Number.isFinite).sort((a, b) => a - b);
  const passed = scored.filter(r => r.pass).length;
  return {
    scored: scored.length, passed, pass_rate: scored.length ? passed / scored.length : 0,
    errors: rows.length - scored.length, metrics,
    failures: [...new Set(scored.filter(r => !r.pass).map(r => r.id))],
    error_ids: [...new Set(rows.filter(r => r.error).map(r => `${r.id}:${r.error}`))],
    cost_usd: priced ? cost : null, median_ms: ms.length ? ms[Math.floor(ms.length / 2)] : null,
  };
}
