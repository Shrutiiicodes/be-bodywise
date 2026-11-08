// "Ask Day 90": a care assistant that answers with the customer's own progress
// data and the product facts. Rules handle red flags before the model is called.
import { z } from 'zod';
import { C, PRODUCTS, RED_FLAGS, screen, verdict, phaseFor, trend, sortEntries, weekOf, dayOf } from '../public/engine.js';
import { askJSON } from './claude.js';

export const CoachSchema = z.object({
  intent: z.enum(['progress_doubt', 'usage_question', 'side_effect', 'product_choice', 'order_support', 'off_topic', 'other']),
  reply: z.string(),
  escalate: z.enum(['none', 'doctor', 'support']),
  action: z.enum(['keep_going', 'check_in', 'compare_photos', 'patch_test', 'see_doctor', 'contact_support', 'none']),
});

// Other brands and prescription drugs the assistant must not recommend.
const OFF_LIMITS = /\b(wishcare|minimalist|the ordinary|refollium|mamaearth|plum|dot ?& ?key|derma ?co|finasteride|spironolactone|tretinoin|hydroquinone)\b/i;
const MAX_WORDS = 140;

/** Guardrail checks on a model reply. Returns a list of problems (empty = OK). */
export function checkReply(reply) {
  const problems = [];
  if (!reply || !reply.trim()) problems.push('empty');
  if (reply.split(/\s+/).length > MAX_WORDS) problems.push('too_long');
  if (OFF_LIMITS.test(reply)) problems.push('off_limits_mention');
  if (/\b(guarantee[sd]?|100% (results|effective)|cure[sd]?)\b/i.test(reply)) problems.push('overclaim');
  if (/(\+91|1800[- ]?\d|@[a-z0-9-]+\.(com|in))/i.test(reply)) problems.push('invented_contact');
  return problems;
}

const productLines = concern => Object.values(PRODUCTS).filter(p => p.track === concern || (concern === 'hair' && ['Biotin Hair Gummies', 'Hair Gummies for Post-Pregnancy Hair Fall'].includes(p.name)))
  .map(p => `- ${p.name}: ${p.actives}. ${p.use}`).join('\n');

/** Everything the assistant may rely on, built from the customer's own saved data. */
export function buildContext({ concern, start, entries = [], flags = [] }) {
  const cfg = C[concern], s = { start };
  const week = Math.max(1, weekOf(s)), day = Math.max(1, Math.min(90, dayOf(s)));
  const sorted = sortEntries(entries), latest = sorted.at(-1);
  const t = trend(concern, entries);
  const missed = entries.reduce((n, e) => n + (Number(e.missed) || 0), 0);
  const fit = verdict(concern, flags);
  const ph = phaseFor(concern, week);
  const lines = [
    `Treating: ${cfg.label} with the ${cfg.product}.`,
    `Today is day ${day} of 90 (week ${week} of 13). Day 90 is the fair point to judge.`,
    `Current phase (weeks ${ph.w[0]}-${ph.w[1]}, "${ph.name}"): ${ph.body}`,
    `Measure tracked: ${cfg.primary.q}. ${sorted.length > 1 ? `Day 0: ${cfg.primary.short[sorted[0].primary]}. Latest (week ${latest.week}): ${cfg.primary.short[latest.primary]}. Trend: ${t.cls}.` : 'Only the day-0 check-in so far.'}`,
    `${cfg.secondary.q} at the latest check-in: ${latest ? cfg.secondary.opts[latest.secondary] : 'unknown'}.`,
    `Check-ins done: ${Math.max(0, sorted.length - 1)} of ${week}. Missed days in total: ${missed}.`,
    `Fit check: ${['good fit', 'start with a check', 'see a doctor first'][fit.lvl]}${fit.notes.length ? ` (${fit.notes.join(' ')})` : ''}.`,
    `Full timeline:\n${cfg.phases.map(p => `  weeks ${p.w[0]}-${p.w[1]} ${p.name}: ${p.body} Tip: ${p.tip}`).join('\n')}`,
    `Be Bodywise products relevant here:\n${productLines(concern)}`,
  ];
  return { text: lines.join('\n'), week, day, trend: t };
}

export const COACH_SYSTEM = `You are the care assistant inside Day 90, an app that helps Be Bodywise customers in India stick with a hair or underarm treatment long enough to know whether it works. Many customers quit at weeks 6-8, before the 3-month result window, because slow progress is hard to see in a mirror. Your job is to answer their message honestly using their own data.

You receive CONTEXT (their day, week, tracked numbers, fit check, the timeline and the product facts), then their message. Use only CONTEXT and general, well-established skincare facts.

How to answer:
- Answer the actual question first, in plain warm English (mirror Hinglish if they wrote Hinglish). Under 110 words. No headings, no bullet lists unless they asked for steps.
- When they doubt progress, quote their own numbers and day from CONTEXT, and say what is normal for their phase. If their trend is flat or down at week 12 or later, do not push them to continue; suggest a dermatologist instead.
- Never promise results, never diagnose, and never say a product cures anything.
- Never recommend another brand or a prescription medicine. If they ask about combining with minoxidil or a prescription, say it is a medicine to plan with a dermatologist.
- Missed days: a few missed days do not reset progress; tell them to carry on with the normal routine, not to double up.
- Orders, delivery, payments, refunds or subscriptions: you cannot see orders. Tell them to contact Be Bodywise customer support through the website or app. Never invent a phone number, email or policy.
- Burning, rash, swelling, bleeding, bald patches or severe acne: tell them to stop and see a doctor.
- Off-topic requests: say briefly what you can help with.

Fields: intent = what they asked about; escalate = "doctor" for medical concerns, "support" for orders, else "none"; action = the single next step in the app that helps most.`;

/** Red flags in the message get a fixed, reviewed answer: no model call. */
export function ruleReply(message) {
  const hits = screen(message);
  if (!hits.length) return null;
  return { intent: 'side_effect', reply: hits.map(k => RED_FLAGS[k].message).join(' '), escalate: 'doctor', action: 'see_doctor', source: 'rules' };
}

export async function runCoach({ message, history = [], ...state }, opts = {}) {
  const fixed = ruleReply(message);
  if (fixed) return fixed;
  const ctx = buildContext(state);
  const convo = history.slice(-6).map(h => `${h.role === 'assistant' ? 'Assistant' : 'Customer'}: ${h.content}`).join('\n');
  const user = `CONTEXT\n${ctx.text}\n${convo ? `\nEARLIER IN THIS CHAT\n${convo}\n` : ''}\nCUSTOMER MESSAGE\n${message}`;
  const { data, usage, model } = await askJSON({ system: COACH_SYSTEM, user, schema: CoachSchema, effort: 'low', ...opts });
  const problems = checkReply(data.reply);
  if (problems.length) {
    // Never show a reply that breaks a guardrail; fall back to the phase guidance.
    const ph = phaseFor(state.concern, ctx.week);
    return { intent: data.intent, reply: `You're on day ${ctx.day} of 90, in the "${ph.name}" phase. ${ph.body} ${ph.tip}`, escalate: data.escalate, action: 'keep_going', source: 'guardrail', problems, usage, model };
  }
  return { ...data, source: 'model', usage, model };
}
