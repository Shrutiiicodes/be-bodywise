// Groq provider: OpenAI-compatible Chat Completions over plain fetch, with
// strict JSON-schema output (constrained decoding) and retry on rate limits.
import { z } from 'zod';
import { ModelError, ProviderError } from './errors.js';

// Production model with strict structured-output support (Groq docs, Nov 2026).
export const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
// gpt-oss reasons before answering; extraction and short replies rarely need much.
export const GROQ_EFFORT = process.env.GROQ_REASONING_EFFORT || 'low';
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Strict mode needs every property listed in `required` and additionalProperties:false
// on every object; nullable fields stay required and allow null instead.
export function strictSchema(schema) {
  const js = z.toJSONSchema(schema);
  delete js.$schema;
  return tighten(js);
}
function tighten(node) {
  if (Array.isArray(node)) return node.map(tighten);
  if (!node || typeof node !== 'object') return node;
  const out = Object.fromEntries(Object.entries(node).map(([k, v]) => [k, tighten(v)]));
  if (out.type === 'object' && out.properties) { out.additionalProperties = false; out.required = Object.keys(out.properties); }
  return out;
}

/** Same contract as askClaude: returns { data, usage, model } or throws ModelError / ProviderError. */
export async function askGroq({ system, user, schema, maxTokens = 4000, fetchImpl = fetch, apiKey = process.env.GROQ_API_KEY }) {
  const body = JSON.stringify({
    model: GROQ_MODEL,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    max_completion_tokens: maxTokens,
    reasoning_effort: GROQ_EFFORT,
    response_format: { type: 'json_schema', json_schema: { name: 'answer', strict: true, schema: strictSchema(schema) } },
  });
  let waitedMs = 0;
  const pause = async ms => { waitedMs += ms; await sleep(ms); };
  for (let attempt = 0; ; attempt++) {
    const res = await fetchImpl(ENDPOINT, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body });
    // Free-tier limits are tight: honour retry-after (seconds) with jitter, a few times.
    if (res.status === 429 && attempt < 3) { await pause(Math.min(30, Number(res.headers.get('retry-after')) || 2 * (attempt + 1)) * 1000 + Math.random() * 400); continue; }
    if (res.status >= 500 && attempt < 2) { await pause(800 * (attempt + 1)); continue; }
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new ProviderError(json?.error?.message || `Groq returned HTTP ${res.status}`, res.status);
    const choice = json?.choices?.[0];
    if (choice?.finish_reason === 'length') throw new ModelError('The model ran out of room to answer.', 'truncated');
    let data;
    try { data = schema.parse(JSON.parse(choice?.message?.content ?? '')); }
    catch { throw new ModelError('The model returned an unexpected format.', 'format'); }
    return { data, usage: { input_tokens: json.usage?.prompt_tokens ?? 0, output_tokens: json.usage?.completion_tokens ?? 0 }, model: json.model, waitedMs, attempts: attempt + 1 };
  }
}
