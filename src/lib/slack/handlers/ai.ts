import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { ActionEvent, Message, StreamChunk, Thread } from "chat";

import { isAiConfigured } from "@/lib/ai";
import { todayIST } from "@/lib/prospects/stats";
import { escapeMrkdwn, recordMessage } from "../cards";
import { appUrl } from "../config";
import { loadSnapshot } from "../records";
import { MAX_TOKENS_PER_CALL, MAX_TOOL_ROUNDS, slackAiDailyLimit, slackAiModel, THREAD_CONTEXT_MESSAGES } from "../ai/config";
import {
  ACTION_AI_CANCEL,
  ACTION_AI_CONFIRM,
  claimKey,
  confirmCard,
  confirmDecision,
  CONFIRM_TTL_MS,
  decisionText,
  pendingKey,
  type PendingAction,
} from "../ai/confirm";
import { askerFor, slackWorkspaceId } from "../ai/context";
import { conversationKey, CONVERSATION_TTL_MS, LINK_HINT_TTL_MS, linkHintKey, shouldAnswer, withParticipant, type Conversation } from "../ai/conversation";
import { executorFor } from "../ai/execute";
import { limitReachedText, takeDailySlot } from "../ai/limit";
import { runAgent } from "../ai/loop";
import { isLinked, toolsFor } from "../ai/permissions";
import { stripLeadingMention, systemBlocks, transcript, userTurn } from "../ai/prompt";
import { applyTouch } from "../ai/prospects";
import { emptyOutbox, type RequestCtx } from "../ai/request";
import { applyTaskUpdate } from "../ai/tasks";
import { isToolName, TOOL_SPECS, toolDefinitions } from "../ai/tools";
import type { SlackBot } from "../types";

/**
 * The AI bot: @Internal in a channel (it reads the thread so far), a DM to
 * the bot, and follow-ups in a thread it has answered in. It answers by
 * streaming into the thread, using tools that read and write Internal as the
 * person asking — see src/lib/slack/ai/ for the pieces. Writes that change an
 * existing record wait for that person's Confirm (the buttons are handled
 * here too).
 */

const BOT_NAMES = ["Internal"];

export function register(bot: SlackBot): void {
  bot.onNewMention((thread, message) => answer(bot, thread, message));
  bot.onDirectMessage((thread, message) => answer(bot, thread, message));
  bot.onSubscribedMessage(async (thread, message) => {
    // Subscribed threads include record threads other features follow: only
    // mentions, and follow-ups from people already talking to the bot here.
    const conv = await bot.getState().get<Conversation>(conversationKey(thread.id));
    const go = shouldAnswer(conv, {
      isMention: message.isMention,
      authorId: message.author.userId,
      authorIsBot: message.author.isBot,
      authorIsMe: message.author.isMe,
    });
    if (go) await answer(bot, thread, message);
  });
  bot.onAction([ACTION_AI_CONFIRM, ACTION_AI_CANCEL], (event) => onConfirm(bot, event));
}

async function answer(bot: SlackBot, thread: Thread, message: Message): Promise<void> {
  if (message.author.isMe || message.author.isBot === true) return;
  try {
    await respond(bot, thread, message);
  } catch (err) {
    console.error("[slack-ai] reply failed:", err);
    await thread.post("Sorry, something went wrong on my side and I couldn't answer that.").catch(() => {});
  }
}

