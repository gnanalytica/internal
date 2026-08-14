/**
 * Starting points for the documents this team writes over and over.
 *
 * The shapes here are lifted from what already exists in the wiki — a weekly
 * green/amber/red gate review, a Go/No-Go call, a metrics checkpoint table.
 * They were being retyped each time, which is both slow and lossy: the review
 * that skipped the "risks" row is the review where the risk went unsaid.
 *
 * Defined in code rather than a table, the same way statuses, priorities and
 * departments are — a template is a decision about how the team works, so it
 * belongs in the repo where it gets reviewed, not in a row someone can quietly
 * edit. Everything here is plain TipTap JSON, so a templated page is an
 * ordinary page from the moment it is created.
 */

type Node = Record<string, unknown>;

// ---- Small builders, so the templates below read as documents, not JSON ----

const text = (value: string, marks?: { type: string }[]) =>
  marks ? { type: "text", text: value, marks } : { type: "text", text: value };

const bold = (value: string) => text(value, [{ type: "bold" }]);

const p = (...content: Node[]): Node =>
  content.length === 0 ? { type: "paragraph" } : { type: "paragraph", content };

const h = (level: number, value: string): Node => ({
  type: "heading",
  attrs: { level },
  content: [text(value)],
});

// An empty string means "a blank line to fill in". ProseMirror has no such
// thing as an empty text node, so it has to become an empty paragraph instead.
const line = (value: string): Node => (value ? p(text(value)) : p());

const bullets = (...items: string[]): Node => ({
  type: "bulletList",
  content: items.map((i) => ({ type: "listItem", content: [line(i)] })),
});

const tasks = (...items: string[]): Node => ({
  type: "taskList",
  content: items.map((i) => ({
    type: "taskItem",
    attrs: { checked: false },
    content: [line(i)],
  })),
});

const callout = (emoji: string, value: string): Node => ({
  type: "callout",
  attrs: { emoji },
  content: [p(text(value))],
});

const cell = (value: string, header = false): Node => ({
  type: header ? "tableHeader" : "tableCell",
  content: [line(value)],
});

/** A table from a header row plus body rows; blank cells are left to fill in. */
const table = (headers: string[], rows: string[][]): Node => ({
  type: "table",
  content: [
    { type: "tableRow", content: headers.map((v) => cell(v, true)) },
    ...rows.map((r) => ({
      type: "tableRow",
      content: headers.map((_, i) => cell(r[i] ?? "")),
    })),
  ],
});

const doc = (...content: Node[]): Node => ({ type: "doc", content });

