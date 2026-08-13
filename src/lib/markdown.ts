/** Convert between a TipTap document (JSON) and Markdown. Pure and
 *  dependency-free. */

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
    case "callout": {
      const emoji = node.type === "callout" ? `${node.attrs?.emoji ?? "💡"} ` : "";
      return (node.content ?? [])
        .map((c, i) => `> ${i === 0 ? emoji : ""}${block(c, depth)}`)
        .join("\n");
    }
    case "codeBlock":
      return `\`\`\`${node.attrs?.language ?? ""}\n${inline(node.content)}\n\`\`\``;
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
    case "table": {
      const rows = (node.content ?? []).filter((r) => r.type === "tableRow");
      if (rows.length === 0) return "";
      const width = Math.max(...rows.map((r) => (r.content ?? []).length));
      const cell = (c: Node) =>
        inline(c.content).replace(/\n+/g, " ").replace(/\|/g, "\\|").trim();
      const render = (r: Node) => {
        const cells = (r.content ?? []).map(cell);
        while (cells.length < width) cells.push("");
        return `| ${cells.join(" | ")} |`;
      };
      const divider = `| ${Array.from({ length: width }, () => "---").join(" | ")} |`;
      // A table without a header row still needs one to stay valid GFM.
      const headed = (rows[0].content ?? []).some((c) => c.type === "tableHeader");
      const head = headed ? render(rows[0]) : `|${" |".repeat(width)}`;
      const body = (headed ? rows.slice(1) : rows).map(render);
      return [head, divider, ...body].join("\n");
    }
    case "image":
      return `![${node.attrs?.caption ?? ""}](${node.attrs?.src ?? ""})`;
    case "issueEmbed":
      return "_[embedded issue view]_";
    case "details": {
      const summary = (node.content ?? []).find((c) => c.type === "detailsSummary");
      const body = (node.content ?? []).find((c) => c.type === "detailsContent");
      const parts = [`**${inline(summary?.content)}**`];
      for (const c of body?.content ?? []) parts.push(block(c, depth));
      return parts.filter((s) => s.length > 0).join("\n\n");
    }
    case "columnBlock":
      return (node.content ?? [])
        .map((col) =>
          (col.content ?? [])
            .map((c) => block(c, depth))
            .filter((s) => s.length > 0)
            .join("\n\n"),
        )
        .filter((s) => s.length > 0)
        .join("\n\n");
    case "toc":
      return "";
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

/** Flatten a TipTap document to plain text (used for the search index). */
export function docToText(doc: unknown): string {
  if (!doc || typeof doc !== "object") return "";
  const node = doc as { type?: string; text?: string; content?: unknown[] };
  if (typeof node.text === "string") return node.text;
  if (Array.isArray(node.content)) {
    const sep =
      node.type === "doc" ||
      node.type === "bulletList" ||
      node.type === "orderedList" ||
      node.type === "table" ||
      node.type === "tableRow"
        ? "\n"
        : "";
    return node.content.map(docToText).join(sep);
  }
  return "";
}

// ---- Markdown -> TipTap ----
// The inverse of `docToMarkdown` over the subset API clients (and agents)
// actually write. Anything unrecognised degrades to a paragraph rather than
// throwing, so a bad heading never costs the user their content.

type Mark = { type: string; attrs?: Record<string, unknown> };

