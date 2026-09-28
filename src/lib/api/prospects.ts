import "server-only";

import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import type { z } from "zod";

import { db } from "@/db";
import { users } from "@/db/schema";
import { getMembers } from "@/lib/data";
import { PROSPECTS_TAG } from "@/lib/prospects/read";
import type { ProspectKind } from "@/lib/prospects/schema";
import { parseKind } from "@/lib/prospects/views";
import type { ApiAuth } from "./auth";
import { ApiInputError } from "./errors";

/**
 * What the prospects API routes share: who the caller is as the sheet names
 * people, and how an API write expires the web's cached workbook.
 */

/** The caller's name as the web's server actions resolve it (name, else email), or null for a key with no member. */
export async function memberName(auth: ApiAuth): Promise<string | null> {
  if (!auth.userId) return null;
  const [u] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, auth.userId)).limit(1);
  if (!u) return null;
  return (u.name || u.email || "Unknown").trim();
}

/** Writes signed with a person's name — a logged call, "assign to me" — need a member behind the key. */
export async function requireMemberName(auth: ApiAuth): Promise<string> {
  const name = await memberName(auth);
  if (!name) throw new ApiInputError("This key isn't tied to a workspace member, so it can't log touches or take records. Sign in to the app as yourself.", 403);
  return name;
}

/** Everyone in the workspace, by the name the team writes in `assigned`. */
export async function teamNames(workspaceId: string): Promise<string[]> {
  const members = await getMembers(workspaceId);
  return members.map((m) => (m.name || m.email || "").trim()).filter(Boolean);
}

/**
 * Route handlers can't call updateTag, so an API write expires the workbook
 * with revalidateTag(..., { expire: 0 }) — the next read waits for the sheet,
 * exactly as the web's updateTag does.
 */
export function invalidateProspects(): void {
  revalidateTag(PROSPECTS_TAG, { expire: 0 });
}

/**
 * A record ID from the path. Registration numbers carry slashes
 * (IBBI/RV/02/2019/1), so clients send them percent-encoded; decoding a
 * second time is a no-op on an ID that has no `%` in it.
 */
export function recordId(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

export function kindOr404(v: string): ProspectKind {
  const k = parseKind(v);
  if (!k) throw new ApiInputError("No such prospect type. Use valuer, firm, rvo, panel or bank.", 404);
  return k;
}

/** Validate a body, turning the first problem into a 400 the caller can act on. */
export function parseInput<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const r = schema.safeParse(value);
  if (r.success) return r.data;
  const issue = r.error.issues[0];
  const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
  throw new ApiInputError(`${where}${issue?.message ?? "Invalid input."}`, 400);
}
