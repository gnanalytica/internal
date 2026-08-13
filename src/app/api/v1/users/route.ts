import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiAddMember } from "@/lib/api/dept-ops";
import { getMembersWithRole } from "@/lib/data";

/** Workspace members — how an agent resolves a name to an `assigneeId`. */
export const GET = withApiAuth(async (_req, auth) => {
  const members = await getMembersWithRole(auth.workspaceId);
  return ok({
    data: members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      title: m.title ?? null,
      entity: m.entity ?? null,
    })),
    count: members.length,
  });
});

/** Add someone to the workspace, creating the user when the email is new. */
export const POST = withApiAuth(async (req, auth) => {
  const body = await readJson<Parameters<typeof apiAddMember>[1]>(req);
  const id = await apiAddMember(auth.workspaceId, body);
  return ok({ data: { id } }, 201);
});
