import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { after } from "next/server";

import { db } from "@/db";
import { contentItems, deals, slackChannelRules, slackThreads } from "@/db/schema";
import { prospectDealName } from "@/lib/prospects/deal-plan";
import { stageIndex } from "@/lib/prospects/parse";
import { STAGES } from "@/lib/prospects/schema";
import { getReadyBot } from "./bot";
import { eventLine, recordMessage, type RecordSnapshot } from "./cards";
import { appUrl, isSlackConfigured } from "./config";
import {
  channelsFor,
  isNewsworthyChange,
  recordTypeOf,
  slackEventsFromWebhook,
  type SlackEventInput,
  type SlackRule,
} from "./events";
import { eventContext, factsOf, loadSnapshot, userNames } from "./records";
import type { SlackBot } from "./types";

/**
 * Outbound: tell the channels that asked (Settings › Slack) what just happened.
 *
 * `emitSlackEvent` is the one entry point. It returns at once and does all the
 * work in `after()`, once the response has gone, so a slow or failing Slack
 * never slows or fails the mutation that caused it. Outside a request (seeds,
 * scripts) it does nothing: a backfill shouldn't announce itself.
 *
 * The first event for a record in a channel posts a card and remembers its
 * thread in `slack_threads`; later events for that record reply in the thread
 * and refresh the card, as Linear does.
 */
export function emitSlackEvent(workspaceId: string, ev: SlackEventInput): void {
  if (!isSlackConfigured()) return;
  try {
    after(() =>
      deliver(workspaceId, ev).catch((err) => {
        console.error(`[slack] ${ev.type} for ${ev.recordId} wasn't posted:`, err);
      }),
    );
  } catch {
    // Not in a request scope.
  }
}

/** The Slack side of an outbound webhook event (called from `dispatchWebhook`). */
export function emitSlackForWebhook(workspaceId: string, event: string, data: unknown): void {
  if (!isSlackConfigured()) return;
  for (const ev of slackEventsFromWebhook(event, data)) emitSlackEvent(workspaceId, ev);
}

/** Cache keys for the last value announced per record and field (see isNewsworthyChange). */
const announcedKey = (field: string, recordId: string) => `announced:${field}:${recordId}`;
const ANNOUNCED_TTL_MS = 90 * 24 * 60 * 60_000;

/** The field whose change an event is about, and its value now, if it's that kind of event. */
function changeOf(ev: SlackEventInput, snap: RecordSnapshot): { field: string; current: string } | null {
  if (ev.type === "issue.status_changed") return { field: "status", current: snap.status ?? "" };
  if (ev.type === "issue.assigned")
    return { field: "assignee", current: snap.fields.find((f) => f.label === "Assignee")?.value ?? "" };
  return null;
}

async function deliver(workspaceId: string, ev: SlackEventInput): Promise<void> {
  // Cheapest check first: most mutations have no rule that wants them.
  const rules: SlackRule[] = await db
    .select({
      id: slackChannelRules.id,
      slackChannelId: slackChannelRules.slackChannelId,
      projectId: slackChannelRules.projectId,
      events: slackChannelRules.events,
      filters: slackChannelRules.filters,
    })
    .from(slackChannelRules)
    .where(eq(slackChannelRules.workspaceId, workspaceId));
  if (!rules.some((r) => r.events.includes(ev.type))) return;

  const type = recordTypeOf(ev.type);
  const snap = await loadSnapshot(workspaceId, type, ev.recordId, ev.prospect);
  if (!snap) return;
  const channels = channelsFor(rules, factsOf(ev, snap));
  if (channels.length === 0) return;

  const [ctx, bot] = await Promise.all([eventContext(workspaceId, ev), getReadyBot()]);
  if (!bot) return;
  const state = bot.getState();

  const change = changeOf(ev, snap);
  if (change) {
    const last = await state.get<string>(announcedKey(change.field, snap.id));
    if (!isNewsworthyChange(change.current, last ?? null, ctx.logged)) return;
  }

  const names = await userNames([ctx.actorId]);
  const actor = ctx.actorId ? (names.get(ctx.actorId) ?? null) : null;
  const headline = eventLine({ ...ev, body: ctx.body }, snap, actor, { from: ctx.from, to: ctx.to });

  await postToChannels(bot, snap, headline, channels);

  if (change) await state.set(announcedKey(change.field, snap.id), change.current, ANNOUNCED_TTL_MS);
  if (ev.type === "issue.created") {
    // The card shows these; later changes are measured against them.
    await state.set(announcedKey("status", snap.id), snap.status ?? "", ANNOUNCED_TTL_MS);
    const who = snap.fields.find((f) => f.label === "Assignee")?.value ?? "";
    await state.set(announcedKey("assignee", snap.id), who, ANNOUNCED_TTL_MS);
  }
}

