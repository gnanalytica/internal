import { describe, expect, it } from "vitest";

import {
  countBySourceBucket,
  groupByTheme,
  groupRoadmap,
  matchThemes,
  progressByFeature,
  quoteText,
  sourceBucket,
  themeKey,
  themeNames,
  themeOf,
  themeToSave,
  ticketsLabel,
  titleFromQuote,
  voicesByFeature,
  voicesLabel,
} from "./product-roadmap";

describe("quotes", () => {
  it("reads the body, or the title for older items without one", () => {
    expect(quoteText({ body: " Show me which fields it guessed. ", title: "x" })).toBe("Show me which fields it guessed.");
    expect(quoteText({ body: null, title: "Slow PDF" })).toBe("Slow PDF");
    expect(quoteText({ body: "  ", title: "Slow PDF" })).toBe("Slow PDF");
  });
  it("titles a new item from the quote's first line, cut at a word", () => {
    expect(titleFromQuote("  Short one.\nSecond line")).toBe("Short one.");
    const long = "If one number is wrong the bank sends it back to me, not to you, and then I lose the whole case";
    const t = titleFromQuote(long);
    expect(t.endsWith("…")).toBe(true);
    expect(t.length).toBeLessThanOrEqual(81);
    expect(long.startsWith(t.slice(0, -1))).toBe(true);
  });
});

const fb = (id: string, title: string, theme: string | null, featureId: string | null = null) => ({ id, title, theme, featureId });

describe("groupRoadmap", () => {
  it("puts building in Now, planned in Next, idea in Later and keeps shipped apart", () => {
    const g = groupRoadmap([
      { id: "a", status: "building" },
      { id: "b", status: "idea" },
      { id: "c", status: "shipped" },
      { id: "d", status: "planned" },
      { id: "e", status: "building" },
    ]);
    expect(g.columns.building.map((f) => f.id)).toEqual(["a", "e"]);
    expect(g.columns.planned.map((f) => f.id)).toEqual(["d"]);
    expect(g.columns.idea.map((f) => f.id)).toEqual(["b"]);
    expect(g.shipped.map((f) => f.id)).toEqual(["c"]);
  });
  it("leaves archived and unknown statuses off the roadmap", () => {
    const g = groupRoadmap([{ status: "archived" }, { status: "weird" }]);
    expect(Object.values(g.columns).flat()).toHaveLength(0);
    expect(g.shipped).toHaveLength(0);
  });
});

describe("progressByFeature", () => {
  it("rolls up done of total per feature, skipping canceled and unlinked tickets", () => {
    const p = progressByFeature([
      { featureId: "f1", status: "done" },
      { featureId: "f1", status: "in_progress" },
      { featureId: "f1", status: "canceled" },
      { featureId: "f2", status: "done" },
      { featureId: null, status: "done" },
    ]);
    expect(p.get("f1")).toEqual({ done: 1, total: 2, pct: 50 });
    expect(p.get("f2")).toEqual({ done: 1, total: 1, pct: 100 });
    expect(p.has("null")).toBe(false);
    expect(p.size).toBe(2);
  });
});

describe("labels", () => {
  it("counts voices", () => {
    expect(voicesLabel(0)).toBe("No voices yet");
    expect(voicesLabel(1)).toBe("1 voice");
    expect(voicesLabel(4)).toBe("4 voices");
  });
  it("counts tickets", () => {
    expect(ticketsLabel({ done: 0, total: 0 })).toBe("No tickets yet");
    expect(ticketsLabel({ done: 0, total: 1 })).toBe("0 of 1 ticket");
    expect(ticketsLabel({ done: 2, total: 5 })).toBe("2 of 5 tickets");
  });
});

describe("voicesByFeature", () => {
  it("counts linked feedback per feature", () => {
    const v = voicesByFeature([{ featureId: "a" }, { featureId: "a" }, { featureId: null }, { featureId: "b" }]);
    expect(v.get("a")).toBe(2);
    expect(v.get("b")).toBe(1);
    expect(v.size).toBe(2);
  });
});

