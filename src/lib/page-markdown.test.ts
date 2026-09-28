import { describe, expect, it } from "vitest";

import { markdownToDoc } from "./markdown";
import { carryBlockIds, isEditConflict, isMarkdownLossless, normalizeDoc } from "./page-markdown";

const t = (text: string, marks?: { type: string; attrs?: Record<string, unknown> }[]) => (marks ? { type: "text", text, marks } : { type: "text", text });
const p = (...content: unknown[]) => ({ type: "paragraph", attrs: { textAlign: null, indent: 0, bg: null, blockId: null }, content });
const doc = (...content: unknown[]) => ({ type: "doc", content });

describe("isMarkdownLossless", () => {
  it("accepts an empty page, in every shape the editor stores one", () => {
    expect(isMarkdownLossless(null)).toBe(true);
    expect(isMarkdownLossless({ type: "doc", content: [] })).toBe(true);
    expect(isMarkdownLossless({ type: "doc", content: [{ type: "paragraph" }] })).toBe(true);
  });

  it("accepts everything the phone's Markdown can say", () => {
    const md = [
      "# Title",
      "",
      "Some **bold**, *italic*, `code`, ~~gone~~ and a [link](https://example.com).",
      "",
      "- one",
      "- two",
      "  - nested",
      "",
      "1. first",
      "2. second",
      "",
      "- [x] done",
      "- [ ] todo",
      "",
      "> quoted",
      "",
      "```ts",
      "const a = 1;",
      "```",
      "",
      "---",
      "",
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
    ].join("\n");
    expect(isMarkdownLossless(markdownToDoc(md))).toBe(true);
  });

  it("ignores the defaults and bookkeeping the web editor writes out", () => {
    const web = doc(
      { type: "heading", attrs: { level: 2, textAlign: null, indent: 0, bg: null, blockId: "a1b2c3d4", folded: false }, content: [t("Plan")] },
      p(t("Hello "), t("world", [{ type: "link", attrs: { href: "https://x.dev", target: "_blank", rel: "noopener noreferrer nofollow", class: null } }])),
      p(),
      {
        type: "table",
        content: [
          { type: "tableRow", content: [{ type: "tableHeader", attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [p(t("A"))] }] },
          { type: "tableRow", content: [{ type: "tableCell", attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [p()] }] },
        ],
      },
    );
    expect(isMarkdownLossless(web)).toBe(true);
  });

  it("treats mark order and split text runs as the same text", () => {
    const a = doc(p(t("x", [{ type: "italic" }, { type: "link", attrs: { href: "https://a.b" } }])));
    const b = doc(p(t("x", [{ type: "link", attrs: { href: "https://a.b" } }, { type: "italic" }])));
    expect(JSON.stringify(normalizeDoc(a))).toBe(JSON.stringify(normalizeDoc(b)));
    expect(isMarkdownLossless(doc(p(t("Hel"), t("lo"))))).toBe(true);
  });

  it("rejects formatting Markdown cannot hold", () => {
    const cases: [string, unknown][] = [
      ["a callout", doc({ type: "callout", attrs: { emoji: "💡" }, content: [p(t("Note"))] })],
      ["a mention", doc(p(t("Ask "), { type: "entityRef", attrs: { kind: "issue", id: "x", label: "ENG-1" } }))],
      ["a text colour", doc(p(t("red", [{ type: "textStyle", attrs: { color: "#f00" } }])))],
      ["a highlight", doc(p(t("hi", [{ type: "highlight", attrs: { color: "yellow" } }])))],
      ["centred text", doc({ type: "paragraph", attrs: { textAlign: "center" }, content: [t("mid")] })],
      ["an indent", doc({ type: "paragraph", attrs: { indent: 2 }, content: [t("in")] })],
      ["a block colour", doc({ type: "paragraph", attrs: { bg: "blue" }, content: [t("tint")] })],
      ["a line break", doc(p(t("a"), { type: "hardBreak" }, t("b")))],
      ["an image", doc({ type: "image", attrs: { src: "https://x/y.png", caption: "" } })],
      ["a toggle", doc({ type: "details", content: [{ type: "detailsSummary", content: [t("More")] }, { type: "detailsContent", content: [p(t("Hidden"))] }] })],
      ["columns", doc({ type: "columnBlock", content: [{ type: "column", content: [p(t("L"))] }, { type: "column", content: [p(t("R"))] }] })],
      ["an issue embed", doc({ type: "issueEmbed", attrs: { filter: {} } })],
      ["a table of contents", doc({ type: "toc" }, p(t("x")))],
      ["an ordered list not starting at 1", doc({ type: "orderedList", attrs: { start: 3 }, content: [{ type: "listItem", content: [p(t("c"))] }] })],
      ["two paragraphs in one list item", doc({ type: "bulletList", content: [{ type: "listItem", content: [p(t("a")), p(t("b"))] }] })],
      ["a resized column", doc({ type: "table", content: [{ type: "tableRow", content: [{ type: "tableHeader", attrs: { colwidth: [200] }, content: [p(t("A"))] }] }, { type: "tableRow", content: [{ type: "tableCell", content: [p(t("1"))] }] }] })],
      ["a table without a header row", doc({ type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [p(t("1"))] }] }] })],
      ["bold italic together", doc(p(t("both", [{ type: "bold" }, { type: "italic" }])))],
      ["text that reads as Markdown", doc(p(t("# not a heading")))],
      ["a literal asterisk pair", doc(p(t("2*3*4")))],
    ];
    for (const [label, d] of cases) expect(isMarkdownLossless(d), label).toBe(false);
  });
});

