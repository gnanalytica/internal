import { z } from "zod";

import type { ProspectRecord } from "./parse";
import { KIND_LABEL, LINKEDIN_COLUMNS, LINKEDIN_HOW_MET } from "./schema";

/**
 * Adding a LinkedIn lead: the one place the dashboard creates a prospect
 * rather than editing one the registers already gave us. Pure, so the ID,
 * the duplicate check and the row layout are tested rather than trusted.
 */

export const newLeadSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  linkedinUrl: z.string().trim().max(500).default(""),
  headline: z.string().trim().max(300).default(""),
  company: z.string().trim().max(200).default(""),
  city: z.string().trim().max(100).default(""),
  state: z.string().trim().max(100).default(""),
  phone: z.string().trim().max(40).default(""),
  email: z.string().trim().max(200).default(""),
  howMet: z.enum(LINKEDIN_HOW_MET).default("We found them"),
  notes: z.string().trim().max(5000).default(""),
  assigned: z.string().trim().max(100).default(""),
  /** Add it even though it looks like someone already in the sheet. */
  force: z.boolean().default(false),
});

export type NewLeadInput = z.input<typeof newLeadSchema>;
export type NewLead = z.output<typeof newLeadSchema>;

/** LI-0001, LI-0002, … — one past the highest already used, so deleted rows never get their ID reused. */
export function nextLeadId(existing: string[]): string {
  const max = existing.reduce((m, v) => {
    const n = /^LI-(\d+)$/.exec(v.trim());
    return n ? Math.max(m, Number(n[1])) : m;
  }, 0);
  return `LI-${String(max + 1).padStart(4, "0")}`;
}

/**
 * A profile link as one canonical string, so the same person pasted from the
 * app, the browser or a share sheet is recognised: https, no "www."/country
 * subdomain, no query or trailing slash, lower case. "" when it isn't a
 * LinkedIn profile or company page.
 */
export function canonicalLinkedInUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return "";
  }
  if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return "";
  const path = decodeURIComponent(u.pathname).replace(/\/+$/, "").toLowerCase();
  if (!/^\/(in|company|pub)\/[^/]+/.test(path)) return "";
  return `https://linkedin.com${path.split("/").slice(0, 3).join("/")}`;
}

/** The last 10 digits, which is how an Indian number reads with or without +91 / 0. */
const phoneKey = (p: string) => p.replace(/\D/g, "").slice(-10);

export type DuplicateMatch = { kind: ProspectRecord["kind"]; id: string; name: string; why: string };

/**
 * Records that look like the same person: same profile link, same email, or
 * same phone, on any tab — a valuer we already have from the IBBI register
 * often turns up on LinkedIn too.
 */
export function findDuplicates(lead: Pick<NewLead, "linkedinUrl" | "email" | "phone">, records: ProspectRecord[]): DuplicateMatch[] {
  const url = canonicalLinkedInUrl(lead.linkedinUrl);
  const email = lead.email.trim().toLowerCase();
  const phone = phoneKey(lead.phone);
  const out: DuplicateMatch[] = [];
  for (const r of records) {
    let why = "";
    if (url && canonicalLinkedInUrl(r.linkedin.url) === url) why = "same LinkedIn profile";
    else if (email && r.email.trim().toLowerCase() === email) why = "same email";
    else if (phone.length === 10 && phoneKey(r.phone) === phone) why = "same phone";
    if (why) out.push({ kind: r.kind, id: r.id, name: r.name, why });
  }
  return out;
}

export function duplicateMessage(d: DuplicateMatch[]): string {
  const first = d[0];
  const more = d.length > 1 ? ` (and ${d.length - 1} more)` : "";
  return `Looks like ${first.name || first.id} — ${KIND_LABEL[first.kind].one.toLowerCase()}, ${first.why}${more}.`;
}

/** The new row in the tab's own column order, read from its header — unknown headers stay blank. */
export function leadRow(id: string, lead: NewLead, by: string, todayIso: string, header: unknown[]): string[] {
  const byColumn: Partial<Record<(typeof LINKEDIN_COLUMNS)[number], string>> = {
    lead_id: id,
    name: lead.name,
    headline: lead.headline,
    company: lead.company,
    city: lead.city,
    state: lead.state,
    linkedin_url: canonicalLinkedInUrl(lead.linkedinUrl) || lead.linkedinUrl,
    phone: lead.phone,
    email: lead.email,
    how_met: lead.howMet,
    added_by: by,
    added_on: todayIso,
    status: "Not contacted",
    assigned: lead.assigned || by,
    notes: lead.notes,
  };
  return header.map((h) => byColumn[String(h ?? "").trim() as keyof typeof byColumn] ?? "");
}
