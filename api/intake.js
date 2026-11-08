// POST /api/intake  { text }  ->  structured answers, fit flags and a product decision.
import { guard, clip, sendError, configured } from '../lib/http.js';
import { runIntake } from '../lib/intake.js';

export default async function handler(req, res) {
  const body = guard(req, res);
  if (!body) return;
  const text = clip(body.text, 1000);
  if (text.length < 8) return res.status(400).json({ error: 'Tell us a little more: what are you noticing, and where?' });
  if (!configured()) return res.status(503).json({ error: 'The assistant is not set up yet.', kind: 'config' });
  try {
    const { usage, waitedMs, ...out } = await runIntake(text);
    res.status(200).json(out);
  } catch (err) {
    sendError(res, err);
  }
}
