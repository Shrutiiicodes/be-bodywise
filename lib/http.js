// Request guards shared by the API routes.
import Anthropic from '@anthropic-ai/sdk';
import { ModelError } from './claude.js';

// ponytail: in-memory per-IP limiter. On serverless each warm instance keeps its own
// counts, so this caps bursts, not daily totals. Move to Vercel KV/Upstash if abused.
const WINDOW_MS = 60_000, MAX_PER_WINDOW = 12;
const hits = new Map();

function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

/** Returns the parsed JSON body, or null after sending an error response. */
export function guard(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.status(405).json({ error: 'Use POST.' }); return null; }
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'local').split(',')[0].trim();
  if (limited(ip)) { res.status(429).json({ error: 'Too many requests. Wait a minute and try again.' }); return null; }
  const body = typeof req.body === 'string' ? safeJSON(req.body) : req.body;
  if (!body || typeof body !== 'object') { res.status(400).json({ error: 'Send a JSON body.' }); return null; }
  return body;
}

const safeJSON = s => { try { return JSON.parse(s); } catch { return null; } };

// Without a key the SDK throws a plain Error at request time; check up front instead.
export const configured = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

export const clip =(s, n) => String(s ?? '').trim().slice(0, n);

/** Map any failure to a short, user-safe error. The UI falls back to the manual flow. */
export function sendError(res, err) {
  if (err instanceof ModelError) return res.status(502).json({ error: err.message, kind: err.kind });
  if (err instanceof Anthropic.RateLimitError) return res.status(503).json({ error: 'The assistant is busy. Try again in a minute.', kind: 'busy' });
  if (err instanceof Anthropic.AuthenticationError) { console.error('Claude auth failed: check ANTHROPIC_API_KEY'); return res.status(503).json({ error: 'The assistant is not set up yet.', kind: 'config' }); }
  if (err instanceof Anthropic.APIError) { console.error('Claude API error', err.status, err.message); return res.status(503).json({ error: 'The assistant is unavailable right now.', kind: 'api' }); }
  console.error(err);
  return res.status(500).json({ error: 'Something went wrong.', kind: 'server' });
}