export type PageTemplate = {
  id: string;
  name: string;
  /** One line explaining when to reach for it, shown under the name. */
  hint: string;
  icon: string;
  /** Suggested page title; the user can still rename freely. */
  title: string;
  build: () => Node;
};

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: "gate-review",
    name: "Weekly gate review",
    hint: "Green / amber / red per track, and what changes because of it",
    icon: "🚦",
    title: "Gate review — week of ",
    build: () =>
      doc(
        h(2, "Verdict"),
        callout("🚦", "Overall: green / amber / red — and the one sentence why."),
        h(2, "Tracks"),
        table(
          ["Track", "Status", "Evidence", "Change this week"],
          [
            ["", "", "", ""],
            ["", "", "", ""],
            ["", "", "", ""],
          ],
        ),
        h(2, "Metrics"),
        table(
          ["Metric", "Target", "Actual", "Trend"],
          [
            ["", "", "", ""],
            ["", "", "", ""],
          ],
        ),
        h(2, "Risks raised"),
        bullets("", ""),
        h(2, "Decisions and owners"),
        tasks("", ""),
      ),
  },
  {
    id: "decision",
    name: "Decision record",
    hint: "What was decided, what it rules out, and what would reverse it",
    icon: "⚖️",
    title: "Decision — ",
    build: () =>
      doc(
        callout("⚖️", "Decision: … · Date: … · Decided by: …"),
        h(2, "Context"),
        p(text("What forced a choice now, and what happens if nothing is decided.")),
        h(2, "Options considered"),
        table(
          ["Option", "For", "Against", "Cost"],
          [
            ["", "", "", ""],
            ["", "", "", ""],
          ],
        ),
        h(2, "Decision"),
        p(bold("We will "), text("…")),
        h(2, "Consequences"),
        bullets(
          "What this rules out",
          "What it commits us to",
          "What we accept as the downside",
        ),
        h(2, "What would change our mind"),
        p(
          text(
            "The signal that would make us revisit this — so the decision is revisitable rather than permanent by default.",
          ),
        ),
      ),
  },
  {
    id: "go-no-go",
    name: "Go / No-Go",
    hint: "The launch gate: criteria, evidence, and the call",
    icon: "🚀",
    title: "Go / No-Go — ",
    build: () =>
      doc(
        callout("🚀", "Call: GO / NO-GO · Date: … · Made by: …"),
        h(2, "Criteria"),
        table(
          ["Criterion", "Threshold", "Actual", "Met?"],
          [
            ["", "", "", ""],
            ["", "", "", ""],
            ["", "", "", ""],
          ],
        ),
        h(2, "Open risks we are accepting"),
        bullets(""),
        h(2, "If it goes wrong"),
        p(text("The rollback, who calls it, and how long it takes.")),
        h(2, "Follow-ups"),
        tasks("", ""),
      ),
  },
  {
    id: "prd",
    name: "Spec / PRD",
    hint: "The problem, the shape of the fix, and how you'll know it worked",
    icon: "📐",
    title: "Spec — ",
    build: () =>
      doc(
        h(2, "Problem"),
        p(text("Who is stuck, on what, and how we know.")),
        h(2, "Not doing"),
        bullets("Explicitly out of scope"),
        h(2, "Proposal"),
        p(),
        h(2, "How we'll know it worked"),
        table(
          ["Signal", "Today", "Target"],
          [
            ["", "", ""],
            ["", "", ""],
          ],
        ),
        h(2, "Open questions"),
        bullets(""),
      ),
  },
  {
    id: "retro",
    name: "Retro",
    hint: "What to keep, what to change, and the one thing you'll actually do",
    icon: "🔁",
    title: "Retro — ",
    build: () =>
      doc(
        h(2, "Keep"),
        bullets(""),
        h(2, "Change"),
        bullets(""),
        h(2, "Puzzles"),
        p(text("Things we noticed but don't understand yet.")),
        h(2, "One change we're committing to"),
        callout(
          "🎯",
          "A single owned action. A retro that produces five actions produces none.",
        ),
        tasks(""),
      ),
  },
  {
    id: "meeting",
    name: "Meeting notes",
    hint: "Decisions and owners, not a transcript",
    icon: "🗒️",
    title: "Notes — ",
    build: () =>
      doc(
        p(bold("Date: "), text("… · "), bold("Present: "), text("…")),
        h(2, "Decisions"),
        bullets(""),
        h(2, "Actions"),
        tasks(""),
        h(2, "Discussed"),
        p(),
      ),
  },
];

export function findPageTemplate(id: string): PageTemplate | null {
  return PAGE_TEMPLATES.find((t) => t.id === id) ?? null;
}

/**
 * Whether a page is untouched enough to still offer templates.
 *
 * Applying a template replaces the body, so it is only offered while there is
 * nothing to lose: an empty document. Anything the user has typed — even one
 * character — takes the strip away.
 */
export function isBlankPage(content: unknown): boolean {
  if (!content || typeof content !== "object") return true;
  const node = content as { content?: unknown[] };
  const blocks = node.content;
  if (!Array.isArray(blocks) || blocks.length === 0) return true;
  // A fresh TipTap document is a single empty paragraph.
  return blocks.every((b) => {
    const block = b as { type?: string; content?: unknown[] };
    return block.type === "paragraph" && (block.content?.length ?? 0) === 0;
  });
}
