import { describe, expect, it } from "vitest";

import { docToMarkdown, docToText } from "@/lib/markdown";
import { bodyToDoc, ticketToIssueFields, type TicketSource } from "@/lib/ticket-to-issue";

function ticket(partial: Partial<TicketSource> = {}): TicketSource {
  return {
    subject: "Valuation report fails to generate",
    body: null,
    priority: "normal",
    projectId: "p1",
    assigneeId: null,
    ...partial,
  };
}

type Node = { type?: string; text?: string; content?: Node[] };

function walk(node: Node, visit: (n: Node) => void) {
  visit(node);
  for (const child of node.content ?? []) walk(child, visit);
}

describe("bodyToDoc", () => {
  it("returns null for a body with nothing in it", () => {
    expect(bodyToDoc(null)).toBeNull();
    expect(bodyToDoc("")).toBeNull();
    expect(bodyToDoc("   \n\n  ")).toBeNull();
  });

  it("splits blank-line-separated blocks into separate paragraphs", () => {
    const doc = bodyToDoc("First problem.\n\nSecond problem.")!;
    expect(doc.content).toHaveLength(2);
    expect(docToText(doc)).toContain("First problem.");
    expect(docToText(doc)).toContain("Second problem.");
  });

  it("keeps a single newline as a break inside one paragraph", () => {
    const doc = bodyToDoc("Line one\nLine two")!;
    expect(doc.content).toHaveLength(1);
    const breaks: string[] = [];
    walk(doc as Node, (n) => {
      if (n.type === "hardBreak") breaks.push("br");
    });
    expect(breaks).toHaveLength(1);
  });

  it("never emits an empty text node, which ProseMirror rejects", () => {
    // Ragged input is the norm for pasted support mail.
    const doc = bodyToDoc("A\n\n\n B \n\n\nC\n")!;
    const empties: string[] = [];
    walk(doc as Node, (n) => {
      if (n.type === "text" && !n.text) empties.push(JSON.stringify(n));
    });
    expect(empties).toEqual([]);
  });

  it("produces a document the exporter can render", () => {
    const md = docToMarkdown(bodyToDoc("Steps:\n\n1 upload\n2 crash"));
    expect(md).toContain("Steps:");
    expect(md).toContain("upload");
  });
});

describe("ticketToIssueFields", () => {
  it("maps every support priority onto a task priority", () => {
    expect(ticketToIssueFields(ticket({ priority: "urgent" })).priority).toBe("urgent");
    expect(ticketToIssueFields(ticket({ priority: "high" })).priority).toBe("high");
    // The one that differs in name — a silent miss here would land as "none".
    expect(ticketToIssueFields(ticket({ priority: "normal" })).priority).toBe("medium");
    expect(ticketToIssueFields(ticket({ priority: "low" })).priority).toBe("low");
  });

  it("falls back to no priority for an unrecognised one", () => {
    expect(ticketToIssueFields(ticket({ priority: "blocker" })).priority).toBe("none");
  });

  it("carries subject, project and assignee across", () => {
    const f = ticketToIssueFields(
      ticket({ subject: "Report fails", projectId: "proj", assigneeId: "user" }),
    );
    expect(f.title).toBe("Report fails");
    expect(f.projectId).toBe("proj");
    expect(f.assigneeId).toBe("user");
  });

  it("never produces a nameless task", () => {
    expect(ticketToIssueFields(ticket({ subject: "   " })).title).toBe("Untitled ticket");
  });

  it("lands the task in Todo as ops work, not the backlog", () => {
    const f = ticketToIssueFields(ticket());
    expect(f.status).toBe("todo");
    expect(f.type).toBe("ops");
  });
});
