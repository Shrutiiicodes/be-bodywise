import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strictSchema, askGroq } from '../lib/groq.js';
import { IntakeSchema, runIntake } from '../lib/intake.js';
import { CoachSchema } from '../lib/coach.js';

// Every object must list all its properties as required and forbid extras (Groq strict mode).
function assertStrict(node, path = '$') {
  if (Array.isArray(node)) return node.forEach((n, i) => assertStrict(n, `${path}[${i}]`));
  if (!node || typeof node !== 'object') return;
  if (node.type === 'object' && node.properties) {
    assert.equal(node.additionalProperties, false, `${path} additionalProperties`);
    assert.deepEqual([...node.required].sort(), Object.keys(node.properties).sort(), `${path} required`);
  }
  for (const [k, v] of Object.entries(node)) assertStrict(v, `${path}.${k}`);
}

test('schemas convert to Groq strict JSON schema', () => {
  for (const s of [IntakeSchema, CoachSchema]) {
    const js = strictSchema(s);
    assert.equal(js.$schema, undefined);
    assertStrict(js);
  }
});

const reply = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers });
const ok = content => reply(200, { model: 'openai/gpt-oss-120b', choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }], usage: { prompt_tokens: 900, completion_tokens: 200 } });
const intakeOut = { concern: 'hair', hair_type: 'post', underarm_level: null, skin: null, acne_severity: null, fit_flags: ['shed'], summary: 's', follow_up: null };

test('sends a strict json_schema request and parses the reply', async () => {
  let sent;
  const fetchImpl = async (url, init) => { sent = { url, init, body: JSON.parse(init.body) }; return ok(intakeOut); };
  const r = await askGroq({ system: 'sys', user: 'hi', schema: IntakeSchema, fetchImpl, apiKey: 'k' });
  assert.equal(sent.url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(sent.init.headers.Authorization, 'Bearer k');
  assert.equal(sent.body.response_format.type, 'json_schema');
  assert.equal(sent.body.response_format.json_schema.strict, true);
  assert.deepEqual(sent.body.messages.map(m => m.role), ['system', 'user']);
  assert.equal(r.data.hair_type, 'post');
  assert.deepEqual(r.usage, { input_tokens: 900, output_tokens: 200 });
});

test('retries a 429 then succeeds', async () => {
  let n = 0;
  const fetchImpl = async () => (++n === 1 ? reply(429, { error: { message: 'slow down' } }, { 'retry-after': '0' }) : ok(intakeOut));
  const r = await askGroq({ system: 's', user: 'u', schema: IntakeSchema, fetchImpl, apiKey: 'k' });
  assert.equal(n, 2);
  assert.equal(r.data.concern, 'hair');
});

test('auth errors and bad output surface as typed errors', async () => {
  await assert.rejects(askGroq({ system: 's', user: 'u', schema: IntakeSchema, apiKey: 'k', fetchImpl: async () => reply(401, { error: { message: 'Invalid API Key' } }) }), { status: 401 });
  await assert.rejects(askGroq({ system: 's', user: 'u', schema: IntakeSchema, apiKey: 'k', fetchImpl: async () => ok({ concern: 'elbows' }) }), { kind: 'format' });
  await assert.rejects(askGroq({ system: 's', user: 'u', schema: IntakeSchema, apiKey: 'k', fetchImpl: async () => reply(200, { choices: [{ finish_reason: 'length', message: { content: '{' } }] }) }), { kind: 'truncated' });
});

test('the intake pipeline runs end to end on the Groq provider', async () => {
  const r = await runIntake('losing hair since my baby was born', { provider: 'groq', apiKey: 'k', fetchImpl: async () => ok(intakeOut) });
  assert.equal(r.recommendation.picks[0].id, 'postpartum');
  assert.equal(r.model, 'openai/gpt-oss-120b');
});