describe("source buckets", () => {
  it("folds six sources into four buckets", () => {
    expect(sourceBucket("sales").id).toBe("prospects");
    expect(sourceBucket("customer").id).toBe("customers");
    expect(sourceBucket("support").id).toBe("customers");
    expect(sourceBucket("interview").id).toBe("interviews");
    expect(sourceBucket("internal").id).toBe("team");
    expect(sourceBucket("other").id).toBe("team");
    expect(sourceBucket("nonsense").id).toBe("team");
  });
  it("counts items per bucket, zero for empty buckets", () => {
    expect(countBySourceBucket([{ source: "sales" }, { source: "sales" }, { source: "support" }, { source: "other" }])).toEqual({
      prospects: 2,
      customers: 1,
      interviews: 0,
      team: 1,
    });
  });
});

describe("themes", () => {
  it("reads an item with no theme as Unsorted", () => {
    expect(themeOf({ theme: null })).toBe("Unsorted");
    expect(themeOf({ theme: "  " })).toBe("Unsorted");
    expect(themeOf({ theme: " Trust " })).toBe("Trust");
  });
  it("saves an existing theme's spelling, and blank or Unsorted as none", () => {
    expect(themeToSave("trust  in ai", ["Trust in AI"])).toBe("Trust in AI");
    expect(themeToSave(" New one ", ["Trust in AI"])).toBe("New one");
    expect(themeToSave("  ", ["Trust in AI"])).toBeNull();
    expect(themeToSave(undefined, [])).toBeNull();
    expect(themeToSave("unsorted", [])).toBeNull();
  });
  it("matches themes regardless of case and spacing", () => {
    expect(themeKey("  Willingness   to Pay ")).toBe("willingness to pay");
  });
  it("groups items by theme, biggest first, keeping the first spelling", () => {
    const groups = groupByTheme([
      fb("1", "a", "Pricing"),
      fb("2", "b", "Trust in AI"),
      fb("3", "c", "trust in ai"),
      fb("4", "Trust in AI", null),
    ]);
    expect(groups.map((g) => [g.name, g.items.map((i) => i.id)])).toEqual([
      ["Trust in AI", ["2", "3"]],
      ["Pricing", ["1"]],
      ["Unsorted", ["4"]],
    ]);
  });
  it("puts Unsorted last however big it is, and never offers it as a theme", () => {
    const items = [fb("1", "a", null), fb("2", "b", null), fb("3", "c", "Pricing")];
    expect(groupByTheme(items).map((g) => g.name)).toEqual(["Pricing", "Unsorted"]);
    expect(themeNames(items)).toEqual(["Pricing"]);
  });
  it("orders equal-sized themes by name", () => {
    expect(groupByTheme([fb("1", "x", "Zeta"), fb("2", "y", "Alpha")]).map((g) => g.name)).toEqual(["Alpha", "Zeta"]);
  });
  it("reads a theme's feature as the one most of its items point at", () => {
    const [g] = groupByTheme([fb("1", "x", "T", "f1"), fb("2", "x", "T", "f2"), fb("3", "x", "T", "f2"), fb("4", "x", "T")]);
    expect(g.featureId).toBe("f2");
    expect(g.mixed).toBe(true);
  });
  it("is unlinked when no item points at a feature, and not mixed when all agree", () => {
    expect(groupByTheme([fb("1", "x", "T")])[0]).toMatchObject({ featureId: null, mixed: false });
    expect(groupByTheme([fb("1", "x", "T", "f"), fb("2", "y", "T", "f")])[0]).toMatchObject({ featureId: "f", mixed: false });
  });
  it("lists theme names most used first and filters them by what is typed", () => {
    const names = themeNames([fb("1", "x", "Pricing"), fb("2", "x", "Trust"), fb("3", "x", "trust")]);
    expect(names).toEqual(["Trust", "Pricing"]);
    expect(matchThemes(names, "PRI")).toEqual(["Pricing"]);
    expect(matchThemes(names, "")).toEqual(["Trust", "Pricing"]);
    expect(matchThemes(names, "", 1)).toEqual(["Trust"]);
  });
});
