import "server-only";

import { cardToBlockKit } from "@chat-adapter/slack";
import type { CardElement } from "chat";
import { and, count, eq, isNull, notInArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { deals, issues, pages, projects, users } from "@/db/schema";
import { actorForSlack, type SlackActor } from "../actor";
import { escapeMrkdwn, recordCard, type RecordSnapshot } from "../cards";
import { appUrl } from "../config";
import { appHosts, isConfidentialLink, parseAppLink, unfurlDetail, type AppLink, type LinkSharer } from "../links";
import { findIssueByKey, issueMeta, projectIsConfidential, prospectByRef } from "../lookups";
import { onSlackEvent } from "../raw";
import { loadSnapshot } from "../records";
import type { SlackBot } from "../types";
import { excerpt, previewCard, prospectsCard, taskHeadline, titleOnlyCard } from "../views";

/**
 * Link previews for internal.gnanalytica.com URLs pasted in Slack
 * (`link_shared`; the manifest lists the domain): tasks, projects, doc pages,
 * Valytica prospects and deals, as compact cards. A task's preview carries the
 * status select and Assign to me (handled in notifications-actions.ts).
 *
 * A preview is seen by the whole channel, so what it shows depends on who
 * shared the link (links.ts `unfurlDetail`): a Slack user the app can't place
 * gets the title only, and Sales, Finance and confidential projects unfurl as
 * a bare title unless the sharer is a linked admin.
 *
 * The Chat SDK's Slack adapter doesn't route `link_shared`, so raw.ts hands it here.
 */

type Preview = {
  /** The record's workspace; null for prospects, which live in the sheet. */
  workspaceId: string | null;
  title: string;
  url: string;
  confidential: boolean;
  full: () => Promise<CardElement | null>;
};

const creator = alias(users, "creator");

async function issuePreview(link: Extract<AppLink, { type: "issue" | "issue_key" }>, url: string, actor: SlackActor | null): Promise<Preview | null> {
  let id: string | null = null;
  let workspaceId: string | null = null;
  if (link.type === "issue") {
    const [r] = await db.select({ ws: issues.workspaceId }).from(issues).where(eq(issues.id, link.id)).limit(1);
    if (r) [id, workspaceId] = [link.id, r.ws];
  } else if (actor) {
    const r = await findIssueByKey(actor.workspaceId, link.key);
    if (r) [id, workspaceId] = [r.id, actor.workspaceId];
  }
  if (!id || !workspaceId) return null;
  const snap = await loadSnapshot(workspaceId, "issue", id);
  if (!snap) return null;
  return {
    workspaceId,
    title: snap.title,
    url,
    confidential: await projectIsConfidential(snap.projectId),
    full: async () => {
      const m = await issueMeta(snap.id);
      return recordCard(snap, taskHeadline(m?.creatorName ?? null, m?.updatedAt ?? null), appUrl());
    },
  };
}

const AREA_LABEL: Record<string, string> = {
  tasks: "Tasks",
  engineering: "Engineering",
  product: "Product",
  sales: "Sales",
  marketing: "Marketing",
  "customer-success": "Customer Success",
  finance: "Finance",
  strategy: "Strategy",
  docs: "Docs",
  cycles: "Cycles",
  milestones: "Milestones",
  analytics: "Analytics",
};

async function projectPreview(link: Extract<AppLink, { type: "project" }>, url: string): Promise<Preview | null> {
  const [p] = await db
    .select({
      workspaceId: projects.workspaceId,
      name: projects.name,
      key: projects.key,
      tagline: projects.tagline,
      description: projects.description,
      confidential: projects.confidential,
      ownerName: users.name,
    })
    .from(projects)
    .leftJoin(users, eq(users.id, projects.ownerId))
    .where(eq(projects.id, link.id))
    .limit(1);
  if (!p) return null;
  const area = link.area ? (AREA_LABEL[link.area] ?? null) : null;
  const title = area ? `${p.name} · ${area}` : p.name;
  return {
    workspaceId: p.workspaceId,
    title,
    url,
    confidential: p.confidential,
    full: async () => {
      const [open] = await db
        .select({ n: count() })
        .from(issues)
        .where(and(eq(issues.projectId, link.id), notInArray(issues.status, ["done", "canceled"])));
      const fields = [
        { label: "Key", value: escapeMrkdwn(p.key) },
        { label: "Owner", value: p.ownerName ? escapeMrkdwn(p.ownerName) : "Open seat" },
        { label: "Open tasks", value: String(open?.n ?? 0) },
      ];
      return previewCard(url, title, excerpt(p.tagline || p.description || "", 160), fields);
    },
  };
}

async function pagePreview(link: Extract<AppLink, { type: "page" }>, url: string): Promise<Preview | null> {
  const [pg] = await db
    .select({
      workspaceId: pages.workspaceId,
      title: pages.title,
      icon: pages.icon,
      text: pages.contentText,
      updatedAt: pages.updatedAt,
      projectId: pages.projectId,
      projectName: projects.name,
      confidential: projects.confidential,
      creatorName: creator.name,
    })
    .from(pages)
    .leftJoin(projects, eq(projects.id, pages.projectId))
    .leftJoin(creator, eq(creator.id, pages.creatorId))
    .where(and(eq(pages.id, link.id), isNull(pages.deletedAt)))
    .limit(1);
  if (!pg) return null;
  const title = `${pg.icon ? `${pg.icon} ` : ""}${pg.title}`;
  return {
    workspaceId: pg.workspaceId,
    title,
    url,
    confidential: Boolean(pg.confidential),
    full: async () =>
      previewCard(url, title, excerpt(pg.text), [
        { label: "Where", value: pg.projectName ? escapeMrkdwn(pg.projectName) : "Company wiki" },
        { label: "Updated", value: pg.updatedAt.toISOString().slice(0, 10) },
        ...(pg.creatorName ? [{ label: "Author", value: escapeMrkdwn(pg.creatorName) }] : []),
      ]),
  };
}

async function dealPreview(link: Extract<AppLink, { type: "deal" }>, url: string): Promise<Preview | null> {
  const [d] = await db
    .select({ ws: deals.workspaceId, name: deals.name, projectId: deals.projectId })
    .from(deals)
    .where(eq(deals.id, link.id))
    .limit(1);
  if (!d) return null;
  return {
    workspaceId: d.ws,
    title: d.name,
    url,
    confidential: true,
    full: async () => {
      const snap: RecordSnapshot | null = await loadSnapshot(d.ws, "deal", link.id);
      return snap ? recordCard({ ...snap, path: new URL(url).pathname + new URL(url).search }, "Deal", appUrl()) : null;
    },
  };
}

async function prospectPreview(link: Extract<AppLink, { type: "prospect" }>, url: string): Promise<Preview | null> {
  const p = await prospectByRef(link.kind, link.id).catch(() => null);
  if (!p) return null;
  return { workspaceId: null, title: p.name, url, confidential: true, full: async () => prospectsCard(p.name, [p], appUrl()) };
}

function previewOf(link: AppLink, url: string, actor: SlackActor | null): Promise<Preview | null> {
  switch (link.type) {
    case "issue":
    case "issue_key":
      return issuePreview(link, url, actor);
    case "project":
      return projectPreview(link, url);
    case "page":
      return pagePreview(link, url);
    case "deal":
      return dealPreview(link, url);
    case "prospect":
      return prospectPreview(link, url);
  }
}

/** The card for one link as this sharer may see it, or null to leave Slack's default. */
async function unfurlOne(raw: string, actor: SlackActor | null, hosts: string[]): Promise<CardElement | null> {
  const link = parseAppLink(raw, hosts);
  if (!link) return null;
  const preview = await previewOf(link, raw, actor);
  if (!preview) return null;
  // A record in another workspace than the sharer's is shown as if they weren't linked.
  const theirs = actor && (preview.workspaceId === null || preview.workspaceId === actor.workspaceId);
  const sharer: LinkSharer = theirs ? { linked: true, isAdmin: actor.isAdmin } : { linked: false };
  const detail = unfurlDetail(sharer, isConfidentialLink(link, preview.confidential));
  if (detail === "title") return titleOnlyCard(preview.url, preview.title);
  return (await preview.full()) ?? titleOnlyCard(preview.url, preview.title);
}

export function register(bot: SlackBot): void {
  onSlackEvent(bot, "link_shared", async (event) => {
    const e = event as {
      channel?: string;
      user?: string;
      message_ts?: string;
      unfurl_id?: string;
      source?: string;
      links?: { url?: string }[];
    };
    const urls = [...new Set((e.links ?? []).map((l) => l.url).filter((u): u is string => Boolean(u)))].slice(0, 5);
    if (urls.length === 0) return;
    const hosts = appHosts(appUrl());
    const actor = e.user ? await actorForSlack(bot, e.user).catch(() => null) : null;

    const unfurls: Record<string, { blocks: unknown[] }> = {};
    await Promise.all(
      urls.map(async (u) => {
        const card = await unfurlOne(u, actor, hosts).catch((err) => {
          console.warn("[slack] couldn't build a preview:", err);
          return null;
        });
        if (card) unfurls[u] = { blocks: cardToBlockKit(card) };
      }),
    );
    if (Object.keys(unfurls).length === 0) return;

    const client = bot.getAdapter("slack").webClient;
    // A link still in the composer is identified by unfurl_id + source; a posted one by channel + ts.
    const target =
      e.unfurl_id && e.source ? { unfurl_id: e.unfurl_id, source: e.source as "composer" | "conversations_history" } : { channel: e.channel ?? "", ts: e.message_ts ?? "" };
    await client.chat
      .unfurl({ ...target, unfurls } as unknown as Parameters<typeof client.chat.unfurl>[0])
      .catch((err) => console.warn("[slack] chat.unfurl failed:", err));
  });
}
