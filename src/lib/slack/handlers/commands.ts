import "server-only";

import type { ModalSubmitEvent } from "chat";
import { eq } from "drizzle-orm";
import { after } from "next/server";

import { db } from "@/db";
import { issues } from "@/db/schema";
import { apiCreateIssue } from "@/lib/api/ops";
import { invalidateProspects } from "@/lib/api/prospects";
import { canSeeProject } from "@/lib/api/scope-rules";
import { subscribe } from "@/lib/notify";
import { logProspectTouch } from "@/lib/prospects/service";
import { touchSchema } from "@/lib/prospects/touch";
import { actorForSlack, actorIn, scopeOf, type SlackActor } from "../actor";
import { escapeMrkdwn, issueIdentifier, recordMessage } from "../cards";
import { appUrl } from "../config";
import { parseProspectRef } from "../links";
import {
  findIssueByKey,
  findProspects,
  issueMeta,
  myOpenTasks,
  newTaskChoices,
  searchTasks,
  taskRow,
  workspaceLabelIds,
} from "../lookups";
import { formatIssueKey, mentionedSlackUsers, parseCommand, slackToMarkdown, titleFromText } from "../parse";
import { onSlackInteraction } from "../raw";
import { loadSnapshot } from "../records";
import { respond, tell } from "../reply";
import { commentFromSlack, linkIssueThread, ruleWillPost } from "../threads";
import type { SlackBot } from "../types";
import {
  ACTION_COMMENT,
  ACTION_LOG_TOUCH,
  MODAL_COMMENT,
  MODAL_LOG_TOUCH,
  MODAL_NEW_TASK,
  MODAL_TASK_FROM_MESSAGE,
  SHORTCUT_CREATE_TASK,
  commentModal,
  decodeTouchButton,
  helpText,
  linkAccountText,
  logTouchModal,
  mineCard,
  newTaskModal,
  prospectsCard,
  readNewTaskValues,
  readTouchValues,
  searchResultsCard,
  taskCard,
  taskHeadline,
  type NewTaskValues,
} from "../views";

/**
 * `/internal …`, the modals it opens, and the "Create task" message shortcut
 * (callback id `create_task_from_message`; both declared in
 * slack/manifest.json). Pure parsing and the cards live in parse.ts and
 * views.ts; reads in lookups.ts.
 *
 * Everyone acts as the app user their Slack account is linked to (actor.ts),
 * through the same session-less writes the API uses. Answers are private:
 * a slash command replies on its response URL; after a modal, an ephemeral
 * message where they were, or a DM.
 *
 * Slack gives 3s from a command or click to open a modal, so the handlers that
 * open one read as little as they can first, and modal submissions return at
 * once — the write runs in `after()` and its result is sent privately.
 */

const settingsUrl = () => `${appUrl()}/settings/slack`;

type SlashRaw = { response_url?: string; channel_id?: string; channel_name?: string };

/** "#general", unless it's a DM or a private group Slack names oddly. */
function channelNameOf(raw: SlashRaw): string | null {
  const id = raw.channel_id ?? "";
  const name = raw.channel_name ?? "";
  if (!id || id.startsWith("D") || name === "directmessage" || name === "privategroup") return null;
  return name || null;
}

type ModalMeta = { channel?: string; ts?: string; threadTs?: string; issueId?: string; ref?: string; name?: string };

function meta(event: ModalSubmitEvent): ModalMeta {
  try {
    return event.privateMetadata ? (JSON.parse(event.privateMetadata) as ModalMeta) : {};
  } catch {
    return {};
  }
}

/** Where a modal was opened from, to answer there. */
const whereFrom = (event: ModalSubmitEvent) => event.relatedThread ?? event.relatedChannel ?? null;

/** Run after the modal has closed; failures are told to the person, not lost. */
function later(bot: SlackBot, event: ModalSubmitEvent, what: string, work: () => Promise<void>): void {
  after(() =>
    work().catch(async (err) => {
      console.error(`[slack] ${what} failed:`, err);
      const reason = err instanceof Error && err.name === "ApiInputError" ? ` ${err.message}` : "";
      await tell(bot, event.user.userId, `:warning: Couldn't ${what}.${reason} Try again, or do it in ${appUrl()}.`, whereFrom(event));
    }),
  );
}