describe("carryBlockIds", () => {
  const block = (id: string, text: string, extra: Record<string, unknown> = {}) => ({ type: "paragraph", attrs: { blockId: id, ...extra }, content: [t(text)] });
  const ids = (d: unknown) => ((d as { content: { attrs?: { blockId?: string } }[] }).content ?? []).map((b) => b.attrs?.blockId ?? null);

  it("keeps ids on unchanged blocks, even when something is inserted above them", () => {
    const before = doc(block("aaa", "one"), block("bbb", "two"));
    const after = carryBlockIds(before, markdownToDoc("zero\n\none\n\ntwo"));
    expect(ids(after)).toEqual([null, "aaa", "bbb"]);
  });

  it("keeps an edited block's id when it stays in place", () => {
    const before = doc(block("aaa", "one"), block("bbb", "two"));
    const after = carryBlockIds(before, markdownToDoc("one\n\ntwo, revised"));
    expect(ids(after)).toEqual(["aaa", "bbb"]);
  });

  it("never gives one id to two blocks, and never across block kinds", () => {
    const before = doc(block("aaa", "same"), { type: "heading", attrs: { level: 1, blockId: "hhh" }, content: [t("H")] });
    const after = carryBlockIds(before, markdownToDoc("same\n\nsame\n\n- H"));
    expect(ids(after)).toEqual(["aaa", null, null]);
  });

  it("carries a collapsed heading's fold state", () => {
    const before = doc({ type: "heading", attrs: { level: 2, folded: true }, content: [t("Details")] });
    const after = carryBlockIds(before, markdownToDoc("## Details")) as { content: { attrs: Record<string, unknown> }[] };
    expect(after.content[0].attrs.folded).toBe(true);
  });

  it("leaves an empty result alone", () => {
    expect(carryBlockIds(doc(block("aaa", "x")), null)).toBeNull();
  });
});

describe("isEditConflict", () => {
  const known = new Date("2026-09-28T10:00:00.000Z");
  it("allows the page's own timestamp and sub-second drift", () => {
    expect(isEditConflict(known, known)).toBe(false);
    expect(isEditConflict(new Date(known.getTime() + 1000), known)).toBe(false);
  });
  it("flags a write more than a second after the copy the client had", () => {
    expect(isEditConflict(new Date(known.getTime() + 1001), known)).toBe(true);
  });
});
