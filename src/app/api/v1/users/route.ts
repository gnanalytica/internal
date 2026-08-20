import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiAddMember } from "@/lib/api/dept-ops";
import { getMembersWithRole } from "@/lib/data";

/**
 * Workspace members — how an agent resolves a name to an `assigneeId`.
 *
 * `?email=` narrows to one person. An integration filing work on someone's
 * behalf knows them by address, not by our uuids, and needs to tell a human
 * "this owner has no account here" BEFORE filing — so it needs a direct
 * lookup, not a full directory fetch it has to scan client-side.
 *
 * Always scoped to the key's workspace, never the global `users` table:
 * `users.email` is globally unique, so matching on email alone would let a
 * key for workspace A resolve a member of workspace B.
 */
export const GET = withApiAuth(async (req, auth) => {
  const members = await getMembersWithRole(auth.workspaceId);
  const email = new URL(req.url).searchParams.get("email")?.trim().toLowerCase();
  const scoped = email
    ? members.filter((m) => (m.email ?? "").toLowerCase() === email)
    : members;
  return ok({
    data: scoped.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      title: m.title ?? null,
      entity: m.entity ?? null,
    })),
    count: scoped.length,
  });
});

/** Add someone to the workspace, creating the user when the email is new. */
export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<Parameters<typeof apiAddMember>[1]>(req);
  const id = await apiAddMember(auth.workspaceId, body);
  return ok({ data: { id } }, 201);
});
