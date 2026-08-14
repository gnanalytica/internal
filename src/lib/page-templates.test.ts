import { describe, expect, it } from "vitest";

import { docToMarkdown, docToText } from "@/lib/markdown";
import {
  PAGE_TEMPLATES,
  findPageTemplate,
  isBlankPage,
} from "@/lib/page-templates";

type Node = { type?: string; text?: string; content?: Node[]; attrs?: Record<string, unknown> };

function walk(node: Node, visit: (n: Node) => void) {
  visit(node);
  for (const child of node.content ?? []) walk(child, visit);
}

describe("PAGE_TEMPLATES", () => {
  it("has unique ids", () => {
    const ids = PAGE_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(PAGE_TEMPLATES.map((t) => [t.id, t] as const))(
    "%s builds a valid document",
    (_id, template) => {
      const doc = template.build() as Node;
      expect(doc.type).toBe("doc");
      expect(doc.content?.length ?? 0).toBeGreaterThan(0);
    },
  );

  it.each(PAGE_TEMPLATES.map((t) => [t.id, t] as const))(
    "%s contains no empty text nodes, which ProseMirror rejects",
    (_id, template) => {
      const offenders: string[] = [];
      walk(template.build() as Node, (n) => {
        if (n.type === "text" && !n.text) offenders.push(JSON.stringify(n));
      });
      expect(offenders).toEqual([]);
    },
  );

  it.each(PAGE_TEMPLATES.map((t) => [t.id, t] as const))(
    "%s survives the markdown exporter",
    (_id, template) => {
      // Export is how these leave the app; a template that crashes or empties
      // it would be found only when someone tried to share the doc.
      const md = docToMarkdown(template.build() as never);
      expect(typeof md).toBe("string");
      expect(md.trim().length).toBeGreaterThan(0);
    },
  );

  it.each(PAGE_TEMPLATES.map((t) => [t.id, t] as const))(
    "%s yields searchable text, so a templated page is findable",
    (_id, template) => {
      expect(docToText(template.build() as never).trim().length).toBeGreaterThan(0);
    },
  );

  it("builds a fresh document each time, so two pages never share nodes", () => {
    const a = PAGE_TEMPLATES[0].build();
    const b = PAGE_TEMPLATES[0].build();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  it("gives every table a header row", () => {
    for (const template of PAGE_TEMPLATES) {
      walk(template.build() as Node, (n) => {
        if (n.type !== "table") return;
        const firstRow = n.content?.[0];
        expect(firstRow?.content?.every((c) => c.type === "tableHeader")).toBe(true);
      });
    }
  });
});

describe("findPageTemplate", () => {
  it("finds by id and returns null for anything else", () => {
    expect(findPageTemplate(PAGE_TEMPLATES[0].id)?.id).toBe(PAGE_TEMPLATES[0].id);
    expect(findPageTemplate("nope")).toBeNull();
  });
});

describe("isBlankPage", () => {
  it("treats null, undefined and an empty doc as blank", () => {
    expect(isBlankPage(null)).toBe(true);
    expect(isBlankPage(undefined)).toBe(true);
    expect(isBlankPage({ type: "doc", content: [] })).toBe(true);
  });

  it("treats a fresh editor's single empty paragraph as blank", () => {
    expect(isBlankPage({ type: "doc", content: [{ type: "paragraph" }] })).toBe(true);
    expect(
      isBlankPage({ type: "doc", content: [{ type: "paragraph", content: [] }] }),
    ).toBe(true);
  });

  it("stops offering templates once there is anything to lose", () => {
    expect(
      isBlankPage({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }],
      }),
    ).toBe(false);
    // Even a non-paragraph block with no text is content someone made.
    expect(isBlankPage({ type: "doc", content: [{ type: "horizontalRule" }] })).toBe(false);
  });

  it("never reports a built template as blank", () => {
    for (const t of PAGE_TEMPLATES) {
      expect(isBlankPage(t.build())).toBe(false);
    }
  });
});
