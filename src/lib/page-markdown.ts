/**
 * Whether a page body can be edited as Markdown without losing anything, and
 * the helpers that make a Markdown save safe for what the web editor keeps
 * alongside the text. Pure, so the rules can be tested without a database.
 *
 * The phone edits page bodies as Markdown, and the web stores TipTap JSON.
 * `docToMarkdown` drops what Markdown cannot say (colours, callouts, toggles,
 * columns, mentions, embeds, alignment, line breaks…), so writing a Markdown
 * edit back over such a page would silently strip it. A page is editable as
 * Markdown only when converting it to Markdown and back yields the same
 * document, compared after normalising away what carries no meaning.
 */
import { docToMarkdown, markdownToDoc } from "@/lib/markdown";

type Mark = { type: string; attrs?: Record<string, unknown> };
type Node = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: Node[];
  marks?: Mark[];
};

/** Attribute values that mean "not set" — TipTap writes them out explicitly. */
const DEFAULT_ATTRS: Record<string, unknown> = {
  indent: 0,
  colspan: 1,
  rowspan: 1,
  start: 1,
  checked: false,
};

/**
 * Attributes that are bookkeeping rather than content: `blockId` anchors page
 * comments and links, `folded` is whether a heading is collapsed on the web.
 * A Markdown save carries both over with `carryBlockIds`.
 */
const CARRIED_ATTRS = ["blockId", "folded"] as const;
const IGNORED_ATTRS = new Set<string>(CARRIED_ATTRS);

/** Nodes whose children are inline text. */
const TEXTBLOCKS = new Set(["paragraph", "heading", "codeBlock"]);

function normAttrs(type: string | undefined, attrs: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(attrs ?? {}).sort()) {
    const v = attrs![key];
    if (IGNORED_ATTRS.has(key)) continue;
    if (v === null || v === undefined || v === "") continue;
    if (key in DEFAULT_ATTRS && DEFAULT_ATTRS[key] === v) continue;
    out[key] = v;
  }
  // A heading without a level renders as h1.
  if (type === "heading") out.level = Number(out.level ?? 1);
  return Object.keys(out).length ? out : undefined;
}

function normMarks(marks: Mark[] | undefined): Mark[] | undefined {
  if (!marks?.length) return undefined;
  const out = marks.map((m) => {
    // A link's target/rel/class come from the editor's configuration, not the
    // document: the web adds them to every link it renders.
    if (m.type === "link") return { type: "link", attrs: { href: String(m.attrs?.href ?? "") } };
    const attrs = normAttrs(m.type, m.attrs);
    return attrs ? { type: m.type, attrs } : { type: m.type };
  });
  out.sort((a, b) => (a.type === b.type ? JSON.stringify(a).localeCompare(JSON.stringify(b)) : a.type.localeCompare(b.type)));
  return out;
}

/** Merge neighbouring text runs with the same marks, as the editor does. */
function mergeText(nodes: Node[]): Node[] {
  const out: Node[] = [];
  for (const n of nodes) {
    const prev = out[out.length - 1];
    if (n.type === "text" && prev?.type === "text" && JSON.stringify(prev.marks ?? null) === JSON.stringify(n.marks ?? null)) {
      out[out.length - 1] = { ...prev, text: (prev.text ?? "") + (n.text ?? "") };
    } else out.push(n);
  }
  return out;
}

/** Leading and trailing spaces of a block are invisible, and Markdown trims them. */
function trimEdges(nodes: Node[]): Node[] {
  const out = nodes.map((n) => ({ ...n }));
  const first = out[0];
  if (first?.type === "text") first.text = (first.text ?? "").replace(/^\s+/, "");
  const last = out[out.length - 1];
  if (last?.type === "text") last.text = (last.text ?? "").replace(/\s+$/, "");
  return out.filter((n) => n.type !== "text" || (n.text ?? "") !== "");
}

