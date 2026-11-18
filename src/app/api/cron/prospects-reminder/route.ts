import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { projects, workspaces } from "@/db/schema";
import { teamNames } from "@/lib/api/prospects";
import { appBaseUrl } from "@/lib/email";
import { isGoogleConfigured } from "@/lib/prospects/google-auth";
import { loadProspectSnapshot } from "@/lib/prospects/read";
import { buildReminder, reminderText } from "@/lib/prospects/reminder";
import { PROSPECTS_PRODUCT_KEY } from "@/lib/prospects/schema";
import { todayIST } from "@/lib/prospects/stats";
import { everyRow } from "@/lib/prospects/views";
import { notifySlack } from "@/lib/slack";

/**
 * Morning Slack nudge (~9:00 IST): each person's prospect follow-ups due today
 * or overdue, with a link to Your day. The aim is the habit of opening
 * Your day every morning, so it posts nothing on a day when nothing is due.
 *
 * Slack is wired as a per-workspace Incoming Webhook, which can only post to
 * the channel it was created for — so this is one channel message per
 * workspace with a block per person, not a DM each. No Slack user IDs are
 * stored, so people are named rather than @-mentioned.
 *
 * Only workspaces that have the prospects product (the VAL project) and a
 * connected Slack are posted to: the sheet is one shared workbook, and a
 * workspace that doesn't sell Valytica shouldn't get its pipeline in Slack.
 *
 * Rows are every kind across All India, not just the focus states the Your day
 * page opens on: a dated next step is a commitment wherever the record is.
 * When one falls outside focus the link opens All India so the counts match.
 *
 * No route segment config here: this project runs Cache Components, under which
 * everything is dynamic by default and `dynamic = "force-dynamic"` is a build
 * error rather than a no-op.
 */

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Vercel signs cron invocations with CRON_SECRET; without one configured the
  // route stays closed rather than open, so an unset env var can't leak a
  // Slack-posting endpoint to the internet.
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!isGoogleConfigured()) {
    return Response.json({ skipped: "Google service account is not configured (GOOGLE_SA_EMAIL, GOOGLE_SA_PRIVATE_KEY)." }, { status: 200 });
  }

  const targets = await db
    // The product's id too: the link goes straight to its Sales tab rather
    // than through the /prospects redirect.
    .selectDistinct({ id: workspaces.id, name: workspaces.name, productId: projects.id })
    .from(workspaces)
    .innerJoin(projects, and(eq(projects.workspaceId, workspaces.id), eq(projects.key, PROSPECTS_PRODUCT_KEY)))
    .where(isNotNull(workspaces.slackWebhookUrl));
  if (!targets.length) {
    return Response.json({ skipped: "No workspace with the prospects product has Slack connected." }, { status: 200 });
  }

  let wb;
  try {
    wb = await loadProspectSnapshot();
  } catch (err) {
    return Response.json({ error: `Could not read the prospects sheet: ${err instanceof Error ? err.message : String(err)}` }, { status: 502 });
  }

  const today = todayIST();
  const rows = everyRow(wb, "all");
  const baseUrl = appBaseUrl();

  const results: { workspace: string; people: number; posted: boolean; quiet?: true }[] = [];
  for (const ws of targets) {
    const reminder = buildReminder({ rows, people: await teamNames(ws.id), today });
    const text = reminderText(reminder, `${baseUrl}/projects/${ws.productId}/sales?tab=today`);
    if (!text) {
      results.push({ workspace: ws.name, people: 0, posted: false, quiet: true });
      continue;
    }
    results.push({ workspace: ws.name, people: reminder.people.length, posted: await notifySlack(ws.id, text) });
  }

  return Response.json({ today, workspaces: results, posted: results.filter((r) => r.posted).length });
}
