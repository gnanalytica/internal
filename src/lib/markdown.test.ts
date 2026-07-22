import { describe, expect, it } from "vitest";

import { docToMarkdown } from "@/lib/markdown";

describe("docToMarkdown", () => {
  it("renders headings and paragraphs", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Goals" }] },
        { type: "paragraph", content: [{ type: "text", text: "Ship it." }] },
      ],
    };
    expect(docToMarkdown(doc)).toBe("## Goals\n\nShip it.");
  });

  it("applies inline marks", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "bold", marks: [{ type: "bold" }] },
            { type: "text", text: " and " },
            { type: "text", text: "link", marks: [{ type: "link", attrs: { href: "https://x.com" } }] },
          ],
        },
      ],
    };
    expect(docToMarkdown(doc)).toBe("**bold** and [link](https://x.com)");
  });

  it("renders bullet and task lists", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }] },
          ],
        },
        {
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "done" }] }] },
          ],
        },
      ],
    };
    expect(docToMarkdown(doc)).toBe("- a\n\n- [x] done");
  });

  it("renders @mentions and callouts", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "entityRef", attrs: { kind: "issue", id: "1", label: "ENG-1" } }] },
        { type: "callout", content: [{ type: "paragraph", content: [{ type: "text", text: "Note" }] }] },
      ],
    };
    expect(docToMarkdown(doc)).toBe("@ENG-1\n\n> Note");
  });

  it("returns empty string for empty docs", () => {
    expect(docToMarkdown(null)).toBe("");
    expect(docToMarkdown({ type: "doc" })).toBe("");
  });

  it("renders a details toggle as a bold summary plus content", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "details",
          content: [
            { type: "detailsSummary", content: [{ type: "text", text: "Rollout plan" }] },
            {
              type: "detailsContent",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "Phase one." }] },
                { type: "paragraph", content: [{ type: "text", text: "Phase two." }] },
              ],
            },
          ],
        },
      ],
    };
    expect(docToMarkdown(doc)).toBe("**Rollout plan**\n\nPhase one.\n\nPhase two.");
  });

  it("flattens columns sequentially in document order", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "columnBlock",
          content: [
            {
              type: "column",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Left" }] }],
            },
            {
              type: "column",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Right" }] }],
            },
          ],
        },
      ],
    };
    expect(docToMarkdown(doc)).toBe("Left\n\nRight");
  });

  it("omits table-of-contents blocks", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "toc" },
        { type: "paragraph", content: [{ type: "text", text: "Body" }] },
      ],
    };
    expect(docToMarkdown(doc)).toBe("Body");
  });

  it("ignores indent and textAlign attributes on paragraphs", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { indent: 3, textAlign: "center" },
          content: [{ type: "text", text: "Indented" }],
        },
      ],
    };
    expect(docToMarkdown(doc)).toBe("Indented");
  });
});
