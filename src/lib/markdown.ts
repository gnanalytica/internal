/** Convert a TipTap document (JSON) to Markdown. Pure and dependency-free. */

type Node = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: Node[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

function inline(nodes: Node[] | undefined): string {
  if (!nodes) return "";
  return nodes
    .map((n) => {
      if (n.type === "entityRef") return `@${n.attrs?.label ?? ""}`;
      if (n.type === "hardBreak") return "\n";
      if (n.type !== "text") return inline(n.content);
      let t = n.text ?? "";
      for (const m of n.marks ?? []) {
        if (m.type === "bold") t = `**${t}**`;
        else if (m.type === "italic") t = `*${t}*`;
        else if (m.type === "code") t = `\`${t}\``;
        else if (m.type === "strike") t = `~~${t}~~`;
        else if (m.type === "link") t = `[${t}](${m.attrs?.href ?? ""})`;
      }
      return t;
    })
    .join("");
}

function block(node: Node, depth = 0): string {
  switch (node.type) {
    case "heading": {
      const level = Number(node.attrs?.level ?? 1);
      return `${"#".repeat(level)} ${inline(node.content)}`;
    }
    case "paragraph":
      return inline(node.content);
    case "blockquote":
    case "callout":
      return (node.content ?? [])
        .map((c) => `> ${block(c, depth)}`)
        .join("\n");
    case "codeBlock":
      return `\`\`\`\n${inline(node.content)}\n\`\`\``;
    case "horizontalRule":
      return "---";
    case "bulletList":
      return (node.content ?? [])
        .map((li) => `${"  ".repeat(depth)}- ${listItem(li, depth)}`)
        .join("\n");
    case "orderedList":
      return (node.content ?? [])
        .map((li, i) => `${"  ".repeat(depth)}${i + 1}. ${listItem(li, depth)}`)
        .join("\n");
    case "taskList":
      return (node.content ?? [])
        .map((li) => {
          const checked = li.attrs?.checked ? "x" : " ";
          return `${"  ".repeat(depth)}- [${checked}] ${listItem(li, depth)}`;
        })
        .join("\n");
    case "issueEmbed":
      return "_[embedded issue view]_";
    default:
      return inline(node.content);
  }
}

function listItem(li: Node, depth: number): string {
  // A list item's first paragraph is inline; nested lists indent.
  const parts: string[] = [];
  for (const c of li.content ?? []) {
    if (c.type === "bulletList" || c.type === "orderedList" || c.type === "taskList") {
      parts.push("\n" + block(c, depth + 1));
    } else {
      parts.push(inline(c.content));
    }
  }
  return parts.join("");
}

export function docToMarkdown(doc: unknown): string {
  const root = doc as Node | null;
  if (!root || !Array.isArray(root.content)) return "";
  return root.content
    .map((n) => block(n))
    .filter((s) => s.length > 0)
    .join("\n\n");
}
