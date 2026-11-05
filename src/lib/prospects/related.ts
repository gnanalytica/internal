import type { ProspectRecord, ProspectsWorkbook } from "./parse";
import type { ProspectKind } from "./schema";

/**
 * The other rows a prospect is connected to: a valuer's firm and its other
 * valuers, a firm's partners, the banks a panel valuer works for and the
 * valuers on a bank's panel, an RVO's members. Worked out from what the sheet
 * already holds, so nothing has to be typed twice.
 */

export type Related = { kind: ProspectKind; id: string; name: string; stage: number; city: string; relation: string };

/** Lender short names the sheet uses, mapped to how institutions are written in Bank Contacts. */
const LENDER_ALIASES: Record<string, string[]> = {
  pnb: ["punjab national bank"],
  sbi: ["state bank of india"],
  boi: ["bank of india"],
  bob: ["bank of baroda"],
  ubi: ["union bank of india"],
  iob: ["indian overseas bank"],
  hdfc: ["hdfc bank"],
  icici: ["icici bank"],
  canara: ["canara bank"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

const plain = (s: string) => norm(s).replace(/\b(ltd|limited|the)\b/g, " ").replace(/\s+/g, " ").trim();

/** The ways one lender name can be written, for matching across tabs: "Canara" → "canara", "canara bank". */
export function lenderKeys(lender: string): string[] {
  const n = plain(lender);
  if (!n) return [];
  const short = n.replace(/\s*\bbank\b\s*$/, "").trim();
  return [...new Set([n, `${short} bank`, ...(LENDER_ALIASES[n] ?? []), ...(LENDER_ALIASES[short] ?? [])].filter((k) => k.length > 2))];
}

/** True when a lender named on a valuer's row is the institution on a bank contact ("Canara Bank, Hyderabad" counts). */
export function sameLender(lender: string, institution: string): boolean {
  const inst = plain(institution);
  return lenderKeys(lender).some((k) => inst === k || inst.startsWith(`${k} `));
}

/** IBBI registration numbers end in a serial, e.g. IBBI/RV/02/2018/10148 → 10148; firms list partners as "Name (10148)". */
function serial(id: string): string {
  return id.split("/").pop() ?? "";
}

const CAP = 25;

function row(r: ProspectRecord, relation: string): Related {
  return { kind: r.kind, id: r.id, name: r.name, stage: r.stage, city: r.city || r.state, relation };
}

export function relatedRecords(wb: ProspectsWorkbook, r: ProspectRecord): { items: Related[]; more: number } {
  const out: Related[] = [];
  const add = (list: ProspectRecord[], relation: string) => {
    for (const x of list) if (x.id !== r.id && !out.some((o) => o.kind === x.kind && o.id === x.id)) out.push(row(x, relation));
  };

  if (r.kind === "valuer") {
    if (r.firmRegNo) {
      add(wb.firms.filter((f) => f.id === r.firmRegNo), "Their firm");
      add(wb.valuers.filter((v) => v.firmRegNo === r.firmRegNo), "Same firm");
    }
    const s = serial(r.id);
    if (s) add(wb.firms.filter((f) => f.people.includes(`(${s})`)), "Partner in");
    add(wb.banks.filter((b) => r.lenders.some((l) => sameLender(l, b.bank.institution))), "Lender contact");
  }
  if (r.kind === "firm") {
    const serials = [...r.people.matchAll(/\((\d{4,6})\)/g)].map((m) => m[1]);
    add(wb.valuers.filter((v) => v.firmRegNo === r.id || serials.includes(serial(v.id))), "Partner or valuer");
  }
  if (r.kind === "panel") {
    add(wb.banks.filter((b) => r.lenders.some((l) => sameLender(l, b.bank.institution))), "Lender contact");
  }
  if (r.kind === "bank" && r.bank.institution) {
    add(wb.panels.filter((p) => p.lenders.some((l) => sameLender(l, r.bank.institution))), "On their panel");
    add(wb.valuers.filter((v) => v.lenders.some((l) => sameLender(l, r.bank.institution))), "On their panel");
  }
  if (r.kind === "rvo") {
    const rvo = norm(r.name);
    add(wb.valuers.filter((v) => { const n = norm(v.rvo); return n.length > 8 && (n === rvo || n.includes(rvo) || rvo.includes(n)); }), "Member");
  }

  return { items: out.slice(0, CAP), more: Math.max(0, out.length - CAP) };
}
