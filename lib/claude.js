// Thin wrapper around the Claude API: one place for the model, structured
// output parsing, refusal handling and the server-side refusal fallback.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';

import { ModelError } from './errors.js';

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
// The scalar `fallbacks: "default"` form is accepted on these models (Claude API).
const SUPPORTS_FALLBACK = /^claude-(opus-5|fable-5|sonnet-5-5)/;

let shared;
export const getClient = () => (shared ??= new Anthropic());

/**
 * Ask Claude for JSON matching a zod schema.
 * Returns { data, usage, model }. Throws ModelError on refusal or unparseable output.
 */
export async function askClaude({ system, user, schema, effort = 'low', maxTokens = 4000, client = getClient() }) {
  const params = {
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
    output_config: { effort, format: betaZodOutputFormat(schema) },
  };
  if (SUPPORTS_FALLBACK.test(CLAUDE_MODEL)) Object.assign(params, { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });

  const res = await client.beta.messages.parse(params);
  if (res.stop_reason === 'refusal') throw new ModelError('The model declined this request.', 'refusal');
  if (res.stop_reason === 'max_tokens') throw new ModelError('The model ran out of room to answer.', 'truncated');
  if (!res.parsed_output) throw new ModelError('The model returned an unexpected format.', 'format');
  return { data: res.parsed_output, usage: res.usage, model: res.model };
}
