import { and, eq, gte, isNull } from "drizzle-orm";

import { db } from "@/db";
import { notifications, users, workspaceMembers, workspaces } from "@/db/schema";
import { buildDigest, digestSubject, digestText } from "@/lib/digest";
import { appBaseUrl, isEmailConfigured, sendEmail } from "@/lib/email";

/**
 * Daily digest of everything a member missed.
 *
 * Cron rather than per-event email on purpose: a team this size that gets a
 * message per comment learns to filter the sender, and then the one that
 * mattered gets filtered too.
 *
 * Only unread notifications count — anything already seen in the inbox is not
 * news — and reading them is not marking them read, so the inbox stays the
 * source of truth.
 *
 * No route segment config here: this project runs Cache Components, under which
 * everything is dynamic by default and `dynamic = "force-dynamic"` is a build
 * error rather than a no-op.
 */

/** How far back a digest looks. Matches the daily schedule, with slack for retries. */
const WINDOW_MS = 36 * 60 * 60 * 1000;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Vercel signs cron invocations with CRON_SECRET; without one configured the
  // route stays closed rather than open, so an unset env var can't leak a
  // mail-sending endpoint to the internet.
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!isEmailConfigured()) {
    return Response.json(
      { skipped: "No email provider configured (RESEND_API_KEY, EMAIL_FROM)." },
      { status: 200 },
    );
  }

  const since = new Date(Date.now() - WINDOW_MS);
  const baseUrl = appBaseUrl();

  const rows = await db
    .select({
      workspaceId: notifications.workspaceId,
      workspaceName: workspaces.name,
      userId: notifications.userId,
      email: users.email,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      createdAt: notifications.createdAt,
      issueId: notifications.issueId,
      pageId: notifications.pageId,
    })
    .from(notifications)
    .innerJoin(users, eq(users.id, notifications.userId))
    .innerJoin(workspaces, eq(workspaces.id, notifications.workspaceId))
    // A member removed from the workspace keeps their rows but stops being a
    // recipient.
    .innerJoin(
      workspaceMembers,
      and(
        eq(workspaceMembers.workspaceId, notifications.workspaceId),
        eq(workspaceMembers.userId, notifications.userId),
      ),
    )
    .where(and(isNull(notifications.read), gte(notifications.createdAt, since)));

  // Group by recipient — one email per person, not one per workspace event.
  const byUser = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = `${r.workspaceId}:${r.userId}`;
    const list = byUser.get(key) ?? [];
    list.push(r);
    byUser.set(key, list);
  }

  let sent = 0;
  for (const list of byUser.values()) {
    const digest = buildDigest(list);
    if (digest.total === 0) continue;
    const ok = await sendEmail({
      to: list[0].email,
      subject: digestSubject(digest, list[0].workspaceName),
      text: `${digestText(digest, baseUrl)}\n\n${baseUrl}/inbox`,
    });
    if (ok) sent += 1;
  }

  return Response.json({ recipients: byUser.size, sent });
}