function normNode(node: Node): Node | null {
  if (!node || typeof node !== "object") return null;
  if (node.type === "text") {
    if (!node.text) return null;
    const marks = normMarks(node.marks);
    return marks ? { type: "text", text: node.text, marks } : { type: "text", text: node.text };
  }
  const out: Node = { type: node.type };
  const attrs = normAttrs(node.type, node.attrs);
  if (attrs) out.attrs = attrs;
  let children = (node.content ?? []).map(normNode).filter((c): c is Node => c !== null);
  children = mergeText(children);
  if (node.type && TEXTBLOCKS.has(node.type) && node.type !== "codeBlock") children = trimEdges(children);
  // An empty paragraph is a blank line: Markdown has no way to keep one, and
  // nothing is lost without it.
  children = children.filter((c) => !(c.type === "paragraph" && !c.content?.length && !c.attrs));
  if (children.length) out.content = children;
  return out;
}

/** A canonical form of a TipTap document for comparing meaning, not bytes. */
export function normalizeDoc(doc: unknown): Node {
  const root = doc && typeof doc === "object" ? (doc as Node) : null;
  const normalized = root ? normNode({ ...root, type: "doc" }) : null;
  return normalized ?? { type: "doc" };
}

/** True when the document survives a trip through Markdown unchanged. */
export function isMarkdownLossless(doc: unknown): boolean {
  const before = normalizeDoc(doc);
  const after = normalizeDoc(markdownToDoc(docToMarkdown(doc)));
  return JSON.stringify(before) === JSON.stringify(after);
}

/**
 * Give the blocks of a Markdown-parsed document the `blockId`s their
 * counterparts had, so page comments anchored to a block stay anchored after a
 * phone edit. Unchanged blocks keep their id wherever they moved to; an edited
 * block keeps the id of the block of the same kind it replaced at the same
 * place. New blocks get none — the web editor assigns ids when it next loads.
 */
export function carryBlockIds(previous: unknown, next: unknown): unknown {
  const prev = (previous as Node | null)?.content ?? [];
  const root = next as Node | null;
  if (!root || !Array.isArray(root.content)) return next;

  const olds = prev.map((b, i) => ({
    // Blocks without an id are still matched, so their fold state carries.
    id: typeof b?.attrs?.blockId === "string" ? (b.attrs.blockId as string) : `#${i}`,
    type: b?.type,
    key: JSON.stringify(normNode(b)),
    carried: Object.fromEntries(CARRIED_ATTRS.filter((k) => b?.attrs?.[k] != null && b.attrs[k] !== false).map((k) => [k, b.attrs![k]])),
  }));
  const used = new Set<string>();
  const assigned: (Record<string, unknown> | null)[] = root.content.map(() => null);
  const keys = root.content.map((b) => JSON.stringify(normNode(b)));

  root.content.forEach((b, j) => {
    const match = olds.find((o) => !used.has(o.id) && o.type === b.type && o.key === keys[j]);
    if (match) {
      assigned[j] = match.carried;
      used.add(match.id);
    }
  });
  root.content.forEach((b, j) => {
    if (assigned[j]) return;
    const o = olds[j];
    if (o && !used.has(o.id) && o.type === b.type) {
      assigned[j] = o.carried;
      used.add(o.id);
    }
  });

  return {
    ...root,
    content: root.content.map((b, j) => {
      const carried = assigned[j];
      return carried && Object.keys(carried).length ? { ...b, attrs: { ...(b.attrs ?? {}), ...carried } } : b;
    }),
  };
}

/** The web's conflict rule: the stored page was written more than a second after the copy the client edited. */
export const CONFLICT_TOLERANCE_MS = 1000;

export function isEditConflict(currentUpdatedAt: Date, knownUpdatedAt: Date): boolean {
  return currentUpdatedAt.getTime() - knownUpdatedAt.getTime() > CONFLICT_TOLERANCE_MS;
}
