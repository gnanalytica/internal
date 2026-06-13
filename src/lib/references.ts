export type RefKind = "issue" | "page" | "project";

export type ExtractedRef = { targetType: RefKind; targetId: string };

const KINDS = new Set<RefKind>(["issue", "page", "project"]);

export function isRefKind(v: unknown): v is RefKind {
  return typeof v === "string" && KINDS.has(v as RefKind);
}

export function entityHref(kind: RefKind, id: string): string {
  switch (kind) {
    case "issue":
      return `/issues/${id}`;
    case "page":
      return `/pages/${id}`;
    case "project":
      return `/projects/${id}`;
  }
}

/**
 * Walk a TipTap document and collect the distinct entity references embedded in
 * it (nodes of type `entityRef` with `{ kind, id }` attrs).
 */
export function extractReferences(doc: unknown): ExtractedRef[] {
  const out: ExtractedRef[] = [];
  const seen = new Set<string>();

  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; attrs?: Record<string, unknown>; content?: unknown[] };
    if (n.type === "entityRef" && n.attrs && isRefKind(n.attrs.kind) && typeof n.attrs.id === "string") {
      const key = `${n.attrs.kind}:${n.attrs.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ targetType: n.attrs.kind, targetId: n.attrs.id });
      }
    }
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };

  walk(doc);
  return out;
}
