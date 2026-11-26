import { KIND_LABEL, type ProspectKind } from "./schema";
import { isAssignedTo } from "./stats";

/**
 * The Inbox pings an owner change sends, Linear-style: whoever is handed a
 * prospect hears about it. One ping per new owner per batch, so a share-out
 * of 30 reads "Sandeep assigned you 30 valuers", not thirty lines. Pure: the
 * caller passes the members and sends what comes back.
 */

/** One row whose `assigned` cell the write set. */
export type OwnerChange = { id: string; before: Record<string, string>; owner: string };

export type Member = { id: string; name: string | null; email: string | null };

export type Ping = { userId: string; title: string; body: string; href: string };

const first = (name: string) => name.trim().split(/\s+/)[0] ?? "";

const sameOwner = (a: string, b: string) => {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  return x === y || (Boolean(x) && Boolean(y) && x.split(/\s+/)[0] === y.split(/\s+/)[0]);
};

const recordName = (row: Record<string, string>) => row.name || [row.institution, row.contact_person].filter(Boolean).join(" · ") || "a prospect";

/** Who an `assigned` cell means: the one member it matches, or null when none or several do. */
export function memberFor(owner: string, members: Member[]): Member | null {
  const hits = members.filter((m) => isAssignedTo(owner, (m.name || m.email || "").trim()));
  return hits.length === 1 ? hits[0] : null;
}

export function planPings(kind: ProspectKind, changes: OwnerChange[], members: Member[], actor: { userId: string | null; name: string }): Ping[] {
  const byUser = new Map<string, { member: Member; rows: OwnerChange[] }>();
  for (const c of changes) {
    if (!c.owner.trim() || sameOwner(c.before.assigned ?? "", c.owner)) continue;
    const m = memberFor(c.owner, members);
    // Taking a record yourself needs no ping.
    if (!m || m.id === actor.userId) continue;
    const entry = byUser.get(m.id) ?? { member: m, rows: [] };
    entry.rows.push(c);
    byUser.set(m.id, entry);
  }
  const by = first(actor.name);
  return [...byUser.values()].map(({ member, rows }) => {
    if (rows.length === 1) {
      const row = rows[0].before;
      const city = row.city || row.state || "";
      return {
        userId: member.id,
        title: by ? `${by} assigned you ${recordName(row)}` : `You were assigned ${recordName(row)}`,
        body: `${KIND_LABEL[kind].one}${city ? ` · ${city}` : ""}`,
        href: `/prospects?${new URLSearchParams({ rec: `${kind}:${rows[0].id}` })}`,
      };
    }
    const names = rows.slice(0, 3).map((r) => recordName(r.before));
    const more = rows.length - names.length;
    const what = `${rows.length} ${KIND_LABEL[kind].many.toLowerCase()}`;
    return {
      userId: member.id,
      title: by ? `${by} assigned you ${what}` : `You were assigned ${what}`,
      body: `${names.join(", ")}${more ? ` and ${more} more` : ""}`,
      href: "/prospects?tab=list&owner=me",
    };
  });
}
