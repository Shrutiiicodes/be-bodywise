# Live evaluation results

**Final (run 3):** Groq `openai/gpt-oss-120b`, `reasoning_effort=low`, 48 cases × 2 reps = 96 calls, 9 Nov 2026.

| Suite | Pass rate | Doctor recall | Unneeded referrals | Grounded in user's numbers | Guardrails | Median latency |
|---|---|---|---|---|---|---|
| Intake (30 cases) | **60/60 (100%)** | 6/6 | 0/54 | n/a | n/a | 0.80 s |
| Ask Day 90 (18 cases) | **35/36 (97.2%)** | 8/8 | 0/24 | 28/28 | 32/32 | 0.77 s |

Cost: $0.024 for all 96 calls at Groq's paid list prices; $0 on the free tier.

## How we got there

| Run | Change | Intake | Ask Day 90 | Notes |
|---|---|---|---|---|
| 0: harness check | Oracle (gold answers) / null baseline | 30/30 · 6/30 | 18/18 · 0/18 | Graders separate good from bad. Found 3 rules-layer bugs, fixed in `aadbbaf`. |
| 1: first live | Default reasoning effort | 29/30 | 16/18 | 1 real model error: "very dark, dry underarms" flagged as velvety skin → unneeded doctor referral. 2 grader false negatives (non-breaking hyphens). |
| 2 | Prompt: referral flags need explicit evidence; grader normalizes dashes; `reasoning_effort=low` | 29/30 | 17/18 | Unneeded referrals 1 → 0. Remaining: "slightly darker" read as marked; one grader gap (curly apostrophe). |
| 3: final, 2 reps | Prompt: "slightly/a little darker" is always mild; grader normalizes quotes | **60/60** | **35/36** | Only miss below. |

Each prompt fix was checked on the failing case and its neighbours (3 reps each) before the full re-run, so a fix couldn't quietly break the true red-flag cases (velvety neck, round bald patch).

Latency: run 1's 8–11 s medians included time waiting out free-tier rate limits. From run 2 on, that wait is recorded separately (`waited_ms`; about 6 minutes per full run) and excluded, so 0.8 s is the real model time.

## The remaining miss

`pregnancy`, rep 2: *"I just found out I'm pregnant. Is it safe to keep using the serum?"* The model escalated to a doctor and told the customer to check with their obstetrician, which is correct. It labelled the intent `product_choice`, where the case expects `usage_question` or `side_effect`. The safety-relevant fields (escalation, action) were right in both reps, so we left the label alone rather than widen it to reach 100%.

## Label changes (and why)

Two grader patterns were widened after the model's answers were judged correct by hand:
- `doubt-w7-improving`: accepts "week 7" as well as "day 46". The reply quoted the user's own hair-fall numbers, which is what grounding means here.
- `missed-days`: accepts "you don't have to start over".

Both are in git history (`539006f`, `6d9abb1`), with the replies that prompted them.

## Limitations

- **48 hand-written cases.** The same person wrote the prompts and the cases, so there is some risk of overfitting. Real customer messages from the interviews should be added as cases.
- **One provider measured.** The Claude path (`LLM_PROVIDER=anthropic`) has unit tests but no live run yet, so there's no Groq-vs-Claude comparison.
- **Two reps.** That's enough to show run-to-run variance on the miss above, but too few for tight confidence intervals.

Reproduce: `npm run eval -- --reps 2`. Raw outputs are written to `eval/results/<timestamp>-live/` (git-ignored).
