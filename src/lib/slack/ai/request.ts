import type { CardElement } from "chat";

import type { ApiScope } from "@/lib/api/scope-rules";
import type { Caller } from "./permissions";
import type { ToolResult } from "./loop";

/**
 * One reply's worth of context, handed to every tool the model calls while
 * writing it. Tools never post to Slack themselves — the reply is still
 * streaming — so cards and confirmation prompts go in the outbox, and the
 * handler posts them under the reply once it has finished.
 */
export type RequestCtx = {
  workspaceId: string;
  caller: Caller;
  scope: ApiScope;
  slackUserId: string;
  threadId: string;
  /** The channel thread being answered in (not a DM); summarize_thread_to_task links the task to it. */
  slackThread: { channel: string; ts: string; permalink: () => Promise<string | null> } | null;
  /** "#engineering", "a direct message". */
  where: string;
  appUrl: string;
  /** yyyy-mm-dd in India. */
  today: string;
  outbox: Outbox;
};

export type Outbox = {
  cards: { card: CardElement; fallbackText: string }[];
  /** Plans stored for confirmation, by nonce, with the summary their card shows. */
  confirmations: { nonce: string; summary: string }[];
};

export const emptyOutbox = (): Outbox => ({ cards: [], confirmations: [] });

export const ok = (data: unknown): ToolResult => ({ content: JSON.stringify(data) });
export const fail = (message: string): ToolResult => ({ content: message, isError: true });
