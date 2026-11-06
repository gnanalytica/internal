"use server";

import { and, eq, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { feedback, projects } from "@/db/schema";
import { wsTag } from "@/lib/cache-tags";
import { getFeedback, getWorkspace } from "@/lib/data";
import { themeNames, themeToSave, titleFromQuote } from "@/lib/product-roadmap";
import { PROSPECTS_PRODUCT_KEY } from "@/lib/prospects/schema";
import { SEND_SOURCES, sentByRef } from "@/lib/send-to-product";
import { emitSlackEvent } from "@/lib/slack/notify";

/**
 * "Send to Product" writes: one remark from a touch or a request becomes a
 * feedback item on the project's Product › Feedback tab. See
 * src/lib/send-to-product.ts for the rules.
 */

/** What a send-to-product button needs to know: where it sends, the themes to pick from, what's already there. */
export type ProductFeedbackContext = {
  projectId: string;
  themes: string[];
  /** Source ref → feedback id, for everything already sent. */
  sent: Record<string, string>;
};

async function projectIn(workspaceId: string, where: { id: string } | { key: string }): Promise<string | null> {
  const [p] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), "id" in where ? eq(projects.id, where.id) : eq(projects.key, where.key)))
    .limit(1);
  return p?.id ?? null;
}

/** The context for one project, or for the prospects' product (Valytica) when none is named. Null if there is no such project. */
export async function getProductFeedbackContext(projectId?: string | null): Promise<ProductFeedbackContext | null> {
  const ws = await getWorkspace();
  const id = await projectIn(ws.id, projectId ? { id: projectId } : { key: PROSPECTS_PRODUCT_KEY });
  if (!id) return null;
  const items = await getFeedback(ws.id, id);
  return { projectId: id, themes: themeNames(items), sent: sentByRef(items) };
}

const sendSchema = z.object({
  projectId: z.string().uuid(),
  body: z.string().trim().min(1, "Nothing to send: they didn't say anything.").max(5000),
  contact: z.string().trim().max(300).nullable(),
  source: z.enum(SEND_SOURCES),
  sourceRef: z.string().trim().min(1).max(300),
  theme: z.string().max(120).nullable().optional(),
});

export type SendToProductInput = z.input<typeof sendSchema>;

/**
 * Add what someone said to the project's feedback, once. If it was sent
 * before (same source ref), the item already there is returned untouched.
 * Two single statements rather than a transaction — the Neon HTTP driver has
 * none — and the unique (workspace, source_ref) index means two clicks racing
 * still make one item.
 */
export async function sendToProduct(input: SendToProductInput): Promise<{ id: string; projectId: string; created: boolean }> {
  const ws = await getWorkspace();
  const v = sendSchema.parse(input);
  const find = async () => {
    const [f] = await db
      .select({ id: feedback.id, projectId: feedback.projectId })
      .from(feedback)
      .where(and(eq(feedback.workspaceId, ws.id), eq(feedback.sourceRef, v.sourceRef)))
      .limit(1);
    return f ? { id: f.id, projectId: f.projectId ?? v.projectId, created: false } : null;
  };
  const before = await find();
  if (before) return before;

  if (!(await projectIn(ws.id, { id: v.projectId }))) throw new Error("That project isn't in this workspace.");
  const themes = themeNames(await getFeedback(ws.id, v.projectId));
  const [made] = await db
    .insert(feedback)
    .values({
      workspaceId: ws.id,
      projectId: v.projectId,
      title: titleFromQuote(v.body),
      body: v.body,
      source: v.source,
      status: "new",
      contact: v.contact || null,
      theme: themeToSave(v.theme, themes),
      sourceRef: v.sourceRef,
      sortKey: `z${Date.now()}`,
    })
    .onConflictDoNothing({ target: [feedback.workspaceId, feedback.sourceRef], where: sql`source_ref is not null` })
    .returning({ id: feedback.id });
  updateTag(wsTag(ws.id, "feedback"));
  if (made) {
    emitSlackEvent(ws.id, { type: "feedback.created", recordId: made.id });
    return { id: made.id, projectId: v.projectId, created: true };
  }
  const raced = await find();
  if (!raced) throw new Error("Couldn't send that to Product. Try again.");
  return raced;
}
