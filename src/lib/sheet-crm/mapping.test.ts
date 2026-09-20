import { describe, expect, it } from "vitest";

import headers from "./fixtures/headers.json";
import {
  TAB_SPECS,
  TAB_SPEC_BY_ID,
  a1,
  columnLetter,
  detectHeaderRow,
  headerDrift,
  identifyTab,
  isWritableColumn,
  rowKeyFor,
  type TabId,
} from "./mapping";

const FIXTURE = headers as Record<TabId, string[]>;

describe("mapping ↔ the workbook's real header rows", () => {
  for (const spec of TAB_SPECS) {
    it(`${spec.id}: every declared (non-optional) header exists in the sheet, in order`, () => {
      const real = FIXTURE[spec.id];
      expect(real, `fixture missing for ${spec.id}`).toBeDefined();
      const declared = spec.columns.filter((c) => !c.optional).map((c) => c.header);
      expect(declared).toEqual(real);
    });

    it(`${spec.id}: the signature identifies the tab and reports no drift`, () => {
      const rows: unknown[][] = spec.bannerRows ? [["SOME BANNER TEXT"], FIXTURE[spec.id]] : [FIXTURE[spec.id]];
      const hit = identifyTab(rows);
      expect(hit?.spec.id).toBe(spec.id);
      expect(hit?.rowIndex).toBe(spec.bannerRows ?? 0);
      const drift = headerDrift(spec, FIXTURE[spec.id]);
      expect(drift.missing).toEqual([]);
      expect(drift.unknown).toEqual([]);
    });
  }

  it("signatures are unique: no header row matches two specs", () => {
    for (const spec of TAB_SPECS) {
      const matches = TAB_SPECS.filter((s) => detectHeaderRow([FIXTURE[spec.id]], s));
      expect(matches.map((m) => m.id)).toEqual([spec.id]);
    }
  });

  it("derived columns are never writable", () => {
    for (const spec of TAB_SPECS)
      for (const c of spec.columns) if (c.derived) expect(isWritableColumn(spec, c.header)).toBe(false);
  });

  it("formula columns the workbook documents are marked derived", () => {
    const people = TAB_SPEC_BY_ID.people;
    for (const h of ["lead_score", "num_empanelments", "source_count", "canonical_entity_key", "duplicate_match_ids"])
      expect(isWritableColumn(people, h)).toBe(false);
    const pi = TAB_SPEC_BY_ID.prospect_intelligence;
    expect(isWritableColumn(pi, "Opportunity Score /100")).toBe(false);
    expect(isWritableColumn(pi, "Score Band")).toBe(false);
    expect(isWritableColumn(pi, "Active Practice /20")).toBe(true);
  });
});

describe("row keys", () => {
  it("masters key on their id and never fall back", () => {
    expect(rowKeyFor(TAB_SPEC_BY_ID.people, { person_id: "P00145", full_name: "X" })).toEqual({ key: "P00145", weak: false });
    expect(rowKeyFor(TAB_SPEC_BY_ID.people, { full_name: "X" })).toBeNull();
  });
  it("GTM tabs key on Person ID and fall back to the name, flagged weak", () => {
    const rq = TAB_SPEC_BY_ID.research_queue;
    expect(rowKeyFor(rq, { "Person ID": "P02058", "Full Name": "V S S Sudheer Chekka" })).toEqual({ key: "P02058", weak: false });
    expect(rowKeyFor(rq, { "Person ID": "", "Full Name": "Someone New" })).toEqual({ key: "Someone New", weak: true });
    expect(rowKeyFor(rq, { "Person ID": " ", "Full Name": "" })).toBeNull();
  });
  it("directories without an id column use the composite key until the id column exists", () => {
    const lc = TAB_SPEC_BY_ID.lender_contacts;
    expect(rowKeyFor(lc, { institution: "Canara Bank", office_level: "Regional Office", department: "Recovery", contact_person_name: "R K" }))
      .toEqual({ key: "Canara Bank|Regional Office|Recovery|R K", weak: true });
    expect(rowKeyFor(lc, { lender_contact_id: "L0001", institution: "Canara Bank" })).toEqual({ key: "L0001", weak: false });
  });
  it("IOV rows are one per (person, membership)", () => {
    expect(rowKeyFor(TAB_SPEC_BY_ID.iov_memberships, { person_id: "P00562", iov_membership_no: "1730" })).toEqual({ key: "P00562|1730", weak: false });
  });
});

describe("A1 addressing", () => {
  it("column letters", () => {
    expect(columnLetter(0)).toBe("A");
    expect(columnLetter(25)).toBe("Z");
    expect(columnLetter(26)).toBe("AA");
    expect(columnLetter(47)).toBe("AV");
  });
  it("quotes titles with spaces and slashes", () => {
    expect(a1("Lender Contacts", 1, 0)).toBe("'Lender Contacts'!A2");
    expect(a1("Bob's tab", 0, 27)).toBe("'Bob''s tab'!AB1");
  });
});
