import { getMyRole, getProjects, getWorkspace } from "@/lib/data";
import { prospectHref, salesProjectId, type ProspectHit } from "@/lib/prospects/access";
import { loadProspectSnapshot } from "@/lib/prospects/read";
import { KIND_LABEL } from "@/lib/prospects/schema";
import { everyRow } from "@/lib/prospects/views";

const LIMIT = 6;

/**
 * Prospects matching a search, for the ⌘K palette. A request of its own,
 * beside the palette's workspace search, so a slow or failing sheet read
 * never holds up or breaks the task and page results. Only for people who
 * may see Sales, by the same checks as the Sales page. Session-authenticated
 * by `proxy.ts`.
 */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().toLowerCase();
  const ws = await getWorkspace();
  if (q.length < 2) return Response.json({ data: [] });
  const [projects, role] = await Promise.all([getProjects(ws.id), getMyRole(ws.id)]);
  const projectId = salesProjectId(projects, role);
  if (!projectId) return Response.json({ data: [] });
  try {
    const rows = everyRow(await loadProspectSnapshot(), "all").filter((r) => `${r.name} ${r.id} ${r.city}`.toLowerCase().includes(q));
    // Names that start with the query first, then the rest, each by name.
    rows.sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name));
    const data: ProspectHit[] = rows.slice(0, LIMIT).map((r) => ({ key: `${r.kind}:${r.id}`, title: r.name, subtitle: [KIND_LABEL[r.kind].one, r.city || r.state].filter(Boolean).join(" · "), href: prospectHref(projectId, r) }));
    return Response.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[search] prospects unavailable", err);
    return Response.json({ data: [] });
  }
}
