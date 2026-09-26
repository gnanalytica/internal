/**
 * Find values sitting in the wrong column.
 *
 * Every rule here is "this column has a known shape, and this cell does not fit
 * it" — a URL column holding a paragraph, a Yes/No column holding a sentence, a
 * lowercase-hyphenated vocabulary holding `High`. Those are not typos: on rows
 * 5605-5612 they come in runs, which is what a write that started one column
 * off looks like.
 *
 * It reports; it does not repair. The repair is `sheet-repair-misplaced-values`,
 * which fixes only the classes where the correct destination is provable.
 * Inferring the rest would move real research into the wrong column, which is
 * the defect, not the fix.
 *
 * `pnpm sheet:audit-values`
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { readRange } from "../src/lib/sheet-crm/sheets-api";

const c = (v: unknown) => (v ?? "").toString().trim();
const L = (i: number) => {
  let n = i, s = "";
  while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
  return s;
};

type Rule = { kind: "enum"; values: string[] } | { kind: "url" } | { kind: "number" } | { kind: "short"; max: number };

/**
 * Vocabularies are the observed live values, not an aspiration.
 *
 * `best_first_channel` and `research_status` are deliberately absent. Both are
 * free text (see rule 10 of SHEET-WRITER-RULES.md) — "WhatsApp first, then short
 * founder call" is the useful answer, and an earlier version of this file
 * asserted an enum for them and reported 19 healthy cells as broken on every
 * run. An alarm is only worth having if it is not noisy.
 */
const PEOPLE_RULES: Record<string, Rule> = {
  ibbi_asset_class: { kind: "enum", values: ["Land and Building", "Land & Building"] },
  iov_approved_valuer: { kind: "enum", values: ["Yes", "No"] },
  iov_match_confidence: { kind: "enum", values: ["high", "medium-ambiguous-name", "low-state-mismatch", "Unknown"] },
  research_confidence: { kind: "enum", values: ["High", "Medium", "Low"] },
  whatsapp_available: { kind: "enum", values: ["Unknown", "Likely (Indian mobile)", "Yes", "No"] },
  is_institutional: { kind: "enum", values: ["Yes", "No"] },
  priority: { kind: "enum", values: ["A", "B", "C", "D", "WATCH"] },
  score_band: { kind: "enum", values: ["A", "B", "C", "D"] },
  website: { kind: "url" },
  linkedin: { kind: "url" },
  opportunity_score: { kind: "number" },
  lead_score: { kind: "number" },
  company_link_source: { kind: "short", max: 40 },
  data_quality_flag: { kind: "short", max: 130 },
  remarks: { kind: "short", max: 4000 },
};

const COMPANY_RULES: Record<string, Rule> = {
  research_confidence: { kind: "enum", values: ["High", "Medium", "Low"] },
  website: { kind: "url" },
  linkedin: { kind: "url" },
  asset_classes: { kind: "short", max: 90 },
};

function offends(rule: Rule, v: string): string | null {
  switch (rule.kind) {
    case "enum": {
      if (rule.values.includes(v)) return null;
      const ci = rule.values.find((a) => a.toLowerCase() === v.toLowerCase());
      if (ci) return `case differs from "${ci}"`;
      return "not in the column's vocabulary";
    }
    case "url":
      // A value that CONTAINS a URL is an annotated link, not a misplaced value:
      // "possible but unconfirmed: https://… (profile reads …)" is honest
      // research and flagging it forever teaches people to ignore this report.
      if (/https?:\/\//i.test(v) || /^www\./i.test(v)) return null;
      return v.length > 40 ? "prose in a URL column" : "not a URL";
    case "number":
      return /^-?\d+(\.\d+)?$/.test(v) ? null : "not a number";
    case "short":
      // A short value is fine; only a run-on paragraph says the write went astray.
      return v.length > rule.max ? `${v.length} chars in a column that holds labels` : null;
  }
}

async function audit(tab: string, idCol: string, rules: Record<string, Rule>) {
  const grid = await readRange(`${process.env.VALYTICA_CRM_SHEET_ID}`, `'${tab}'!A1:BZ6200`);
  const headers = (grid[0] ?? []).map(c);
  const findings: { row: number; id: string; col: string; letter: string; why: string; value: string }[] = [];

  grid.slice(1).forEach((r, i) => {
    const id = c(r[headers.indexOf(idCol)]);
    if (!id) return;
    for (const [col, rule] of Object.entries(rules)) {
      const ci = headers.indexOf(col);
      if (ci < 0) continue;
      const v = c(r[ci]);
      if (!v) continue;
      const why = offends(rule, v);
      if (why) findings.push({ row: i + 2, id, col, letter: L(ci), why, value: v });
    }
  });

  console.log(`\n##### ${tab} — ${findings.length} cell(s) in the wrong shape`);
  const byCol = new Map<string, typeof findings>();
  findings.forEach((f) => { if (!byCol.has(f.col)) byCol.set(f.col, []); byCol.get(f.col)!.push(f); });
  for (const [col, fs] of [...byCol.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const reasons = new Map<string, number>();
    fs.forEach((f) => reasons.set(f.why, (reasons.get(f.why) ?? 0) + 1));
    console.log(`  ${String(fs.length).padStart(4)}  ${fs[0].letter.padEnd(3)} ${col.padEnd(22)} ${[...reasons].map(([w, n]) => `${w} (${n})`).join(", ")}`);
  }

  const byRow = new Map<number, typeof findings>();
  findings.forEach((f) => { if (!byRow.has(f.row)) byRow.set(f.row, []); byRow.get(f.row)!.push(f); });
  const runs = [...byRow.entries()].filter(([, fs]) => fs.length > 1).sort((a, b) => a[0] - b[0]);
  if (runs.length) {
    console.log(`\n  ${runs.length} row(s) offend in more than one column — the shape of a shifted write:`);
    for (const [row, fs] of runs) console.log(`    row ${String(row).padStart(5)}  ${fs[0].id.padEnd(8)} ${fs.map((f) => f.col).join(" + ")}`);
  }
  return findings;
}

async function main() {
  if (!process.env.VALYTICA_CRM_SHEET_ID) throw new Error("VALYTICA_CRM_SHEET_ID is not set");
  await audit("People", "person_id", PEOPLE_RULES);
  await audit("Companies", "company_id", COMPANY_RULES);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