async function respond(bot: SlackBot, thread: Thread, message: Message): Promise<void> {
  if (!isAiConfigured()) {
    await thread.post("I can't answer questions yet: the AI isn't set up (an admin needs to add ANTHROPIC_API_KEY).");
    return;
  }
  const workspaceId = await slackWorkspaceId();
  if (!workspaceId) return;
  const state = bot.getState();

  // The cost guard comes before any model call.
  const limit = slackAiDailyLimit();
  if (!(await takeDailySlot(state, workspaceId, limit)).ok) {
    await thread.post(limitReachedText(limit));
    return;
  }

  const slackUserId = message.author.userId;
  const { caller, scope } = await askerFor(bot, workspaceId, slackUserId);

  if (!thread.isDM) {
    const key = conversationKey(thread.id);
    await state.set(key, withParticipant(await state.get<Conversation>(key), slackUserId), CONVERSATION_TTL_MS);
    await thread.subscribe();
  }

  const slack = bot.getAdapter("slack");
  const { channel, threadTs } = slack.decodeThreadId(thread.id);
  const [history, where] = await Promise.all([threadHistory(thread, threadTs), placeName(thread)]);
  const base = appUrl();
  const settingsUrl = `${base}/settings/slack`;
  const today = todayIST();
  const inThread = !thread.isDM && Boolean(threadTs);

  const ctx: RequestCtx = {
    workspaceId,
    caller,
    scope,
    slackUserId,
    threadId: thread.id,
    slackThread: inThread
      ? {
          channel,
          ts: threadTs,
          permalink: async () => (await slack.webClient.chat.getPermalink({ channel, message_ts: threadTs })).permalink ?? null,
        }
      : null,
    where,
    appUrl: base,
    today,
    outbox: emptyOutbox(),
  };

  const asker = message.author.fullName || message.author.userName || "Someone";
  const reply = runAgent({
    client: new Anthropic(),
    model: slackAiModel(),
    system: systemBlocks({ today, where, caller: { name: caller.name, linked: isLinked(caller), isAdmin: caller.isAdmin }, settingsUrl, inThread }),
    tools: toolDefinitions(toolsFor(caller)),
    messages: [
      {
        role: "user",
        content: userTurn({ history: transcript(history, message.id), askerName: asker, text: stripLeadingMention(message.text, BOT_NAMES) }),
      },
    ],
    execute: executorFor(ctx, state),
    labelFor: (name) => (isToolName(name) ? TOOL_SPECS[name].label : "Working"),
    maxToolRounds: MAX_TOOL_ROUNDS,
    maxTokens: MAX_TOKENS_PER_CALL,
    signal: thread.signal,
    logUsage: ({ round, model, stopReason, usage }) =>
      console.info(
        `[slack-ai] usage ${JSON.stringify({
          workspaceId,
          thread: thread.id,
          round,
          model,
          stop: stopReason,
          input: usage.input_tokens,
          output: usage.output_tokens,
          cacheRead: usage.cache_read_input_tokens ?? 0,
          cacheWrite: usage.cache_creation_input_tokens ?? 0,
        })}`,
      ),
  });

  // Unlinked people are told how to link, once a day rather than every time.
  const hint =
    !isLinked(caller) && (await state.setIfNotExists(linkHintKey(slackUserId), 1, LINK_HINT_TTL_MS))
      ? `\n\n_Link your Slack account in [Settings › Slack](${settingsUrl}) and I can make changes for you too._`
      : null;

  await thread.post(withFooter(reply, hint));

  // Cards and confirmations, under the reply now that it has finished.
  for (const c of ctx.outbox.cards) await thread.post(c).catch((err) => console.warn("[slack-ai] card failed:", err));
  for (const c of ctx.outbox.confirmations)
    await thread
      .post({ card: confirmCard(c.summary, c.nonce), fallbackText: c.summary.replace(/\*/g, "") })
      .catch((err) => console.warn("[slack-ai] confirmation failed:", err));
}

async function* withFooter(stream: AsyncIterable<string | StreamChunk>, footer: string | null): AsyncGenerator<string | StreamChunk> {
  yield* stream;
  if (footer) yield footer;
}

/** A DM has no thread: its recent messages are the conversation, back to a few hours. */
const DM_CONTEXT_MS = 6 * 3600_000;
const DM_CONTEXT_MESSAGES = 16;

