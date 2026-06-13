export type Heading = { level: number; text: string };

type Node = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: Node[];
};

function textOf(node: Node): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "entityRef") return `@${node.attrs?.label ?? ""}`;
  return (node.content ?? []).map(textOf).join("");
}

/**
 * Extract headings (h1–h3) from a TipTap document in document order. The index
 * of each heading matches the order of <h1>/<h2>/<h3> elements the editor
 * renders, so a TOC can scroll to the Nth heading by position.
 */
export function extractHeadings(doc: unknown): Heading[] {
  const root = doc as Node | null;
  if (!root || !Array.isArray(root.content)) return [];
  const out: Heading[] = [];
  const walk = (node: Node) => {
    if (node.type === "heading") {
      const text = textOf(node).trim();
      if (text) out.push({ level: Number(node.attrs?.level ?? 1), text });
    }
    (node.content ?? []).forEach(walk);
  };
  root.content.forEach(walk);
  return out;
}
