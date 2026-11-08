// "Describe it in your own words": Claude turns free text into the finder's
// structured answers; the rules engine then decides products and doctor referrals.
import { z } from 'zod';
import { C, FINDER, PRODUCTS, recommend, verdict, screen, RED_FLAGS } from '../public/engine.js';
import { askJSON } from './llm.js';

const FIT_FLAGS = [...new Set(Object.values(C).flatMap(c => Object.keys(c.flags)))];
const opts = (concern, id) => FINDER[concern].qs.find(q => q.id === id).opts.map(([v]) => v);

export const IntakeSchema = z.object({
  concern: z.enum(['hair', 'underarm', 'body', 'unclear']),
  hair_type: z.enum(opts('hair', 'type')).nullable(),
  underarm_level: z.enum(opts('underarm', 'level')).nullable(),
  skin: z.enum(['normal', 'dry', 'sens']).nullable(),
  acne_severity: z.enum(opts('body', 'sev')).nullable(),
  fit_flags: z.array(z.enum(FIT_FLAGS)),
  summary: z.string(),
  follow_up: z.string().nullable(),
});

const fitGuide = Object.entries(C).map(([c, cfg]) =>
  `${c}: ${Object.entries(cfg.flags).map(([k, [, msg]]) => `${k} = ${msg.split('.')[0].toLowerCase()}`).join('; ')}`).join('\n');

export const INTAKE_SYSTEM = `You help customers of Be Bodywise, an Indian women's wellness brand, describe a hair, underarm or body-skin concern so a rules engine can match them to a product. You only extract; you never recommend products or diagnose.

Read the customer's message (it may be in English, Hindi or Hinglish) and fill the fields:

concern: "hair" (hair fall, thinning, dandruff, breakage, frizz, bald patches), "underarm" (dark underarms, underarm odour or pigmentation), "body" (body acne, back or chest bumps), or "unclear" if none of these or more than one is equally prominent.
hair_type (hair only): "thin" = thinning, widening part, less volume or general hair fall; "post" = shedding that started after pregnancy or childbirth; "scalp" = itchy, flaky, dandruff or irritated scalp; "break" = breakage, split ends, frizz or hair snapping from tight styles; "patch" = round or coin-sized bald spots.
underarm_level (underarm only): "mild" = slightly darker or mostly odour; "marked" = clearly darker than the surrounding skin.
skin (underarm and body only): "normal" = normal or oily; "dry" = dry or tight; "sens" = sensitive, reacts easily, or has reacted to acids or products before.
acne_severity (body only): "mild" = small bumps or occasional spots; "severe" = painful, deep, cystic or widespread.
fit_flags: every flag the message clearly supports, from this list (concern: flag = meaning):
${fitGuide}

Rules:
- Set a field only when the message states it or clearly implies it. Otherwise use null. Never guess skin type.
- Fields for other concerns must be null.
- summary: one plain sentence, under 25 words, addressed to the customer, restating what you understood ("You're seeing more hair fall since your baby was born.").
- follow_up: if concern is "unclear" or a field the customer must answer is null, ask the single most useful short question. Otherwise null.`;

/** Turn the model's extraction plus the safety screen into answers, flags and a decision. */
export function decide(text, x) {
  const concern = x.concern;
  const red = screen(text);
  const safety = red.filter(k => k === 'burn').map(k => RED_FLAGS[k].message);
  if (concern === 'unclear') return { concern, answers: null, flags: [], missing: [], summary: x.summary, follow_up: x.follow_up || 'Is this about your hair, your underarms, or acne on your body?', safety, recommendation: null, fit: null };

  const answers = { concern };
  if (concern === 'hair') answers.type = x.hair_type;
  if (concern === 'underarm') Object.assign(answers, { level: x.underarm_level, skin: x.skin });
  if (concern === 'body') Object.assign(answers, { skin: x.skin, sev: x.acne_severity });

  // The deterministic screen overrides the model in the cautious direction.
  if (concern === 'hair' && red.includes('patch')) answers.type = 'patch';
  if (concern === 'body' && red.includes('severe_acne')) answers.sev = 'severe';
  const flags = new Set(x.fit_flags.filter(f => C[concern]?.flags[f]));
  if (concern === 'hair' && red.includes('patch')) flags.add('patch');
  if (concern === 'underarm' && red.includes('velvet')) flags.add('velvet');
  if (concern === 'underarm' && red.includes('burn')) flags.add('sensitive');
  if (concern === 'underarm' && answers.skin === 'sens') flags.add('sensitive');

  for (const k of Object.keys(answers)) if (answers[k] == null) delete answers[k];
  let missing = FINDER[concern].qs.map(q => q.id).filter(id => !answers[id]);
  let recommendation = recommend(answers);
  // A referral can be decided before every question is answered; otherwise wait for the rest.
  if (recommendation.doctor) missing = []; else if (missing.length) recommendation = null;
  const fit = verdict(concern, [...flags]);
  // A fit-check "see a doctor" outranks a product suggestion.
  if (recommendation && fit.lvl === 2 && !recommendation.doctor) Object.assign(recommendation, { doctor: fit.notes[0], picks: [] });
  return {
    concern, answers, flags: [...flags], missing, summary: x.summary,
    follow_up: missing.length ? (x.follow_up || FINDER[concern].qs.find(q => q.id === missing[0]).q) : null,
    safety, fit, recommendation: recommendation && { ...recommendation, picks: recommendation.picks.map(([id, why]) => ({ id, why, name: PRODUCTS[id].name })) },
  };
}

export async function runIntake(text, opts = {}) {
  const { data, usage, model } = await askJSON({ system: INTAKE_SYSTEM, user: text, schema: IntakeSchema, effort: 'low', ...opts });
  return { ...decide(text, data), extraction: data, usage, model };
}