/**
 * Post a record's event to each channel: a reply in its existing thread (and a
 * refreshed root card), or a new card that starts one. Channels fail one at a
 * time — a channel the bot was removed from doesn't stop the others.
 */
export async function postToChannels(
  bot: SlackBot,
  snap: RecordSnapshot,
  headline: string,
  channels: string[],
): Promise<void> {
  const existing = await db
    .select({ channel: slackThreads.slackChannelId, ts: slackThreads.slackThreadTs })
    .from(slackThreads)
    .where(
      and(
        eq(slackThreads.recordType, snap.type),
        eq(slackThreads.recordId, snap.id),
        inArray(slackThreads.slackChannelId, channels),
      ),
    );
  const message = recordMessage(snap, headline, appUrl());
  const slack = bot.getAdapter("slack");

  await Promise.all(
    channels.map(async (channel) => {
      try {
        const thread = existing.find((t) => t.channel === channel);
        if (thread) {
          const threadId = slack.encodeThreadId({ channel, threadTs: thread.ts });
          await bot.thread(threadId).post({ raw: headline });
          // The root card is the record's live summary; a deleted root just
          // means there is nothing to refresh.
          await slack.editMessage(threadId, thread.ts, message).catch(() => {});
          return;
        }
        const sent = await bot.channel(`slack:${channel}`).post(message);
        const ts = slack.decodeThreadId(sent.threadId).threadTs || sent.id;
        await db
          .insert(slackThreads)
          .values({ workspaceId: snap.workspaceId, recordType: snap.type, recordId: snap.id, slackChannelId: channel, slackThreadTs: ts })
          .onConflictDoNothing({ target: [slackThreads.recordType, slackThreads.recordId, slackThreads.slackChannelId] });
      } catch (err) {
        console.warn(`[slack] couldn't post ${snap.type} ${snap.id} to ${channel}:`, err);
      }
    }),
  );
}

/* ---------- call-site helpers ---------- */

/**
 * The deals among `changes` that this write will move into "won" — read
 * before the write, since a board drag re-sends every moved card's stage and
 * only a deal that wasn't won yet is news. No query unless one is being won.
 */
export async function dealsTurningWon(
  workspaceId: string,
  changes: { id: string; stage?: string | null }[],
): Promise<string[]> {
  const ids = changes.filter((c) => c.stage === "won").map((c) => c.id);
  if (ids.length === 0 || !isSlackConfigured()) return [];
  const rows = await db
    .select({ id: deals.id, stage: deals.stage })
    .from(deals)
    .where(and(eq(deals.workspaceId, workspaceId), inArray(deals.id, ids)))
    .catch(() => []);
  return rows.filter((r) => r.stage !== "won").map((r) => r.id);
}

/** Whether this write moves a content piece to "published" (Posted) — read before the write. */
export async function contentTurningPosted(workspaceId: string, id: string, status?: string | null): Promise<boolean> {
  if (status !== "published" || !isSlackConfigured()) return false;
  const [row] = await db
    .select({ status: contentItems.status })
    .from(contentItems)
    .where(and(eq(contentItems.workspaceId, workspaceId), eq(contentItems.id, id)))
    .limit(1)
    .catch(() => []);
  return Boolean(row && row.status !== "published");
}

export function emitDealsWon(workspaceId: string, dealIds: string[], actorId?: string | null): void {
  for (const id of dealIds) emitSlackEvent(workspaceId, { type: "deal.won", recordId: id, actorId });
}

/**
 * A prospect's status was written. Announced only when the stage actually
 * moved — a touch logged at the same stage isn't news — and only when the
 * row's previous status is known.
 */
export function emitProspectStage(
  ctx: { workspaceId: string; userId: string | null },
  change: { kind: string; id: string; before: Record<string, string>; status: string },
): void {
  if (change.before.status === undefined) return;
  const from = STAGES[stageIndex(change.before.status)];
  const to = STAGES[stageIndex(change.status)];
  if (from === to) return;
  emitSlackEvent(ctx.workspaceId, {
    type: "prospect.stage_changed",
    recordId: `${change.kind}:${change.id}`,
    actorId: ctx.userId,
    prospect: { name: prospectDealName(change.before, change.id), from, to },
  });
}
