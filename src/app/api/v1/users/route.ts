import { ok, withApiAuth } from "@/lib/api/http";
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
