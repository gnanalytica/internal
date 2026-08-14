/**
 * Mapping a support ticket onto a task.
 *
 * Kept pure and separate from the action that writes it, because this is the
 * part that can be quietly wrong — a priority that silently lands as "none", a
 * body that arrives as one run-on paragraph — in a way no type check catches
 * and only someone reading the converted task would notice.
 */

/**
 * Support priorities onto task priorities. Only "normal" differs in name, but
 * the map is explicit so a new ticket priority fails loudly in review rather
 * than silently becoming "none".
 */
const PRIORITY: Record<string, string> = {
  urgent: "urgent",
  high: "high",
  normal: "medium",
  low: "low",
};

export type TicketSource = {
  subject: string;
  body: string | null;
  priority: string;
  projectId: string | null;
  assigneeId: string | null;
};

export type IssueFields = {
  title: string;
  /** TipTap document, or null when the ticket had no body worth carrying. */
  description: { type: "doc"; content: unknown[] } | null;
  status: string;
  priority: string;
  type: string;
  projectId: string | null;
  assigneeId: string | null;
};

/**
 * A plain-text ticket body as an editor document.
 *
 * Blank lines separate paragraphs, and single newlines become hard breaks, so
 * a report written as several paragraphs still reads as several paragraphs —
 * dropping it into one text node turned every ticket into a wall.
 */
export function bodyToDoc(body: string | null): IssueFields["description"] {
  const trimmed = body?.trim();
  if (!trimmed) return null;

  const paragraphs = trimmed
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return {
    type: "doc",
    content: paragraphs.map((block) => {
      // Within a paragraph, a lone newline is a line break, not a new block.
      const lines = block.split("\n");
      const content: unknown[] = [];
      lines.forEach((lineText, i) => {
        if (i > 0) content.push({ type: "hardBreak" });
        // ProseMirror rejects empty text nodes; a blank line inside a block
        // contributes only its break.
        if (lineText) content.push({ type: "text", text: lineText });
      });
      return { type: "paragraph", content };
    }),
  };
}

/** The task a ticket becomes. */
export function ticketToIssueFields(ticket: TicketSource): IssueFields {
  return {
    // A ticket always has a subject, but an empty one would produce a nameless
    // task that is impossible to find again.
    title: ticket.subject.trim() || "Untitled ticket",
    description: bodyToDoc(ticket.body),
    // Converted work is committed work — it goes to Todo, not the backlog.
    status: "todo",
    priority: PRIORITY[ticket.priority] ?? "none",
    // Support work is rarely engineering-only; "ops" is the honest default and
    // the type picker is one click away on the task.
    type: "ops",
    projectId: ticket.projectId,
    assigneeId: ticket.assigneeId,
  };
}