const INLINE_RE =
  /`([^`]+)`|\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|~~([\s\S]+?)~~|\*([\s\S]+?)\*|\[([^\]]*)\]\(([^)\s]*)\)/;

function inlineNodes(src: string, marks: Mark[] = []): Node[] {
  const out: Node[] = [];
  const push = (text: string, m: Mark[]) => {
    if (text) out.push(m.length ? { type: "text", text, marks: m } : { type: "text", text });
  };

  let rest = src;
  while (rest.length > 0) {
    const m = INLINE_RE.exec(rest);
    if (!m) {
      push(rest, marks);
      break;
    }
    push(rest.slice(0, m.index), marks);
    // `code` is literal — its content is never re-parsed for other marks.
    if (m[1] !== undefined) push(m[1], [...marks, { type: "code" }]);
    else if (m[2] !== undefined) out.push(...inlineNodes(m[2], [...marks, { type: "bold" }]));
    else if (m[3] !== undefined) out.push(...inlineNodes(m[3], [...marks, { type: "bold" }]));
    else if (m[4] !== undefined) out.push(...inlineNodes(m[4], [...marks, { type: "strike" }]));
    else if (m[5] !== undefined) out.push(...inlineNodes(m[5], [...marks, { type: "italic" }]));
    else
      out.push(
        ...inlineNodes(m[6] ?? "", [
          ...marks,
          { type: "link", attrs: { href: m[7] ?? "" } },
        ]),
      );
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

function paragraph(text: string): Node {
  const content = inlineNodes(text);
  return content.length > 0 ? { type: "paragraph", content } : { type: "paragraph" };
}

type ListKind = "bulletList" | "orderedList" | "taskList";
type ListLine = { kind: ListKind; indent: number; text: string; checked: boolean };

function listLine(line: string): ListLine | null {
  const m = /^(\s*)(?:[-*+]|(\d+)[.)])\s+(.*)$/.exec(line);
  if (!m) return null;
  const indent = m[1].length;
  const text = m[3];
  if (m[2] !== undefined) return { kind: "orderedList", indent, text, checked: false };
  const task = /^\[([ xX])\]\s*(.*)$/.exec(text);
  if (task)
    return {
      kind: "taskList",
      indent,
      text: task[2],
      checked: task[1].toLowerCase() === "x",
    };
  return { kind: "bulletList", indent, text, checked: false };
}

/** Split one pipe-table row into trimmed cells, honouring `\|` escapes. */
function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = "";
  for (let k = 0; k < s.length; k++) {
    if (s[k] === "\\" && s[k + 1] === "|") {
      cur += "|";
      k++;
    } else if (s[k] === "|") {
      cells.push(cur.trim());
      cur = "";
    } else {
      cur += s[k];
    }
  }
  cells.push(cur.trim());
  return cells;
}

/** `|---|:--:|` — the row that turns the line above it into a table header. */
function isDelimiterRow(line: string | undefined): boolean {
  if (!line || !line.includes("-")) return false;
  const cells = splitRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

/** A GFM table starts where a pipe line is followed by a delimiter row. */
function startsTable(lines: string[], i: number): boolean {
  return lines[i].includes("|") && isDelimiterRow(lines[i + 1]);
}

function tableRow(cells: string[], header: boolean, width: number): Node {
  return {
    type: "tableRow",
    content: Array.from({ length: width }, (_, k) => ({
      type: header ? "tableHeader" : "tableCell",
      attrs: { colspan: 1, rowspan: 1, colwidth: null },
      content: [paragraph(cells[k] ?? "")],
    })),
  };
}

/** Build one (possibly nested) list starting at `i`. Returns the node and the
 *  index of the first line that is not part of it. */
function parseList(lines: ListLine[], i: number): [Node, number] {
  const base = lines[i].indent;
  const kind = lines[i].kind;
  const items: Node[] = [];

  while (i < lines.length && lines[i].indent >= base) {
    const cur = lines[i];
    if (cur.indent > base) {
      const [child, next] = parseList(lines, i);
      const prev = items[items.length - 1];
      if (prev) (prev.content ??= []).push(child);
      else items.push({ type: "listItem", content: [child] });
      i = next;
      continue;
    }
    if (cur.kind !== kind) break;
    const item: Node = {
      type: kind === "taskList" ? "taskItem" : "listItem",
      content: [paragraph(cur.text)],
    };
    if (kind === "taskList") item.attrs = { checked: cur.checked };
    items.push(item);
    i++;
  }
  return [{ type: kind, content: items }, i];
}

/**
 * Parse Markdown into a TipTap document. Returns `null` for empty input so
 * callers can store a null body rather than an empty doc.
 */
export function markdownToDoc(md: string): unknown | null {
  const src = (md ?? "").replace(/\r\n?/g, "\n");
  if (!src.trim()) return null;

  const lines = src.split("\n");
  const content: Node[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // Fenced code block.
    const fence = /^\s*```(\S*)\s*$/.exec(line);
    if (fence) {
      const language = fence[1] || null;
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) body.push(lines[i++]);
      i++; // closing fence (or EOF)
      content.push({
        type: "codeBlock",
        attrs: { language },
        content: body.length ? [{ type: "text", text: body.join("\n") }] : undefined,
      });
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      content.push({
        type: "heading",
        attrs: { level: heading[1].length },
        content: inlineNodes(heading[2]),
      });
      i++;
      continue;
    }

    if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
      content.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    // Blockquote — consume the whole run of `>` lines.
    if (/^\s*>\s?/.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i]))
        quoted.push(lines[i++].replace(/^\s*>\s?/, ""));
      content.push({
        type: "blockquote",
        content: quoted.filter((q) => q.trim()).map(paragraph),
      });
      continue;
    }

    // Pipe table — header, delimiter, then body rows. Rows are padded or
    // truncated to the header width so the table stays rectangular.
    if (startsTable(lines, i)) {
      const width = splitRow(line).length;
      const rows: Node[] = [tableRow(splitRow(line), true, width)];
      i += 2;
      while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
        rows.push(tableRow(splitRow(lines[i]), false, width));
        i++;
      }
      content.push({ type: "table", content: rows });
      continue;
    }

    // Lists — consume the whole run so nesting is handled in one pass.
    if (listLine(line)) {
      const run: ListLine[] = [];
      while (i < lines.length) {
        const parsed = listLine(lines[i]);
        if (!parsed) break;
        run.push(parsed);
        i++;
      }
      let j = 0;
      while (j < run.length) {
        const [node, next] = parseList(run, j);
        content.push(node);
        j = next;
      }
      continue;
    }

    // Paragraph — join consecutive plain lines until a blank line or a line
    // that starts a different block.
    const para: string[] = [];
    while (i < lines.length) {
      const l = lines[i];
      if (
        !l.trim() ||
        /^(#{1,6})\s+/.test(l) ||
        /^\s*>\s?/.test(l) ||
        /^\s*```/.test(l) ||
        /^\s*(?:---+|\*\*\*+|___+)\s*$/.test(l) ||
        startsTable(lines, i) ||
        listLine(l)
      )
        break;
      para.push(l.trim());
      i++;
    }
    content.push(paragraph(para.join(" ")));
  }

  return content.length > 0 ? { type: "doc", content } : null;
}
