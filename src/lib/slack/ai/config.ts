/**
 * The Slack AI bot's knobs. Pure: everything is read from an env object so the
 * defaults are tested rather than trusted.
 *
 *   SLACK_AI_MODEL        the model the bot runs on (default claude-haiku-5-5).
 *                         Separate from the app-wide AI_MODEL: Slack questions
 *                         are short lookups and small writes, and run far more
 *                         often than Ask, so the bot runs on Haiku for cost.
 *   SLACK_AI_DAILY_LIMIT  replies per workspace per day (default 200). Each
 *                         @mention, DM or follow-up the bot answers is one.
 *
 * ANTHROPIC_API_KEY is the same key the rest of the app uses (src/lib/ai.ts);
 * without it the bot says it isn't set up rather than going quiet.
 */

export const DEFAULT_SLACK_AI_MODEL = "claude-haiku-5-5";
export const DEFAULT_SLACK_AI_DAILY_LIMIT = 200;

/**
 * Model calls one reply may make with tools on offer. After this many rounds
 * of tool use the bot gets one last call with tools switched off, so a reply
 * always ends in an answer rather than a silent stop.
 */
export const MAX_TOOL_ROUNDS = 6;

/**
 * Per model call. Adaptive thinking counts against it, so this is not the
 * answer's length: a two-line reply that thought first still needs the room.
 */
export const MAX_TOKENS_PER_CALL = 4096;

/** How much of the Slack thread the model reads as context. */
export const THREAD_CONTEXT_MESSAGES = 30;

type Env = Record<string, string | undefined>;

export function slackAiModel(env: Env = process.env): string {
  return env.SLACK_AI_MODEL?.trim() || DEFAULT_SLACK_AI_MODEL;
}

/** A positive whole number from the env, else the default. "0" turns the bot off for the day, every day. */
export function slackAiDailyLimit(env: Env = process.env): number {
  const raw = env.SLACK_AI_DAILY_LIMIT?.trim();
  if (!raw) return DEFAULT_SLACK_AI_DAILY_LIMIT;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : DEFAULT_SLACK_AI_DAILY_LIMIT;
}
