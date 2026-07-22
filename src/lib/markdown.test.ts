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
    expect(docToMarkdown(doc)).toBe("@ENG-1\n\n> 💡 Note");
  });

  it("prefixes callouts with their emoji, blockquotes untouched", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "callout",
          attrs: { emoji: "🔥" },
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Hot" }] },
            { type: "paragraph", content: [{ type: "text", text: "Second" }] },
          ],
        },
        {
          type: "blockquote",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Quote" }] }],
        },
      ],
    };
    expect(docToMarkdown(doc)).toBe("> 🔥 Hot\n> Second\n\n> Quote");
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

  it("renders images with captions as alt text", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "image", attrs: { src: "/x.png", caption: "Diagram" } },
        { type: "image", attrs: { src: "/y.png" } },
      ],
    };
    expect(docToMarkdown(doc)).toBe("![Diagram](/x.png)\n\n![](/y.png)");
  });

  it("renders code block language fences", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: { language: "ts" },
          content: [{ type: "text", text: "const a = 1;" }],
        },
      ],
    };
    expect(docToMarkdown(doc)).toBe("```ts\nconst a = 1;\n```");
  });

  it("renders code blocks without a language as plain fences", () => {
    const doc = {
      type: "doc",
      content: [{ type: "codeBlock", content: [{ type: "text", text: "x" }] }],
    };
    expect(docToMarkdown(doc)).toBe("```\nx\n```");
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
