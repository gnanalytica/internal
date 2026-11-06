/**
 * How the bot turns what a person (or the model) wrote into a record: a task
 * key, a teammate's name, a project, a label. Pure — the database side reads
 * the candidates and these decide which one was meant, or say why none was.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TaskRef = { kind: "id"; id: string } | { kind: "key"; projectKey: string | null; number: number };

/**
 * A task as people refer to it: "VAL-12", "val 12", "#12", a link to
 * /issues/<id>, or the id itself. Null when it isn't any of those.
 */
export function parseTaskRef(raw: string): TaskRef | null {
  const v = raw.trim().replace(/^<|>$/g, "").split("|")[0].trim();
  const fromUrl = v.match(/\/issues\/([0-9a-f-]{36})/i);
  if (fromUrl && UUID.test(fromUrl[1])) return { kind: "id", id: fromUrl[1].toLowerCase() };
  if (UUID.test(v)) return { kind: "id", id: v.toLowerCase() };
  const key = v.match(/^([a-z][a-z0-9]{0,9}?)[\s-]?(\d{1,7})$/i);
  if (key) return { kind: "key", projectKey: key[1].toUpperCase(), number: Number(key[2]) };
  const bare = v.match(/^#?(\d{1,7})$/);
  if (bare) return { kind: "key", projectKey: null, number: Number(bare[1]) };
  return null;
}

export type Match<T> = { ok: true; value: T } | { ok: false; error: string };

export type MemberLike = { id: string; name: string; email: string };

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * A teammate from a name, first name, email or email prefix — or "me". An
 * exact match wins over a partial one; two people who both match are an
 * ambiguity to ask about, never a guess.
 */
export function matchMember<M extends MemberLike>(members: M[], query: string, meId: string | null): Match<M> {
  const q = norm(query.replace(/^@/, ""));
  if (!q) return { ok: false, error: "No person given." };
  if (q === "me" || q === "myself" || q === "i") {
    const me = meId ? members.find((m) => m.id === meId) : undefined;
    return me ? { ok: true, value: me } : { ok: false, error: "I don't know who you are in Internal — link your Slack account first." };
  }
  const exact = members.filter(
    (m) => norm(m.name) === q || norm(m.email) === q || norm(m.email.split("@")[0]) === q || norm(m.name.split(" ")[0]) === q,
  );
  if (exact.length === 1) return { ok: true, value: exact[0] };
  const partial = exact.length > 1 ? exact : members.filter((m) => norm(m.name).includes(q) || norm(m.email).includes(q));
  if (partial.length === 1) return { ok: true, value: partial[0] };
  if (partial.length > 1)
    return { ok: false, error: `"${query}" matches ${partial.map((m) => m.name).join(", ")}. Which one?` };
  return { ok: false, error: `Nobody called "${query}" is in this workspace.` };
}

export type ProjectLike = { id: string; key: string; name: string };

/** A project from its key or name (exact first, then a unique partial name). */
export function matchProject<P extends ProjectLike>(projects: P[], query: string): Match<P> {
  const q = norm(query);
  if (!q) return { ok: false, error: "No project given." };
  const exact = projects.filter((p) => norm(p.key) === q || norm(p.name) === q);
  if (exact.length === 1) return { ok: true, value: exact[0] };
  const partial = projects.filter((p) => norm(p.name).includes(q));
  if (partial.length === 1) return { ok: true, value: partial[0] };
  if (partial.length > 1)
    return { ok: false, error: `"${query}" matches ${partial.map((p) => `${p.name} (${p.key})`).join(", ")}. Which one?` };
  return { ok: false, error: `There's no project called "${query}". Projects: ${projects.map((p) => `${p.name} (${p.key})`).join(", ")}.` };
}

/** Label ids for names, case-insensitively. Unknown names are an error naming them, not silently dropped. */
export function matchLabels<L extends { id: string; name: string }>(labels: L[], names: string[]): Match<string[]> {
  const ids: string[] = [];
  const missing: string[] = [];
  for (const n of names) {
    const hit = labels.find((l) => norm(l.name) === norm(n));
    if (hit) ids.push(hit.id);
    else missing.push(n);
  }
  if (missing.length)
    return { ok: false, error: `No label called ${missing.map((m) => `"${m}"`).join(", ")}. Labels: ${labels.map((l) => l.name).join(", ") || "none yet"}.` };
  return { ok: true, value: [...new Set(ids)] };
}
