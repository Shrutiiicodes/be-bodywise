import { test } from 'node:test';
import assert from 'node:assert/strict';
import { C, PRODUCTS, FINDER, VERDICT, recommend, verdict, sample, dayOf, weekOf, iso, today0, DAY, phaseFor, trend, screen } from '../public/engine.js';

const startDaysAgo = n => iso(new Date(+today0() - n * DAY));

test('day and week math', () => {
  assert.equal(dayOf({ start: startDaysAgo(0) }), 1);
  assert.equal(weekOf({ start: startDaysAgo(0) }), 1);
  assert.equal(weekOf({ start: startDaysAgo(6) }), 1);
  assert.equal(weekOf({ start: startDaysAgo(7) }), 2);
  assert.equal(weekOf({ start: startDaysAgo(45) }), 7);
  assert.equal(weekOf({ start: startDaysAgo(400) }), 13, 'caps at 13');
  assert.equal(weekOf({ start: startDaysAgo(-5) }), 0, 'future start is week 0');
});

test('every concern has a full 13-week timeline', () => {
  for (const [c, cfg] of Object.entries(C)) {
    assert.equal(cfg.zones.length, 13, c);
    for (let w = 1; w <= 13; w++) {
      const hits = cfg.phases.filter(p => w >= p.w[0] && w <= p.w[1]);
      assert.equal(hits.length, 1, `${c} week ${w} must be in exactly one phase`);
      assert.equal(phaseFor(c, w), hits[0]);
    }
  }
});

test('fit verdict takes the most serious flag', () => {
  assert.equal(verdict('hair', []).lvl, 0);
  assert.equal(verdict('hair', ['pattern']).lvl, 0);
  assert.equal(verdict('hair', ['pattern', 'hormonal']).lvl, 1);
  assert.equal(verdict('hair', ['hormonal', 'patch']).lvl, 2);
  assert.equal(verdict('underarm', ['velvet']).lvl, 2);
  assert.equal(verdict('hair', ['velvet']).lvl, 0, 'flags from another concern are ignored');
  assert.equal(verdict('hair', ['hormonal', 'hormonal']).notes.length, 1, 'duplicate flags give one note');
  assert.equal(VERDICT.length, 3);
});

test('every fit-check option flag is defined for its concern', () => {
  for (const [c, cfg] of Object.entries(C))
    for (const q of cfg.fit)
      for (const [, flag] of q.opts)
        if (flag) assert.ok(cfg.flags[flag], `${c}.${q.id} uses undefined flag ${flag}`);
});

// Exhaustive: every combination of finder answers must end in products or a doctor referral.
function* combos(concern) {
  const qs = FINDER[concern].qs;
  function* walk(i, acc) {
    if (i === qs.length) return yield acc;
    for (const [v] of qs[i].opts) yield* walk(i + 1, { ...acc, [qs[i].id]: v });
  }
  yield* walk(0, { concern });
}

test('every finder path ends in a product or a doctor referral', () => {
  let n = 0;
  for (const concern of Object.keys(FINDER))
    for (const a of combos(concern)) {
      n++;
      const r = recommend(a);
      assert.ok(r.picks.length > 0 || r.doctor, JSON.stringify(a));
      assert.ok(!(r.picks.length && r.doctor), `doctor cases recommend no product: ${JSON.stringify(a)}`);
      for (const [id] of r.picks) {
        assert.ok(PRODUCTS[id], `unknown product ${id}`);
        assert.match(PRODUCTS[id].url, /^https:\/\/bebodywise\.com\/product\//);
      }
    }
  assert.ok(n >= 15);
});

test('incomplete answers recommend nothing yet', () => {
  assert.deepEqual(recommend({ concern: 'underarm' }).picks, []);
  assert.deepEqual(recommend({ concern: 'body', skin: 'dry' }).picks, []);
  assert.deepEqual(recommend({}).picks, []);
});

test('key recommendations match the research', () => {
  assert.equal(recommend({ concern: 'hair', type: 'thin' }).picks[0][0], 'serum');
  assert.equal(recommend({ concern: 'underarm', level: 'marked', skin: 'sens' }).picks[0][0], 'uaNF', 'sensitive skin gets fragrance-free first');
  assert.equal(recommend({ concern: 'underarm', level: 'mild', skin: 'normal' }).picks[0][0], 'ua4');
  assert.equal(recommend({ concern: 'body', skin: 'dry', sev: 'mild' }).picks[0][0], 'bwCer');
  assert.equal(recommend({ concern: 'body', skin: 'normal', sev: 'mild' }).picks[0][0], 'bwSal');
  assert.ok(recommend({ concern: 'hair', type: 'patch' }).doctor);
  assert.ok(recommend({ concern: 'body', skin: 'dry', sev: 'severe' }).doctor);
  assert.ok(recommend({ concern: 'body', sev: 'severe' }).doctor, 'severe acne needs no skin answer');
  assert.equal(verdict('body', ['sensitive']).lvl, 0, 'concern without a fit check does not crash');
});

test('trend compares day 0 with the latest check-in', () => {
  const e = (week, primary) => ({ week, primary });
  assert.equal(trend('hair', [e(0, 1)]).cls, 'flat');
  assert.equal(trend('hair', [e(3, 2), e(0, 1)]).cls, 'up', 'order-independent');
  assert.equal(trend('hair', [e(0, 2), e(4, 1)]).cls, 'down');
  assert.equal(trend('hair', [e(0, 2), e(4, 2)]).text, 'Still 20–50');
  assert.equal(trend('hair', sample().entries).text, '50–100 → 20–50');
});

test('safety screen catches red flags', () => {
  assert.deepEqual(screen('the roll-on is burning my skin'), ['burn']);
  assert.deepEqual(screen('It stings a lot after applying'), ['burn']);
  assert.deepEqual(screen('I found a round bald patch near my crown'), ['patch']);
  assert.deepEqual(screen('dark velvety skin on my neck too'), ['velvet']);
  assert.deepEqual(screen('painful cysts on my back'), ['severe_acne']);
  assert.deepEqual(screen('my hair is thinning at the part'), []);
  assert.deepEqual(screen('slight tingle, otherwise fine'), []);
  assert.deepEqual(screen('No bald patches, just general thinning'), [], 'negated');
  assert.deepEqual(screen("it doesn't burn at all"), [], 'negated contraction');
  assert.deepEqual(screen("I'm not sure why, but there is a round bald patch"), ['patch'], 'negation far away still flags');
  assert.deepEqual(screen('no rash, but now it is burning'), ['burn'], 'one negated, one not');
  assert.deepEqual(screen(''), []);
  assert.deepEqual(screen(undefined), []);
});