/** The thread so far (in a DM, the recent conversation), oldest first. */
async function threadHistory(thread: Thread, threadTs: string): Promise<Message[]> {
  try {
    if (!threadTs) {
      const out: Message[] = [];
      const since = Date.now() - DM_CONTEXT_MS;
      for await (const m of thread.channel.messages) {
        if (out.length >= DM_CONTEXT_MESSAGES || m.metadata.dateSent.getTime() < since) break;
        out.push(m);
      }
      return out.reverse();
    }
    const res = await thread.adapter.fetchMessages(thread.id, { limit: THREAD_CONTEXT_MESSAGES });
    return res.messages;
  } catch (err) {
    console.warn("[slack-ai] couldn't read the thread:", err);
    return thread.recentMessages;
  }
}

async function placeName(thread: Thread): Promise<string> {
  if (thread.isDM) return "a direct message with the person asking";
  const info = await thread.channel.fetchMetadata().catch(() => null);
  const name = info?.name?.replace(/^#/, "");
  return name ? `a thread in #${name}` : "a Slack channel thread";
}

/* ---------- Confirm / Cancel ---------- */

async function onConfirm(bot: SlackBot, event: ActionEvent): Promise<void> {
  const nonce = event.value;
  if (!nonce) return;
  const state = bot.getState();
  const pending = await state.get<PendingAction>(pendingKey(nonce));
  const edit = (text: string) => event.adapter.editMessage(event.threadId, event.messageId, { raw: text }).catch(() => {});
  const tell = (text: string) =>
    event.thread?.postEphemeral(event.user, { raw: text }, { fallbackToDM: false }).catch(() => null) ?? Promise.resolve(null);

  const decision = confirmDecision(pending, event.user.userId);
  if (!decision.ok) {
    if (decision.reason === "not_yours") await tell(decisionText(decision));
    else await edit(decisionText(decision));
    return;
  }
  const p = pending!;

  // One click wins: a double click or a retried delivery finds the claim taken.
  if (!(await state.setIfNotExists(claimKey(nonce), 1, CONFIRM_TTL_MS))) return;
  await state.delete(pendingKey(nonce));

  if (event.actionId === ACTION_AI_CANCEL) {
    await edit(`${p.summary}\n_Cancelled — nothing was changed._`);
    return;
  }

  try {
    // Who they are and what they may do now, not when they asked.
    const { caller, scope } = await askerFor(bot, p.workspaceId, event.user.userId);
    if (!caller.userId || caller.userId !== p.appUserId) {
      await edit(`${p.summary}\n_Not changed: your Slack account isn't linked to the same Internal account any more._`);
      return;
    }
    const me = { id: caller.userId, name: caller.name ?? "Someone" };
    const who = escapeMrkdwn(me.name);
    if (p.kind === "update_task") {
      const res = await applyTaskUpdate(p.plan, p.workspaceId, me, scope);
      if (!res.ok) {
        await edit(`${p.summary}\n_Not changed: ${escapeMrkdwn(res.error)}_`);
        return;
      }
      await edit(`${p.summary}\n:white_check_mark: _Done by ${who}._`);
      const snap = await loadSnapshot(p.workspaceId, "issue", p.plan.issueId);
      if (snap && event.thread) await event.thread.post(recordMessage(snap, `*${who}* changed this from Slack`, appUrl())).catch(() => {});
      return;
    }
    if (!caller.isAdmin) {
      await edit(`${p.summary}\n_Not logged: prospects are only available to workspace admins._`);
      return;
    }
    const res = await applyTouch(p.plan, p.workspaceId, me, appUrl());
    if (!res.ok) {
      await edit(`${p.summary}\n_Not logged: ${escapeMrkdwn(res.error)}_`);
      return;
    }
    await edit(`${p.summary}\n:white_check_mark: _Logged by ${who}._`);
    if (res.card && event.thread) await event.thread.post(res.card).catch(() => {});
  } catch (err) {
    console.error("[slack-ai] confirmed change failed:", err);
    await edit(`${p.summary}\n_Something went wrong and the change may not have been made. Check in Internal._`);
  }
}
