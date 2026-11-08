import { test } from 'node:test';
import assert from 'node:assert/strict';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { decide, runIntake, IntakeSchema } from '../lib/intake.js';

const x = over => ({ concern: 'hair', hair_type: null, underarm_level: null, skin: null, acne_severity: null, fit_flags: [], summary: 's', follow_up: null, ...over });

test('schema converts to a structured-output format', () => {
  assert.doesNotThrow(() => betaZodOutputFormat(IntakeSchema));
});

test('complete hair answer gives a product', () => {
  const r = decide('my part is getting wider', x({ hair_type: 'thin', fit_flags: ['pattern'] }));
  assert.deepEqual(r.answers, { concern: 'hair', type: 'thin' });
  assert.equal(r.recommendation.picks[0].id, 'serum');
  assert.deepEqual(r.missing, []);
  assert.equal(r.follow_up, null);
});

test('missing fields produce a follow-up and no product', () => {
  const r = decide('dark underarms', x({ concern: 'underarm', underarm_level: 'marked' }));
  assert.deepEqual(r.missing, ['skin']);
  assert.equal(r.recommendation, null);
  assert.ok(r.follow_up);
});

test('unclear concern asks which area', () => {
  const r = decide('help', x({ concern: 'unclear' }));
  assert.equal(r.recommendation, null);
  assert.match(r.follow_up, /hair|underarm|body/i);
});

test('safety screen overrides a missed extraction', () => {
  const r = decide('there is a round bald patch on my scalp', x({ hair_type: 'thin' }));
  assert.equal(r.answers.type, 'patch');
  assert.ok(r.recommendation.doctor);
  assert.equal(r.recommendation.picks.length, 0);

  const b = decide('painful cysts all over my back', x({ concern: 'body', skin: 'normal', acne_severity: 'mild' }));
  assert.equal(b.answers.sev, 'severe');
  assert.ok(b.recommendation.doctor);
});

test('velvety skin escalates the underarm fit check to a doctor', () => {
  const r = decide('dark underarms and velvety skin on my neck', x({ concern: 'underarm', underarm_level: 'marked', skin: 'normal' }));
  assert.ok(r.flags.includes('velvet'));
  assert.equal(r.fit.lvl, 2);
  assert.ok(r.recommendation.doctor, 'doctor outranks product');
  assert.equal(r.recommendation.picks.length, 0);
});

test('burning adds a safety message and the sensitive flag', () => {
  const r = decide('the roll-on burns my underarms', x({ concern: 'underarm', underarm_level: 'mild', skin: 'normal' }));
  assert.equal(r.safety.length, 1);
  assert.ok(r.flags.includes('sensitive'));
});

test('flags from another concern are dropped', () => {
  const r = decide('hair fall', x({ hair_type: 'thin', fit_flags: ['velvet', 'hormonal'] }));
  assert.deepEqual(r.flags, ['hormonal']);
});

test('runIntake sends the right request and uses the parsed output', async () => {
  let sent;
  const client = { beta: { messages: { parse: async p => { sent = p; return { stop_reason: 'end_turn', parsed_output: x({ hair_type: 'post' }), usage: {}, model: p.model }; } } } };
  const r = await runIntake('shedding since my baby', { client });
  assert.equal(r.recommendation.picks[0].id, 'postpartum');
  assert.equal(sent.messages[0].content, 'shedding since my baby');
  assert.equal(sent.output_config.effort, 'low');
  assert.ok(sent.output_config.format);
});

test('refusals surface as a ModelError', async () => {
  const client = { beta: { messages: { parse: async () => ({ stop_reason: 'refusal', parsed_output: null }) } } };
  await assert.rejects(runIntake('text here', { client }), { kind: 'refusal' });
});