/* ---------- creating tasks ---------- */

/** Create the task the modal describes, as the actor. */
async function createTask(actor: SlackActor, v: NewTaskValues, extra: { externalId?: string; externalUrl?: string } = {}) {
  const scope = await scopeOf(actor);
  const projectId = v.projectId && canSeeProject(scope, v.projectId) ? v.projectId : null;
  const labelIds = await workspaceLabelIds(actor.workspaceId, v.labelIds);
  const res = await apiCreateIssue(actor.workspaceId, actor.id, {
    title: v.title,
    description: v.description || undefined,
    projectId,
    assigneeId: v.assigneeId,
    priority: v.priority,
    status: v.status,
    labelIds,
    ...(extra.externalId ? { externalSource: "slack", externalId: extra.externalId, externalUrl: extra.externalUrl } : {}),
  });
  await subscribe(actor.workspaceId, actor.id, "issue", res.id);
  const snap = await loadSnapshot(actor.workspaceId, "issue", res.id);
  return { ...res, snap, projectId };
}

export function register(bot: SlackBot): void {
  /* ----- /internal ----- */

  bot.onSlashCommand("/internal", async (event) => {
    const raw = (event.raw ?? {}) as SlashRaw;
    const reply = (m: Parameters<typeof respond>[1]) => respond(raw.response_url, m);
    const cmd = parseCommand(event.text);
    if (cmd.kind === "help") {
      await reply(helpText());
      return;
    }

    const actor = await actorForSlack(bot, event.user.userId);
    if (!actor) {
      await reply(linkAccountText(settingsUrl()));
      return;
    }
    const base = appUrl();

    switch (cmd.kind) {
      case "new": {
        const choices = await newTaskChoices(actor.workspaceId, await scopeOf(actor));
        const opened = await event
          .openModal(
            newTaskModal({
              callbackId: MODAL_NEW_TASK,
              title: cmd.title,
              description: "",
              ...choices,
              projectId: choices.defaultProjectId,
              assigneeId: actor.id,
              channelName: channelNameOf(raw),
              privateMetadata: JSON.stringify({ channel: raw.channel_id ?? "" }),
            }),
          )
          .catch((err) => {
            console.warn("[slack] couldn't open the new-task modal:", err);
            return undefined;
          });
        if (!opened) await reply(`Couldn't open the form in time — try again, or create it in ${base}/issues.`);
        return;
      }
      case "search": {
        const rows = await searchTasks(actor.workspaceId, cmd.query, await scopeOf(actor));
        await reply(searchResultsCard(cmd.query, rows, base));
        return;
      }
      case "mine": {
        const rows = await myOpenTasks(actor.workspaceId, actor.id, await scopeOf(actor));
        await reply(mineCard(rows, base));
        return;
      }
      case "issue": {
        const found = await findIssueByKey(actor.workspaceId, cmd.key);
        const scope = await scopeOf(actor);
        const snap = found && canSeeProject(scope, found.projectId) ? await loadSnapshot(actor.workspaceId, "issue", found.id) : null;
        if (!snap) {
          await reply(`No task ${formatIssueKey(cmd.key)}.`);
          return;
        }
        const m = await issueMeta(snap.id);
        await reply(taskCard(snap, taskHeadline(m?.creatorName ?? null, m?.updatedAt ?? null), base));
        return;
      }
      case "prospect": {
        // As in the mobile API, any member works prospects (Valytica's
        // top-of-funnel is shared); this answer is private to them.
        const matches = await findProspects(cmd.query);
        await reply(prospectsCard(cmd.query, matches, base));
        return;
      }
    }
  });

  bot.onModalSubmit(MODAL_NEW_TASK, async (event) => {
    const read = readNewTaskValues(event.values);
    if (!read.ok) return { action: "errors", errors: read.errors };
    const v = read.value;
    const { channel } = meta(event);
    later(bot, event, "create the task", async () => {
      const actor = await actorForSlack(bot, event.user.userId);
      if (!actor) {
        await tell(bot, event.user.userId, linkAccountText(settingsUrl()), whereFrom(event));
        return;
      }
      const created = await createTask(actor, v);
      if (!created.snap) return;
      const base = appUrl();
      let note = "";
      if (v.post && channel) {
        if (await ruleWillPost(actor.workspaceId, channel, "issue.created", created.projectId)) {
          note = " This channel's Slack rule posts it here too.";
        } else {
          const headline = `*${escapeMrkdwn(actor.name)}* created a task`;
          const sent = await bot
            .channel(`slack:${channel}`)
            .post(recordMessage(created.snap, headline, base))
            .catch(() => null);
          if (sent) {
            const ts = bot.getAdapter("slack").decodeThreadId(sent.threadId).threadTs || sent.id;
            await linkIssueThread(actor.workspaceId, created.id, channel, ts);
          } else {
            note = " I couldn't post in this channel — invite me with `/invite @Internal`.";
          }
        }
      }
      await tell(
        bot,
        event.user.userId,
        taskCard(created.snap, `:white_check_mark: You created this task.${note}`, base),
        whereFrom(event),
      );
    });
  });

  /* ----- "Create task" on a message ----- */

  onSlackInteraction(bot, "message_action", async (payload) => {
    if (payload.callback_id !== SHORTCUT_CREATE_TASK) return;
    const p = payload as {
      trigger_id?: string;
      response_url?: string;
      user?: { id?: string };
      channel?: { id?: string };
      message?: { ts?: string; thread_ts?: string; text?: string };
    };
    const slackUserId = p.user?.id;
    const channel = p.channel?.id;
    const ts = p.message?.ts;
    if (!slackUserId || !channel || !ts || !p.trigger_id) return;

    const actor = await actorForSlack(bot, slackUserId);
    if (!actor) {
      await respond(p.response_url, linkAccountText(settingsUrl()));
      return;
    }
    const text = p.message?.text ?? "";
    const mentions = mentionedSlackUsers(text).slice(0, 5);
    const [choices, names] = await Promise.all([
      scopeOf(actor).then((s) => newTaskChoices(actor.workspaceId, s)),
      Promise.all(mentions.map(async (id) => [id, (await bot.getUser(id).catch(() => null))?.fullName ?? ""] as const)),
    ]);
    const markdown = slackToMarkdown(text, new Map(names.filter(([, n]) => n)));
    const opened = await bot
      .getAdapter("slack")
      .openModal(
        p.trigger_id,
        newTaskModal({
          callbackId: MODAL_TASK_FROM_MESSAGE,
          title: titleFromText(markdown),
          description: markdown,
          ...choices,
          projectId: choices.defaultProjectId,
          assigneeId: actor.id,
          channelName: null,
          privateMetadata: JSON.stringify({ channel, ts, threadTs: p.message?.thread_ts || ts }),
          note: "A link back to this message is added to the description, and the thread stays in sync with the task's comments.",
        }),
      )
      .catch((err) => {
        console.warn("[slack] couldn't open the create-task modal:", err);
        return undefined;
      });
    if (!opened) await respond(p.response_url, "Couldn't open the form in time — try the shortcut again.");
  });

  bot.onModalSubmit(MODAL_TASK_FROM_MESSAGE, async (event) => {
    const read = readNewTaskValues(event.values);
    if (!read.ok) return { action: "errors", errors: read.errors };
    const { channel, ts, threadTs } = meta(event);
    if (!channel || !ts) return;
    later(bot, event, "create the task", async () => {
      const actor = await actorForSlack(bot, event.user.userId);
      if (!actor) {
        await tell(bot, event.user.userId, linkAccountText(settingsUrl()));
        return;
      }
      const slack = bot.getAdapter("slack");
      const link = await slack.webClient.chat
        .getPermalink({ channel, message_ts: ts })
        .then((r) => r.permalink ?? null)
        .catch(() => null);
      const v = read.value;
      const description = link ? `${v.description}\n\n[From Slack](${link})`.trim() : v.description;
      // One task per message: pressing Create twice (or a retried submit) finds the first.
      const created = await createTask(actor, { ...v, description }, { externalId: `${channel}:${ts}`, externalUrl: link ?? undefined });
      if (!created.snap) return;
      const root = threadTs || ts;
      await linkIssueThread(actor.workspaceId, created.id, channel, root);
      const headline = created.created
        ? `*${escapeMrkdwn(actor.name)}* made this a task. Replies here sync with its comments.`
        : "This message is already a task.";
      const posted = await bot
        .thread(slack.encodeThreadId({ channel, threadTs: root }))
        .post(recordMessage(created.snap, headline, appUrl()))
        .catch(() => null);
      if (!posted)
        await tell(
          bot,
          event.user.userId,
          taskCard(created.snap, ":white_check_mark: Task created. Invite me to that channel (`/invite @Internal`) to keep its thread in sync.", appUrl()),
        );
    });
  });

  /* ----- Comment (on task cards from /internal) ----- */

  bot.onAction(ACTION_COMMENT, async (event) => {
    const id = event.value;
    if (!id) return;
    const [row] = await db.select({ title: issues.title, workspaceId: issues.workspaceId }).from(issues).where(eq(issues.id, id)).limit(1);
    if (!row) return;
    const t = await taskRow(row.workspaceId, id);
    await event.openModal(commentModal(id, t ? `${issueIdentifier(t)} · ${t.title}` : row.title));
  });

  bot.onModalSubmit(MODAL_COMMENT, async (event) => {
    const body = (event.values.body ?? "").trim();
    if (!body) return { action: "errors", errors: { body: "Write something first." } };
    const { issueId } = meta(event);
    if (!issueId) return;
    later(bot, event, "add the comment", async () => {
      const [issue] = await db
        .select({ title: issues.title, workspaceId: issues.workspaceId, projectId: issues.projectId })
        .from(issues)
        .where(eq(issues.id, issueId))
        .limit(1);
      if (!issue) return;
      const actor = await actorIn(bot, issue.workspaceId, event.user.userId);
      if (!actor) {
        await tell(bot, event.user.userId, linkAccountText(settingsUrl()), whereFrom(event));
        return;
      }
      if (!canSeeProject(await scopeOf(actor), issue.projectId)) return;
      await commentFromSlack({ workspaceId: issue.workspaceId, issueId, issueTitle: issue.title, author: actor, body });
      await tell(bot, event.user.userId, ":speech_balloon: Comment added.", whereFrom(event));
    });
  });

  /* ----- Log a touch (on prospect cards) ----- */

  bot.onAction(ACTION_LOG_TOUCH, async (event) => {
    const p = decodeTouchButton(event.value);
    if (!p) return;
    await event.openModal(logTouchModal(p));
  });

  bot.onModalSubmit(MODAL_LOG_TOUCH, async (event) => {
    const read = readTouchValues(event.values);
    if (!read.ok) return { action: "errors", errors: read.errors };
    const { ref, name } = meta(event);
    const target = ref ? parseProspectRef(ref) : null;
    if (!target) return;
    later(bot, event, "log the touch", async () => {
      const actor = await actorForSlack(bot, event.user.userId);
      if (!actor) {
        await tell(bot, event.user.userId, linkAccountText(settingsUrl()), whereFrom(event));
        return;
      }
      const input = touchSchema.safeParse({
        kind: target.kind,
        id: target.id,
        name: name ?? "",
        ...read.value,
        durationMin: null,
        fields: {},
      });
      if (!input.success) throw new Error(input.error.issues[0]?.message ?? "Invalid touch.");
      const by = (actor.name || actor.email).trim();
      const res = await logProspectTouch(input.data, by, invalidateProspects, { workspaceId: actor.workspaceId, userId: actor.id });
      await tell(
        bot,
        event.user.userId,
        res.ok
          ? `:white_check_mark: Logged a ${read.value.channel.toLowerCase()} with *${escapeMrkdwn(name ?? target.id)}* — ${escapeMrkdwn(read.value.outcome)}, now *${escapeMrkdwn(read.value.statusAfter)}*.`
          : `:warning: Couldn't log it: ${escapeMrkdwn(res.message)}`,
        whereFrom(event),
      );
    });
  });
}
