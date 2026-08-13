import { describe, expect, it } from "vitest";

import { docToMarkdown, docToText, markdownToDoc } from "@/lib/markdown";

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

describe("markdownToDoc", () => {
  it("returns null for empty input", () => {
    expect(markdownToDoc("")).toBeNull();
    expect(markdownToDoc("   \n\n ")).toBeNull();
  });

  it("parses headings and paragraphs", () => {
    expect(markdownToDoc("## Goals\n\nShip it.")).toEqual({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Goals" }] },
        { type: "paragraph", content: [{ type: "text", text: "Ship it." }] },
      ],
    });
  });

  it("joins wrapped lines into one paragraph", () => {
    expect(markdownToDoc("one\ntwo")).toEqual({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "one two" }] }],
    });
  });

  it("parses inline marks", () => {
    const doc = markdownToDoc("**bold** and *italic* and `code`") as {
      content: { content: unknown[] }[];
    };
    expect(doc.content[0].content).toEqual([
      { type: "text", text: "bold", marks: [{ type: "bold" }] },
      { type: "text", text: " and " },
      { type: "text", text: "italic", marks: [{ type: "italic" }] },
      { type: "text", text: " and " },
      { type: "text", text: "code", marks: [{ type: "code" }] },
    ]);
  });

  it("parses links", () => {
    const doc = markdownToDoc("see [docs](https://x.dev)") as {
      content: { content: unknown[] }[];
    };
    expect(doc.content[0].content).toEqual([
      { type: "text", text: "see " },
      {
        type: "text",
        text: "docs",
        marks: [{ type: "link", attrs: { href: "https://x.dev" } }],
      },
    ]);
  });

  it("does not re-parse markers inside code spans", () => {
    const doc = markdownToDoc("`a**b**c`") as { content: { content: unknown[] }[] };
    expect(doc.content[0].content).toEqual([
      { type: "text", text: "a**b**c", marks: [{ type: "code" }] },
    ]);
  });

  it("parses bullet, ordered and task lists", () => {
    expect(markdownToDoc("- one\n- two")).toEqual({
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "one" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "two" }] }] },
          ],
        },
      ],
    });

    const ordered = markdownToDoc("1. one\n2. two") as { content: { type: string }[] };
    expect(ordered.content[0].type).toBe("orderedList");

    const tasks = markdownToDoc("- [x] done\n- [ ] todo") as {
      content: { type: string; content: { attrs: unknown }[] }[];
    };
    expect(tasks.content[0].type).toBe("taskList");
    expect(tasks.content[0].content[0].attrs).toEqual({ checked: true });
    expect(tasks.content[0].content[1].attrs).toEqual({ checked: false });
  });

  it("nests indented list items under their parent", () => {
    const doc = markdownToDoc("- parent\n  - child") as {
      content: { content: { content: { type: string }[] }[] }[];
    };
    const parentItem = doc.content[0].content[0];
    expect(parentItem.content.map((c) => c.type)).toEqual(["paragraph", "bulletList"]);
  });

  it("parses fenced code blocks with a language", () => {
    expect(markdownToDoc("```ts\nconst a = 1\n```")).toEqual({
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: { language: "ts" },
          content: [{ type: "text", text: "const a = 1" }],
        },
      ],
    });
  });

  it("parses blockquotes and horizontal rules", () => {
    const doc = markdownToDoc("> quoted\n\n---") as { content: { type: string }[] };
    expect(doc.content.map((c) => c.type)).toEqual(["blockquote", "horizontalRule"]);
  });

  it("round-trips through docToMarkdown", () => {
    const md = [
      "# Title",
      "",
      "Some **bold** text.",
      "",
      "- one",
      "- two",
      "",
      "```ts",
      "const a = 1",
      "```",
    ].join("\n");
    expect(docToMarkdown(markdownToDoc(md))).toBe(md);
  });
});

describe("tables", () => {
  const md = ["| Task | Owner |", "| --- | --- |", "| Corpus | Gopal |", "| QA | Aparna |"].join(
    "\n",
  );

  it("parses a pipe table into header and body rows", () => {
    const doc = markdownToDoc(md) as { content: { type: string; content: unknown[] }[] };
    const table = doc.content[0];
    expect(table.type).toBe("table");
    expect(table.content).toHaveLength(3);
    const [head, first] = table.content as { content: { type: string }[] }[];
    expect(head.content.map((c) => c.type)).toEqual(["tableHeader", "tableHeader"]);
    expect(first.content.map((c) => c.type)).toEqual(["tableCell", "tableCell"]);
  });

  it("round-trips a table", () => {
    expect(docToMarkdown(markdownToDoc(md))).toBe(md);
  });

  it("pads short rows and truncates long ones to the header width", () => {
    const doc = markdownToDoc("| A | B |\n| --- | --- |\n| only |\n| x | y | z |") as {
      content: { content: { content: unknown[] }[] }[];
    };
    const rows = doc.content[0].content;
    expect(rows[1].content).toHaveLength(2);
    expect(rows[2].content).toHaveLength(2);
  });

  it("keeps escaped pipes inside a cell", () => {
    expect(docToMarkdown(markdownToDoc("| a \\| b |\n| --- |"))).toBe("| a \\| b |\n| --- |");
  });

  it("does not treat a delimiter-less pipe line as a table", () => {
    const doc = markdownToDoc("costs | benefits") as { content: { type: string }[] };
    expect(doc.content[0].type).toBe("paragraph");
  });

  it("ends a paragraph where a table begins", () => {
    const doc = markdownToDoc("intro line\n| A |\n| --- |\n| 1 |") as {
      content: { type: string }[];
    };
    expect(doc.content.map((c) => c.type)).toEqual(["paragraph", "table"]);
  });

  it("indexes table text for search with separators", () => {
    expect(docToText(markdownToDoc(md))).toContain("Corpus");
    expect(docToText(markdownToDoc(md))).not.toContain("CorpusGopal");
  });
});
