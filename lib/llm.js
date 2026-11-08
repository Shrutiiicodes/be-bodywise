// Picks the model provider. LLM_PROVIDER=groq|anthropic; if unset, Groq is used
// when only a Groq key is present, otherwise Claude.
import { askClaude, CLAUDE_MODEL } from './claude.js';
import { askGroq, GROQ_MODEL } from './groq.js';

const env = process.env;
export const PROVIDER = (env.LLM_PROVIDER || (env.GROQ_API_KEY && !env.ANTHROPIC_API_KEY ? 'groq' : 'anthropic')).toLowerCase();
export const MODEL = PROVIDER === 'groq' ? GROQ_MODEL : CLAUDE_MODEL;

export const configured = () => PROVIDER === 'groq'
  ? Boolean(env.GROQ_API_KEY)
  : Boolean(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN);

/** Structured JSON from the configured provider. `provider` overrides it (tests). */
export function askJSON({ provider = PROVIDER, ...opts }) {
  return provider === 'groq' ? askGroq(opts) : askClaude(opts);
}
