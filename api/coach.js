// POST /api/coach  { message, concern, start, entries, flags, history }  ->  { reply, intent, escalate, action }
import { guard, clip, sendError, configured } from '../lib/http.js';
import { runCoach, ruleReply } from '../lib/coach.js';
import { C } from '../public/engine.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const int = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.trunc(Number(v)) || 0));

export default async function handler(req, res) {
  const body = guard(req, res);
  if (!body) return;
  const message = clip(body.message, 600);
  if (!message) return res.status(400).json({ error: 'Type a question first.' });
  if (!C[body.concern] || !DATE.test(body.start || '')) return res.status(400).json({ error: 'Start a 90-day journey first, so answers can use your progress.' });

  // Only the numbers the assistant needs: photos never leave the device.
  const cfg = C[body.concern];
  const entries = (Array.isArray(body.entries) ? body.entries : []).slice(0, 20).map(e => ({
    week: int(e.week, 0, 13), primary: int(e.primary, 0, cfg.primary.opts.length - 1),
    secondary: int(e.secondary, 0, cfg.secondary.opts.length - 1), missed: int(e.missed, 0, 7),
  }));
  const flags = (Array.isArray(body.flags) ? body.flags : []).filter(f => cfg.flags[f]);
  const history = (Array.isArray(body.history) ? body.history : []).slice(-6)
    .map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: clip(h.content, 600) }));

  const input = { message, concern: body.concern, start: body.start, entries, flags, history };
  try {
    // Red-flag messages are answered by rules even when the model is not configured.
    if (!configured()) {
      const fixed = ruleReply(message);
      return fixed ? res.status(200).json(fixed) : res.status(503).json({ error: 'The assistant is not set up yet.', kind: 'config' });
    }
    const { usage, problems, ...out } = await runCoach(input);
    res.status(200).json(out);
  } catch (err) {
    sendError(res, err);
  }
}
