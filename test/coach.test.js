import { test } from 'node:test';
import assert from 'node:assert/strict';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { CoachSchema, checkReply, buildContext, ruleReply, runCoach } from '../lib/coach.js';
import { sample } from '../public/engine.js';

const S = sample();
const state = { concern: S.concern, start: S.start, entries: S.entries, flags: S.flags };
const fakeClient = data => {
  const calls = [];
  return { calls, beta: { messages: { parse: async p => { calls.push(p); return { stop_reason: 'end_turn', parsed_output: data, usage: {}, model: p.model }; } } } };
};

test('schema converts to a structured-output format', () => {
  assert.doesNotThrow(() => betaZodOutputFormat(CoachSchema));
});

test('context carries the customer numbers and phase', () => {
  const c = buildContext(state);
  assert.equal(c.week, 7);
  assert.match(c.text, /day 46 of 90/);
  assert.match(c.text, /Day 0: 50–100\. Latest \(week 6\): 20–50\. Trend: up/);
  assert.match(c.text, /Missed days in total: 4/);
  assert.match(c.text, /Advanced Hair Growth Serum Roll-On/);
});

test('guardrails catch unsafe replies', () => {
  assert.deepEqual(checkReply('You are on day 46. Keep going.'), []);
  assert.ok(checkReply('Try Wishcare instead.').includes('off_limits_mention'));
  assert.ok(checkReply('This will cure your hair loss.').includes('overclaim'));
  assert.ok(checkReply('Call 1800-123-456 for help').includes('invented_contact'));
  assert.ok(checkReply('word '.repeat(200)).includes('too_long'));
  assert.ok(checkReply('').includes('empty'));
});

test('red flags are answered by rules without a model call', async () => {
  const client = fakeClient(null);
  const r = await runCoach({ ...state, message: 'it is burning and my skin has a rash' }, { client });
  assert.equal(r.source, 'rules');
  assert.equal(r.escalate, 'doctor');
  assert.equal(client.calls.length, 0);
  assert.equal(ruleReply('is it working?'), null);
});

test('model reply passes through when it is safe', async () => {
  const client = fakeClient({ intent: 'progress_doubt', reply: 'You are on day 46 and hair fall dropped from 50–100 to 20–50.', escalate: 'none', action: 'compare_photos' });
  const r = await runCoach({ ...state, message: 'Is this even working?', history: [{ role: 'user', content: 'hi' }] }, { client });
  assert.equal(r.source, 'model');
  assert.equal(r.action, 'compare_photos');
  const sent = client.calls[0].messages[0].content;
  assert.match(sent, /CONTEXT/);
  assert.match(sent, /EARLIER IN THIS CHAT\nCustomer: hi/);
  assert.match(sent, /CUSTOMER MESSAGE\nIs this even working\?/);
});

test('unsafe model reply is replaced by phase guidance', async () => {
  const client = fakeClient({ intent: 'product_choice', reply: 'Switch to The Ordinary serum.', escalate: 'none', action: 'none' });
  const r = await runCoach({ ...state, message: 'Should I switch brands?' }, { client });
  assert.equal(r.source, 'guardrail');
  assert.doesNotMatch(r.reply, /Ordinary/);
  assert.match(r.reply, /day 46 of 90/);
});
